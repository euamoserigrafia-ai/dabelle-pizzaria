# 🔗 Guia de Integrações — WhatsApp Business API + Pix

---

## Parte 1 — WhatsApp Business Cloud API (Meta)

### Por que usar a API em vez do link wa.me?
| Recurso                | Link wa.me | API Business |
|------------------------|:----------:|:------------:|
| Envio manual pelo admin| ✅         | ✅           |
| Envio automático       | ❌         | ✅           |
| Chatbot automático     | ❌         | ✅           |
| Histórico no banco     | ❌         | ✅           |
| Custo                  | Grátis     | Grátis* (1000 conversas/mês) |

*Após 1000 conversas/mês: ~R$ 0,25 por conversa iniciada pela empresa

---

### Passo a passo: configurar WhatsApp Business API

#### 1. Criar conta Meta Business
1. Acesse [business.facebook.com](https://business.facebook.com)
2. Crie uma conta em nome da pizzaria
3. Verifique o negócio (opcional mas recomendado)

#### 2. Criar app no Meta for Developers
1. Acesse [developers.facebook.com](https://developers.facebook.com)
2. Crie novo app → tipo **Business**
3. Adicione o produto **WhatsApp**
4. Em **WhatsApp → Getting Started**, copie:
   - **Phone Number ID** → `VITE_WA_PHONE_ID`
   - **Temporary access token** → `VITE_WA_TOKEN` (gere token permanente abaixo)

#### 3. Adicionar número de telefone real
1. WhatsApp → Phone Numbers → Add phone number
2. Use o número da pizzaria: **(11) 94862-5369**
3. Verifique via SMS ou chamada

#### 4. Gerar token permanente
1. Meta Business → Configurações → Usuários do sistema
2. Crie um usuário do sistema → gere token com permissão `whatsapp_business_messaging`
3. Salve o token — ele não expira

#### 5. Criar templates de mensagem
1. WhatsApp → Message Templates → Create template
2. Crie os 5 templates (os nomes devem ser EXATAMENTE iguais):

```
dabelle_pedido_recebido
Categoria: UTILITY
Corpo: "Olá {{1}}! Seu pedido *#{{2}}* foi recebido. Total: R$ {{3}}. Aguardando confirmação da equipe Dabelle Pizzaria 🍕"

dabelle_pedido_aceito
Categoria: UTILITY
Corpo: "Boa notícia! Seu pedido *#{{1}}* foi aceito e está sendo preparado. Previsão de entrega: {{2}} minutos ⏱️"

dabelle_pedido_entrega
Categoria: UTILITY
Corpo: "🏍️ Seu pedido *#{{1}}* saiu para entrega! Acompanhe em tempo real: {{2}}"

dabelle_pedido_recusado
Categoria: UTILITY
Corpo: "😔 Infelizmente não conseguimos atender o pedido *#{{1}}* no momento. Pedimos desculpas pelo transtorno."

dabelle_pix_confirmado
Categoria: UTILITY
Corpo: "✅ Pagamento Pix confirmado para o pedido *#{{1}}*! Já estamos preparando sua pizza 🍕"
```

3. Aguarde aprovação (geralmente em minutos para UTILITY)

#### 6. Configurar webhook
1. WhatsApp → Configuration → Webhook
2. Callback URL: `https://SEU_PROJETO.supabase.co/functions/v1/whatsapp-webhook`
3. Verify token: `dabelle-verify-2024` (mesmo valor de `WA_VERIFY_TOKEN`)
4. Marcar: **messages** e **message_status_updates**
5. Clicar em Verify and Save

#### 7. Adicionar variáveis no Supabase
```
supabase secrets set WA_TOKEN=seu_token_permanente
supabase secrets set WA_PHONE_ID=seu_phone_id
supabase secrets set WA_VERIFY_TOKEN=dabelle-verify-2024
supabase secrets set APP_URL=https://pedidos.dabellepizzaria.com.br
```

---

## Parte 2 — Pix via Mercado Pago

### Por que Mercado Pago?
- QR Code dinâmico com valor embutido (cliente não precisa digitar valor)
- Confirmação automática via webhook
- Gratuito até R$ 500/mês; depois 0,99% por transação
- SDK confiável, aprovado pelo Banco Central

### Passo a passo: configurar Pix no Mercado Pago

#### 1. Criar conta Mercado Pago
1. Acesse [mercadopago.com.br](https://www.mercadopago.com.br)
2. Crie conta como pessoa jurídica (CNPJ: 63.733.611/0001-69)
3. Complete a verificação de identidade

#### 2. Obter credenciais
1. Acesse [mercadopago.com.br/developers/panel](https://www.mercadopago.com.br/developers/panel)
2. Suas integrações → Criar aplicação → "Dabelle Pizzaria"
3. Copie o **Access Token de Produção**
4. Coloque em: `VITE_MP_ACCESS_TOKEN` (frontend) e `MP_ACCESS_TOKEN` (Supabase)

#### 3. Configurar webhook Pix
1. No painel MP: Notificações → Webhooks → Criar
2. URL: `https://SEU_PROJETO.supabase.co/functions/v1/pix-webhook`
3. Eventos: **payment** → **payment.updated**
4. Testar com o botão de simulação

#### 4. Adicionar variável no Supabase
```bash
supabase secrets set MP_ACCESS_TOKEN=APP_USR-sua_chave_de_producao
```

#### 5. Adicionar no .env.local (frontend)
```
VITE_MP_ACCESS_TOKEN=TEST-sua_chave_de_teste  # Para testes
# Em produção, trocar para APP_USR-...
```

### Fluxo completo do Pix no app
```
Cliente escolhe Pix
      ↓
App chama criarCobrancaPix()
      ↓
Mercado Pago retorna QR Code (imagem + texto)
      ↓
App exibe QR Code na tela + polling a cada 5s
      ↓
Cliente paga no banco
      ↓
Mercado Pago chama pix-webhook (Edge Function)
      ↓
Webhook atualiza pedido no banco (pix_status = 'aprovado')
      ↓
Supabase Realtime notifica o app do cliente (tela atualiza)
      ↓
Supabase Realtime notifica o painel admin
      ↓
Edge Function notificar-cliente envia WhatsApp de confirmação
```

---

## Deploy das Edge Functions

```bash
# Instalar CLI
npm install -g supabase

# Login
supabase login

# Vincular ao projeto
supabase link --project-ref SEU_PROJECT_REF

# Deploy todas as funções
supabase functions deploy pix-webhook
supabase functions deploy whatsapp-webhook
supabase functions deploy notificar-cliente

# Ver logs em tempo real
supabase functions logs pix-webhook --tail
supabase functions logs whatsapp-webhook --tail
```

---

## Variáveis de ambiente — resumo completo

### Frontend (.env.local)
```
VITE_SUPABASE_URL=https://SEU_PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=sua_anon_key
VITE_WHATSAPP_LOJA=5511948625369
VITE_PIX_CHAVE=63.733.611/0001-69
VITE_PIX_TIPO=cnpj
VITE_MP_ACCESS_TOKEN=TEST-sua_chave_mp
VITE_VAPID_PUBLIC_KEY=sua_chave_vapid
```

### Supabase Edge Functions (supabase secrets set ...)
```
SUPABASE_URL              → automático
SUPABASE_SERVICE_ROLE_KEY → automático
MP_ACCESS_TOKEN           → chave Mercado Pago produção
WA_TOKEN                  → token permanente Meta
WA_PHONE_ID               → ID do número Meta
WA_VERIFY_TOKEN           → dabelle-verify-2024
APP_URL                   → https://pedidos.dabellepizzaria.com.br
```

### Vercel (em Settings → Environment Variables)
```
As mesmas do .env.local acima
```
