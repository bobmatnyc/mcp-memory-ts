/**
 * Google OAuth Initiation
 *
 * Initiates OAuth flow for Google Contacts and Calendar sync.
 * Uses authorization code flow with offline access for refresh tokens.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { GoogleAuthService, GOOGLE_SCOPES } from '@/lib/google-auth';
import { getDatabaseOperations } from '@/lib/database';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      console.error('[GoogleOAuth] Unauthorized - no userId from Clerk');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get Clerk user data
    const { currentUser } = await import('@clerk/nextjs/server');
    const clerkUser = await currentUser();

    if (!clerkUser || !clerkUser.emailAddresses || clerkUser.emailAddresses.length === 0) {
      console.error('[GoogleOAuth] No email found for Clerk user:', userId);
      return NextResponse.json({ error: 'User email not found' }, { status: 400 });
    }

    const email = clerkUser.emailAddresses[0].emailAddress;
    const name = clerkUser.firstName && clerkUser.lastName
      ? `${clerkUser.firstName} ${clerkUser.lastName}`
      : clerkUser.firstName || email.split('@')[0];

    console.log('[GoogleOAuth] Initiating OAuth for user:', { userId, email });

    // Get database operations
    const db = await getDatabaseOperations();

    // Ensure user exists in database BEFORE starting OAuth flow
    try {
      let user = await db.getUserById(userId);

      if (!user) {
        console.log('[GoogleOAuth] User not found in database, creating:', { userId, email });
        user = await db.createUser({
          id: userId, // Use Clerk userId as primary key
          email,
          name,
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        console.log('[GoogleOAuth] User created successfully:', user.id);
      } else {
        console.log('[GoogleOAuth] User already exists in database:', user.id);
      }
    } catch (dbError) {
      console.error('[GoogleOAuth] Failed to ensure user exists in database:', dbError);
      return NextResponse.json(
        { error: 'Failed to prepare user for authentication' },
        { status: 500 }
      );
    }

    // Initialize Google Auth Service
    const googleAuth = new GoogleAuthService(
      db,
      process.env.GOOGLE_CLIENT_ID!,
      process.env.GOOGLE_CLIENT_SECRET!,
      `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/google-connect/callback`
    );

    // Request all necessary scopes
    const scopes = [
      GOOGLE_SCOPES.CONTACTS,
      GOOGLE_SCOPES.CALENDAR_READONLY,
      GOOGLE_SCOPES.GMAIL_READONLY,
    ];

    // Use Clerk userId as state for security
    const authUrl = googleAuth.generateAuthUrl(scopes, userId);

    console.log('[GoogleOAuth] Redirecting to Google OAuth consent screen');
    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error('[GoogleOAuth] Failed to initiate OAuth:', error);
    return NextResponse.json(
      { error: 'Failed to initiate authentication' },
      { status: 500 }
    );
  }
}
