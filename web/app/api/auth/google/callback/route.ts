/**
 * Google OAuth Callback Handler
 *
 * Handles the OAuth redirect from Google and passes the access token
 * back to the parent window via postMessage.
 */

import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  // This is a simple HTML page that extracts the access token from the URL hash
  // and sends it to the parent window via postMessage
  const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Google OAuth Callback</title>
</head>
<body>
  <script>
    // Extract access token from URL hash
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    const accessToken = params.get('access_token');
    const error = params.get('error');

    if (error) {
      // Send error to parent window
      window.opener.postMessage({
        type: 'gmail-auth-error',
        error: error
      }, window.location.origin);
      window.close();
    } else if (accessToken) {
      // Send token to parent window
      window.opener.postMessage({
        type: 'gmail-auth-success',
        accessToken: accessToken
      }, window.location.origin);
      window.close();
    } else {
      document.body.innerHTML = '<p>Error: No access token received</p>';
    }
  </script>
  <p>Processing OAuth callback...</p>
</body>
</html>
  `;

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html',
    },
  });
}
