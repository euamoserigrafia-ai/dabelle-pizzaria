-- ============================================================
-- DABELLE PIZZARIA — Schema Supabase
-- Execute no SQL Editor do seu projeto Supabase
-- ============================================================

-- EXTENSÕES
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── CATEGORIAS ──────────────────────────────────────────────
CREATE TABLE categorias (
  id     SERIAL PRIMARY KEY,
  nome   TEXT NOT NULL,
  slug   TEXT NOT NULL UNIQUE,  -- 'salgada' | 'doce' | '2sabores' | 'bebida'
  ordem  INT  DEFAULT 0
);

INSERT INTO categorias (nome, slug, ordem) VALUES
  ('Pizzas Salgadas', 'salgada', 1),
  ('Meia a Meia',     '2sabores', 2),
  ('Pizzas Doces',    'doce', 3),
  ('Bebidas',         'bebida', 4);

-- ─── PRODUTOS ────────────────────────────────────────────────
CREATE TABLE produtos (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome         TEXT    NOT NULL,
  descricao    TEXT,
  preco        NUMERIC(8,2) NOT NULL DEFAULT 0,
  categoria_id INT     REFERENCES categorias(id),
  emoji        TEXT    DEFAULT '🍕',
  foto_url     TEXT,
  fatias       INT,          -- 8 salgada, 6 doce
  volume_ml    INT,          -- para bebidas
  ativo        BOOLEAN DEFAULT TRUE,
  ordem        INT     DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO produtos (nome, descricao, preco, categoria_id, emoji, fatias, ordem) VALUES
  ('Calabresa',          'Calabresa fatiada, cebola, azeitona e orégano',            35.00, 1, '🍕', 8, 1),
  ('Frango c/ Catupiry', 'Frango desfiado, catupiry original, azeitona',              40.00, 1, '🍕', 8, 2),
  ('Mussarela',          'Mussarela, tomate fresco, azeitona e orégano',             35.00, 1, '🍕', 8, 3),
  ('Portuguesa',         'Mussarela, presunto, palmito, ovo, ervilha, cebola',       35.00, 1, '🍕', 8, 4),
  ('Caipira',            'Frango desfiado, milho, ovo, bacon e mussarela',           48.00, 1, '🍕', 8, 5),
  ('Marguerita',         'Mussarela, manjericão, parmesão, azeitona',                40.00, 1, '🍕', 8, 6),
  ('Pizza 2 Sabores',    'Escolha 2 sabores — preço pela média das metades',         0.00,  2, '🌓', 8, 1),
  ('Brigadinho',         'Brigadeiro caseiro com granulado',                         25.00, 3, '🍫', 6, 1),
  ('Ninho c/ Morango',   'Recheio de ninho caseiro com morangos frescos',            28.00, 3, '🍫', 6, 2),
  ('Dois Amores',        'Brigadeiro branco e brigadeiro preto',                     28.00, 3, '🍫', 6, 3),
  ('Coca-Cola 2L',       'Refrigerante 2 litros',                                    18.00, 4, '🥤', NULL, 1),
  ('Guaraná Cruzeiro',   'Refrigerante 2 litros',                                     7.00, 4, '🥤', NULL, 2);

-- ─── BORDAS ───────────────────────────────────────────────────
CREATE TABLE bordas (
  id       SERIAL PRIMARY KEY,
  nome     TEXT    NOT NULL,
  preco    NUMERIC(8,2) DEFAULT 0,
  foto_url TEXT,
  ativo    BOOLEAN DEFAULT TRUE,
  ordem    INT     DEFAULT 0
);

INSERT INTO bordas (nome, preco, ordem) VALUES
  ('Tradicional', 0.00, 1),
  ('Cheddar',     5.00, 2),
  ('Catupiry',    5.00, 3);

-- ─── ADICIONAIS ───────────────────────────────────────────────
CREATE TABLE adicionais (
  id         SERIAL PRIMARY KEY,
  nome       TEXT    NOT NULL,
  preco      NUMERIC(8,2) DEFAULT 0,
  tipo       TEXT    NOT NULL CHECK (tipo IN ('salgado','doce')),
  obrigatorio BOOLEAN DEFAULT FALSE,
  ativo      BOOLEAN DEFAULT TRUE,
  ordem      INT     DEFAULT 0
);

INSERT INTO adicionais (nome, preco, tipo, ordem) VALUES
  ('Bacon extra',            4.00, 'salgado', 1),
  ('Mussarela extra',        3.00, 'salgado', 2),
  ('Milho extra',            2.00, 'salgado', 3),
  ('Cebola extra',           2.00, 'salgado', 4),
  ('Leite condensado extra', 3.00, 'doce',    1),
  ('Confete extra',          2.00, 'doce',    2);

-- ─── PEDIDOS ──────────────────────────────────────────────────
CREATE TABLE pedidos (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  numero               SERIAL,
  cliente_nome         TEXT NOT NULL,
  cliente_whatsapp     TEXT NOT NULL,
  endereco_rua         TEXT NOT NULL,
  endereco_numero      TEXT NOT NULL,
  endereco_complemento TEXT,
  endereco_bairro      TEXT NOT NULL,
  forma_pagamento      TEXT NOT NULL CHECK (forma_pagamento IN ('dinheiro','pix','cartao')),
  troco_para           NUMERIC(8,2),
  subtotal             NUMERIC(8,2) NOT NULL,
  taxa_entrega         NUMERIC(8,2) NOT NULL DEFAULT 5.00,
  total                NUMERIC(8,2) NOT NULL,
  status               TEXT NOT NULL DEFAULT 'novo'
                         CHECK (status IN ('novo','producao','entrega','finalizado','recusado')),
  itens                JSONB NOT NULL DEFAULT '[]',
  observacao           TEXT,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);

-- índice para busca por data
CREATE INDEX pedidos_created_at_idx ON pedidos (created_at DESC);

-- ─── AVALIAÇÕES ───────────────────────────────────────────────
CREATE TABLE avaliacoes (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cliente_nome  TEXT NOT NULL,
  estrelas      INT  NOT NULL CHECK (estrelas BETWEEN 1 AND 5),
  comentario    TEXT,
  aprovada      BOOLEAN DEFAULT FALSE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO avaliacoes (cliente_nome, estrelas, comentario, aprovada) VALUES
  ('Maria S.',  5, 'Pizza incrível, chegou quentinha!', TRUE),
  ('João P.',   5, 'A borda de catupiry é perfeita, virei fã!', TRUE),
  ('Ana L.',    4, 'Muito boa, entrega rápida. Recomendo!', TRUE);

-- ─── CONFIGURAÇÕES ────────────────────────────────────────────
CREATE TABLE configuracoes (
  id                   INT PRIMARY KEY DEFAULT 1,
  loja_aberta          BOOLEAN DEFAULT TRUE,
  taxa_entrega_ativa   BOOLEAN DEFAULT TRUE,
  taxa_entrega_valor   NUMERIC(8,2) DEFAULT 5.00,
  taxa_cartao_pct      NUMERIC(5,4) DEFAULT 0.0314,
  horario_abertura     TIME DEFAULT '18:00',
  horario_fechamento   TIME DEFAULT '23:00',
  dias_funcionamento   TEXT[] DEFAULT ARRAY['ter','qua','qui','sex','sab','dom'],
  whatsapp_loja        TEXT DEFAULT '5511948625369',
  whatsapp_secundario  TEXT DEFAULT '5511960611249',
  pix_chave            TEXT DEFAULT '63.733.611/0001-69',
  pix_tipo             TEXT DEFAULT 'cnpj',
  cor_primaria         TEXT DEFAULT '#E8151B',
  cor_secundaria       TEXT DEFAULT '#FFFFFF',
  banner_titulo        TEXT DEFAULT 'Pizza fresquinha 🍕',
  banner_subtitulo     TEXT DEFAULT 'Peça agora e receba em até 40 min!'
);

INSERT INTO configuracoes (id) VALUES (1) ON CONFLICT DO NOTHING;

-- ─── ROW LEVEL SECURITY ───────────────────────────────────────
-- Clientes podem ler produtos, bordas, adicionais, avaliações aprovadas e configs
ALTER TABLE produtos       ENABLE ROW LEVEL SECURITY;
ALTER TABLE bordas         ENABLE ROW LEVEL SECURITY;
ALTER TABLE adicionais     ENABLE ROW LEVEL SECURITY;
ALTER TABLE avaliacoes     ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedidos        ENABLE ROW LEVEL SECURITY;
ALTER TABLE configuracoes  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "publico_le_produtos"    ON produtos      FOR SELECT USING (ativo = TRUE);
CREATE POLICY "publico_le_bordas"      ON bordas        FOR SELECT USING (ativo = TRUE);
CREATE POLICY "publico_le_adicionais"  ON adicionais    FOR SELECT USING (ativo = TRUE);
CREATE POLICY "publico_le_avaliacoes"  ON avaliacoes    FOR SELECT USING (aprovada = TRUE);
CREATE POLICY "publico_le_config"      ON configuracoes FOR SELECT USING (TRUE);

-- Qualquer pessoa pode inserir pedido e avaliação
CREATE POLICY "publico_insere_pedido"    ON pedidos    FOR INSERT WITH CHECK (TRUE);
CREATE POLICY "publico_insere_avaliacao" ON avaliacoes FOR INSERT WITH CHECK (TRUE);

-- Admin (usuário autenticado) pode tudo
CREATE POLICY "admin_tudo_produtos"    ON produtos      FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "admin_tudo_pedidos"     ON pedidos       FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "admin_tudo_avaliacoes"  ON avaliacoes    FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "admin_tudo_config"      ON configuracoes FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "admin_tudo_bordas"      ON bordas        FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "admin_tudo_adicionais"  ON adicionais    FOR ALL USING (auth.role() = 'authenticated');

-- ─── REALTIME ─────────────────────────────────────────────────
-- Habilitar realtime para a tabela pedidos (notificação de novo pedido no painel)
ALTER PUBLICATION supabase_realtime ADD TABLE pedidos;
