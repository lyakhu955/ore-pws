// Serverless endpoint per raccogliere log client (debug temporaneo)
// ATTENZIONE: Non lasciare abilitato in produzione senza protezioni.
export default async function handler(req, res) {
  // CORS basico (riusa allowed origins di refresh-token se serve)
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = req.body;
    // Valida forma minima
    if (!body || !Array.isArray(body.logs) && !Array.isArray(body.log) && !body.logs && !body.session) {
      return res.status(400).json({ error: 'Invalid payload' });
    }

    // Aggiungi timestamp lato server
    const serverTs = Date.now();

    // Riduci dimensione: tronca messaggi lunghi
    const sanitize = (entry) => ({
      level: String(entry.level || 'log').slice(0,32),
      message: String(entry.message || '').slice(0,2000),
      stack: entry.stack ? String(entry.stack).slice(0,4000) : undefined,
      ts: typeof entry.ts === 'number' ? entry.ts : serverTs
    });

    const logs = (body.logs || []).map(sanitize).slice(0, 200); // limite batch

    // Salva su console del serverless (visibile nei log provider)
    console.log('[REMOTE-LOG]', JSON.stringify({
      session: body.session,
      ua: body.ua,
      page: body.page,
      count: logs.length,
      first: logs[0]
    }));

    // (Opzionale) Potresti salvare su storage esterno qui.

    return res.status(204).end();
  } catch (e) {
    console.error('Log endpoint error', e);
    return res.status(500).json({ error: 'Server error' });
  }
}
