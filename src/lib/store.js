// src/lib/store.js
// Estado global reativo sem framework — pub/sub simples

const state = {
  // Cardápio
  produtos: [],
  bordas: [],
  adicionais: [],
  categoriaAtiva: 'all',
  busca: '',

  // Carrinho
  carrinho: JSON.parse(localStorage.getItem('dabelle_carrinho') || '[]'),

  // Checkout
  formaPagamento: 'dinheiro',
  trocoPara: null,

  // Loja
  lojaAberta: true,
  taxaEntrega: 5.00,
  configuracoes: null,

  // UI
  viewAtual: 'home',
  viewAnterior: [],
  modalProduto: null,
  modalStep: 0,
  modalSel: {},

  // Admin
  usuarioAdmin: null,
  pedidosDoDia: [],

  // Avaliações
  avaliacoes: [],
}

const listeners = {}

export function getState(chave) {
  return chave ? state[chave] : { ...state }
}

export function setState(chave, valor) {
  state[chave] = valor
  emit(chave, valor)

  // Persistir carrinho automaticamente
  if (chave === 'carrinho') {
    localStorage.setItem('dabelle_carrinho', JSON.stringify(valor))
  }
}

export function on(chave, fn) {
  if (!listeners[chave]) listeners[chave] = []
  listeners[chave].push(fn)
  return () => off(chave, fn) // retorna unsubscribe
}

export function off(chave, fn) {
  if (listeners[chave]) {
    listeners[chave] = listeners[chave].filter(f => f !== fn)
  }
}

function emit(chave, valor) {
  if (listeners[chave]) {
    listeners[chave].forEach(fn => fn(valor))
  }
  // wildcard '*' para quem quiser ouvir qualquer mudança
  if (listeners['*']) {
    listeners['*'].forEach(fn => fn(chave, valor))
  }
}

// ─── Ações do carrinho ────────────────────────────────────────

export function adicionarAoCarrinho(item) {
  const cart = [...state.carrinho, { ...item, id: Date.now() }]
  setState('carrinho', cart)
}

export function removerDoCarrinho(itemId) {
  const cart = state.carrinho.filter(i => i.id !== itemId)
  setState('carrinho', cart)
}

export function alterarQtdCarrinho(itemId, delta) {
  const cart = state.carrinho
    .map(i => i.id === itemId ? { ...i, qty: i.qty + delta } : i)
    .filter(i => i.qty > 0)
  setState('carrinho', cart)
}

export function limparCarrinho() {
  setState('carrinho', [])
}

export function totalCarrinho() {
  const sub = state.carrinho.reduce((a, i) => a + i.preco * i.qty, 0)
  const taxa = state.taxaEntrega
  let total = sub + taxa
  if (state.formaPagamento === 'cartao') total *= 1.0314
  return { subtotal: sub, taxa, total }
}

export function qtdItensCarrinho() {
  return state.carrinho.reduce((a, i) => a + i.qty, 0)
}

// ─── Navegação ────────────────────────────────────────────────

export function navegar(view) {
  const atual = state.viewAtual
  if (atual !== view) {
    setState('viewAnterior', [...state.viewAnterior, atual])
  }
  setState('viewAtual', view)
}

export function voltarView() {
  const historico = [...state.viewAnterior]
  const anterior = historico.pop() || 'home'
  setState('viewAnterior', historico)
  setState('viewAtual', anterior)
}
