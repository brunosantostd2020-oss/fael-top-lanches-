const express = require('express');
const router = express.Router();
const { pool } = require('../db/init');
const { requireGerenciamento } = require('./auth');

// GET /api/gerenciamento/stats - Estatísticas financeiras
router.get('/stats', requireGerenciamento, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        id, 
        total, 
        status, 
        TO_CHAR(created_at, 'YYYY-MM-DD') as order_date,
        created_at
      FROM orders 
      WHERE status != 'cancelado'
      ORDER BY created_at DESC
    `);
    
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
