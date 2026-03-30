const DEFAULT_CLIENT_ID = '141214713715-9ns5460706gfabg52shjp0f75536fars.apps.googleusercontent.com';
const REFRESH_COOKIE = '__Host-ore_google_refresh';
const REFRESH_MAX_AGE = 60 * 60 * 24 * 30; // 30 giorni

function allowedOrigins() {
  return [
    'https://ore-pws.vercel.app',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:8080',
    'http://127.0.0.1:8080'
  ];
}

export function applyCors(req, res) {
  const origin = req.headers.origin;
  if (allowedOrigins().includes(origin) || !origin) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
  }

  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Max-Age', '86400');
}

export function parseCookies(req) {
  const header = req.headers?.cookie || '';
  if (!header) return {};

  return header
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((acc, part) => {
      const idx = part.indexOf('=');
      if (idx <= 0) return acc;
      const key = part.slice(0, idx);
      const raw = part.slice(idx + 1);
      acc[key] = decodeURIComponent(raw);
      return acc;
    }, {});
}

export function getRefreshTokenFromCookie(req) {
  const cookies = parseCookies(req);
  return cookies[REFRESH_COOKIE] || null;
}

export function setRefreshCookie(res, refreshToken) {
  const value = encodeURIComponent(refreshToken);
  const cookie = `${REFRESH_COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${REFRESH_MAX_AGE}`;
  res.setHeader('Set-Cookie', cookie);
}

export function clearRefreshCookie(res) {
  const cookie = `${REFRESH_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
  res.setHeader('Set-Cookie', cookie);
}

export function getOAuthConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID || DEFAULT_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientSecret) {
    throw new Error('GOOGLE_CLIENT_SECRET mancante nelle variabili ambiente di Vercel');
  }

  return { clientId, clientSecret };
}

export async function googleTokenRequest(params, timeoutMs = 10000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams(params),
      signal: controller.signal
    });

    let data = {};
    try {
      data = await response.json();
    } catch (_ignore) {
      data = {};
    }

    return { response, data };
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function fetchGoogleUserInfo(accessToken, timeoutMs = 8000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: {
        Authorization: `Bearer ${accessToken}`
      },
      signal: controller.signal
    });

    if (!response.ok) {
      return null;
    }

    return await response.json();
  } catch (_error) {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

