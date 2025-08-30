// Serverless endpoint per raccogliere log client (debug temporaneo)
// ATTENZIONE: Non lasciare abilitato in produzione senza protezioni.
export default async function handler(req, res) {
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const body = req.body || {};
    const arr = Array.isArray(body.logs) ? body.logs : [];
    if (!body.session || !arr.length) return res.status(400).json({ error: 'Invalid payload' });

    const serverTs = Date.now();
    const session = String(body.session).slice(0,40);
    const page = (body.page || '').slice(0,200);
    const ua = (body.ua || '').slice(0,300);

    for (const entry of arr.slice(0,400)) {
      try {
        const level = String(entry.level || 'log').slice(0,32);
        const message = String(entry.message || '').slice(0, 4000);
        const loc = entry.loc ? String(entry.loc).slice(0,120) : '';
        const seq = typeof entry.seq === 'number' ? entry.seq : undefined;
        const ts = typeof entry.ts === 'number' ? entry.ts : serverTs;
        const stack = entry.stack ? String(entry.stack).slice(0,8000) : '';
        console.log(`[REMOTE-LINE] session=${session} seq=${seq} level=${level} loc=${loc} ts=${ts} page=${page} msg="${message.replace(/"/g,'\"')}"${stack?` stack="${stack.replace(/"/g,'\"')}"`:''} ua="${ua.replace(/"/g,'\"')}"`);
      } catch(inner){ /* ignora */ }
    }

    return res.status(204).end();
  } catch(e) {
    console.error('[REMOTE-LINE][error]', e && e.message);
    return res.status(500).json({ error: 'Server error' });
  }
}
