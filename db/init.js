require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function initDB() {
  const client = await pool.connect();
  try {
    // Tabela de produtos
    await client.query(`
      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        price NUMERIC(10,2) NOT NULL,
        emoji TEXT DEFAULT '🍽',
        description TEXT DEFAULT '',
        active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Tabela de pedidos
    await client.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        client_name TEXT NOT NULL,
        client_phone TEXT NOT NULL,
        address TEXT,
        complement TEXT,
        delivery_type TEXT NOT NULL DEFAULT 'entrega',
        payment TEXT NOT NULL DEFAULT 'dinheiro',
        change_for NUMERIC(10,2),
        subtotal NUMERIC(10,2) NOT NULL,
        delivery_fee NUMERIC(10,2) DEFAULT 0,
        total NUMERIC(10,2) NOT NULL,
        status TEXT DEFAULT 'pendente',
        observations TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Tabela de itens do pedido
    await client.query(`
      CREATE TABLE IF NOT EXISTS order_items (
        id SERIAL PRIMARY KEY,
        order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        product_id INTEGER,
        product_name TEXT NOT NULL,
        product_emoji TEXT DEFAULT '🍽',
        quantity INTEGER NOT NULL,
        unit_price NUMERIC(10,2) NOT NULL,
        subtotal NUMERIC(10,2) NOT NULL
      )
    `);

    // Tabela de configurações
    await client.query(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
    `);

    // Tabela de acréscimos
    await client.query(`
      CREATE TABLE IF NOT EXISTS acrescimos (
        id SERIAL PRIMARY KEY,
        nome TEXT NOT NULL,
        valor NUMERIC(10,2) NOT NULL,
        emoji TEXT DEFAULT '➕',
        ativo BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Acréscimos padrão
    const acrRes = await client.query("SELECT COUNT(*) FROM acrescimos");
    if (parseInt(acrRes.rows[0].count) === 0) {
      const acrs = [
        ['Bife', 5.00, '🥩'],
        ['Catupiry', 3.00, '🧀'],
        ['Cheddar', 3.00, '🧀'],
        ['Bacon', 4.00, '🥓'],
        ['Ovo', 2.00, '🍳'],
        ['Frango', 5.00, '🍗'],
      ];
      for (const a of acrs) {
        await client.query(
          "INSERT INTO acrescimos (nome, valor, emoji) VALUES ($1,$2,$3)",
          a
        );
      }
      console.log('Acrescimos padrao inseridos');
    }

    // Migrations seguras — ADD COLUMN IF NOT EXISTS
    await client.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS original_price NUMERIC(10,2) DEFAULT NULL`);
    await client.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_fee_override NUMERIC(10,2) DEFAULT NULL`);

    // Configurações padrão da loja
    const configKeys = [
      ['whatsapp', '5532998204435'],
      ['pix_chave', 'cb91d867-3309-4ffb-a028-b5d3925ff0e9'],
      ['pix_nome', 'RAPHAEL GONZAGA CORDEIRO'],
      ['pix_cidade', 'BRASILIA'],
      ['manual_status', 'auto'],
    ];
    for (const [key, val] of configKeys) {
      const exists = await client.query("SELECT value FROM settings WHERE key=$1", [key]);
      if (!exists.rows.length) {
        await client.query("INSERT INTO settings (key, value) VALUES ($1,$2)", [key, val]);
      }
    }

    // Senha admin padrão
    const pwdRes = await client.query("SELECT value FROM settings WHERE key = 'admin_password'");
    if (pwdRes.rows.length === 0) {
      const hash = bcrypt.hashSync('1234', 10);
      await client.query("INSERT INTO settings (key, value) VALUES ('admin_password', $1)", [hash]);
      console.log('✅ Senha admin criada (padrão: 1234)');
    }

    // Senha gerenciamento padrão
    const gerPwdRes = await client.query("SELECT value FROM settings WHERE key = 'gerenciamento_password'");
    if (gerPwdRes.rows.length === 0) {
      const hash = bcrypt.hashSync('gerente123', 10);
      await client.query("INSERT INTO settings (key, value) VALUES ('gerenciamento_password', $1)", [hash]);
      console.log('✅ Senha gerenciamento criada (padrão: gerente123)');
    }

    // Chave PIX padrão
    const pixRes = await client.query("SELECT value FROM settings WHERE key = 'pix_chave'");
    if (pixRes.rows.length === 0) {
      await client.query("INSERT INTO settings (key, value) VALUES ('pix_chave', '32999754142')");
      console.log('✅ Chave PIX configurada: 32999754142');
    }

    // Produtos padrão
    const prodRes = await client.query("SELECT COUNT(*) FROM products");
    if (parseInt(prodRes.rows[0].count) === 0) {
      const prods = [
        ['X-Burguer','lanches',18,'🍔','Pão brioche, carne artesanal, queijo, alface e tomate'],
        ['X-Bacon','lanches',22,'🥓','Pão brioche, carne, bacon crocante, queijo cheddar'],
        ['X-Salada','lanches',20,'🥗','Pão, carne, alface, tomate, cebola e maionese caseira'],
        ['X-Duplo','lanches',28,'🍔','Dupla de carnes, queijo duplo, bacon e molho especial'],
        ['Pizza Margherita','pizzas',42,'🍕','Molho de tomate, mussarela, manjericão fresco'],
        ['Pizza Calabresa','pizzas',45,'🍕','Calabresa fatiada, cebola, azeitona e mussarela'],
        ['Pizza 4 Queijos','pizzas',52,'🧀','Mussarela, provolone, parmesão e gorgonzola'],
        ['Pizza Portuguesa','pizzas',48,'🍕','Presunto, ovo, cebola, azeitona, tomate e mussarela'],
        ['Coca-Cola 350ml','bebidas',6,'🥤','Gelada, lata 350ml'],
        ['Suco Natural','bebidas',10,'🍹','Laranja, limão ou abacaxi — 400ml'],
        ['Agua Mineral','bebidas',4,'💧','500ml com ou sem gas'],
        ['Batata Frita P','porcoes',14,'🍟','Porcao individual crocante com tempero especial'],
        ['Batata Frita G','porcoes',22,'🍟','Porcao familia crocante com catupiry'],
        ['Onion Rings','porcoes',18,'🧅','Aneis de cebola empanados com molho especial'],
        ['Omelete Simples','omelete',18,'🍳','Ovos, sal e temperos especiais'],
        ['Omelete com Queijo','omelete',22,'🧀','Ovos, queijo derretido e temperos'],
        ['Omelete com Presunto','omelete',24,'🍳','Ovos, presunto fatiado e queijo'],
        ['Omelete Completo','omelete',28,'🍳','Ovos, presunto, queijo, tomate e cebola'],
        ['Cachorro Quente Simples','cachorro_quente',12,'🌭','Pao, salsicha e molho especial'],
        ['Cachorro Quente Completo','cachorro_quente',18,'🌭','Pao, salsicha, batata palha, milho, ervilha e molho'],
        ['Cachorro Quente Especial','cachorro_quente',22,'🌭','Pao, duas salsichas, queijo derretido, batata palha e molhos'],
        ['Cachorro Quente Duplo','cachorro_quente',26,'🌭','Pao maior, duas salsichas, bacon, queijo, batata palha e molho especial'],
      ];
      for (const p of prods) {
        await client.query(
          "INSERT INTO products (name, category, price, emoji, description) VALUES ($1,$2,$3,$4,$5)",
          p
        );
      }
      console.log('✅ Produtos padrao inseridos');
    }

    console.log('✅ Banco de dados PostgreSQL pronto!');
  } catch(err) {
    console.error('❌ Erro no banco:', err.message);
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { pool, initDB };
