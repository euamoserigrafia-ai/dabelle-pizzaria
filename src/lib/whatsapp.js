// src/lib/whatsapp.js
// Integração com WhatsApp Business via link wa.me

const WHATSAPP_LOJA = import.meta.env.VITE_WHATSAPP_LOJA || '5511948625369'

/**
 * Formata um pedido como mensagem WhatsApp e abre o app.
 */
export function enviarPedidoWhatsApp(pedido) {
  const linhaItens = pedido.itens
    .map(i => `• ${i.qty}x ${i.nome}${i.detalhe ? ` (${i.detalhe})` : ''} — R$ ${fmtMoeda(i.preco * i.qty)}`)
    .join('\n')

  const pagLabel = { dinheiro: '💵 Dinheiro', pix: '📱 Pix', cartao: '💳 Cartão' }[pedido.formaPagamento]
  const trocoLine = pedido.trocoPara ? `\n💱 *Troco para:* R$ ${fmtMoeda(pedido.trocoPara)}` : ''

  const msg = [
    `🍕 *NOVO PEDIDO — DABELLE PIZZARIA*`,
    ``,
    `👤 *Cliente:* ${pedido.clienteNome}`,
    `📞 *WhatsApp:* ${pedido.clienteWhatsapp}`,
    `📍 *Endereço:* ${pedido.enderecoRua}, ${pedido.enderecoNumero}${pedido.enderecoComplemento ? ' — ' + pedido.enderecoComplemento : ''}, ${pedido.enderecoBairro}`,
    ``,
    `🛒 *Itens:*`,
    linhaItens,
    ``,
    `💰 *Subtotal:* R$ ${fmtMoeda(pedido.subtotal)}`,
    `🛵 *Entrega:* R$ ${fmtMoeda(pedido.taxaEntrega)}`,
    `✅ *TOTAL: R$ ${fmtMoeda(pedido.total)}*`,
    ``,
    `${pagLabel}${trocoLine}`,
    pedido.observacao ? `\n📝 *Obs:* ${pedido.observacao}` : '',
  ].filter(l => l !== undefined).join('\n')

  abrirWhatsApp(WHATSAPP_LOJA, msg)
}

/**
 * Notifica o cliente sobre o status do pedido.
 * Chamado pelo painel admin.
 */
export function notificarCliente(telefoneCliente, status, numeroPedido) {
  const mensagens = {
    producao: `🍕 Olá! Seu pedido *${numeroPedido}* da Dabelle Pizzaria foi *aceito* e está sendo preparado com carinho. Em breve chega até você! 😊`,
    entrega:  `🏍️ Boa notícia! Seu pedido *${numeroPedido}* *saiu para entrega*! Fique de olho, está chegando quentinho. 🍕`,
    recusado: `😔 Infelizmente não conseguimos atender o pedido *${numeroPedido}* no momento. Pedimos desculpas pelo transtorno. Tente novamente mais tarde!`,
  }
  const msg = mensagens[status]
  if (msg) abrirWhatsApp(telefoneCliente.replace(/\D/g, ''), msg)
}

/**
 * Abre o WhatsApp com a mensagem pré-preenchida.
 */
export function abrirWhatsApp(numero, mensagem) {
  const url = `https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}`
  window.open(url, '_blank', 'noopener,noreferrer')
}

/**
 * Envia aviso de atraso para todos os clientes com pedido em produção.
 */
export function avisarAtraso(pedidosEmProducao) {
  pedidosEmProducao.forEach((pedido, i) => {
    setTimeout(() => {
      notificarCliente(
        pedido.cliente_whatsapp,
        'atraso',
        `#${String(pedido.numero).padStart(3, '0')}`
      )
    }, i * 500) // Pequeno delay para não abrir tudo ao mesmo tempo
  })
}

// ─── helpers ──────────────────────────────────────────────────
function fmtMoeda(valor) {
  return Number(valor).toFixed(2).replace('.', ',')
}
