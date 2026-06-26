// src/lib/rastreamento.js
// Rastreamento do pedido em tempo real — Supabase Realtime

// Status em ordem de progressão
export const ETAPAS = [
  {
    id: 'novo',
    label: 'Pedido recebido',
    emoji: '✅',
    descricao: 'Seu pedido chegou! Aguardando confirmação da pizzaria.',
    cor: '#F59E0B',
  },
  {
    id: 'producao',
    label: 'Em preparo',
    emoji: '🍕',
    descricao: 'Nossa equipe está preparando sua pizza com muito carinho!',
    cor: '#3B82F6',
  },
  {
    id: 'entrega',
    label: 'Saiu para entrega',
    emoji: '🏍️',
    descricao: 'Seu pedido está a caminho! Fique de olho.',
    cor: '#8B5CF6',
  },
  {
    id: 'finalizado',
    label: 'Entregue!',
    emoji: '🎉',
    descricao: 'Pedido entregue. Bom apetite! 😋',
    cor: '#10B981',
  },
]

export const STATUS_RECUSADO = {
  id: 'recusado',
  label: 'Pedido recusado',
  emoji: '😔',
  descricao: 'Infelizmente não conseguimos atender seu pedido agora. Entre em contato pelo WhatsApp.',
  cor: '#EF4444',
}

// ─── Índice da etapa atual ────────────────────────────────────
export function indiceEtapa(status) {
  return ETAPAS.findIndex(e => e.id === status)
}

export function etapaAtual(status) {
  if (status === 'recusado') return STATUS_RECUSADO
  return ETAPAS.find(e => e.id === status) || ETAPAS[0]
}

// ─── Buscar pedido pelo número + WhatsApp (autenticação simples) ──
export async function buscarPedidoCliente(supabase, numeroPedido, whatsapp) {
  const numeroLimpo = whatsapp.replace(/\D/g, '')

  const { data, error } = await supabase
    .from('pedidos')
    .select('id, numero, status, cliente_nome, itens, total, created_at, updated_at')
    .eq('numero', numeroPedido)
    .eq('cliente_whatsapp', numeroLimpo)
    .single()

  if (error || !data) {
    return { ok: false, erro: 'Pedido não encontrado. Verifique o número e o WhatsApp.' }
  }
  return { ok: true, pedido: data }
}

// ─── Ouvir mudanças de status em tempo real ──────────────────
export function ouvirStatusPedido(supabase, pedidoId, onMudanca) {
  const canal = supabase
    .channel(`pedido-${pedidoId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'pedidos',
        filter: `id=eq.${pedidoId}`,
      },
      payload => {
        onMudanca(payload.new)
      }
    )
    .subscribe()

  // Retorna função para cancelar a assinatura
  return () => supabase.removeChannel(canal)
}

// ─── Tempo estimado por status ────────────────────────────────
export function tempoEstimado(status, criadoEm) {
  const agora = new Date()
  const criado = new Date(criadoEm)
  const minutosPassados = Math.floor((agora - criado) / 60000)

  const estimativas = {
    novo:       { min: 5,  label: 'Confirmação em até 5 min' },
    producao:   { min: 25, label: 'Pronto em aprox. 25 min' },
    entrega:    { min: 15, label: 'Chegando em até 15 min' },
    finalizado: { min: 0,  label: 'Entregue!' },
    recusado:   { min: 0,  label: '' },
  }

  const est = estimativas[status] || estimativas.novo
  const restante = Math.max(0, est.min - minutosPassados)

  return {
    label: est.label,
    minutosRestantes: restante,
    minutosPassados,
    textoRestante: restante > 0 ? `~${restante} min restantes` : est.label,
  }
}

// ─── Gerar link de rastreamento para enviar ao cliente ────────
export function linkRastreamento(numeroPedido, whatsapp) {
  const base = window.location.origin
  return `${base}/rastrear?pedido=${numeroPedido}&tel=${whatsapp.replace(/\D/g,'')}`
}

// ─── Salvar último pedido no dispositivo (para acesso rápido) ─
export function salvarPedidoLocal(pedido) {
  const dados = {
    id: pedido.id,
    numero: pedido.numero,
    whatsapp: pedido.cliente_whatsapp,
    salvoEm: new Date().toISOString(),
  }
  localStorage.setItem('dabelle_ultimo_pedido', JSON.stringify(dados))
}

export function getPedidoLocal() {
  try {
    return JSON.parse(localStorage.getItem('dabelle_ultimo_pedido') || 'null')
  } catch {
    return null
  }
}
