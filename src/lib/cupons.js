// src/lib/cupons.js
// Sistema completo de cupons de desconto

// ─── Validar e aplicar cupom ──────────────────────────────────
export async function validarCupom(supabase, codigo, subtotal) {
  if (!codigo?.trim()) return { ok: false, erro: 'Informe um código de cupom.' }

  const { data: cupom, error } = await supabase
    .from('cupons')
    .select('*')
    .eq('codigo', codigo.toUpperCase().trim())
    .eq('ativo', true)
    .single()

  if (error || !cupom) return { ok: false, erro: 'Cupom inválido ou expirado.' }

  // Validade
  const agora = new Date()
  if (cupom.valido_ate && new Date(cupom.valido_ate) < agora) {
    return { ok: false, erro: 'Este cupom já expirou.' }
  }
  if (cupom.valido_de && new Date(cupom.valido_de) > agora) {
    return { ok: false, erro: 'Este cupom ainda não está ativo.' }
  }

  // Limite de usos
  if (cupom.limite_usos !== null && cupom.usos_realizados >= cupom.limite_usos) {
    return { ok: false, erro: 'Este cupom atingiu o limite de usos.' }
  }

  // Pedido mínimo
  if (cupom.pedido_minimo && subtotal < cupom.pedido_minimo) {
    return {
      ok: false,
      erro: `Pedido mínimo de R$ ${Number(cupom.pedido_minimo).toFixed(2).replace('.',',')} para este cupom.`,
    }
  }

  const desconto = calcularDesconto(cupom, subtotal)

  return {
    ok: true,
    cupom,
    desconto,
    mensagem: `Cupom aplicado! ${cupom.descricao || ''} — ${formatarDesconto(cupom)}`,
  }
}

// ─── Calcular valor do desconto ───────────────────────────────
export function calcularDesconto(cupom, subtotal) {
  if (cupom.tipo === 'percentual') {
    const desconto = subtotal * (cupom.valor / 100)
    return cupom.desconto_maximo ? Math.min(desconto, cupom.desconto_maximo) : desconto
  }
  if (cupom.tipo === 'fixo') {
    return Math.min(cupom.valor, subtotal) // não pode ficar negativo
  }
  if (cupom.tipo === 'frete_gratis') {
    return 5.00 // valor da taxa de entrega
  }
  return 0
}

// ─── Registrar uso do cupom após pedido confirmado ────────────
export async function registrarUsoCupom(supabase, cupomId, pedidoId) {
  const { error } = await supabase.rpc('incrementar_uso_cupom', {
    p_cupom_id: cupomId,
    p_pedido_id: pedidoId,
  })
  if (error) console.error('[Cupom] Erro ao registrar uso:', error)
}

// ─── CRUD Admin ───────────────────────────────────────────────
export async function listarCupons(supabase) {
  const { data, error } = await supabase
    .from('cupons')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) { console.error('listarCupons:', error); return [] }
  return data
}

export async function criarCupom(supabase, cupom) {
  const { data, error } = await supabase
    .from('cupons')
    .insert([{
      codigo:           cupom.codigo.toUpperCase().trim(),
      descricao:        cupom.descricao,
      tipo:             cupom.tipo,             // 'percentual' | 'fixo' | 'frete_gratis'
      valor:            cupom.valor,
      pedido_minimo:    cupom.pedidoMinimo || null,
      desconto_maximo:  cupom.descontoMaximo || null,
      limite_usos:      cupom.limiteUsos || null,
      valido_de:        cupom.validoDe || null,
      valido_ate:       cupom.validoAte || null,
      ativo:            true,
    }])
    .select()
    .single()
  if (error) { console.error('criarCupom:', error); return null }
  return data
}

export async function toggleCupom(supabase, id, ativo) {
  const { error } = await supabase.from('cupons').update({ ativo }).eq('id', id)
  return !error
}

export async function deletarCupom(supabase, id) {
  const { error } = await supabase.from('cupons').delete().eq('id', id)
  return !error
}

// ─── helper ───────────────────────────────────────────────────
function formatarDesconto(cupom) {
  if (cupom.tipo === 'percentual') return `${cupom.valor}% de desconto`
  if (cupom.tipo === 'fixo') return `R$ ${Number(cupom.valor).toFixed(2).replace('.',',')} de desconto`
  if (cupom.tipo === 'frete_gratis') return 'Frete grátis'
  return ''
}

// ─── SQL para adicionar ao Supabase ──────────────────────────
export const SQL_CUPONS = `
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

-- Histórico de uso por pedido
CREATE TABLE IF NOT EXISTS cupons_usos (
  id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cupom_id  UUID REFERENCES cupons(id) ON DELETE CASCADE,
  pedido_id UUID REFERENCES pedidos(id) ON DELETE CASCADE,
  usado_em  TIMESTAMPTZ DEFAULT NOW()
);

-- Função para incrementar uso de forma segura (evita race condition)
CREATE OR REPLACE FUNCTION incrementar_uso_cupom(p_cupom_id UUID, p_pedido_id UUID)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  UPDATE cupons SET usos_realizados = usos_realizados + 1 WHERE id = p_cupom_id;
  INSERT INTO cupons_usos (cupom_id, pedido_id) VALUES (p_cupom_id, p_pedido_id)
    ON CONFLICT DO NOTHING;
END;
$$;

-- Segurança
ALTER TABLE cupons       ENABLE ROW LEVEL SECURITY;
ALTER TABLE cupons_usos  ENABLE ROW LEVEL SECURITY;

-- Clientes podem ler cupons ativos (para validar código)
CREATE POLICY "publico_le_cupons"   ON cupons      FOR SELECT USING (ativo = TRUE);
CREATE POLICY "admin_tudo_cupons"   ON cupons      FOR ALL   USING (auth.role() = 'authenticated');
CREATE POLICY "admin_tudo_usos"     ON cupons_usos FOR ALL   USING (auth.role() = 'authenticated');

-- Cupons iniciais de exemplo
INSERT INTO cupons (codigo, descricao, tipo, valor, limite_usos) VALUES
  ('BEMVINDO',  'Desconto de boas-vindas',   'percentual', 10, 1),
  ('FRETEGRATIS','Frete grátis no pedido',   'frete_gratis', 0, NULL),
  ('DABELLE5',  'R$ 5 de desconto',          'fixo', 5.00, 100)
ON CONFLICT DO NOTHING;
`
