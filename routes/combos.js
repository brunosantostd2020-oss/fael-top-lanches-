const express = require('express');
const router = express.Router();
const { pool } = require('../db/init');
const { requireAdmin } = require('./auth');

// Substitui imagem base64 da descrição por URL leve (mesma técnica de products.js)
function leveinar(row) {
  if (row.description && /##IMG:[^#]+##/.test(row.description)) {
    row.image_url = `/api/combos/${row.id}/image`;
    row.description = row.description.replace(/##IMG:[^#]+##/gi, '').trim();
  }
  return row;
}

// GET combos ativos (público)
router.get('/', async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM combos WHERE active = true ORDER BY name");
    res.json(result.rows.map(leveinar));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET imagem do combo (extraída da descrição)
router.get('/:id/image', async (req, res) => {
  try {
    const r = await pool.query("SELECT description FROM combos WHERE id = $1", [parseInt(req.params.id)]);
    if (!r.rows.length) return res.status(404).json({ error: 'Combo não encontrado' });
    const m = (r.rows[0].description || '').match(/##IMG:data:(image\/[a-z+]+);base64,([^#]+)##/i);
    if (!m) return res.status(404).json({ error: 'Sem imagem' });
    const buf = Buffer.from(m[2], 'base64');
    res.set('Content-Type', m[1]);
    res.set('Cache-Control', 'public, max-age=86400');
    res.send(buf);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET todos os combos (admin)
router.get('/all', requireAdmin, async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM combos ORDER BY name");
    res.json(result.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST criar combo
router.post('/', requireAdmin, async (req, res) => {
  const { name, description, emoji, price, items } = req.body;
  if (!name || !price) return res.status(400).json({ error: 'name e price são obrigatórios' });
  try {
    const result = await pool.query(
      "INSERT INTO combos (name, description, emoji, price, items) VALUES ($1,$2,$3,$4,$5) RETURNING *",
      [name, description || '', emoji || '🍔', parseFloat(price), items || '']
    );
    res.status(201).json(result.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT atualizar combo
router.put('/:id', requireAdmin, async (req, res) => {
  const { name, description, emoji, price, items, active } = req.body;
  const id = parseInt(req.params.id);
  try {
    const cur = await pool.query("SELECT * FROM combos WHERE id = $1", [id]);
    if (!cur.rows.length) return res.status(404).json({ error: 'Combo não encontrado' });
    const c = cur.rows[0];
    const result = await pool.query(
      "UPDATE combos SET name=$1, description=$2, emoji=$3, price=$4, items=$5, active=$6 WHERE id=$7 RETURNING *",
      [
        name ?? c.name,
        description ?? c.description,
        emoji ?? c.emoji,
        price != null ? parseFloat(price) : c.price,
        items ?? c.items,
        active != null ? active : c.active,
        id
      ]
    );
    res.json(result.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE toggle ativo/inativo
router.delete('/:id', requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    const cur = await pool.query("SELECT active FROM combos WHERE id = $1", [id]);
    if (!cur.rows.length) return res.status(404).json({ error: 'Combo não encontrado' });
    const newActive = !cur.rows[0].active;
    await pool.query("UPDATE combos SET active = $1 WHERE id = $2", [newActive, id]);
    res.json({ success: true, active: newActive });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE permanente
router.delete('/:id/permanent', requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    await pool.query("DELETE FROM combos WHERE id = $1", [id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
