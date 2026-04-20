-- Script SQL para adicionar lanches de FRANGO DESFIADO
-- Execute este comando no seu banco PostgreSQL

-- 1. X-FRANGO DESFIADO
INSERT INTO products (emoji, name, category, price, description, active)
VALUES ('🍗', 'X-Frango Desfiado', 'frango_desfiado', 18.00, 'Pão, frango desfiado, queijo, alface, tomate', true);

-- 2. X-FRANGO DESFIADO ESPECIAL
INSERT INTO products (emoji, name, category, price, description, active)
VALUES ('🍗', 'X-Frango Desfiado Especial', 'frango_desfiado', 20.00, 'Pão, frango desfiado, queijo, bacon, alface, tomate, milho', true);

-- 3. X-FRANGO DESFIADO CATUPIRY
INSERT INTO products (emoji, name, category, price, description, active)
VALUES ('🍗', 'X-Frango Desfiado Catupiry', 'frango_desfiado', 22.00, 'Pão, frango desfiado, catupiry, alface, tomate', true);

-- 4. X-FRANGO DESFIADO BACON
INSERT INTO products (emoji, name, category, price, description, active)
VALUES ('🍗', 'X-Frango Desfiado Bacon', 'frango_desfiado', 21.00, 'Pão, frango desfiado, queijo, bacon, alface, tomate', true);

-- 5. X-FRANGO DESFIADO COMPLETO
INSERT INTO products (emoji, name, category, price, description, active)
VALUES ('🍗', 'X-Frango Desfiado Completo', 'frango_desfiado', 25.00, 'Pão, frango desfiado, queijo, bacon, catupiry, milho, alface, tomate, azeitona', true);

-- 6. X-FRANGO DESFIADO CHEDDAR
INSERT INTO products (emoji, name, category, price, description, active)
VALUES ('🍗', 'X-Frango Desfiado Cheddar', 'frango_desfiado', 23.00, 'Pão, frango desfiado, cheddar, bacon, alface, tomate', true);

-- NOTA: Ajuste os preços conforme necessário!
-- Para executar no PostgreSQL:
-- 1. Conecte ao banco: psql -h localhost -U seu_usuario -d fael_lanches
-- 2. Execute: \i adicionar-frango-desfiado.sql
-- 3. Ou copie e cole diretamente no pgAdmin/terminal
