// capacitor.config.ts
// Configuração principal do Capacitor — converte o app web em nativo
import { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  // ID único do app nas lojas (formato: com.empresa.app)
  appId: 'br.com.dabellepizzaria.app',

  // Nome exibido na tela inicial do celular
  appName: 'Dabelle Pizzaria',

  // Pasta onde está o build do app web
  webDir: 'dist',

  // Servidor de desenvolvimento (remova em produção)
  server: {
    androidScheme: 'https',
  },

  // ─── iOS ──────────────────────────────────────────────────
  ios: {
    // Esquema de URL para deep links (dabelle://rastrear?pedido=66)
    scheme: 'dabelle',

    // Cor da barra de status
    backgroundColor: '#FFFFFF',

    // Permite scroll com bounce nativo no iOS
    scrollEnabled: true,

    // Limita orientação para retrato (app de pedidos, não precisa de paisagem)
    allowsLinkPreview: false,
  },

  // ─── Android ──────────────────────────────────────────────
  android: {
    // Cor da barra de status Android
    backgroundColor: '#FFFFFF',

    // Permite que o app abra o WhatsApp via Intent
    allowMixedContent: false,

    // Versão mínima do Android: 7.0 (API 24) — cobre 98% dos dispositivos
    minWebViewVersion: 55,
  },

  // ─── Plugins nativos ──────────────────────────────────────
  plugins: {
    // Notificações push
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },

    // Splash screen
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#FFFFFF',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      iosSpinnerStyle: 'small',
      spinnerColor: '#E8151B',
    },

    // Barra de status
    StatusBar: {
      style: 'LIGHT',
      backgroundColor: '#FFFFFF',
    },

    // Teclado
    Keyboard: {
      resize: 'body',
      style: 'LIGHT',
      resizeOnFullScreen: true,
    },

    // Haptics (vibração ao tocar)
    Haptics: {},

    // Biometria para login admin
    BiometricAuth: {
      androidBiometricPromptTitle: 'Acesso Admin',
      androidBiometricPromptSubtitle: 'Confirme sua identidade',
      androidBiometricPromptDescription: 'Use sua digital ou rosto para acessar',
    },

    // Permissão de localização (opcional — para cálculo de taxa)
    Geolocation: {
      iosLocationWhenInUseUsageDescription:
        'Usamos sua localização para calcular a taxa de entrega.',
      iosLocationAlwaysAndWhenInUseUsageDescription:
        'Usamos sua localização para calcular a taxa de entrega.',
    },
  },
}

export default config
