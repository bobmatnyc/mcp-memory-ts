/**
 * Google OAuth Callback Handler
 *
 * Handles OAuth redirect from Google, exchanges code for tokens,
 * and stores tokens securely in user metadata.
 */

import { NextRequest, NextResponse } from 'next/server';
import { GoogleAuthService } from '@/lib/google-auth';
import { getDatabaseOperations } from '@/lib/database';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state'); // Clerk userId
  const error = searchParams.get('error');

  // Handle OAuth errors
  if (error) {
    console.error('Google OAuth error:', error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/settings?google_error=${encodeURIComponent(error)}`
    );
  }

  // Validate required parameters
  if (!code || !state) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/settings?google_error=invalid_callback`
    );
  }

  try {
    // Get database operations
    const db = await getDatabaseOperations();

    // Initialize Google Auth Service
    const googleAuth = new GoogleAuthService(
      db,
      process.env.GOOGLE_CLIENT_ID!,
      process.env.GOOGLE_CLIENT_SECRET!,
      `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/google-connect/callback`
    );

    // Exchange code for tokens
    const tokenResult = await googleAuth.getTokensFromCode(code);

    if (!tokenResult.ok) {
      console.error('Failed to get tokens:', tokenResult.error);
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/settings?google_error=token_exchange_failed`
      );
    }

    // Store tokens in user metadata
    const storeResult = await googleAuth.storeTokens(state, tokenResult.data);

    if (!storeResult.ok) {
      console.error('Failed to store tokens:', storeResult.error);
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/settings?google_error=token_storage_failed`
      );
    }

    // Success - redirect to settings with success message
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/settings?google_connected=true`
    );
  } catch (error) {
    console.error('OAuth callback error:', error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/settings?google_error=unexpected_error`
    );
  }
}
