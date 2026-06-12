// ─────────────────────────────────────────────────────────────
// Z-API — Envio automático de WhatsApp para os clientes
//
// SÓ ATIVA se as variáveis abaixo existirem no Railway (Variables):
//   ZAPI_INSTANCE_ID  → ID da instância (painel da Z-API)
//   ZAPI_TOKEN        → Token da instância
//   ZAPI_CLIENT_TOKEN → Token de segurança da conta (aba Segurança)
//
// Sem as variáveis, o site funciona normalmente, sem enviar nada.
// RECOMENDAÇÃO: use um chip SEPARADO do número da loja na Z-API.
// ─────────────────────────────────────────────────────────────

const ZAPI_INSTANCE_ID = process.env.ZAPI_INSTANCE_ID;
const ZAPI_TOKEN = process.env.ZAPI_TOKEN;
const ZAPI_CLIENT_TOKEN = process.env.ZAPI_CLIENT_TOKEN;

function configurado() {
  return Boolean(ZAPI_INSTANCE_ID && ZAPI_TOKEN);
}

// "(32) 99811-1297" → "5532998111297"
function normalizarTelefone(tel) {
  let d = String(tel || '').replace(/\D/g, '');
  if (!d) return null;
  while (d.startsWith('0')) d = d.slice(1);
  if (!d.startsWith('55')) d = '55' + d;
  // 55 + DDD (2) + número (8 ou 9 dígitos)
  if (d.length < 12 || d.length > 13) return null;
  return d;
}

async function enviarWhatsApp(telefone, mensagem) {
  if (!configurado()) return false;
  const phone = normalizarTelefone(telefone);
  if (!phone || !mensagem) return false;
  try {
    const url = `https://api.z-api.io/instances/${ZAPI_INSTANCE_ID}/token/${ZAPI_TOKEN}/send-text`;
    const headers = { 'Content-Type': 'application/json' };
    if (ZAPI_CLIENT_TOKEN) headers['Client-Token'] = ZAPI_CLIENT_TOKEN;
    const r = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ phone, message: mensagem })
    });
    if (!r.ok) console.error('Z-API respondeu', r.status, await r.text().catch(() => ''));
    return r.ok;
  } catch (e) {
    console.error('Z-API erro:', e.message);
    return false;
  }
}

// Mensagens automáticas por status — adaptadas ao tipo de entrega
function mensagemDeStatus(status, order) {
  const nome = (order.client_name || '').split(' ')[0] || 'cliente';
  const tipo = order.delivery_type || 'entrega';

  if (status === 'recebido') {
    return `Olá, ${nome}! 🍔 Recebemos seu pedido na *Fael Top Lanches*!\nJá já começamos o preparo. Você vai receber as atualizações por aqui. 😉`;
  }
  if (status === 'preparo') {
    return `👨‍🍳 Boa notícia, ${nome}! Seu pedido está *EM PREPARO*!`;
  }
  if (status === 'entrega') {
    if (tipo === 'retirada') return `🏪 ${nome}, seu pedido está *PRONTO PARA RETIRADA*! Pode vir buscar. 😋`;
    if (tipo === 'mesa') return `🪑 ${nome}, seu pedido está *SAINDO PARA SUA MESA*! 😋`;
    return `🛵 ${nome}, seu pedido *SAIU PARA ENTREGA*! Fica de olho aí! 👀`;
  }
  if (status === 'entregue') {
    return `✅ Pedido entregue! Bom apetite, ${nome}! 😋\nObrigado pela preferência ⭐ *Fael Top Lanches*`;
  }
  return null; // cancelado e outros: sem mensagem automática
}

// Dispara sem travar a resposta da API (fire-and-forget)
function notificarStatus(status, order) {
  if (!configurado() || !order || !order.client_phone) return;
  const msg = mensagemDeStatus(status, order);
  if (!msg) return;
  enviarWhatsApp(order.client_phone, msg).catch(() => {});
}

module.exports = { enviarWhatsApp, notificarStatus, configurado };
