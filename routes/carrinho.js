const express = require('express');
const router = express.Router();
const { pool } = require('../db/init');

// Gera código único de 8 caracteres
function gerarCodigo() {
  return Math.random().toString(36).substring(2, 10).toUpperCase();
}

// POST /api/carrinho — salva ou atualiza carrinho
router.post('/', async (req, res) => {
  try {
    const { codigo, dados } = req.body;
    if (!dados) return res.status(400).json({ error: 'dados obrigatório' });

    let cod = codigo;

    if (cod) {
      // Atualiza existente
      const result = await pool.query(
        `UPDATE carrinhos SET dados=$1, atualizado_em=NOW() WHERE codigo=$2 RETURNING codigo`,
        [JSON.stringify(dados), cod]
      );
      if (!result.rows.length) {
        // Código não existe mais — cria novo
        cod = gerarCodigo();
        await pool.query(
          `INSERT INTO carrinhos (codigo, dados) VALUES ($1, $2)`,
          [cod, JSON.stringify(dados)]
        );
      }
    } else {
      // Cria novo
      cod = gerarCodigo();
      await pool.query(
        `INSERT INTO carrinhos (codigo, dados) VALUES ($1, $2)`,
        [cod, JSON.stringify(dados)]
      );
    }

    res.json({ codigo: cod });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/carrinho/:codigo — recupera carrinho
router.get('/:codigo', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT dados FROM carrinhos WHERE codigo=$1`,
      [req.params.codigo.toUpperCase()]
    );
    if (!result.rows.length) return res.json(null);
    res.json(JSON.parse(result.rows[0].dados));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/carrinho/:codigo — limpa carrinho após pedido
router.delete('/:codigo', async (req, res) => {
  try {
    await pool.query(`DELETE FROM carrinhos WHERE codigo=$1`, [req.params.codigo.toUpperCase()]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
