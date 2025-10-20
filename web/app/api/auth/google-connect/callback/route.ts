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

  console.log('[GoogleOAuth Callback] Received callback:', {
    hasCode: !!code,
    hasState: !!state,
    error,
  });

  // Handle OAuth errors
  if (error) {
    console.error('[GoogleOAuth Callback] Google OAuth error:', error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/settings?google_error=${encodeURIComponent(error)}`
    );
  }

  // Validate required parameters
  if (!code || !state) {
    console.error('[GoogleOAuth Callback] Missing required parameters:', { code: !!code, state: !!state });
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/settings?google_error=invalid_callback`
    );
  }

  const userId = state; // Clerk userId from state parameter

  try {
    // Get database operations
    const db = await getDatabaseOperations();

    // Ensure user exists in database (defensive)
    try {
      let user = await db.getUserById(userId);

      if (!user) {
        console.warn('[GoogleOAuth Callback] User not found in database, attempting to create:', userId);

        // Get Clerk user data to create database user
        const { clerkClient } = await import('@clerk/nextjs/server');
        const client = await clerkClient();
        const clerkUser = await client.users.getUser(userId);

        if (!clerkUser || !clerkUser.emailAddresses || clerkUser.emailAddresses.length === 0) {
          console.error('[GoogleOAuth Callback] Cannot create user - no email in Clerk:', userId);
          return NextResponse.redirect(
            `${process.env.NEXT_PUBLIC_APP_URL}/settings?google_error=user_creation_failed`
          );
        }

        const email = clerkUser.emailAddresses[0].emailAddress;
        const name = clerkUser.firstName && clerkUser.lastName
          ? `${clerkUser.firstName} ${clerkUser.lastName}`
          : clerkUser.firstName || email.split('@')[0];

        user = await db.createUser({
          id: userId,
          email,
          name,
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

        console.log('[GoogleOAuth Callback] User created successfully:', user.id);
      } else {
        console.log('[GoogleOAuth Callback] User found in database:', user.id);
      }
    } catch (userError) {
      console.error('[GoogleOAuth Callback] Failed to ensure user exists:', userError);
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/settings?google_error=user_lookup_failed`
      );
    }

    // Initialize Google Auth Service
    const googleAuth = new GoogleAuthService(
      db,
      process.env.GOOGLE_CLIENT_ID!,
      process.env.GOOGLE_CLIENT_SECRET!,
      `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/google-connect/callback`
    );

    console.log('[GoogleOAuth Callback] Exchanging authorization code for tokens');

    // Exchange code for tokens
    const tokenResult = await googleAuth.getTokensFromCode(code);

    if (!tokenResult.ok) {
      console.error('[GoogleOAuth Callback] Failed to get tokens:', tokenResult.error);
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/settings?google_error=token_exchange_failed`
      );
    }

    console.log('[GoogleOAuth Callback] Tokens received successfully, storing for user:', userId);

    // Store tokens in user metadata
    const storeResult = await googleAuth.storeTokens(userId, tokenResult.data);

    if (!storeResult.ok) {
      console.error('[GoogleOAuth Callback] Failed to store tokens:', {
        userId,
        error: storeResult.error,
      });
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/settings?google_error=token_storage_failed&details=${encodeURIComponent(storeResult.error.message)}`
      );
    }

    console.log('[GoogleOAuth Callback] Tokens stored successfully for user:', userId);

    // Verify tokens were actually stored
    const verifyUser = await db.getUserById(userId);
    if (!verifyUser?.metadata?.googleOAuthTokens) {
      console.error('[GoogleOAuth Callback] Verification failed - tokens not found in user metadata:', userId);
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/settings?google_error=verification_failed`
      );
    }

    console.log('[GoogleOAuth Callback] OAuth connection verified successfully');

    // Success - redirect to settings with success message
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/settings?google_connected=true`
    );
  } catch (error) {
    console.error('[GoogleOAuth Callback] Unexpected error:', error);
    const errorMessage = error instanceof Error ? error.message : 'unexpected_error';
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/settings?google_error=${encodeURIComponent(errorMessage)}`
    );
  }
}
