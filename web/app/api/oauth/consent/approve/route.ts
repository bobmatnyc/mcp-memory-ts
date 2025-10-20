/**
 * OAuth Consent Approval Endpoint
 * Generates authorization code after user approval
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { initDatabaseFromEnv } from '@/lib/database';
import {
  generateAuthorizationCode,
  storeAuthorizationCode,
  validateRedirectUri,
} from '../../../../../../src/utils/oauth';

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        {
          error: 'unauthorized',
          error_description: 'User not authenticated',
        },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { client_id, redirect_uri, scope, state } = body;

    // Validate required parameters
    if (!client_id || !redirect_uri || !state) {
      return NextResponse.json(
        {
          error: 'invalid_request',
          error_description: 'Missing required parameters',
        },
        { status: 400 }
      );
    }

    // Initialize database
    const db = initDatabaseFromEnv();
    await db.connect();

    // Validate redirect_uri
    const isValidRedirectUri = await validateRedirectUri(db, client_id, redirect_uri);
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

    // Generate authorization code
    const code = generateAuthorizationCode();

    // Store authorization code
    await storeAuthorizationCode(db, {
      code,
      clientId: client_id,
      userId,
      redirectUri: redirect_uri,
      scope: scope || 'memories:read memories:write',
      state,
    });

    await db.disconnect();

    // Return authorization code
    return NextResponse.json({
      code,
      state,
    });
  } catch (error) {
    console.error('Consent approval error:', error);
    return NextResponse.json(
      {
        error: 'server_error',
        error_description: 'An unexpected error occurred',
      },
      { status: 500 }
    );
  }
}
