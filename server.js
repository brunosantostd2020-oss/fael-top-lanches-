require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDB } = require('./db/init');

const app = express();
const PORT = process.env.PORT || 3000;

// Compressão gzip — reduz muito o tamanho das respostas (cardápio com imagens base64)
let compression = null;
try { compression = require('compression'); } catch (e) { /* opcional em dev */ }
if (compression) app.use(compression());

app.use(cors());
// Limite maior para permitir upload de imagens de produtos (base64) pelo admin
app.use(express.json({ limit: '5mb' }));
app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders: (res, filePath) => {
    if (/\.(png|jpg|jpeg|webp|gif|svg|mp3|ico)$/i.test(filePath)) {
      // Imagens e sons podem ficar em cache por 7 dias
      res.setHeader('Cache-Control', 'public, max-age=604800');
    } else if (/\.html$/i.test(filePath)) {
      // HTML sempre atualizado após cada deploy
      res.setHeader('Cache-Control', 'no-cache');
    }
  }
}));

app.use('/api/auth',     require('./routes/auth').router);
app.use('/api/acrescimos', require('./routes/acrescimos'));
app.use('/api/combos',    require('./routes/combos'));
app.use('/api/products', require('./routes/products'));
app.use('/api/orders',   require('./routes/orders'));
app.use('/api/gerenciamento', require('./routes/gerenciamento'));
app.use('/api/cupons',       require('./routes/cupons'));
app.use('/api/carrinho',     require('./routes/carrinho'));

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
