const express = require('express');
const router = express.Router();
const { pool } = require('../db/init');
const { requireAdmin } = require('./auth');

// GET all active acrescimos (public)
router.get('/', async (req, res) => {
  try {
    const r = await pool.query("SELECT * FROM acrescimos WHERE ativo = true ORDER BY nome");
    res.json(r.rows);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// GET all including inactive (admin)
router.get('/all', requireAdmin, async (req, res) => {
  try {
    const r = await pool.query("SELECT * FROM acrescimos ORDER BY nome");
    res.json(r.rows);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// POST create
router.post('/', requireAdmin, async (req, res) => {
  const { nome, valor, emoji } = req.body;
  if (!nome || !valor) return res.status(400).json({ error: 'nome e valor obrigatorios' });
  try {
    const r = await pool.query(
      "INSERT INTO acrescimos (nome, valor, emoji) VALUES ($1,$2,$3) RETURNING *",
      [nome, parseFloat(valor), emoji || '➕']
    );
    res.status(201).json(r.rows[0]);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// PUT update
router.put('/:id', requireAdmin, async (req, res) => {
  const { nome, valor, emoji, ativo } = req.body;
  const id = parseInt(req.params.id);
  try {
    const cur = await pool.query("SELECT * FROM acrescimos WHERE id = $1", [id]);
    if (!cur.rows.length) return res.status(404).json({ error: 'Nao encontrado' });
    const a = cur.rows[0];
    const r = await pool.query(
      "UPDATE acrescimos SET nome=$1, valor=$2, emoji=$3, ativo=$4 WHERE id=$5 RETURNING *",
      [nome ?? a.nome, valor != null ? parseFloat(valor) : a.valor, emoji ?? a.emoji, ativo != null ? ativo : a.ativo, id]
    );
    res.json(r.rows[0]);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// DELETE (toggle ativo)
router.delete('/:id', requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    const cur = await pool.query("SELECT ativo FROM acrescimos WHERE id=$1", [id]);
    if (!cur.rows.length) return res.status(404).json({ error: 'Nao encontrado' });
    const novo = !cur.rows[0].ativo;
    await pool.query("UPDATE acrescimos SET ativo=$1 WHERE id=$2", [novo, id]);
    res.json({ success: true, ativo: novo });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
