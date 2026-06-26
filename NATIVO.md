# 🍕 Dabelle Pizzaria — App Nativo (Passo 3)

## Pré-requisitos para publicar nas lojas

| Plataforma   | Requisito                                  | Link                                      |
|--------------|--------------------------------------------|-------------------------------------------|
| Android      | Conta Google Play Console (taxa única $25) | play.google.com/console                   |
| iOS          | Apple Developer Program ($99/ano)          | developer.apple.com/programs              |
| Android      | Android Studio instalado                   | developer.android.com/studio              |
| iOS          | Mac com Xcode 15+                          | Apenas disponível no macOS                |
| Ambos        | Node.js 18+, npm                           | nodejs.org                                |

---

## Passo a passo completo

### 1. Instalar o Capacitor no projeto
```bash
npm install
npx cap init "Dabelle Pizzaria" br.com.dabellepizzaria.app --web-dir dist
```

### 2. Fazer o build web
```bash
npm run build
```

### 3. Adicionar as plataformas nativas
```bash
# Android
npx cap add android

# iOS (apenas em Mac)
npx cap add ios
```

### 4. Copiar configurações personalizadas

**Android:**
```bash
# Strings e configurações
cp capacitor/android/strings.xml android/app/src/main/res/values/strings.xml

# google-services.json (depois de criar no Firebase)
cp capacitor/android/google-services.json android/app/google-services.json

# Build config (mesclar com o build.gradle existente)
# Abra android/app/build.gradle e adicione as configs de capacitor/android/app-build.gradle
```

**iOS:**
```bash
# Mesclar permissões no Info.plist
# Abra ios/App/App/Info.plist no Xcode e adicione as chaves de capacitor/ios/Info.plist.additions
```

### 5. Gerar ícones e splash screen
```bash
# Instalar a ferramenta de ícones
npm install -g @capacitor/assets

# Coloque seu ícone em resources/icon.png (1024x1024, sem fundo transparente)
# Coloque sua splash em resources/splash.png (2732x2732)
npx capacitor-assets generate
```

### 6. Sincronizar e abrir nas IDEs
```bash
# Sincroniza o build web com as plataformas nativas
npm run cap:sync

# Abre o Android Studio
npm run cap:android

# Abre o Xcode (somente Mac)
npm run cap:ios
```

---

## Publicar no Google Play

### 6a. Gerar keystore de assinatura (UMA VEZ — guarde com segurança!)
```bash
keytool -genkey -v \
  -keystore dabelle.jks \
  -alias dabelle \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000
# Anote e guarde MUITO BEM a senha — perder a keystore = perder o app
```

### 6b. Gerar o AAB para o Play Store
```bash
cd android
./gradlew bundleRelease
# Arquivo gerado: android/app/build/outputs/bundle/release/app-release.aab
```

### 6c. Publicar
1. Acesse [play.google.com/console](https://play.google.com/console)
2. Crie o app: "Dabelle Pizzaria", categoria "Comida e Bebidas", grátis
3. Complete todas as seções: ficha da loja, classificação indicativa, política de privacidade
4. Vá em **Produção → Criar nova versão → Enviar o AAB**
5. Aguarde revisão (geralmente 1–3 dias)

---

## Publicar na App Store

### 6d. Criar o app no App Store Connect
1. Acesse [appstoreconnect.apple.com](https://appstoreconnect.apple.com)
2. Apps → "+" → Novo app
3. Plataforma: iOS, Nome: "Dabelle Pizzaria", Bundle ID: `br.com.dabellepizzaria.app`

### 6e. Criar certificado e provisioning profile
1. No Xcode: Preferences → Accounts → Manage Certificates
2. Crie "Apple Distribution" certificate
3. Em developer.apple.com: Identifiers → Register bundle ID
4. Profiles → Create distribution profile para o bundle ID

### 6f. Build e upload via Xcode
1. Abra `ios/App/App.xcworkspace` no Xcode
2. Selecione "Any iOS Device" como destino
3. Product → Archive
4. Distribute App → App Store Connect → Upload

### 6g. Submeter para revisão
1. No App Store Connect, preencha: descrição, screenshots, classificação indicativa
2. Selecione o build enviado
3. Clique "Submit for Review" — geralmente 1–2 dias

---

## CI/CD automático (GitHub Actions)

O arquivo `.github/workflows/build.yml` automatiza todo o processo.

### Secrets necessários no GitHub
```
VITE_SUPABASE_URL              → URL do projeto Supabase
VITE_SUPABASE_ANON_KEY         → Chave anon do Supabase
VITE_WHATSAPP_LOJA             → Número WhatsApp da loja
VITE_VAPID_PUBLIC_KEY          → Chave pública VAPID (push web)
VERCEL_TOKEN                   → Token da conta Vercel
VERCEL_ORG_ID                  → ID da organização Vercel
VERCEL_PROJECT_ID              → ID do projeto Vercel
ANDROID_KEYSTORE_BASE64        → base64 do arquivo dabelle.jks
ANDROID_KEYSTORE_PASSWORD      → Senha do keystore
ANDROID_KEY_ALIAS              → Alias (dabelle)
ANDROID_KEY_PASSWORD           → Senha da chave
IOS_DISTRIBUTION_CERT_BASE64   → Certificado Apple em base64
IOS_DISTRIBUTION_CERT_PASSWORD → Senha do certificado
APPSTORE_ISSUER_ID             → Issuer ID do App Store Connect
APPSTORE_API_KEY_ID            → API Key ID do App Store Connect
APPSTORE_API_PRIVATE_KEY       → Chave privada da API
APPLE_TEAM_ID                  → ID do time Apple Developer
```

### Como gerar o keystore em base64
```bash
base64 -i dabelle.jks | pbcopy   # macOS
base64 dabelle.jks | xclip       # Linux
```

### Workflow de deploy
- **Push em `main`** → build web + deploy automático no Vercel
- **Tag `v1.0.0`** → build web + build Android AAB + build iOS IPA + upload automático nas lojas

```bash
# Publicar nova versão nas lojas
git tag v1.0.0
git push origin v1.0.0
```

---

## Estrutura final do projeto

```
dabelle-pizzaria/
├── src/lib/
│   ├── native.js          ← Plugins nativos (biometria, push, câmera, haptics)
│   ├── supabase.js        ← Banco de dados
│   ├── whatsapp.js        ← Integração WhatsApp
│   ├── notifications.js   ← Push notifications web
│   ├── cupons.js          ← Sistema de cupons
│   ├── entrega.js         ← Taxa por CEP
│   ├── rastreamento.js    ← Rastreamento em tempo real
│   └── store.js           ← Estado global
├── capacitor/
│   ├── android/           ← Configs Android
│   ├── ios/               ← Configs iOS
│   └── LOJA.md            ← Textos e guia das lojas
├── .github/workflows/
│   └── build.yml          ← CI/CD automático
├── capacitor.config.ts    ← Configuração Capacitor
├── supabase/migrations/
│   ├── 001_schema_inicial.sql
│   └── 002_novas_funcionalidades.sql
└── README.md
```
