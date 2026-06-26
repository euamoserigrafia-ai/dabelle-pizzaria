// supabase/functions/whatsapp-webhook/index.ts
// Edge Function — recebe mensagens de clientes via WhatsApp Business API
// URL configurar no Meta: https://SEU_PROJETO.supabase.co/functions/v1/whatsapp-webhook

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const WA_TOKEN      = Deno.env.get('WA_TOKEN')!
const WA_PHONE_ID   = Deno.env.get('WA_PHONE_ID')!
const VERIFY_TOKEN  = Deno.env.get('WA_VERIFY_TOKEN') || 'dabelle-verify-2024'

serve(async (req) => {
  // ── Verificação do webhook (Meta exige GET para confirmar URL) ──
  if (req.method === 'GET') {
    const url    = new URL(req.url)
    const mode   = url.searchParams.get('hub.mode')
    const token  = url.searchParams.get('hub.verify_token')
    const challenge = url.searchParams.get('hub.challenge')

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('[WA Webhook] Verificado com sucesso')
      return new Response(challenge, { status: 200 })
    }
    return new Response('Forbidden', { status: 403 })
  }

  // ── Receber mensagem ──────────────────────────────────────────
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  try {
    const body = await req.json()
    const entry = body.entry?.[0]?.changes?.[0]?.value

    // Confirmar leitura (read receipt)
    const messageId = entry?.messages?.[0]?.id
    if (messageId) await marcarComoLida(messageId)

    const msg = entry?.messages?.[0]
    if (!msg) return new Response('OK', { status: 200 })

    const de    = msg.from           // número do remetente
    const tipo  = msg.type           // text | interactive | button
    const texto = msg.text?.body?.toLowerCase().trim() || ''

    console.log(`[WA] Mensagem de ${de}: "${texto}"`)

    // ── Chatbot automático ────────────────────────────────────
    const resposta = await processarMensagem(de, texto, msg)
    if (resposta) await enviarTexto(de, resposta)

    return new Response('OK', { status: 200 })

  } catch (err) {
    console.error('[WA Webhook] Erro:', err)
    return new Response('Error', { status: 500 })
  }
})

// ─── Processamento de mensagens recebidas ────────────────────
async function processarMensagem(de: string, texto: string, msg: any): Promise<string | null> {
  // Saudações
  if (/^(oi|olá|ola|bom dia|boa tarde|boa noite|hey|hello)/.test(texto)) {
    return (
      `Olá! 👋 Seja bem-vindo à *Dabelle Pizzaria*! 🍕\n\n` +
      `Como posso ajudar?\n` +
      `1️⃣ Ver cardápio\n` +
      `2️⃣ Fazer pedido\n` +
      `3️⃣ Rastrear pedido\n` +
      `4️⃣ Horário de funcionamento\n\n` +
      `Ou acesse nosso app: ${Deno.env.get('APP_URL') || 'https://pedidos.dabellepizzaria.com.br'}`
    )
  }

  // Cardápio
  if (texto.includes('cardápio') || texto.includes('cardapio') || texto.includes('menu') || texto === '1') {
    return (
      `🍕 *Cardápio Dabelle Pizzaria*\n\n` +
      `*Pizzas Salgadas (8 fatias)*\n` +
      `• Calabresa — R$ 35,00\n` +
      `• Frango c/ Catupiry — R$ 40,00\n` +
      `• Mussarela — R$ 35,00\n` +
      `• Portuguesa — R$ 35,00\n` +
      `• Caipira — R$ 48,00\n\n` +
      `*Pizzas Doces (6 fatias)*\n` +
      `• Brigadinho — R$ 25,00\n` +
      `• Ninho c/ Morango — R$ 28,00\n\n` +
      `*Bebidas*\n` +
      `• Coca-Cola 2L — R$ 18,00\n\n` +
      `📱 Monte seu pedido no app: ${Deno.env.get('APP_URL')}`
    )
  }

  // Pedido / fazer pedido
  if (texto.includes('pedido') && (texto.includes('fazer') || texto.includes('quero') || texto.includes('pedir')) || texto === '2') {
    return (
      `Ótimo! Para fazer seu pedido, acesse nosso app:\n` +
      `👉 ${Deno.env.get('APP_URL') || 'https://pedidos.dabellepizzaria.com.br'}\n\n` +
      `Pelo app você pode:\n` +
      `✅ Escolher sabores e bordas\n` +
      `✅ Pagar via Pix, Cartão ou Dinheiro\n` +
      `✅ Rastrear seu pedido em tempo real`
    )
  }

  // Rastreamento
  if (texto.includes('rastrear') || texto.includes('pedido') || texto === '3') {
    return (
      `Para rastrear seu pedido, acesse:\n` +
      `👉 ${Deno.env.get('APP_URL')}/rastrear\n\n` +
      `Ou me informe o número do pedido (ex: *#066*) que verifico para você.`
    )
  }

  // Horário
  if (texto.includes('horário') || texto.includes('horario') || texto.includes('aberto') || texto.includes('fecha') || texto === '4') {
    const aberta = isLojaAberta()
    return (
      `🕒 *Horário de funcionamento:*\n` +
      `Terça a Domingo — 18h às 23h\n` +
      `(Fechamos às segundas-feiras)\n\n` +
      `Status atual: ${aberta ? '🟢 *Aberta*' : '🔴 *Fechada*'}`
    )
  }

  // Pagamento
  if (texto.includes('pagamento') || texto.includes('pix') || texto.includes('cartão') || texto.includes('cartao')) {
    return (
      `💳 *Formas de pagamento:*\n\n` +
      `📱 *Pix* — à vista, sem taxas\n` +
      `💳 *Cartão* — crédito/débito (+3,14%)\n` +
      `💵 *Dinheiro* — levamos troco\n\n` +
      `Chave Pix (CNPJ): *63.733.611/0001-69*`
    )
  }

  // Taxa de entrega
  if (texto.includes('taxa') || texto.includes('entrega') || texto.includes('frete') || texto.includes('deliver')) {
    return (
      `🛵 *Taxa de entrega:*\n\n` +
      `Calculada automaticamente pelo endereço no app.\n` +
      `• Rua Agrimensor Sugaya (nº 930+): *grátis*\n` +
      `• Bairros próximos: a partir de R$ 5,00\n\n` +
      `Atendemos São Paulo — região norte/central.`
    )
  }

  // Número de pedido específico (ex: "#066", "066", "pedido 66")
  const matchPedido = texto.match(/#?(\d{1,4})/)
  if (matchPedido && texto.includes('pedido')) {
    const numero = parseInt(matchPedido[1])
    const status = await buscarStatusPedido(de, numero)
    if (status) return status
  }

  // Fallback
  return (
    `Não entendi muito bem! 😅\n\n` +
    `Posso ajudar com:\n` +
    `• *cardápio* — ver pizzas e preços\n` +
    `• *pedido* — fazer um pedido\n` +
    `• *rastrear* — acompanhar entrega\n` +
    `• *horário* — quando estamos abertos\n\n` +
    `Ou fale com um atendente: wa.me/5511948625369`
  )
}

async function buscarStatusPedido(whatsapp: string, numero: number) {
  const tel = whatsapp.replace(/\D/g, '')
  const { data } = await supabase
    .from('pedidos')
    .select('numero, status, total')
    .eq('numero', numero)
    .eq('cliente_whatsapp', tel)
    .single()

  if (!data) return null

  const labels: Record<string, string> = {
    novo:       '⏳ Aguardando confirmação',
    producao:   '🍕 Em preparo',
    entrega:    '🏍️ Saiu para entrega',
    finalizado: '✅ Entregue',
    recusado:   '❌ Não atendido',
  }

  return (
    `📦 *Pedido #${String(data.numero).padStart(3,'0')}*\n` +
    `Status: ${labels[data.status] || data.status}\n` +
    `Total: R$ ${Number(data.total).toFixed(2).replace('.',',')}\n\n` +
    `Acompanhe em tempo real: ${Deno.env.get('APP_URL')}/rastrear`
  )
}

async function enviarTexto(para: string, texto: string) {
  const num = para.replace(/\D/g, '')
  const to  = num.startsWith('55') ? num : `55${num}`

  await fetch(`https://graph.facebook.com/v19.0/${WA_PHONE_ID}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${WA_TOKEN}` },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body: texto },
    }),
  })
}

async function marcarComoLida(messageId: string) {
  await fetch(`https://graph.facebook.com/v19.0/${WA_PHONE_ID}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${WA_TOKEN}` },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      status: 'read',
      message_id: messageId,
    }),
  })
}

function isLojaAberta(): boolean {
  const now  = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }))
  const dia  = now.getDay()   // 0=dom, 1=seg...
  const hora = now.getHours()
  return dia !== 1 && hora >= 18 && hora < 23
}
