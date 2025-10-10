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

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get database operations
    const db = await getDatabaseOperations();

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

    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error('Failed to initiate Google OAuth:', error);
    return NextResponse.json(
      { error: 'Failed to initiate authentication' },
      { status: 500 }
    );
  }
}
