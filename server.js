require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDB } = require('./db/init');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/auth',     require('./routes/auth').router);
app.use('/api/acrescimos', require('./routes/acrescimos'));
app.use('/api/products', require('./routes/products'));
app.use('/api/orders',   require('./routes/orders'));

app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date().toLocaleString('pt-BR') }));

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// Start only after DB is ready
initDB().then(() => {
  app.listen(PORT, () => {
    console.log(`\n🍔 Fael Top Lanches rodando em http://localhost:${PORT}`);
    console.log(`🔑 Senha admin padrão: 1234\n`);
  });
}).catch(err => {
  console.error('❌ Erro ao conectar ao banco de dados:', err.message);
  console.error('Verifique se DATABASE_URL está configurado corretamente.');
  process.exit(1);
});
