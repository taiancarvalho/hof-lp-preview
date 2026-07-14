// Meta Conversions API (CAPI) — Vercel Serverless Function
// Recebe eventos do navegador e reenvia server-side pro Meta, com o MESMO event_id
// que o Pixel usa no browser (Meta deduplica). O access token vem SÓ do env da Vercel.
//
// Env vars a configurar no painel da Vercel (Project → Settings → Environment Variables):
//   META_CAPI_TOKEN  = <token do CAPI gerado no Events Manager>   (SECRETO)
//   META_PIXEL_ID    = 1657768221792702   (opcional; já é o default)
//
// O token NUNCA aparece no código nem no repositório.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method_not_allowed' });
    return;
  }
  const TOKEN = process.env.META_CAPI_TOKEN;
  const PIXEL = process.env.META_PIXEL_ID || '1657768221792702';
  if (!TOKEN) {
    res.status(500).json({ error: 'missing_META_CAPI_TOKEN' });
    return;
  }
  try {
    const b = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
    const ua = req.headers['user-agent'] || '';

    const user_data = { client_ip_address: ip, client_user_agent: ua };
    if (b.fbp) user_data.fbp = b.fbp;
    if (b.fbc) user_data.fbc = b.fbc;

    const payload = {
      // access_token no BODY (não em query string) — evita expor o segredo na URL/logs
      access_token: TOKEN,
      data: [{
        event_name: b.event_name || 'InitiateCheckout',
        event_time: Math.floor(Date.now() / 1000),
        action_source: 'website',
        event_id: b.event_id,
        event_source_url: b.event_source_url,
        user_data,
        custom_data: b.custom_data || {}
      }]
    };

    const r = await fetch(`https://graph.facebook.com/v21.0/${PIXEL}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const j = await r.json().catch(() => ({}));
    res.status(r.ok ? 200 : 502).json(j);
  } catch (e) {
    res.status(500).json({ error: String(e && e.message || e) });
  }
}
