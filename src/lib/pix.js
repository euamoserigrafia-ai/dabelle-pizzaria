// src/lib/pix.js
// Integração Pix — QR Code dinâmico via Mercado Pago
// Documentação: https://www.mercadopago.com.br/developers/pt/docs/qr-code

const MP_BASE = 'https://api.mercadopago.com'

// ─── Criar cobrança Pix com QR Code dinâmico ─────────────────
export async function criarCobrancaPix(pedido) {
  const res = await fetch(`${MP_BASE}/v1/payments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${import.meta.env.VITE_MP_ACCESS_TOKEN}`,
      'X-Idempotency-Key': `dabelle-pedido-${pedido.id}`,
    },
    body: JSON.stringify({
      transaction_amount: Number(pedido.total),
      description: `Dabelle Pizzaria — Pedido #${String(pedido.numero).padStart(3, '0')}`,
      payment_method_id: 'pix',
      payer: {
        email: 'cliente@dabelle.com',  // Mercado Pago exige email
        first_name: pedido.clienteNome.split(' ')[0],
        last_name: pedido.clienteNome.split(' ').slice(1).join(' ') || 'Cliente',
        identification: { type: 'CPF', number: '00000000000' },
      },
      notification_url: `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/pix-webhook`,
      metadata: { pedido_id: pedido.id, pedido_numero: pedido.numero },
      date_of_expiration: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 min
    }),
  })

  if (!res.ok) {
    const err = await res.json()
    console.error('[Pix] Erro ao criar cobrança:', err)
    return { ok: false, erro: err.message || 'Erro ao gerar Pix.' }
  }

  const data = await res.json()
  const pix = data.point_of_interaction?.transaction_data

  return {
    ok: true,
    paymentId: data.id,
    qrCode:    pix?.qr_code,          // string copia e cola
    qrCodeB64: pix?.qr_code_base64,   // imagem base64 para exibir
    expiraEm:  data.date_of_expiration,
    status:    data.status,           // pending, approved, rejected
  }
}

// ─── Verificar status do pagamento ───────────────────────────
export async function verificarPagamentoPix(paymentId) {
  const res = await fetch(`${MP_BASE}/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${import.meta.env.VITE_MP_ACCESS_TOKEN}` },
  })
  if (!res.ok) return null
  const data = await res.json()
  return {
    status:   data.status,            // approved | pending | rejected | cancelled
    aprovado: data.status === 'approved',
    valor:    data.transaction_amount,
  }
}

// ─── Polling automático até confirmar pagamento ───────────────
export function aguardarPagamentoPix(paymentId, onConfirmado, onTimeout, minutos = 10) {
  const limite = Date.now() + minutos * 60 * 1000
  const intervalo = setInterval(async () => {
    const status = await verificarPagamentoPix(paymentId)
    if (status?.aprovado) {
      clearInterval(intervalo)
      onConfirmado(status)
      return
    }
    if (status?.status === 'rejected' || status?.status === 'cancelled') {
      clearInterval(intervalo)
      onTimeout('cancelled')
      return
    }
    if (Date.now() > limite) {
      clearInterval(intervalo)
      onTimeout('timeout')
    }
  }, 5000) // verifica a cada 5 segundos
  return () => clearInterval(intervalo) // cancelar polling
}

// ─── Renderizar QR Code na tela ──────────────────────────────
export function renderQRCode(containerId, qrCodeB64, qrCodeString) {
  const el = document.getElementById(containerId)
  if (!el) return

  el.innerHTML = `
    <div style="text-align:center;padding:16px">
      <img
        src="data:image/png;base64,${qrCodeB64}"
        alt="QR Code Pix"
        style="width:200px;height:200px;border-radius:12px"
      />
      <div style="margin-top:12px;font-size:12px;color:#555;word-break:break-all;
                  background:#f5f5f5;padding:10px;border-radius:8px;line-height:1.5">
        ${qrCodeString}
      </div>
      <button
        onclick="navigator.clipboard.writeText('${qrCodeString}').then(()=>alert('Código copiado!'))"
        style="margin-top:10px;padding:10px 24px;background:#E8151B;color:white;
               border:none;border-radius:20px;font-size:13px;font-weight:700;cursor:pointer"
      >
        📋 Copiar código Pix
      </button>
    </div>
  `
}

// ─── Pix estático (fallback — chave CNPJ, sem QR dinâmico) ───
export function pixEstatico() {
  return {
    chave:  import.meta.env.VITE_PIX_CHAVE  || '63.733.611/0001-69',
    tipo:   import.meta.env.VITE_PIX_TIPO   || 'cnpj',
    nome:   'Dabelle Pizzaria',
    cidade: 'São Paulo',
  }
}

// ─── Gerar payload EMV para Pix estático (copia e cola) ──────
export function gerarPixEstaticoCopiaECola(chave, nome, cidade, valor, txid) {
  const fmt = (id, val) => {
    const len = String(val.length).padStart(2, '0')
    return `${id}${len}${val}`
  }
  const merchantAccount = fmt('00', 'br.gov.bcb.pix') + fmt('01', chave)
  const addData = fmt('05', txid?.slice(0, 25) || '***')

  let payload =
    fmt('00', '01') +
    fmt('26', merchantAccount) +
    fmt('52', '0000') +
    fmt('53', '986') +
    (valor ? fmt('54', Number(valor).toFixed(2)) : '') +
    fmt('58', 'BR') +
    fmt('59', nome.slice(0, 25)) +
    fmt('60', cidade.slice(0, 15)) +
    fmt('62', addData) +
    '6304'

  payload += crc16(payload)
  return payload
}

function crc16(str) {
  let crc = 0xFFFF
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8
    for (let j = 0; j < 8; j++) {
      crc = (crc & 0x8000) ? (crc << 1) ^ 0x1021 : crc << 1
    }
  }
  return ((crc & 0xFFFF).toString(16).toUpperCase().padStart(4, '0'))
}
