// Serverless function per scambiare il codice di autorizzazione con i token
export default async function handler(req, res) {
  // Configura CORS
  const allowedOrigins = [
    'https://ore-pws.vercel.app',
    'https://ore-pws.meme',
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
  res.setHeader('Access-Control-Max-Age', '86400');

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
    const { code, redirect_uri } = req.body;

    // Verifica che il codice sia presente
    if (!code) {
      return res.status(400).json({
        error: 'Missing authorization code',
        message: 'Il codice di autorizzazione è obbligatorio'
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

    console.log('Scambio codice di autorizzazione con token...');

    // Aggiungi timeout per evitare richieste che si bloccano
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    // Chiama l'API di Google per scambiare il codice con i token
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        code: code,
        grant_type: 'authorization_code',
        redirect_uri: redirect_uri
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    const data = await response.json();

    if (!response.ok) {
      console.error('Google OAuth error:', data);
      return res.status(400).json({
        error: 'Token exchange failed',
        message: data.error_description || 'Impossibile scambiare il codice con i token',
        details: data
      });
    }

    console.log('Codice scambiato con successo');

    // Restituisci i token
    res.status(200).json({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_in: data.expires_in || 3600,
      token_type: data.token_type || 'Bearer',
      scope: data.scope,
      success: true
    });

  } catch (error) {
    console.error('Exchange code error:', error);

    if (error.name === 'AbortError') {
      return res.status(408).json({
        error: 'Request timeout',
        message: 'Timeout durante lo scambio del codice',
        details: 'La richiesta a Google ha impiegato troppo tempo'
      });
    }

    res.status(500).json({
      error: 'Internal server error',
      message: 'Errore interno del server durante lo scambio del codice',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}
