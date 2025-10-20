/**
 * OAuth 2.0 Authorization Endpoint
 * Handles authorization requests from OAuth clients (e.g., Claude.AI)
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { initDatabaseFromEnv } from '@/lib/database';
import { getOAuthClient, validateRedirectUri } from '../../../../../src/utils/oauth';

/**
 * GET /api/oauth/authorize
 *
 * OAuth 2.0 authorization endpoint
 * Required query parameters:
 * - response_type: "code" (only authorization code flow supported)
 * - client_id: OAuth client identifier
 * - redirect_uri: Callback URL
 * - scope: Requested permissions (optional, defaults to "memories:read memories:write")
 * - state: CSRF protection token (required)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Extract OAuth parameters
    const responseType = searchParams.get('response_type');
    const clientId = searchParams.get('client_id');
    const redirectUri = searchParams.get('redirect_uri');
    const scope = searchParams.get('scope') || 'memories:read memories:write';
    const state = searchParams.get('state');

    // Validate required parameters
    if (!responseType || !clientId || !redirectUri || !state) {
      return NextResponse.json(
        {
          error: 'invalid_request',
          error_description: 'Missing required parameters: response_type, client_id, redirect_uri, state',
        },
        { status: 400 }
      );
    }

    // Validate response_type
    if (responseType !== 'code') {
      return NextResponse.json(
        {
          error: 'unsupported_response_type',
          error_description: 'Only "code" response type is supported',
        },
        { status: 400 }
      );
    }

    // Initialize database
    const db = initDatabaseFromEnv();
    await db.connect();

    // Validate client_id
    const client = await getOAuthClient(db, clientId);
    if (!client) {
      await db.disconnect();
      return NextResponse.json(
        {
          error: 'invalid_client',
          error_description: 'Unknown client_id',
        },
        { status: 401 }
      );
    }

    // Check if client is active
    if (!client.isActive) {
      await db.disconnect();
      return NextResponse.json(
        {
          error: 'unauthorized_client',
          error_description: 'Client is not active',
        },
        { status: 401 }
      );
    }

    // Validate redirect_uri
    const isValidRedirectUri = await validateRedirectUri(db, clientId, redirectUri);
    if (!isValidRedirectUri) {
      await db.disconnect();
      return NextResponse.json(
        {
          error: 'invalid_request',
          error_description: 'Invalid redirect_uri',
        },
        { status: 400 }
      );
    }

    await db.disconnect();

    // Check if user is authenticated
    const { userId } = await auth();

    if (!userId) {
      // Redirect to login with return URL
      const loginUrl = new URL('/sign-in', request.url);
      loginUrl.searchParams.set('redirect_url', request.url);

      return NextResponse.redirect(loginUrl);
    }

    // User is authenticated - redirect to consent screen
    const consentUrl = new URL('/oauth/consent', request.url);
    consentUrl.searchParams.set('client_id', clientId);
    consentUrl.searchParams.set('redirect_uri', redirectUri);
    consentUrl.searchParams.set('scope', scope);
    consentUrl.searchParams.set('state', state);
    consentUrl.searchParams.set('client_name', client.name);

    return NextResponse.redirect(consentUrl);
  } catch (error) {
    console.error('OAuth authorization error:', error);
    return NextResponse.json(
      {
        error: 'server_error',
        error_description: 'An unexpected error occurred',
      },
      { status: 500 }
    );
  }
}
