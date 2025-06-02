// Serverless function per rinnovare i token OAuth di Google
export default async function handler(req, res) {
  // Configura CORS per permettere richieste dal frontend (ottimizzato per Vercel)
  const allowedOrigins = [
    'https://ore-pws.vercel.app',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:8080',
    'http://127.0.0.1:8080'
  ];

  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin) || !origin) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
  }

  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Max-Age', '86400'); // Cache preflight per 24 ore

  // Gestisci richieste OPTIONS (preflight CORS)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Accetta solo richieste POST
  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method not allowed',
      message: 'Questa API accetta solo richieste POST'
    });
  }

  try {
    // Estrai il refresh token dal body della richiesta
    const { refreshToken } = req.body;

    // Verifica che il refresh token sia presente
    if (!refreshToken) {
      return res.status(400).json({
        error: 'Missing refresh token',
        message: 'Il refresh token è obbligatorio'
      });
    }

    // Verifica che le variabili d'ambiente siano configurate
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      console.error('Missing Google OAuth credentials in environment variables');
      return res.status(500).json({
        error: 'Server configuration error',
        message: 'Credenziali OAuth non configurate'
      });
    }

    console.log('Attempting to refresh Google OAuth token...');
    console.log('Client ID configured:', process.env.GOOGLE_CLIENT_ID ? 'YES' : 'NO');
    console.log('Client Secret configured:', process.env.GOOGLE_CLIENT_SECRET ? 'YES' : 'NO');

    // Aggiungi timeout per evitare richieste che si bloccano
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 secondi timeout

    // Chiama l'API di Google per rinnovare il token
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        refresh_token: refreshToken,
        grant_type: 'refresh_token'
      }),
      signal: controller.signal
    });

    // Cancella il timeout se la richiesta è completata
    clearTimeout(timeoutId);

    const data = await response.json();

    // Verifica se la richiesta a Google è andata a buon fine
    if (!response.ok) {
      console.error('Google OAuth error:', data);
      return res.status(400).json({
        error: 'Token refresh failed',
        message: data.error_description || 'Impossibile rinnovare il token',
        details: data
      });
    }

    console.log('Token refreshed successfully');

    // Restituisci il nuovo access token
    res.status(200).json({
      access_token: data.access_token,
      expires_in: data.expires_in || 3600,
      token_type: data.token_type || 'Bearer',
      success: true
    });

  } catch (error) {
    console.error('Refresh token error:', error);

    // Gestisci specificamente gli errori di timeout
    if (error.name === 'AbortError') {
      return res.status(408).json({
        error: 'Request timeout',
        message: 'Timeout durante la richiesta di rinnovo del token',
        details: 'La richiesta a Google ha impiegato troppo tempo'
      });
    }

    res.status(500).json({
      error: 'Internal server error',
      message: 'Errore interno del server durante il rinnovo del token',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}
