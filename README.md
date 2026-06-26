# 🍕 Dabelle Pizzaria — App Web

App de pedidos online com painel administrativo completo.

---

## 🗂️ Estrutura do projeto

```
dabelle-pizzaria/
├── index.html                  # Entrada do app (PWA shell)
├── public/
│   ├── manifest.json           # PWA manifest
│   ├── sw.js                   # Service Worker (offline)
│   └── icons/                  # Ícones do app (adicionar manualmente)
├── src/
│   ├── main.js                 # Ponto de entrada JS
│   ├── styles/
│   │   └── main.css            # Estilos globais
│   ├── lib/
│   │   ├── supabase.js         # Todas as funções de banco de dados
│   │   ├── whatsapp.js         # Integração WhatsApp
│   │   └── store.js            # Estado global do app
│   ├── pages/                  # Cada tela do app
│   └── components/             # Componentes reutilizáveis
├── supabase/
│   └── migrations/
│       └── 001_schema_inicial.sql  # Execute no Supabase
├── .env.example                # Template de variáveis de ambiente
├── vite.config.js              # Configuração do build
├── vercel.json                 # Configuração do deploy
└── package.json
```

---

## 🚀 Passo a passo para colocar no ar

### Passo 1 — Configurar o banco de dados (Supabase)

1. Acesse [supabase.com](https://supabase.com) e crie uma conta gratuita
2. Clique em **New project** → dê um nome (ex: `dabelle-pizzaria`) → escolha região **South America (São Paulo)**
3. Aguarde o projeto ser criado (~2 min)
4. No menu lateral, clique em **SQL Editor**
5. Cole todo o conteúdo do arquivo `supabase/migrations/001_schema_inicial.sql`
6. Clique em **Run** — o banco está pronto!
7. Vá em **Settings → API** e copie:
   - **Project URL** (ex: `https://xyzabc.supabase.co`)
   - **anon public key** (chave longa)

---

### Passo 2 — Configurar variáveis de ambiente

```bash
# Na pasta do projeto, copie o template:
cp .env.example .env.local

# Abra o .env.local e preencha:
VITE_SUPABASE_URL=https://SEU_PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=sua_anon_key_aqui
VITE_WHATSAPP_LOJA=5511948625369
```

---

### Passo 3 — Rodar localmente (teste)

```bash
# Instalar dependências
npm install

# Iniciar servidor de desenvolvimento
npm run dev
# Acesse: http://localhost:3000
```

---

### Passo 4 — Deploy no Vercel (produção gratuita)

#### Opção A — Via GitHub (recomendado, deploy automático)

1. Crie um repositório no [github.com](https://github.com)
2. Faça o push do projeto:
   ```bash
   git init
   git add .
   git commit -m "🍕 Dabelle Pizzaria — versão inicial"
   git remote add origin https://github.com/seu-usuario/dabelle-pizzaria.git
   git push -u origin main
   ```
3. Acesse [vercel.com](https://vercel.com) → **New Project** → importe o repositório
4. Em **Environment Variables**, adicione as mesmas variáveis do `.env.local`
5. Clique em **Deploy** — em ~1 minuto seu app estará no ar!

#### Opção B — Via Vercel CLI

```bash
npm install -g vercel
vercel login
vercel --prod
# Siga as instruções e adicione as variáveis de ambiente quando solicitado
```

---

### Passo 5 — Configurar domínio personalizado (opcional)

No painel do Vercel:
1. Vá em seu projeto → **Settings → Domains**
2. Adicione seu domínio (ex: `pedidos.dabellepizzaria.com.br`)
3. Configure o DNS conforme as instruções do Vercel

---

### Passo 6 — Criar usuário admin

1. No Supabase, vá em **Authentication → Users**
2. Clique em **Invite user** ou **Add user**
3. Adicione o e-mail `dabellepizzaria@gmail.com`
4. O usuário receberá um e-mail para definir a senha

---

### Passo 7 — Instalar como app no celular (PWA)

**Android (Chrome):**
- Abra o site → toque no menu `⋮` → "Adicionar à tela inicial"

**iPhone (Safari):**
- Abra o site → toque no botão de compartilhar `⬆` → "Adicionar à Tela de Início"

---

## 🔧 Funcionalidades implementadas

### App do Cliente
- [x] Cardápio completo (salgadas, doces, meia a meia, bebidas)
- [x] Busca em tempo real
- [x] Modal de pedido com etapas (borda → adicionais → observação)
- [x] Carrinho persistido no dispositivo
- [x] Checkout com validação
- [x] Pagamento: Dinheiro (troco), Pix (QR + chave), Cartão (+3,14%)
- [x] Envio automático via WhatsApp
- [x] Avaliações dos clientes
- [x] Assistente virtual (chatbot)
- [x] PWA — funciona offline e pode ser instalado

### Painel Admin
- [x] Login com e-mail/senha ou Google (via Supabase Auth)
- [x] Gestão de pedidos com esteira de status
- [x] Notificação automática do cliente via WhatsApp em cada etapa
- [x] Relatórios do dia (faturamento, ranking de pizzas, formas de pagamento)
- [x] Moderação de avaliações
- [x] Abrir/fechar loja manualmente

---

## 📞 Suporte

WhatsApp da loja: **(11) 94862-5369**
E-mail admin: dabellepizzaria@gmail.com
