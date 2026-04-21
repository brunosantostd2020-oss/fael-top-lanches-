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
}
initCuponsTable().catch(console.error);

// POST /api/cupons/validar — público (cliente usa)
router.post('/validar', async (req, res) => {
  const { codigo } = req.body;
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
    res.json({
      valido: true,
      codigo: c.codigo,
      desconto_percent: parseFloat(c.desconto_percent),
      usos_restantes: c.usos_maximos - c.usos_atuais
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/cupons/usar — chamado ao finalizar pedido
router.post('/usar', async (req, res) => {
  const { codigo } = req.body;
  if (!codigo) return res.status(400).json({ error: 'Informe o cupom' });
  try {
    const r = await pool.query(
      "SELECT * FROM cupons WHERE UPPER(codigo) = UPPER($1)", [codigo.trim()]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Cupom inválido' });
    const c = r.rows[0];
    if (!c.ativo || new Date() > new Date(c.expira_em) || c.usos_atuais >= c.usos_maximos)
      return res.status(400).json({ error: 'Cupom não pode ser usado' });
    await pool.query(
      "UPDATE cupons SET usos_atuais = usos_atuais + 1 WHERE id = $1", [c.id]
    );
    res.json({ sucesso: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/cupons/gerar — admin gera lote
router.post('/gerar', requireAdmin, async (req, res) => {
  const { quantidade, desconto_percent, usos_maximos, horas_validade } = req.body;
  const qtd = parseInt(quantidade) || 10;
  const desc = parseFloat(desconto_percent) || 2;
  const usos = parseInt(usos_maximos) || 5;
  const horas = parseInt(horas_validade) || 2;
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
      await pool.query(
        "INSERT INTO cupons (codigo, desconto_percent, usos_maximos, expira_em) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING",
        [cod, desc, usos, expira]
      );
      gerados.push(cod);
    } catch (e) { /* skip duplicates */ }
  }

  res.json({ gerados, total: gerados.length, expira_em: expira });
});

// GET /api/cupons — admin lista cupons
router.get('/', requireAdmin, async (req, res) => {
  try {
    const r = await pool.query("SELECT * FROM cupons ORDER BY criado_em DESC LIMIT 200");
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/cupons/:id — admin desativa cupom
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    await pool.query("UPDATE cupons SET ativo = false WHERE id = $1", [req.params.id]);
    res.json({ sucesso: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
