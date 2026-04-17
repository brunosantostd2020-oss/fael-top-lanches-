const express = require('express');
const router = express.Router();
const { pool } = require('../db/init');
const { requireAdmin } = require('./auth');

// GET active products (public)
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM products WHERE active = true ORDER BY category, name"
    );
    res.json(result.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET all products including inactive (admin)
router.get('/all', requireAdmin, async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM products ORDER BY category, name");
    res.json(result.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST create product
router.post('/', requireAdmin, async (req, res) => {
  const { name, category, price, emoji, description } = req.body;
  if (!name || !category || !price) return res.status(400).json({ error: 'name, category e price são obrigatórios' });
  try {
    const original_price = req.body.original_price ? parseFloat(req.body.original_price) : null;
  const result = await pool.query(
      "INSERT INTO products (name, category, price, original_price, emoji, description) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *",
      [name, category, parseFloat(price), original_price, emoji || '🍽', description || '']
    );
    res.status(201).json(result.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT update product
router.put('/:id', requireAdmin, async (req, res) => {
  const { name, category, price, emoji, description, active } = req.body;
  const id = parseInt(req.params.id);
  try {
    const cur = await pool.query("SELECT * FROM products WHERE id = $1", [id]);
    if (!cur.rows.length) return res.status(404).json({ error: 'Produto não encontrado' });
    const p = cur.rows[0];
    const original_price = req.body.original_price !== undefined
      ? (req.body.original_price ? parseFloat(req.body.original_price) : null)
      : p.original_price;
    const result = await pool.query(
      "UPDATE products SET name=$1, category=$2, price=$3, original_price=$4, emoji=$5, description=$6, active=$7 WHERE id=$8 RETURNING *",
      [
        name ?? p.name,
        category ?? p.category,
        price != null ? parseFloat(price) : p.price,
        original_price,
        emoji ?? p.emoji,
        description ?? p.description,
        active != null ? active : p.active,
        id
      ]
    );
    res.json(result.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE (deactivate) product
router.delete('/:id', requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    const cur = await pool.query("SELECT active FROM products WHERE id = $1", [id]);
    if (!cur.rows.length) return res.status(404).json({ error: 'Produto não encontrado' });
    // Toggle: if active → deactivate, if inactive → reactivate
    const newActive = !cur.rows[0].active;
    await pool.query("UPDATE products SET active = $1 WHERE id = $2", [newActive, id]);
    res.json({ success: true, active: newActive });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
