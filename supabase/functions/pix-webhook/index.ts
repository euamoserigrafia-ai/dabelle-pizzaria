// supabase/functions/pix-webhook/index.ts
// Edge Function — recebe confirmação de pagamento do Mercado Pago
// URL: https://SEU_PROJETO.supabase.co/functions/v1/pix-webhook
// Configurar no Mercado Pago: notification_url neste endpoint

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const MP_ACCESS_TOKEN = Deno.env.get('MP_ACCESS_TOKEN')!

serve(async (req) => {
  // Apenas POST
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  try {
    const body = await req.json()
    console.log('[Pix Webhook]', JSON.stringify(body))

    // Mercado Pago envia: { action: 'payment.updated', data: { id: '...' } }
    if (body.type !== 'payment') {
      return new Response('OK', { status: 200 })
    }

    const paymentId = body.data?.id
    if (!paymentId) return new Response('No payment ID', { status: 400 })

    // Consultar detalhes do pagamento na API do MP
    const mpRes = await fetch(
      `https://api.mercadopago.com/v1/payments/${paymentId}`,
      { headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` } }
    )
    const payment = await mpRes.json()

    if (payment.status !== 'approved') {
      console.log('[Pix] Pagamento não aprovado ainda:', payment.status)
      return new Response('OK', { status: 200 })
    }

    const pedidoId = payment.metadata?.pedido_id
    if (!pedidoId) {
      console.error('[Pix] pedido_id não encontrado nos metadados')
      return new Response('OK', { status: 200 })
    }

    // Marcar pagamento como confirmado no banco
    const { data: pedido, error } = await supabase
      .from('pedidos')
      .update({
        pix_status:    'aprovado',
        pix_payment_id: String(paymentId),
        updated_at:    new Date().toISOString(),
      })
      .eq('id', pedidoId)
      .select()
      .single()

    if (error) {
      console.error('[Pix] Erro ao atualizar pedido:', error)
      return new Response('DB error', { status: 500 })
    }

    // Notificar admin via Supabase Realtime (já configurado)
    // A mudança no banco dispara o listener do painel admin automaticamente

    // Notificar cliente via WhatsApp
    if (pedido?.cliente_whatsapp) {
      await notificarClientePix(pedido)
    }

    console.log(`[Pix] Pagamento #${paymentId} aprovado para pedido ${pedido?.numero}`)
    return new Response('OK', { status: 200 })

  } catch (err) {
    console.error('[Pix Webhook] Erro:', err)
    return new Response('Internal error', { status: 500 })
  }
})

async function notificarClientePix(pedido: any) {
  const waToken   = Deno.env.get('WA_TOKEN')
  const waPhoneId = Deno.env.get('WA_PHONE_ID')

  if (!waToken || !waPhoneId) return

  const num = pedido.cliente_whatsapp.replace(/\D/g, '')
  const para = num.startsWith('55') ? num : `55${num}`

  await fetch(`https://graph.facebook.com/v19.0/${waPhoneId}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${waToken}`,
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: para,
      type: 'template',
      template: {
        name: 'dabelle_pix_confirmado',
        language: { code: 'pt_BR' },
        components: [{
          type: 'body',
          parameters: [{ type: 'text', text: String(pedido.numero).padStart(3, '0') }],
        }],
      },
    }),
  })
}
