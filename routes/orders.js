const express = require('express');
const router = express.Router();
const { pool } = require('../db/init');
const { requireAdmin } = require('./auth');

async function getOrderWithItems(id) {
  const oRes = await pool.query("SELECT * FROM orders WHERE id = $1", [id]);
  if (!oRes.rows.length) return null;
  const order = oRes.rows[0];
  const iRes = await pool.query("SELECT * FROM order_items WHERE order_id = $1", [id]);
  order.items = iRes.rows;
  // Format date com timezone de Brasília
  order.created_at = new Date(order.created_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  return order;
}

// GET all orders (admin)
router.get('/', requireAdmin, async (req, res) => {
  const { status } = req.query;
  try {
    let q = "SELECT * FROM orders";
    const params = [];
    if (status && status !== 'todos') {
      q += " WHERE status = $1";
      params.push(status);
    }
    q += " ORDER BY created_at DESC";
    const result = await pool.query(q, params);
    const orders = result.rows;
    // attach items
    for (const o of orders) {
      const iRes = await pool.query("SELECT * FROM order_items WHERE order_id = $1", [o.id]);
      o.items = iRes.rows;
      // Formatar data para horário de Brasília
      o.created_at = new Date(o.created_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    }
    res.json(orders);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET novos pedidos desde um timestamp (para notificação em tempo real)
router.get('/new-since/:ts', requireAdmin, async (req, res) => {
  try {
    const tsMs = parseInt(req.params.ts);
    if (isNaN(tsMs)) return res.status(400).json({ error: 'Timestamp inválido' });
    // Converte o timestamp do navegador (epoch UTC) para o horário de Brasília
    // gravado no banco — independente do fuso do servidor. Corrige notificações atrasadas em 3h.
    const result = await pool.query(
      `SELECT id, client_name, client_phone, total, address, complement,
              delivery_type, payment, change_for, observations
       FROM orders
       WHERE created_at > (to_timestamp($1 / 1000.0) AT TIME ZONE 'America/Sao_Paulo')
         AND status = 'pendente'
       ORDER BY created_at ASC`,
      [tsMs]
    );
    // Anexa os itens de cada pedido (para o card de notificação do admin)
    for (const o of result.rows) {
      const it = await pool.query(
        "SELECT product_name, quantity FROM order_items WHERE order_id = $1",
        [o.id]
      );
      o.items = it.rows;
    }
    res.json(result.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET status público do pedido — retorna SÓ id e status (sem dados pessoais),
// para o cliente acompanhar o pedido na tela "Meu pedido"
router.get('/:id/status', async (req, res) => {
  try {
    const r = await pool.query("SELECT id, status FROM orders WHERE id = $1", [parseInt(req.params.id)]);
    if (!r.rows.length) return res.status(404).json({ error: 'Pedido não encontrado' });
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET single order (admin — protege dados pessoais dos clientes)
router.get('/:id', requireAdmin, async (req, res) => {
  try {
    const order = await getOrderWithItems(parseInt(req.params.id));
    if (!order) return res.status(404).json({ error: 'Pedido não encontrado' });
    res.json(order);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST create order
router.post('/', async (req, res) => {
  const { client_name, client_phone, address, complement, delivery_type, payment, change_for, items, observations, delivery_fee_override } = req.body;
  if (!client_name || !client_phone || !items?.length)
    return res.status(400).json({ error: 'Campos obrigatórios ausentes' });

  // Validação dos itens — evita totais NaN ou valores absurdos
  for (const i of items) {
    const qty = parseInt(i.quantity);
    const price = parseFloat(i.unit_price);
    if (!i.name || isNaN(qty) || qty < 1 || qty > 100 || isNaN(price) || price < 0) {
      return res.status(400).json({ error: 'Item do pedido inválido' });
    }
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const subtotal = items.reduce((s, i) => s + (parseFloat(i.unit_price) * parseInt(i.quantity)), 0);
    const delivery_fee = delivery_fee_override != null ? parseFloat(delivery_fee_override) : 0;
    const total = subtotal + delivery_fee;

    const oRes = await client.query(
      `INSERT INTO orders
        (client_name, client_phone, address, complement, delivery_type, payment, change_for, subtotal, delivery_fee, total, observations)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [client_name, client_phone, address || '', complement || '',
       delivery_type || 'entrega', payment || 'dinheiro',
       change_for ? parseFloat(change_for) : null,
       subtotal, delivery_fee, total, observations || '']
    );
    const order = oRes.rows[0];

    for (const item of items) {
      const itemSubtotal = parseFloat(item.unit_price) * parseInt(item.quantity);
      await client.query(
        `INSERT INTO order_items (order_id, product_id, product_name, product_emoji, quantity, unit_price, subtotal)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [order.id, item.id || null, item.name, item.emoji || '🍽',
         parseInt(item.quantity), parseFloat(item.unit_price), itemSubtotal]
      );
    }

    await client.query('COMMIT');

    const fullOrder = await getOrderWithItems(order.id);
    res.status(201).json(fullOrder);
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

// PATCH update status
router.patch('/:id/status', requireAdmin, async (req, res) => {
  const { status } = req.body;
  const valid = ['pendente','preparo','entrega','entregue','cancelado'];
  if (!valid.includes(status)) return res.status(400).json({ error: 'Status inválido' });
  try {
    await pool.query("UPDATE orders SET status = $1 WHERE id = $2", [status, parseInt(req.params.id)]);
    res.json({ success: true, status });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET stats summary (admin)
router.get('/stats/summary', requireAdmin, async (req, res) => {
  try {
    const [tot, pend, deliv, rev, todayRev, todayOrd] = await Promise.all([
      pool.query("SELECT COUNT(*) FROM orders WHERE status != 'cancelado'"),
      pool.query("SELECT COUNT(*) FROM orders WHERE status = 'pendente'"),
      pool.query("SELECT COUNT(*) FROM orders WHERE status = 'entrega'"),
      pool.query("SELECT COALESCE(SUM(total),0) as s FROM orders WHERE status != 'cancelado'"),
      pool.query("SELECT COALESCE(SUM(total),0) as s FROM orders WHERE status != 'cancelado' AND DATE(created_at) = CURRENT_DATE"),
      pool.query("SELECT COUNT(*) FROM orders WHERE DATE(created_at) = CURRENT_DATE"),
    ]);
    res.json({
      total_orders: parseInt(tot.rows[0].count),
      pending: parseInt(pend.rows[0].count),
      in_delivery: parseInt(deliv.rows[0].count),
      revenue: parseFloat(rev.rows[0].s),
      today_revenue: parseFloat(todayRev.rows[0].s),
      today_orders: parseInt(todayOrd.rows[0].count),
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE reset all orders (admin only - DANGER!)
router.delete('/reset-all', requireAdmin, async (req, res) => {
  try {
    // Delete all order items first (foreign key constraint)
    await pool.query("DELETE FROM order_items");
    // Delete all orders
    await pool.query("DELETE FROM orders");
    // Reset the sequence to start from 1 again
    await pool.query("ALTER SEQUENCE orders_id_seq RESTART WITH 1");
    res.json({ 
      success: true, 
      message: 'Todos os pedidos e faturamento foram resetados com sucesso!' 
    });
  } catch (e) { 
    res.status(500).json({ error: e.message }); 
  }
});

// DELETE individual order (admin only)
router.delete('/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    // Verificar se pedido existe
    const orderCheck = await pool.query('SELECT id, status FROM orders WHERE id = $1', [id]);
    if (orderCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Pedido não encontrado' });
    }
    
    // Só permite excluir pedidos finalizados (entregue ou cancelado)
    const status = orderCheck.rows[0].status;
    if (status !== 'entregue' && status !== 'cancelado') {
      return res.status(400).json({ 
        error: 'Só é permitido excluir pedidos entregues ou cancelados. Cancele o pedido primeiro.' 
      });
    }
    
    // Delete order items first (foreign key constraint)
    await pool.query('DELETE FROM order_items WHERE order_id = $1', [id]);
    
    // Delete the order
    await pool.query('DELETE FROM orders WHERE id = $1', [id]);
    
    res.json({ 
      success: true, 
      message: 'Pedido excluído com sucesso!' 
    });
  } catch (e) { 
    res.status(500).json({ error: e.message }); 
  }
});

// ── AUTO-FINALIZAÇÃO DE PEDIDOS ──────────────────────────────
// Se o estabelecimento esquecer de marcar como entregue, o sistema marca sozinho:
// pedidos não finalizados (pendente/preparo/entrega) há mais de 3 horas viram 'entregue'.
// Roda a cada 10 minutos. Pedidos cancelados nunca são alterados.
setInterval(async () => {
  try {
    const r = await pool.query(
      "UPDATE orders SET status = 'entregue' WHERE status IN ('pendente','preparo','entrega') AND created_at < NOW() - INTERVAL '3 hours'"
    );
    if (r.rowCount > 0) console.log(`✅ Auto-finalização: ${r.rowCount} pedido(s) antigos marcados como entregues`);
  } catch (e) { console.error('Erro na auto-finalização:', e.message); }
}, 10 * 60 * 1000);

module.exports = router;
