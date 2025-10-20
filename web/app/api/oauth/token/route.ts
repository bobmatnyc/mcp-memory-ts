/**
 * OAuth 2.0 Token Endpoint
 * Exchanges authorization codes for access tokens
 */

import { NextRequest, NextResponse } from 'next/server';
import { initDatabaseFromEnv } from '@/lib/database';
import {
  validateClientCredentials,
  validateAuthorizationCode,
  generateAccessToken,
  generateRefreshToken,
  storeAccessToken,
  storeRefreshToken,
  TOKEN_EXPIRY,
} from '../../../../../src/utils/oauth';

/**
 * POST /api/oauth/token
 *
 * OAuth 2.0 token endpoint
 * Body parameters (application/x-www-form-urlencoded):
 * - grant_type: "authorization_code" or "refresh_token"
 * - code: Authorization code (for authorization_code grant)
 * - redirect_uri: Must match the redirect_uri from authorization request
 * - client_id: OAuth client identifier
 * - client_secret: OAuth client secret
 * - refresh_token: Refresh token (for refresh_token grant)
 */
export async function POST(request: NextRequest) {
  try {
    // Parse form data
    const formData = await request.formData();
    const grantType = formData.get('grant_type')?.toString();
    const code = formData.get('code')?.toString();
    const redirectUri = formData.get('redirect_uri')?.toString();
    const clientId = formData.get('client_id')?.toString();
    const clientSecret = formData.get('client_secret')?.toString();
    const refreshToken = formData.get('refresh_token')?.toString();

    // Validate required parameters
    if (!grantType || !clientId || !clientSecret) {
      return NextResponse.json(
        {
          error: 'invalid_request',
          error_description: 'Missing required parameters: grant_type, client_id, client_secret',
        },
        { status: 400 }
      );
    }

    // Initialize database
    const db = initDatabaseFromEnv();
    await db.connect();

    // Validate client credentials
    const isValidClient = await validateClientCredentials(db, clientId, clientSecret);
    if (!isValidClient) {
      await db.disconnect();
      return NextResponse.json(
        {
          error: 'invalid_client',
          error_description: 'Invalid client credentials',
        },
        { status: 401 }
      );
    }

    // Handle authorization_code grant
    if (grantType === 'authorization_code') {
      if (!code || !redirectUri) {
        await db.disconnect();
        return NextResponse.json(
          {
            error: 'invalid_request',
            error_description: 'Missing required parameters: code, redirect_uri',
          },
          { status: 400 }
        );
      }

      // Validate authorization code
      const codeValidation = await validateAuthorizationCode(db, code, clientId, redirectUri);

      if (!codeValidation.valid || !codeValidation.userId || !codeValidation.scope) {
        await db.disconnect();
        return NextResponse.json(
          {
            error: 'invalid_grant',
            error_description: 'Invalid or expired authorization code',
          },
          { status: 400 }
        );
      }

      // Generate access token and refresh token
      const accessToken = generateAccessToken();
      const newRefreshToken = generateRefreshToken();

      // Store tokens in database
      await storeAccessToken(db, {
        token: accessToken,
        clientId,
        userId: codeValidation.userId,
        scope: codeValidation.scope,
      });

      await storeRefreshToken(db, {
        token: newRefreshToken,
        accessToken,
        clientId,
        userId: codeValidation.userId,
        scope: codeValidation.scope,
      });

      await db.disconnect();

      // Return token response
      return NextResponse.json({
        access_token: accessToken,
        token_type: 'Bearer',
        expires_in: Math.floor(TOKEN_EXPIRY.accessToken / 1000), // Convert to seconds
        refresh_token: newRefreshToken,
        scope: codeValidation.scope,
      });
    }

    // Handle refresh_token grant
    if (grantType === 'refresh_token') {
      if (!refreshToken) {
        await db.disconnect();
        return NextResponse.json(
          {
            error: 'invalid_request',
            error_description: 'Missing required parameter: refresh_token',
          },
          { status: 400 }
        );
      }

      // Validate refresh token
      const result = await db.execute(
        `SELECT user_id, client_id, scope, expires_at, revoked
         FROM oauth_refresh_tokens
         WHERE token = ?`,
        [refreshToken]
      );

      if (result.rows.length === 0) {
        await db.disconnect();
        return NextResponse.json(
          {
            error: 'invalid_grant',
            error_description: 'Invalid refresh token',
          },
          { status: 400 }
        );
      }

      const tokenData = result.rows[0] as any;

      // Check if revoked
      if (tokenData.revoked) {
        await db.disconnect();
        return NextResponse.json(
          {
            error: 'invalid_grant',
            error_description: 'Refresh token has been revoked',
          },
          { status: 400 }
        );
      }

      // Check if expired
      const expiresAt = new Date(tokenData.expires_at);
      if (new Date() > expiresAt) {
        await db.disconnect();
        return NextResponse.json(
          {
            error: 'invalid_grant',
            error_description: 'Refresh token has expired',
          },
          { status: 400 }
        );
      }

      // Validate client_id matches
      if (tokenData.client_id !== clientId) {
        await db.disconnect();
        return NextResponse.json(
          {
            error: 'invalid_grant',
            error_description: 'Client ID mismatch',
          },
          { status: 400 }
        );
      }

      // Generate new access token
      const newAccessToken = generateAccessToken();

      // Store new access token
      await storeAccessToken(db, {
        token: newAccessToken,
        clientId,
        userId: tokenData.user_id,
        scope: tokenData.scope,
      });

      await db.disconnect();

      // Return token response (refresh token stays the same)
      return NextResponse.json({
        access_token: newAccessToken,
        token_type: 'Bearer',
        expires_in: Math.floor(TOKEN_EXPIRY.accessToken / 1000), // Convert to seconds
        scope: tokenData.scope,
      });
    }

    // Unsupported grant type
    await db.disconnect();
    return NextResponse.json(
      {
        error: 'unsupported_grant_type',
        error_description: 'Only authorization_code and refresh_token grant types are supported',
      },
      { status: 400 }
    );
  } catch (error) {
    console.error('OAuth token error:', error);
    return NextResponse.json(
      {
        error: 'server_error',
        error_description: 'An unexpected error occurred',
      },
      { status: 500 }
    );
  }
}
