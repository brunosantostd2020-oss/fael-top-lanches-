const express = require('express');
const router = express.Router();
const { pool } = require('../db/init');
const { requireAdmin } = require('./auth');

// Criar tabela de cupons (chamado no init)
async function initCuponsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS cupons (
      id SERIAL PRIMARY KEY,
      codigo TEXT UNIQUE NOT NULL,
      desconto_percent NUMERIC(5,2) NOT NULL DEFAULT 2,
      usos_maximos INTEGER NOT NULL DEFAULT 5,
      usos_atuais INTEGER NOT NULL DEFAULT 0,
      expira_em TIMESTAMP NOT NULL,
      ativo BOOLEAN DEFAULT true,
      criado_em TIMESTAMP DEFAULT NOW()
    )
  `);
  // Migrations seguras — ADD COLUMN IF NOT EXISTS
  await pool.query(`ALTER TABLE cupons ADD COLUMN IF NOT EXISTS valor_minimo NUMERIC(10,2) DEFAULT 0`);
  await pool.query(`ALTER TABLE cupons ADD COLUMN IF NOT EXISTS destaque BOOLEAN DEFAULT false`);
}
initCuponsTable().catch(console.error);

// POST /api/cupons/validar — público (cliente usa)
router.post('/validar', async (req, res) => {
  const { codigo, subtotal } = req.body;
  if (!codigo) return res.status(400).json({ error: 'Informe o cupom' });
  try {
    const r = await pool.query(
      "SELECT * FROM cupons WHERE UPPER(codigo) = UPPER($1)", [codigo.trim()]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Cupom inválido' });
    const c = r.rows[0];
    if (!c.ativo) return res.status(400).json({ error: 'Cupom desativado' });
    if (new Date() > new Date(c.expira_em)) return res.status(400).json({ error: 'Cupom expirado' });
    if (c.usos_atuais >= c.usos_maximos) return res.status(400).json({ error: 'Cupom esgotado' });
    const valorMinimo = parseFloat(c.valor_minimo) || 0;
    const sub = parseFloat(subtotal) || 0;
    if (valorMinimo > 0 && sub < valorMinimo) {
      return res.status(400).json({
        error: 'Pedido minimo para este cupom: R$ ' + valorMinimo.toFixed(2).replace('.', ','),
        valor_minimo: valorMinimo
      });
    }
    res.json({
      valido: true,
      codigo: c.codigo,
      desconto_percent: parseFloat(c.desconto_percent),
      usos_restantes: c.usos_maximos - c.usos_atuais,
      valor_minimo: valorMinimo
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/cupons/usar — chamado ao finalizar pedido
router.post('/usar', async (req, res) => {
  const { codigo, subtotal } = req.body;
  if (!codigo) return res.status(400).json({ error: 'Informe o cupom' });
  try {
    const r = await pool.query(
      "SELECT * FROM cupons WHERE UPPER(codigo) = UPPER($1)", [codigo.trim()]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Cupom inválido' });
    const c = r.rows[0];
    if (!c.ativo || new Date() > new Date(c.expira_em) || c.usos_atuais >= c.usos_maximos)
      return res.status(400).json({ error: 'Cupom não pode ser usado' });
    const valorMinimo = parseFloat(c.valor_minimo) || 0;
    if (valorMinimo > 0 && (parseFloat(subtotal) || 0) < valorMinimo)
      return res.status(400).json({ error: 'Pedido nao atinge o minimo deste cupom' });
    await pool.query(
      "UPDATE cupons SET usos_atuais = usos_atuais + 1 WHERE id = $1", [c.id]
    );
    res.json({ sucesso: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/cupons/gerar — admin gera lote
router.post('/gerar', requireAdmin, async (req, res) => {
  const { quantidade, desconto_percent, usos_maximos, horas_validade, valor_minimo } = req.body;
  const qtd = parseInt(quantidade) || 10;
  let desc = parseFloat(desconto_percent);
  if (isNaN(desc) || desc <= 0) desc = 2;
  if (desc > 100) desc = 100; // nunca permite desconto acima de 100%
  const usos = parseInt(usos_maximos) || 5;
  const horas = parseInt(horas_validade) || 2;
  let valorMin = parseFloat(valor_minimo);
  if (isNaN(valorMin) || valorMin < 0) valorMin = 0;
  if (qtd > 1000) return res.status(400).json({ error: 'Máximo 1000 por vez' });

  const expira = new Date(Date.now() + horas * 60 * 60 * 1000);
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const gerados = [];
  let tentativas = 0;

  while (gerados.length < qtd && tentativas < qtd * 5) {
    tentativas++;
    let cod = 'FAEL-';
    for (let i = 0; i < 6; i++) cod += chars[Math.floor(Math.random() * chars.length)];
    try {
      const r = await pool.query(
        "INSERT INTO cupons (codigo, desconto_percent, usos_maximos, expira_em, valor_minimo) VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING",
        [cod, desc, usos, expira, valorMin]
      );
      if (r.rowCount > 0) gerados.push(cod); // só conta se realmente inseriu
    } catch (e) { /* skip duplicates */ }
  }

  res.json({ gerados, total: gerados.length, expira_em: expira });
});

// GET /api/cupons/destaque — público, retorna o cupom marcado pra aparecer no banner do site (se ainda valido)
router.get('/destaque', async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT * FROM cupons
       WHERE destaque = true AND ativo = true
         AND expira_em > NOW() AND usos_atuais < usos_maximos
       LIMIT 1`
    );
    if (!r.rows.length) return res.json(null);
    const c = r.rows[0];
    res.json({
      codigo: c.codigo,
      desconto_percent: parseFloat(c.desconto_percent),
      valor_minimo: parseFloat(c.valor_minimo) || 0,
      expira_em: c.expira_em
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/cupons — admin lista cupons (com total vendido por cada um)
router.get('/', requireAdmin, async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT c.*,
        COALESCE((SELECT SUM(o.total) FROM orders o WHERE o.coupon_code = c.codigo AND o.status != 'cancelado'), 0) AS total_vendas,
        COALESCE((SELECT COUNT(*) FROM orders o WHERE o.coupon_code = c.codigo AND o.status != 'cancelado'), 0) AS qtd_pedidos
      FROM cupons c
      ORDER BY c.criado_em DESC LIMIT 200
    `);
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PATCH /api/cupons/:id/destaque — marca/desmarca este cupom para aparecer no banner (so um por vez)
router.patch('/:id/destaque', requireAdmin, async (req, res) => {
  try {
    const cur = await pool.query("SELECT destaque FROM cupons WHERE id = $1", [req.params.id]);
    if (!cur.rows.length) return res.status(404).json({ error: 'Cupom não encontrado' });
    const novoValor = !cur.rows[0].destaque;
    if (novoValor) await pool.query("UPDATE cupons SET destaque = false"); // so um cupom em destaque por vez
    await pool.query("UPDATE cupons SET destaque = $1 WHERE id = $2", [novoValor, req.params.id]);
    res.json({ sucesso: true, destaque: novoValor });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/cupons/:id — apaga cupom permanentemente
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    await pool.query("DELETE FROM cupons WHERE id = $1", [req.params.id]);
    res.json({ sucesso: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/cupons — apaga TODOS os cupons (reset geral)
router.delete('/', requireAdmin, async (req, res) => {
  try {
    const r = await pool.query("DELETE FROM cupons");
    res.json({ sucesso: true, apagados: r.rowCount });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Reset automático toda quinta-feira às 18:00 (horário de Brasília)
function agendarResetQuinta() {
  function proximaQuintaAs18() {
    const agora = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
    const diaSemana = agora.getDay(); // 0=dom, 4=qui
    let diasAteQuinta = (4 - diaSemana + 7) % 7;
    if (diasAteQuinta === 0 && (agora.getHours() > 18 || (agora.getHours() === 18 && agora.getMinutes() > 0))) {
      diasAteQuinta = 7; // já passou das 18h de quinta, pega a próxima
    }
    const proxQuinta = new Date(agora);
    proxQuinta.setDate(agora.getDate() + diasAteQuinta);
    proxQuinta.setHours(18, 0, 0, 0);
    return proxQuinta.getTime() - agora.getTime();
  }

  const msAteQuinta = proximaQuintaAs18();
  console.log(`⏰ Reset de cupons agendado em ${Math.round(msAteQuinta/1000/60)} minutos`);

  setTimeout(async function executarReset() {
    try {
      await pool.query("DELETE FROM cupons");
      console.log('🗑️ Reset automático de cupons executado (quinta 18h)');
    } catch (e) {
      console.error('Erro no reset automático de cupons:', e.message);
    }
    // Reagendar para a próxima quinta
    setTimeout(executarReset, proximaQuintaAs18());
  }, msAteQuinta);
}
agendarResetQuinta();

module.exports = router;
