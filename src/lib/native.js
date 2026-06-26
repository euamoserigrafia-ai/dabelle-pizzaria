// src/lib/native.js
// Integração com plugins nativos do Capacitor
// Funciona tanto no app nativo (iOS/Android) quanto no navegador (fallback)

// ─── Detectar se está rodando como app nativo ─────────────────
export const isNative = () => !!(window.Capacitor?.isNativePlatform?.())
export const isIOS    = () => window.Capacitor?.getPlatform?.() === 'ios'
export const isAndroid= () => window.Capacitor?.getPlatform?.() === 'android'

// ─── Importação dinâmica dos plugins ─────────────────────────
async function getPlugin(name) {
  if (!isNative()) return null
  try {
    const cap = await import('@capacitor/core')
    return cap.Plugins?.[name] || null
  } catch {
    return null
  }
}

// ══════════════════════════════════════════════════════════════
// 1. BIOMETRIA — login admin com face/digital
// ══════════════════════════════════════════════════════════════
export async function loginComBiometria() {
  if (!isNative()) {
    // No navegador, simula com confirm (apenas dev)
    return { ok: confirm('Simular autenticação biométrica?'), erro: null }
  }

  try {
    const { NativeBiometric } = await import('capacitor-native-biometric')

    const available = await NativeBiometric.isAvailable()
    if (!available.isAvailable) {
      return { ok: false, erro: 'Biometria não disponível neste dispositivo.' }
    }

    const result = await NativeBiometric.verifyIdentity({
      reason: 'Confirme sua identidade para acessar o painel',
      title: 'Painel Admin — Dabelle',
      subtitle: 'Use digital ou reconhecimento facial',
      description: 'Autenticação necessária para acesso',
    })

    return { ok: true, erro: null }
  } catch (e) {
    if (e.code === 'USER_CANCEL') return { ok: false, erro: 'Cancelado pelo usuário.' }
    return { ok: false, erro: 'Falha na autenticação biométrica.' }
  }
}

// ══════════════════════════════════════════════════════════════
// 2. PUSH NOTIFICATIONS nativas
// ══════════════════════════════════════════════════════════════
export async function registrarPushNativo(onPedidoNovo) {
  if (!isNative()) return registrarPushWeb(onPedidoNovo)

  try {
    const { PushNotifications } = await import('@capacitor/push-notifications')

    // Pedir permissão
    let permissao = await PushNotifications.checkPermissions()
    if (permissao.receive === 'prompt') {
      permissao = await PushNotifications.requestPermissions()
    }
    if (permissao.receive !== 'granted') {
      console.warn('[Push] Permissão negada.')
      return null
    }

    // Registrar
    await PushNotifications.register()

    // Token recebido — salvar no Supabase
    PushNotifications.addListener('registration', token => {
      console.log('[Push] Token:', token.value)
      salvarTokenPush(token.value)
    })

    // Notificação recebida com app aberto
    PushNotifications.addListener('pushNotificationReceived', notification => {
      console.log('[Push] Recebida:', notification)
      if (notification.data?.tipo === 'novo_pedido') {
        onPedidoNovo?.(notification.data)
        vibrar('medium')
      }
    })

    // Usuário tocou na notificação
    PushNotifications.addListener('pushNotificationActionPerformed', action => {
      const data = action.notification.data
      if (data?.url) window.location.href = data.url
    })

    return true
  } catch (e) {
    console.error('[Push Nativo] Erro:', e)
    return null
  }
}

async function registrarPushWeb(onPedidoNovo) {
  // Fallback para navegador — usa Web Push API
  const { inscreverParaPush, notificarAdminNovoPedido } = await import('./notifications.js')
  return inscreverParaPush(null, null)
}

async function salvarTokenPush(token) {
  // Salva o token FCM/APNs no Supabase para envio server-side
  try {
    localStorage.setItem('dabelle_push_token', token)
    // TODO: enviar para Supabase via Edge Function
  } catch {}
}

// ══════════════════════════════════════════════════════════════
// 3. HAPTICS — vibração ao interagir
// ══════════════════════════════════════════════════════════════
export async function vibrar(intensidade = 'light') {
  if (!isNative()) return

  try {
    const { Haptics, ImpactStyle } = await import('@capacitor/haptics')
    const estilos = {
      light:  ImpactStyle.Light,
      medium: ImpactStyle.Medium,
      heavy:  ImpactStyle.Heavy,
    }
    await Haptics.impact({ style: estilos[intensidade] || ImpactStyle.Light })
  } catch {}
}

export async function vibrarNotificacao() {
  if (!isNative()) return
  try {
    const { Haptics } = await import('@capacitor/haptics')
    await Haptics.notification({ type: 'SUCCESS' })
  } catch {}
}

// ══════════════════════════════════════════════════════════════
// 4. SHARE — compartilhar link de rastreamento
// ══════════════════════════════════════════════════════════════
export async function compartilharRastreamento(numeroPedido, linkRastreamento) {
  const texto = `Acompanhe seu pedido #${String(numeroPedido).padStart(3,'0')} da Dabelle Pizzaria em tempo real:\n${linkRastreamento}`

  if (isNative()) {
    try {
      const { Share } = await import('@capacitor/share')
      await Share.share({
        title: `Pedido #${numeroPedido} — Dabelle Pizzaria`,
        text: texto,
        url: linkRastreamento,
        dialogTitle: 'Compartilhar link de rastreamento',
      })
      return
    } catch {}
  }

  // Fallback web: Web Share API ou copiar
  if (navigator.share) {
    await navigator.share({ title: 'Rastreamento Dabelle', text: texto, url: linkRastreamento })
  } else {
    await navigator.clipboard.writeText(linkRastreamento)
    alert('Link copiado para a área de transferência!')
  }
}

// ══════════════════════════════════════════════════════════════
// 5. STATUS BAR — cor dinâmica por tela
// ══════════════════════════════════════════════════════════════
export async function setStatusBar(cor = '#FFFFFF', estilo = 'LIGHT') {
  if (!isNative()) return
  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar')
    await StatusBar.setBackgroundColor({ color: cor })
    await StatusBar.setStyle({ style: estilo === 'DARK' ? Style.Dark : Style.Light })
  } catch {}
}

// Vermelho na tela admin, branco nas demais
export async function statusBarAdmin()  { await setStatusBar('#E8151B', 'DARK') }
export async function statusBarPadrao() { await setStatusBar('#FFFFFF', 'LIGHT') }

// ══════════════════════════════════════════════════════════════
// 6. SPLASH SCREEN — controle manual
// ══════════════════════════════════════════════════════════════
export async function esconderSplash() {
  if (!isNative()) return
  try {
    const { SplashScreen } = await import('@capacitor/splash-screen')
    await SplashScreen.hide({ fadeOutDuration: 300 })
  } catch {}
}

// ══════════════════════════════════════════════════════════════
// 7. CÂMERA — foto para produtos (painel admin)
// ══════════════════════════════════════════════════════════════
export async function tirarFotoProduto() {
  if (!isNative()) {
    // No navegador: usa input file
    return new Promise(resolve => {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = 'image/*'
      input.onchange = e => {
        const file = e.target.files[0]
        if (!file) return resolve(null)
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result)
        reader.readAsDataURL(file)
      }
      input.click()
    })
  }

  try {
    const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera')
    const image = await Camera.getPhoto({
      quality: 80,
      allowEditing: true,
      resultType: CameraResultType.DataUrl,
      source: CameraSource.Prompt,
      promptLabelHeader: 'Foto do produto',
      promptLabelPhoto: 'Escolher da galeria',
      promptLabelPicture: 'Tirar foto',
    })
    return image.dataUrl
  } catch (e) {
    if (e.message !== 'User cancelled photos app') console.error('[Camera]', e)
    return null
  }
}

// ══════════════════════════════════════════════════════════════
// 8. DEEP LINKS — dabelle://rastrear?pedido=66
// ══════════════════════════════════════════════════════════════
export async function registrarDeepLinks(router) {
  if (!isNative()) return

  try {
    const { App } = await import('@capacitor/app')

    App.addListener('appUrlOpen', data => {
      const url = new URL(data.url)
      if (url.hostname === 'rastrear') {
        const pedido = url.searchParams.get('pedido')
        const tel    = url.searchParams.get('tel')
        if (pedido) router?.navegar?.('rastrear', { pedido, tel })
      }
    })
  } catch {}
}

// ══════════════════════════════════════════════════════════════
// 9. NETWORK — detectar se está online
// ══════════════════════════════════════════════════════════════
export async function monitorarConexao(onMudanca) {
  if (!isNative()) {
    window.addEventListener('online',  () => onMudanca(true))
    window.addEventListener('offline', () => onMudanca(false))
    return
  }

  try {
    const { Network } = await import('@capacitor/network')
    const status = await Network.getStatus()
    onMudanca(status.connected)
    Network.addListener('networkStatusChange', s => onMudanca(s.connected))
  } catch {}
}
