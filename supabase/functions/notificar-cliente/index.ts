// supabase/functions/notificar-cliente/index.ts
// Chamada pelo painel admin ao mudar o status do pedido
// POST { pedidoId, status }

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)
const WA_TOKEN    = Deno.env.get('WA_TOKEN')!
const WA_PHONE_ID = Deno.env.get('WA_PHONE_ID')!
const APP_URL     = Deno.env.get('APP_URL') || 'https://pedidos.dabellepizzaria.com.br'

serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return new Response('Unauthorized', { status: 401 })

  try {
    const { pedidoId, status } = await req.json()
    if (!pedidoId || !status) return new Response('pedidoId e status obrigatórios', { status: 400 })

    // Buscar dados do pedido
    const { data: pedido, error } = await supabase
      .from('pedidos')
      .select('*')
      .eq('id', pedidoId)
      .single()

    if (error || !pedido) return new Response('Pedido não encontrado', { status: 404 })

    const numero = String(pedido.numero).padStart(3, '0')
    const nome   = pedido.cliente_nome.split(' ')[0]
    const linkRastreamento = `${APP_URL}/rastrear?pedido=${pedido.numero}&tel=${pedido.cliente_whatsapp.replace(/\D/g,'')}`

    // Mensagens por status (texto livre — sem template, dentro da janela de 24h)
    const mensagens: Record<string, string> = {
      producao: (
        `🍕 Olá, *${nome}*! Seu pedido *#${numero}* foi confirmado e está sendo preparado com muito carinho.\n\n` +
        `⏱️ Previsão: aproximadamente 25 minutos.\n\n` +
        `Acompanhe em tempo real: ${linkRastreamento}`
      ),
      entrega: (
        `🏍️ *Saiu para entrega!*\n\n` +
        `Seu pedido *#${numero}* está a caminho! Fique de olho, já já chega quentinho. 🍕\n\n` +
        `📍 Acompanhe: ${linkRastreamento}`
      ),
      finalizado: (
        `✅ Pedido *#${numero}* entregue!\n\n` +
        `Esperamos que você curta muito! 😋 Sua opinião é muito importante para nós.\n\n` +
        `Deixe uma avaliação: ${APP_URL}?avaliacao=1\n\n` +
        `Obrigado pela preferência! Até a próxima! 🍕`
      ),
      recusado: (
        `😔 Olá, *${nome}*. Infelizmente não conseguiremos atender o pedido *#${numero}* neste momento.\n\n` +
        `Pedimos desculpas pelo transtorno. Entre em contato pelo WhatsApp para mais informações.\n\n` +
        `📞 (11) 94862-5369`
      ),
    }

    const mensagem = mensagens[status]
    if (!mensagem) return new Response('Status sem mensagem configurada', { status: 400 })

    // Enviar via WhatsApp API
    const tel = pedido.cliente_whatsapp.replace(/\D/g, '')
    const to  = tel.startsWith('55') ? tel : `55${tel}`

    const waRes = await fetch(`https://graph.facebook.com/v19.0/${WA_PHONE_ID}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${WA_TOKEN}`,
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body: mensagem },
      }),
    })

    const waData = await waRes.json()

    // Registrar notificação enviada no pedido
    const notificados = pedido.notificado_em || {}
    notificados[status] = new Date().toISOString()

    await supabase
      .from('pedidos')
      .update({ notificado_em: notificados })
      .eq('id', pedidoId)

    return new Response(JSON.stringify({
      ok: waRes.ok,
      messageId: waData.messages?.[0]?.id,
      status,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })

  } catch (err) {
    console.error('[notificar-cliente]', err)
    return new Response('Internal error', { status: 500 })
  }
})
