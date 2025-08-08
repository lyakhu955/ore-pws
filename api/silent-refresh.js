// api/silent-refresh.js
// Serverless function per silent refresh OAuth2 Google da iframe nascosto

export default async function handler(req, res) {
  // Solo GET per compatibilità iframe
  if (req.method !== 'GET') {
    return res.status(405).send('Method Not Allowed');
  }

  // Estrai parametri
  const { refresh_token, origin } = req.query;

  if (!refresh_token || !origin) {
    return res.status(400).send('Missing refresh_token or origin');
  }

  // CORS per iframe
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Content-Type', 'text/html');

  // Funzione per inviare risposta JS all'iframe parent
  function sendJsMessage(type, data = {}) {
    return `<!DOCTYPE html><html><body><script>window.parent.postMessage({type: '${type}', ...${JSON.stringify(data)}}, '${origin}');</script></body></html>`;
  }

  try {
    // Richiedi nuovo access token a Google
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        refresh_token,
        grant_type: 'refresh_token'
      })
    });
    const data = await response.json();

    if (!response.ok) {
      return res.status(200).send(sendJsMessage('SILENT_REFRESH_ERROR', { description: data.error_description || 'Errore Google', details: data }));
    }

    // Successo: invia access token all'iframe parent
    return res.status(200).send(sendJsMessage('SILENT_REFRESH_SUCCESS', {
      access_token: data.access_token,
      expires_in: data.expires_in,
      token_type: data.token_type
    }));
  } catch (error) {
    return res.status(200).send(sendJsMessage('SILENT_REFRESH_ERROR', { description: error.message }));
  }
}
