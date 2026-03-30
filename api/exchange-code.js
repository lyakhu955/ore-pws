import {
  applyCors,
  setRefreshCookie,
  getOAuthConfig,
  googleTokenRequest,
  fetchGoogleUserInfo
} from './_google-oauth.js';

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

  try {
    const { code, redirectUri } = req.body || {};

    if (!code) {
      return res.status(400).json({
        error: 'Missing authorization code',
        message: 'Il codice di autorizzazione è obbligatorio'
      });
    }

    const { clientId, clientSecret } = getOAuthConfig();

    const { response, data } = await googleTokenRequest({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri || 'postmessage'
    });

    if (!response.ok) {
      return res.status(400).json({
        error: 'Code exchange failed',
        message: data.error_description || 'Impossibile completare l\'autenticazione Google',
        details: data
      });
    }

    if (data.refresh_token) {
      setRefreshCookie(res, data.refresh_token);
    }

    const user = data.access_token ? await fetchGoogleUserInfo(data.access_token) : null;

    return res.status(200).json({
      success: true,
      access_token: data.access_token,
      expires_in: data.expires_in || 3600,
      token_type: data.token_type || 'Bearer',
      scope: data.scope,
      has_refresh_token: Boolean(data.refresh_token),
      user
    });
  } catch (error) {
    if (error.name === 'AbortError') {
      return res.status(408).json({
        error: 'Request timeout',
        message: 'Timeout durante il completamento del login Google'
      });
    }

    return res.status(500).json({
      error: 'Internal server error',
      message: error.message || 'Errore interno durante lo scambio codice Google'
    });
  }
}
