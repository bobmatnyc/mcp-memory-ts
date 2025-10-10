/**
 * Google Disconnect API
 *
 * POST: Disconnect Google account
 * Clears OAuth tokens from user metadata
 */

import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getDatabaseOperations } from '@/lib/database';

export async function POST() {
  try {
    const { userId, sessionClaims } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userEmail = sessionClaims?.email as string;

    // Get database operations
    const db = await getDatabaseOperations();

    // Get user
    let user = await db.getUserByEmail(userEmail);
    if (!user) {
      user = await db.getUserById(userId);
    }

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Clear Google OAuth tokens and sync metadata
    const updatedMetadata = { ...user.metadata };
    delete updatedMetadata.googleOAuthTokens;
    delete updatedMetadata.googleContactsSyncToken;
    delete updatedMetadata.googleContactsSyncAt;
    delete updatedMetadata.googleCalendarSyncAt;

    await db.updateUser(user.id, {
      metadata: updatedMetadata,
    });

    return NextResponse.json({
      success: true,
      message: 'Google account disconnected successfully',
    });
  } catch (error) {
    console.error('Failed to disconnect Google:', error);
    return NextResponse.json(
      { error: 'Failed to disconnect Google account' },
      { status: 500 }
    );
  }
}
