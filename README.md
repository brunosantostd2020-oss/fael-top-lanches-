# 🍔 Fael Top Lanches e Pizzaria

Sistema de pedidos com banco de dados PostgreSQL permanente.

---

## 🚀 COMO COLOCAR NO AR (passo a passo para iniciantes)

### PASSO 1 — Criar conta no GitHub (se ainda não tiver)
1. Acesse https://github.com e clique em "Sign up"
2. Crie sua conta gratuitamente

---

### PASSO 2 — Criar repositório no GitHub
1. Faça login no GitHub
2. Clique no "+" no canto superior direito → "New repository"
3. Nome: fael-top-lanches
4. Deixe como "Public"
5. Clique em "Create repository"

---

### PASSO 3 — Instalar o Git no seu computador
1. Acesse https://git-scm.com e baixe o instalador
2. Instale com as opções padrão (Next, Next, Finish)

---

### PASSO 4 — Enviar os arquivos para o GitHub
1. Extraia o ZIP em uma pasta no seu computador
2. Abra o Prompt de Comando DENTRO da pasta fael-site
   (clique com botão direito na pasta → "Abrir no Terminal" ou "Git Bash Here")
3. Execute os comandos abaixo UM POR UM:

   git init
   git add .
   git commit -m "primeiro commit"
   git branch -M main
   git remote add origin https://github.com/SEU_USUARIO/fael-top-lanches.git
   git push -u origin main

   ⚠️ Troque SEU_USUARIO pelo seu usuário do GitHub

---

### PASSO 5 — Criar conta no Railway
1. Acesse https://railway.app
2. Clique em "Login" → "Login with GitHub" (autorize)

---

### PASSO 6 — Criar o banco de dados PostgreSQL
1. No Railway, clique em "New Project"
2. Escolha "Provision PostgreSQL"
3. Um banco de dados será criado automaticamente
4. Clique no banco criado → aba "Variables"
5. Copie o valor de DATABASE_URL (vai precisar logo)

---

### PASSO 7 — Fazer o deploy do site
1. Ainda no Railway, clique em "New" dentro do projeto
2. Escolha "GitHub Repo"
3. Selecione "fael-top-lanches"
4. Railway vai começar o deploy automaticamente

---

### PASSO 8 — Configurar as variáveis de ambiente
1. Clique no serviço do seu site (não no banco)
2. Vá na aba "Variables"
3. Adicione as seguintes variáveis clicando em "New Variable":

   DATABASE_URL  →  (cole o valor copiado no Passo 6)
   JWT_SECRET    →  fael-lanches-segredo-2024
   NODE_ENV      →  production

---

### PASSO 9 — Gerar o domínio (URL pública)
1. Vá na aba "Settings" do seu serviço
2. Clique em "Generate Domain"
3. Sua URL será algo como: https://fael-top-lanches.up.railway.app 🎉

---

## ✅ PRONTO! O site está no ar!

- Acesse a URL gerada pelo Railway
- Faça login no Admin com a senha: 1234
- Troque a senha em: Admin → ⚙️ Config → Alterar Senha

---

## 📁 Estrutura do projeto

  server.js          ← Servidor principal Node.js
  package.json       ← Lista de dependências
  Procfile           ← Instrução para o Railway iniciar o servidor
  .env.example       ← Modelo das variáveis de ambiente
  db/
    init.js          ← Cria as tabelas no PostgreSQL automaticamente
  routes/
    auth.js          ← Login e autenticação
    products.js      ← API de produtos (adicionar, editar, remover)
    orders.js        ← API de pedidos e faturamento
  public/
    index.html       ← Site completo (cardápio + admin)

---

## 🔑 Credenciais padrão

  Senha admin: 1234
  (Altere no painel Admin → ⚙️ Config → Alterar Senha)

---

## 📞 Contato da loja

  WhatsApp: (32) 99820-4435
