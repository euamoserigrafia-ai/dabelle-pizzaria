// src/lib/whatsapp-api.js
// WhatsApp Business Cloud API (Meta) — mensagens automáticas por template
// Documentação: https://developers.facebook.com/docs/whatsapp/cloud-api

const WA_BASE    = 'https://graph.facebook.com/v19.0'
const WA_PHONE   = import.meta.env.VITE_WA_PHONE_ID    // ID do número no Meta
const WA_TOKEN   = import.meta.env.VITE_WA_TOKEN       // Token de acesso permanente

// ══════════════════════════════════════════════════════════════
// TEMPLATES PRÉ-APROVADOS PELA META
// Cada template precisa ser criado e aprovado no painel Meta Business
// https://business.facebook.com/wa/manage/message-templates/
// ══════════════════════════════════════════════════════════════

const TEMPLATES = {
  // Confirmação de pedido recebido
  pedido_recebido: {
    name: 'dabelle_pedido_recebido',
    language: 'pt_BR',
    // Mensagem: "Olá {{1}}! Seu pedido #{{2}} foi recebido. Total: R$ {{3}}. Aguardando confirmação..."
  },

  // Pedido aceito — em produção
  pedido_aceito: {
    name: 'dabelle_pedido_aceito',
    language: 'pt_BR',
    // "Boa notícia! Seu pedido #{{1}} foi aceito e está sendo preparado. Previsão: {{2}} min."
  },

  // Saiu para entrega
  pedido_entrega: {
    name: 'dabelle_pedido_entrega',
    language: 'pt_BR',
    // "Seu pedido #{{1}} saiu para entrega! Acompanhe em tempo real: {{2}}"
  },

  // Pedido recusado
  pedido_recusado: {
    name: 'dabelle_pedido_recusado',
    language: 'pt_BR',
    // "Infelizmente não conseguimos atender o pedido #{{1}} neste momento. Pedimos desculpas."
  },

  // Pagamento Pix confirmado
  pix_confirmado: {
    name: 'dabelle_pix_confirmado',
    language: 'pt_BR',
    // "Pagamento Pix confirmado para o pedido #{{1}}. Obrigado!"
  },

  // Aviso de atraso
  aviso_atraso: {
    name: 'dabelle_aviso_atraso',
    language: 'pt_BR',
    // "Olá {{1}}! Seu pedido #{{2}} está levando um pouco mais que o esperado. Pedimos desculpas!"
  },
}

// ─── Enviar mensagem template ─────────────────────────────────
async function enviarTemplate(para, templateKey, parametros = []) {
  const template = TEMPLATES[templateKey]
  if (!template) {
    console.error('[WA API] Template desconhecido:', templateKey)
    return { ok: false }
  }

  // Formatar componentes com os parâmetros
  const components = parametros.length > 0
    ? [{
        type: 'body',
        parameters: parametros.map(p => ({ type: 'text', text: String(p) })),
      }]
    : []

  const res = await fetch(`${WA_BASE}/${WA_PHONE}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${WA_TOKEN}`,
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: formatarTelefoneWA(para),
      type: 'template',
      template: { name: template.name, language: { code: template.language }, components },
    }),
  })

  const data = await res.json()
  if (!res.ok) {
    console.error('[WA API] Erro ao enviar:', data)
    return { ok: false, erro: data.error?.message }
  }

  return { ok: true, messageId: data.messages?.[0]?.id }
}

// ─── Enviar mensagem de texto livre (janela de 24h) ───────────
async function enviarTexto(para, texto) {
  const res = await fetch(`${WA_BASE}/${WA_PHONE}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${WA_TOKEN}`,
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: formatarTelefoneWA(para),
      type: 'text',
      text: { preview_url: false, body: texto },
    }),
  })

  const data = await res.json()
  return { ok: res.ok, messageId: data.messages?.[0]?.id }
}

// ══════════════════════════════════════════════════════════════
// AUTOMAÇÕES — chamadas pelo painel admin e webhooks
// ══════════════════════════════════════════════════════════════

// Chamado ao receber novo pedido (cliente recebe confirmação)
export async function notificarPedidoRecebido(pedido) {
  return enviarTemplate(
    pedido.cliente_whatsapp,
    'pedido_recebido',
    [
      pedido.cliente_nome.split(' ')[0],
      String(pedido.numero).padStart(3, '0'),
      Number(pedido.total).toFixed(2).replace('.', ','),
    ]
  )
}

// Chamado quando admin aceita o pedido
export async function notificarPedidoAceito(pedido, minutos = 25) {
  return enviarTemplate(
    pedido.cliente_whatsapp,
    'pedido_aceito',
    [String(pedido.numero).padStart(3, '0'), String(minutos)]
  )
}

// Chamado quando admin marca "saiu para entrega"
export async function notificarPedidoEntrega(pedido, linkRastreamento) {
  return enviarTemplate(
    pedido.cliente_whatsapp,
    'pedido_entrega',
    [String(pedido.numero).padStart(3, '0'), linkRastreamento]
  )
}

// Chamado quando admin recusa o pedido
export async function notificarPedidoRecusado(pedido) {
  return enviarTemplate(
    pedido.cliente_whatsapp,
    'pedido_recusado',
    [String(pedido.numero).padStart(3, '0')]
  )
}

// Chamado quando Pix é confirmado
export async function notificarPixConfirmado(pedido) {
  return enviarTemplate(
    pedido.cliente_whatsapp,
    'pix_confirmado',
    [String(pedido.numero).padStart(3, '0')]
  )
}

// Botão "Aviso de Atraso" — envia para todos em produção
export async function avisarAtrasoEmMassa(pedidosEmProducao) {
  const resultados = []
  for (const pedido of pedidosEmProducao) {
    const r = await enviarTemplate(
      pedido.cliente_whatsapp,
      'aviso_atraso',
      [pedido.cliente_nome.split(' ')[0], String(pedido.numero).padStart(3, '0')]
    )
    resultados.push({ pedidoId: pedido.id, ...r })
    await esperar(300) // delay entre envios para não ser bloqueado
  }
  return resultados
}

// ─── Fallback: link wa.me (sem API, sempre funciona) ─────────
export function linkWhatsApp(numero, mensagem) {
  return `https://wa.me/${formatarTelefoneWA(numero)}?text=${encodeURIComponent(mensagem)}`
}

export function abrirWhatsApp(numero, mensagem) {
  window.open(linkWhatsApp(numero, mensagem), '_blank', 'noopener,noreferrer')
}

// ─── Montar mensagem completa de pedido (fallback wa.me) ─────
export function montarMensagemPedido(pedido) {
  const itens = (pedido.itens || [])
    .map(i => `• ${i.qty}x ${i.nome}${i.detalhe ? ` (${i.detalhe})` : ''} — R$ ${fmtMoeda(i.preco * i.qty)}`)
    .join('\n')

  const pagLabel = { dinheiro: '💵 Dinheiro', pix: '📱 Pix', cartao: '💳 Cartão' }

  return [
    `🍕 *NOVO PEDIDO — DABELLE PIZZARIA*`,
    ``,
    `👤 *Cliente:* ${pedido.clienteNome}`,
    `📞 *WhatsApp:* ${pedido.clienteWhatsapp}`,
    `📍 *Endereço:* ${pedido.enderecoRua}, ${pedido.enderecoNumero}${pedido.enderecoComplemento ? ' — ' + pedido.enderecoComplemento : ''}, ${pedido.enderecoBairro}`,
    ``,
    `🛒 *Itens:*`,
    itens,
    ``,
    `💰 *Subtotal:* R$ ${fmtMoeda(pedido.subtotal)}`,
    `🛵 *Entrega:* R$ ${fmtMoeda(pedido.taxaEntrega)}`,
    pedido.desconto > 0 ? `🎟️ *Desconto:* - R$ ${fmtMoeda(pedido.desconto)}` : null,
    `✅ *TOTAL: R$ ${fmtMoeda(pedido.total)}*`,
    ``,
    pagLabel[pedido.formaPagamento] || pedido.formaPagamento,
    pedido.trocoPara ? `💱 Troco para: R$ ${fmtMoeda(pedido.trocoPara)}` : null,
    pedido.observacao ? `📝 Obs: ${pedido.observacao}` : null,
  ].filter(Boolean).join('\n')
}

// ─── helpers ──────────────────────────────────────────────────
function formatarTelefoneWA(num) {
  const limpo = String(num).replace(/\D/g, '')
  return limpo.startsWith('55') ? limpo : `55${limpo}`
}

function fmtMoeda(v) { return Number(v).toFixed(2).replace('.', ',') }
function esperar(ms) { return new Promise(r => setTimeout(r, ms)) }
