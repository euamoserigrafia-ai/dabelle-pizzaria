// src/lib/notifications.js
// Notificações Push — Web Push API + VAPID + Supabase

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY

// ─── Registro do Service Worker ───────────────────────────────
export async function registrarServiceWorker() {
  if (!('serviceWorker' in navigator)) return null
  try {
    const reg = await navigator.serviceWorker.register('/sw.js')
    console.log('[SW] Registrado:', reg.scope)
    return reg
  } catch (e) {
    console.error('[SW] Falha no registro:', e)
    return null
  }
}

// ─── Pedir permissão e inscrever para push ────────────────────
export async function inscreverParaPush(supabase, usuarioId = null) {
  if (!('PushManager' in window)) {
    console.warn('[Push] Navegador não suporta notificações push.')
    return null
  }

  const permissao = await Notification.requestPermission()
  if (permissao !== 'granted') {
    console.warn('[Push] Permissão negada pelo usuário.')
    return null
  }

  const reg = await navigator.serviceWorker.ready
  const subscription = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
  })

  // Salvar subscription no Supabase
  const payload = subscription.toJSON()
  const { error } = await supabase
    .from('push_subscriptions')
    .upsert({
      endpoint: payload.endpoint,
      p256dh: payload.keys.p256dh,
      auth: payload.keys.auth,
      usuario_id: usuarioId,
      dispositivo: navigator.userAgent.slice(0, 120),
      created_at: new Date().toISOString(),
    }, { onConflict: 'endpoint' })

  if (error) console.error('[Push] Erro ao salvar subscription:', error)
  return subscription
}

// ─── Verificar se já tem permissão ───────────────────────────
export function statusPermissaoPush() {
  if (!('Notification' in window)) return 'unsupported'
  return Notification.permission // 'default' | 'granted' | 'denied'
}

// ─── Enviar notificação local (sem servidor) ──────────────────
export function notificacaoLocal(titulo, corpo, opcoes = {}) {
  if (Notification.permission !== 'granted') return
  const reg = navigator.serviceWorker?.controller
  if (reg) {
    navigator.serviceWorker.ready.then(r => {
      r.showNotification(titulo, {
        body: corpo,
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        vibrate: [200, 100, 200],
        tag: opcoes.tag || 'dabelle',
        data: opcoes.data || {},
        actions: opcoes.actions || [],
      })
    })
  } else {
    new Notification(titulo, { body: corpo, icon: '/icons/icon-192.png' })
  }
}

// ─── Notificar admin sobre novo pedido ───────────────────────
export function notificarAdminNovoPedido(pedido) {
  notificacaoLocal(
    '🍕 Novo pedido chegou!',
    `#${String(pedido.numero).padStart(3,'0')} — ${pedido.cliente_nome} — R$ ${Number(pedido.total).toFixed(2).replace('.',',')}`,
    {
      tag: `pedido-${pedido.id}`,
      actions: [
        { action: 'ver', title: 'Ver pedido' },
        { action: 'aceitar', title: 'Aceitar ✅' },
      ],
      data: { pedidoId: pedido.id, url: '/admin/pedidos' },
    }
  )
  // Som de alerta
  tocarAlertaSonoro()
}

// ─── Som de alerta para novo pedido ─────────────────────────
export function tocarAlertaSonoro() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const notas = [523, 659, 784, 1047] // Dó Mi Sol Dó (acorde alegre)
    notas.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.frequency.value = freq
      osc.type = 'sine'
      gain.gain.setValueAtTime(0.3, ctx.currentTime + i * 0.15)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.15 + 0.3)
      osc.start(ctx.currentTime + i * 0.15)
      osc.stop(ctx.currentTime + i * 0.15 + 0.3)
    })
  } catch (e) {
    console.warn('[Som] Não foi possível tocar alerta:', e)
  }
}

// ─── SQL para adicionar ao Supabase ──────────────────────────
export const SQL_PUSH_SUBSCRIPTIONS = `
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  endpoint     TEXT NOT NULL UNIQUE,
  p256dh       TEXT NOT NULL,
  auth         TEXT NOT NULL,
  usuario_id   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  dispositivo  TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_push" ON push_subscriptions FOR ALL USING (auth.role() = 'authenticated');
`

// ─── helper VAPID ─────────────────────────────────────────────
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)))
}
