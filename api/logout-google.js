import { applyCors, clearRefreshCookie } from './_google-oauth.js';

export default async function handler(req, res) {
  applyCors(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method not allowed',
      message: 'Questa API accetta solo richieste POST'
    });
  }

  clearRefreshCookie(res);

  return res.status(200).json({
    success: true,
    message: 'Sessione Google chiusa correttamente'
  });
}
