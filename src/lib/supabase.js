// src/lib/supabase.js
// Instale: npm install @supabase/supabase-js
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn('[Dabelle] Variáveis Supabase não configuradas. Rodando em modo offline.')
}

export const supabase = createClient(
  SUPABASE_URL || 'https://placeholder.supabase.co',
  SUPABASE_ANON_KEY || 'placeholder'
)

// ─── PRODUTOS ────────────────────────────────────────────────
export async function getProdutos() {
  const { data, error } = await supabase
    .from('produtos')
    .select('*, categoria:categorias(nome, slug)')
    .eq('ativo', true)
    .order('ordem')
  if (error) { console.error('getProdutos:', error); return [] }
  return data
}

export async function getProdutoById(id) {
  const { data, error } = await supabase
    .from('produtos')
    .select('*')
    .eq('id', id)
    .single()
  if (error) return null
  return data
}

// ─── BORDAS ───────────────────────────────────────────────────
export async function getBordas() {
  const { data, error } = await supabase
    .from('bordas')
    .select('*')
    .eq('ativo', true)
    .order('ordem')
  if (error) { console.error('getBordas:', error); return [] }
  return data
}

// ─── ADICIONAIS ───────────────────────────────────────────────
export async function getAdicionais(tipo = null) {
  let query = supabase.from('adicionais').select('*').eq('ativo', true).order('ordem')
  if (tipo) query = query.eq('tipo', tipo) // 'salgado' | 'doce'
  const { data, error } = await query
  if (error) { console.error('getAdicionais:', error); return [] }
  return data
}

// ─── PEDIDOS ──────────────────────────────────────────────────
export async function criarPedido(pedido) {
  const { data, error } = await supabase
    .from('pedidos')
    .insert([{
      cliente_nome: pedido.clienteNome,
      cliente_whatsapp: pedido.clienteWhatsapp,
      endereco_rua: pedido.enderecoRua,
      endereco_numero: pedido.enderecoNumero,
      endereco_complemento: pedido.enderecoComplemento,
      endereco_bairro: pedido.enderecoBairro,
      forma_pagamento: pedido.formaPagamento,
      troco_para: pedido.trocoPara || null,
      subtotal: pedido.subtotal,
      taxa_entrega: pedido.taxaEntrega,
      total: pedido.total,
      status: 'novo',
      itens: pedido.itens, // JSONB
    }])
    .select()
    .single()
  if (error) { console.error('criarPedido:', error); return null }
  return data
}

export async function getPedidosDoDia() {
  const hoje = new Date().toISOString().split('T')[0]
  const { data, error } = await supabase
    .from('pedidos')
    .select('*')
    .gte('created_at', `${hoje}T00:00:00`)
    .order('created_at', { ascending: false })
  if (error) { console.error('getPedidosDoDia:', error); return [] }
  return data
}

export async function atualizarStatusPedido(id, status) {
  const { error } = await supabase
    .from('pedidos')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)
  return !error
}

// ─── AVALIAÇÕES ───────────────────────────────────────────────
export async function getAvaliacoes(apenasAprovadas = true) {
  let query = supabase.from('avaliacoes').select('*').order('created_at', { ascending: false })
  if (apenasAprovadas) query = query.eq('aprovada', true)
  const { data, error } = await query
  if (error) { console.error('getAvaliacoes:', error); return [] }
  return data
}

export async function criarAvaliacao(av) {
  const { data, error } = await supabase
    .from('avaliacoes')
    .insert([{
      cliente_nome: av.clienteNome,
      estrelas: av.estrelas,
      comentario: av.comentario,
      aprovada: false, // moderação obrigatória
    }])
    .select()
    .single()
  if (error) { console.error('criarAvaliacao:', error); return null }
  return data
}

export async function aprovarAvaliacao(id) {
  const { error } = await supabase
    .from('avaliacoes')
    .update({ aprovada: true })
    .eq('id', id)
  return !error
}

// ─── CONFIGURAÇÕES ────────────────────────────────────────────
export async function getConfiguracoes() {
  const { data, error } = await supabase
    .from('configuracoes')
    .select('*')
    .eq('id', 1)
    .single()
  if (error) return null
  return data
}

export async function salvarConfiguracao(chave, valor) {
  const { error } = await supabase
    .from('configuracoes')
    .update({ [chave]: valor })
    .eq('id', 1)
  return !error
}

// ─── REALTIME: ouvir novos pedidos (painel admin) ─────────────
export function ouvirNovosPedidos(callback) {
  return supabase
    .channel('pedidos-realtime')
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'pedidos',
    }, payload => callback(payload.new))
    .subscribe()
}

// ─── AUTH ADMIN ───────────────────────────────────────────────
export async function loginAdmin(email, senha) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password: senha })
  if (error) return { ok: false, erro: error.message }
  return { ok: true, usuario: data.user }
}

export async function loginComGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${window.location.origin}/admin` }
  })
  return !error
}

export async function logoutAdmin() {
  await supabase.auth.signOut()
}

export async function getUsuarioAtual() {
  const { data } = await supabase.auth.getUser()
  return data?.user || null
}
