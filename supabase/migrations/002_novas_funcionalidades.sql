-- ============================================================
-- DABELLE PIZZARIA — Migration 002: Novas Funcionalidades
-- Execute APÓS a migration 001 no SQL Editor do Supabase
-- ============================================================

-- ─── 1. PUSH NOTIFICATIONS ───────────────────────────────────
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  endpoint     TEXT NOT NULL UNIQUE,
  p256dh       TEXT NOT NULL,
  auth         TEXT NOT NULL,
  usuario_id   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  dispositivo  TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_push" ON push_subscriptions
  FOR ALL USING (auth.role() = 'authenticated');

-- ─── 2. CUPONS DE DESCONTO ────────────────────────────────────
CREATE TABLE IF NOT EXISTS cupons (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  codigo           TEXT NOT NULL UNIQUE,
  descricao        TEXT,
  tipo             TEXT NOT NULL CHECK (tipo IN ('percentual','fixo','frete_gratis')),
  valor            NUMERIC(8,2) NOT NULL DEFAULT 0,
  pedido_minimo    NUMERIC(8,2),
  desconto_maximo  NUMERIC(8,2),
  limite_usos      INT,
  usos_realizados  INT NOT NULL DEFAULT 0,
  valido_de        TIMESTAMPTZ,
  valido_ate       TIMESTAMPTZ,
  ativo            BOOLEAN DEFAULT TRUE,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cupons_usos (
  id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cupom_id  UUID REFERENCES cupons(id) ON DELETE CASCADE,
  pedido_id UUID REFERENCES pedidos(id) ON DELETE CASCADE,
  usado_em  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (cupom_id, pedido_id)
);

CREATE OR REPLACE FUNCTION incrementar_uso_cupom(p_cupom_id UUID, p_pedido_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE cupons SET usos_realizados = usos_realizados + 1 WHERE id = p_cupom_id;
  INSERT INTO cupons_usos (cupom_id, pedido_id)
    VALUES (p_cupom_id, p_pedido_id) ON CONFLICT DO NOTHING;
END;
$$;

ALTER TABLE cupons       ENABLE ROW LEVEL SECURITY;
ALTER TABLE cupons_usos  ENABLE ROW LEVEL SECURITY;
CREATE POLICY "publico_le_cupons"  ON cupons      FOR SELECT USING (ativo = TRUE);
CREATE POLICY "admin_tudo_cupons"  ON cupons      FOR ALL   USING (auth.role() = 'authenticated');
CREATE POLICY "admin_tudo_usos"    ON cupons_usos FOR ALL   USING (auth.role() = 'authenticated');

-- Cupons de exemplo
INSERT INTO cupons (codigo, descricao, tipo, valor, limite_usos) VALUES
  ('BEMVINDO',    'Desconto de boas-vindas — 10% no primeiro pedido', 'percentual',  10,   1),
  ('FRETEGRATIS', 'Frete grátis no pedido',                           'frete_gratis', 0, NULL),
  ('DABELLE5',    'R$ 5,00 de desconto',                              'fixo',         5,  100)
ON CONFLICT (codigo) DO NOTHING;

-- ─── 3. ZONAS DE ENTREGA ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS zonas_entrega (
  id          SERIAL PRIMARY KEY,
  nome        TEXT NOT NULL,
  taxa        NUMERIC(8,2) NOT NULL DEFAULT 0,
  bairros     TEXT[] NOT NULL DEFAULT '{}',
  descricao   TEXT,
  ativo       BOOLEAN DEFAULT TRUE,
  ordem       INT DEFAULT 0
);

INSERT INTO zonas_entrega (nome, taxa, bairros, descricao, ordem) VALUES
  ('Grátis (Rua Agrimensor Sugaya 930+)', 0.00,
    ARRAY['Vila Nova Cachoeirinha'],
    'Rua Agrimensor Sugaya, nº 930 em diante', 1),
  ('Zona 1 — até 2 km', 5.00,
    ARRAY['Cachoeirinha','Vila Nova Cachoeirinha','Jardim Peri'],
    'Bairros próximos', 2),
  ('Zona 2 — 2 a 5 km', 8.00,
    ARRAY['Mandaqui','Casa Verde','Limão','Vila Guilherme'],
    'Bairros intermediários', 3),
  ('Zona 3 — 5 a 10 km', 12.00,
    ARRAY['Santana','Tucuruvi','Jaçanã','Tremembé'],
    'Bairros mais distantes', 4)
ON CONFLICT DO NOTHING;

ALTER TABLE zonas_entrega ENABLE ROW LEVEL SECURITY;
CREATE POLICY "publico_le_zonas" ON zonas_entrega FOR SELECT USING (ativo = TRUE);
CREATE POLICY "admin_tudo_zonas" ON zonas_entrega FOR ALL   USING (auth.role() = 'authenticated');

-- ─── 4. RASTREAMENTO — adicionar campos ao pedido ────────────
ALTER TABLE pedidos
  ADD COLUMN IF NOT EXISTS cupom_id       UUID REFERENCES cupons(id),
  ADD COLUMN IF NOT EXISTS desconto       NUMERIC(8,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS link_maps      TEXT,
  ADD COLUMN IF NOT EXISTS notificado_em  JSONB DEFAULT '{}';

-- Habilitar realtime para rastreamento em tempo real
ALTER PUBLICATION supabase_realtime ADD TABLE pedidos;

-- ─── ÍNDICES de performance ───────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_pedidos_status      ON pedidos (status);
CREATE INDEX IF NOT EXISTS idx_pedidos_whatsapp    ON pedidos (cliente_whatsapp);
CREATE INDEX IF NOT EXISTS idx_pedidos_numero      ON pedidos (numero);
CREATE INDEX IF NOT EXISTS idx_cupons_codigo       ON cupons (codigo);
