// src/lib/entrega.js
// Cálculo de taxa de entrega por CEP e lógica especial da Rua Agrimensor Sugaya

const ENDERECO_LOJA = {
  rua: 'Rua Agrimensor Sugaya',
  numero: 1200,
  bairro: 'Vila Nova Cachoeirinha',
  cidade: 'São Paulo',
  uf: 'SP',
  cep: '02720-000', // CEP aproximado
}

// Zonas de entrega com taxa fixa
// Configurar conforme a real área de atendimento
const ZONAS_ENTREGA = [
  {
    id: 'gratis',
    nome: 'Entrega grátis',
    taxa: 0,
    bairros: ['Vila Nova Cachoeirinha'],
    descricao: 'Rua Agrimensor Sugaya, nº 930 em diante',
  },
  {
    id: 'zona1',
    nome: 'Zona 1 — até 2 km',
    taxa: 5.00,
    bairros: ['Cachoeirinha', 'Vila Nova Cachoeirinha', 'Jardim Peri'],
    descricao: 'Bairros próximos',
  },
  {
    id: 'zona2',
    nome: 'Zona 2 — 2 a 5 km',
    taxa: 8.00,
    bairros: ['Mandaqui', 'Casa Verde', 'Limão', 'Vila Guilherme'],
    descricao: 'Bairros intermediários',
  },
  {
    id: 'zona3',
    nome: 'Zona 3 — 5 a 10 km',
    taxa: 12.00,
    bairros: ['Santana', 'Tucuruvi', 'Jaçanã', 'Tremembé'],
    descricao: 'Bairros mais distantes',
  },
]

// ─── Lógica especial: Rua Agrimensor Sugaya ───────────────────
// Grátis a partir do nº 930 — cobrado do 929 para baixo
export function calcularTaxaSugaya(numero) {
  const num = parseInt(numero, 10)
  if (isNaN(num)) return { taxa: 5.00, zona: 'zona1', mensagem: 'Taxa padrão' }
  if (num >= 930) return { taxa: 0, zona: 'gratis', mensagem: '🎉 Entrega grátis para este endereço!' }
  return { taxa: 5.00, zona: 'zona1', mensagem: `Taxa de entrega: R$ 5,00` }
}

// ─── Buscar CEP via ViaCEP (gratuito, sem autenticação) ───────
export async function buscarCEP(cep) {
  const cepLimpo = cep.replace(/\D/g, '')
  if (cepLimpo.length !== 8) return { ok: false, erro: 'CEP inválido. Digite 8 números.' }

  try {
    const res = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`)
    if (!res.ok) return { ok: false, erro: 'Não foi possível consultar o CEP.' }
    const data = await res.json()
    if (data.erro) return { ok: false, erro: 'CEP não encontrado.' }

    return {
      ok: true,
      rua: data.logradouro,
      bairro: data.bairro,
      cidade: data.localidade,
      uf: data.uf,
      cep: data.cep,
    }
  } catch {
    return { ok: false, erro: 'Erro de conexão ao consultar CEP.' }
  }
}

// ─── Calcular taxa pelo bairro + lógica especial ──────────────
export function calcularTaxaEntrega(rua, numero, bairro, taxaAtiva = true) {
  if (!taxaAtiva) return { taxa: 0, zona: 'gratis', mensagem: 'Taxa de entrega desativada pelo admin' }

  // Lógica especial para Rua Agrimensor Sugaya
  const ruaNorm = (rua || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  if (ruaNorm.includes('agrimensor') || ruaNorm.includes('sugaya')) {
    return calcularTaxaSugaya(numero)
  }

  // Procurar por bairro nas zonas
  const bairroNorm = (bairro || '').toLowerCase()
  for (const zona of ZONAS_ENTREGA) {
    const match = zona.bairros.some(b => bairroNorm.includes(b.toLowerCase()))
    if (match) {
      return {
        taxa: zona.taxa,
        zona: zona.id,
        mensagem: zona.taxa === 0
          ? `🎉 Entrega grátis — ${zona.nome}`
          : `Taxa de entrega: R$ ${zona.taxa.toFixed(2).replace('.',',')} — ${zona.nome}`,
      }
    }
  }

  // Fora da área de entrega
  return {
    taxa: null,
    zona: 'fora',
    mensagem: '😔 Ainda não entregamos neste endereço. Entre em contato pelo WhatsApp.',
  }
}

// ─── Verificar se endereço está na área de entrega ────────────
export function foraDeArea(resultado) {
  return resultado.zona === 'fora' || resultado.taxa === null
}

// ─── Formatar CEP enquanto digita (99999-999) ─────────────────
export function formatarCEP(valor) {
  const nums = valor.replace(/\D/g, '').slice(0, 8)
  if (nums.length > 5) return `${nums.slice(0,5)}-${nums.slice(5)}`
  return nums
}

// ─── Formatar telefone enquanto digita ───────────────────────
export function formatarTelefone(valor) {
  const nums = valor.replace(/\D/g, '').slice(0, 11)
  if (nums.length === 11) return `(${nums.slice(0,2)}) ${nums.slice(2,7)}-${nums.slice(7)}`
  if (nums.length > 6)    return `(${nums.slice(0,2)}) ${nums.slice(2,6)}-${nums.slice(6)}`
  if (nums.length > 2)    return `(${nums.slice(0,2)}) ${nums.slice(2)}`
  return nums
}

// ─── SQL para adicionar zonas ao Supabase ────────────────────
export const SQL_ZONAS_ENTREGA = `
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
  ('Grátis',          0.00,  ARRAY['Vila Nova Cachoeirinha'], 'Rua Agrimensor Sugaya 930+', 1),
  ('Zona 1 — até 2km',5.00,  ARRAY['Cachoeirinha','Vila Nova Cachoeirinha','Jardim Peri'], 'Bairros próximos', 2),
  ('Zona 2 — 2 a 5km',8.00,  ARRAY['Mandaqui','Casa Verde','Limão','Vila Guilherme'], 'Bairros intermediários', 3),
  ('Zona 3 — 5 a 10km',12.00,ARRAY['Santana','Tucuruvi','Jaçanã','Tremembé'], 'Bairros mais distantes', 4)
ON CONFLICT DO NOTHING;

ALTER TABLE zonas_entrega ENABLE ROW LEVEL SECURITY;
CREATE POLICY "publico_le_zonas"  ON zonas_entrega FOR SELECT USING (ativo = TRUE);
CREATE POLICY "admin_tudo_zonas"  ON zonas_entrega FOR ALL   USING (auth.role() = 'authenticated');
`
