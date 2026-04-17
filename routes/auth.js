const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../db/init');

const JWT_SECRET = process.env.JWT_SECRET || 'fael-top-lanches-jwt-secret-2024';

function requireAdmin(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token necessário' });
  }
  try {
    const payload = jwt.verify(auth.split(' ')[1], JWT_SECRET);
    if (!payload.admin) return res.status(403).json({ error: 'Acesso negado' });
    req.admin = payload;
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido ou expirado' });
  }
}

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { password } = req.body;
  if (!password) return res.status(400).json({ error: 'Senha obrigatória' });
  try {
    const result = await pool.query("SELECT value FROM settings WHERE key = 'admin_password'");
    if (!result.rows.length || !bcrypt.compareSync(password, result.rows[0].value)) {
      return res.status(401).json({ error: 'Senha incorreta' });
    }
    const token = jwt.sign({ admin: true }, JWT_SECRET, { expiresIn: '12h' });
    res.json({ token, expiresIn: '12h' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/auth/change-password
router.post('/change-password', requireAdmin, async (req, res) => {
  const { current_password, new_password } = req.body;
  if (!current_password || !new_password) return res.status(400).json({ error: 'Campos obrigatórios' });
  if (new_password.length < 4) return res.status(400).json({ error: 'Mínimo 4 caracteres' });
  try {
    const result = await pool.query("SELECT value FROM settings WHERE key = 'admin_password'");
    if (!bcrypt.compareSync(current_password, result.rows[0].value)) {
      return res.status(401).json({ error: 'Senha atual incorreta' });
    }
    const hash = bcrypt.hashSync(new_password, 10);
    await pool.query("UPDATE settings SET value = $1 WHERE key = 'admin_password'", [hash]);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET settings (admin)
router.get('/settings', requireAdmin, async (req, res) => {
  try {
    const r = await pool.query("SELECT key, value FROM settings WHERE key NOT LIKE '%password%'");
    const settings = {};
    r.rows.forEach(row => { settings[row.key] = row.value; });
    res.json(settings);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// PUT update setting (admin)
router.put('/settings/:key', requireAdmin, async (req, res) => {
  const { value } = req.body;
  const key = req.params.key;
  // Block password changes via this route
  if (key.includes('password')) return res.status(403).json({ error: 'Use /change-password' });
  try {
    await pool.query(
      "INSERT INTO settings (key, value) VALUES ($1,$2) ON CONFLICT (key) DO UPDATE SET value=$2",
      [key, value]
    );
    res.json({ success: true, key, value });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

module.exports = { router, requireAdmin };
