-- ============================================================
-- DABELLE PIZZARIA — Migration 003: Pix + WhatsApp API
-- Execute no SQL Editor do Supabase após migration 002
-- ============================================================

-- ─── Campos Pix na tabela pedidos ────────────────────────────
ALTER TABLE pedidos
  ADD COLUMN IF NOT EXISTS pix_payment_id TEXT,
  ADD COLUMN IF NOT EXISTS pix_status     TEXT DEFAULT 'pendente'
    CHECK (pix_status IN ('pendente','aprovado','expirado','cancelado')),
  ADD COLUMN IF NOT EXISTS pix_qr_code    TEXT,
  ADD COLUMN IF NOT EXISTS pix_expira_em  TIMESTAMPTZ;

-- ─── Log de mensagens WhatsApp enviadas ──────────────────────
CREATE TABLE IF NOT EXISTS whatsapp_log (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pedido_id    UUID REFERENCES pedidos(id) ON DELETE SET NULL,
  para         TEXT NOT NULL,
  tipo         TEXT NOT NULL,  -- 'template' | 'text'
  template     TEXT,
  mensagem     TEXT,
  status       TEXT DEFAULT 'sent',
  message_id   TEXT,           -- ID retornado pela API do Meta
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wa_log_pedido ON whatsapp_log (pedido_id);

ALTER TABLE whatsapp_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_wa_log" ON whatsapp_log
  FOR ALL USING (auth.role() = 'authenticated');

-- ─── Variáveis de ambiente para as Edge Functions ────────────
-- Configure em: supabase.com → Projeto → Settings → Edge Functions → Secrets
--
-- MP_ACCESS_TOKEN          → Token de acesso do Mercado Pago (produção)
-- WA_TOKEN                 → Token permanente do WhatsApp Business
-- WA_PHONE_ID              → ID do número do WhatsApp no Meta
-- WA_VERIFY_TOKEN          → Token de verificação do webhook (qualquer string)
-- APP_URL                  → URL do app (ex: https://pedidos.dabellepizzaria.com.br)

-- ─── Deploy das Edge Functions ───────────────────────────────
-- Execute no terminal após instalar Supabase CLI (npm install -g supabase):
--
-- supabase login
-- supabase link --project-ref SEU_PROJECT_REF
-- supabase functions deploy pix-webhook
-- supabase functions deploy whatsapp-webhook
-- supabase functions deploy notificar-cliente

-- ─── Verificar URLs das funções ──────────────────────────────
-- Pix webhook:      https://SEU_PROJETO.supabase.co/functions/v1/pix-webhook
-- WA webhook:       https://SEU_PROJETO.supabase.co/functions/v1/whatsapp-webhook
-- Notif. cliente:   https://SEU_PROJETO.supabase.co/functions/v1/notificar-cliente
