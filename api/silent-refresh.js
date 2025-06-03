// Edge Function ottimizzata per refresh silenzioso Google OAuth
export const config = {
  runtime: 'edge',
}

export default async function handler(req) {
  // Configura CORS per Vercel Edge
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  }

  // Gestisci preflight CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders })
  }

  // Solo GET per iframe silenzioso
  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  try {
    const url = new URL(req.url)
    const refreshToken = url.searchParams.get('refresh_token')
    const origin = url.searchParams.get('origin')

    if (!refreshToken) {
      return new Response(JSON.stringify({ error: 'Missing refresh token' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Verifica variabili ambiente
    const clientId = process.env.GOOGLE_CLIENT_ID
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET

    if (!clientId || !clientSecret) {
      return new Response(JSON.stringify({ error: 'Server configuration error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Refresh token tramite Google OAuth
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token'
      })
    })

    const tokenData = await tokenResponse.json()

    if (!tokenResponse.ok) {
      console.error('Google OAuth error:', tokenData)

      // Restituisci HTML per iframe che comunica l'errore
      const errorHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Silent Refresh Error</title>
        </head>
        <body>
          <script>
            window.parent.postMessage({
              type: 'SILENT_REFRESH_ERROR',
              error: '${tokenData.error || 'refresh_failed'}',
              description: '${tokenData.error_description || 'Token refresh failed'}'
            }, '${origin || '*'}');
          </script>
        </body>
        </html>
      `

      return new Response(errorHtml, {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'text/html' }
      })
    }

    // Successo - restituisci HTML per iframe che comunica il nuovo token
    const successHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Silent Refresh Success</title>
      </head>
      <body>
        <script>
          window.parent.postMessage({
            type: 'SILENT_REFRESH_SUCCESS',
            access_token: '${tokenData.access_token}',
            expires_in: ${tokenData.expires_in || 3600},
            token_type: '${tokenData.token_type || 'Bearer'}'
          }, '${origin || '*'}');
        </script>
      </body>
      </html>
    `

    return new Response(successHtml, {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'text/html' }
    })

  } catch (error) {
    console.error('Silent refresh error:', error)

    const errorHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Silent Refresh Error</title>
      </head>
      <body>
        <script>
          window.parent.postMessage({
            type: 'SILENT_REFRESH_ERROR',
            error: 'server_error',
            description: 'Internal server error during token refresh'
          }, '*');
        </script>
      </body>
      </html>
    `

    return new Response(errorHtml, {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'text/html' }
    })
  }
}
