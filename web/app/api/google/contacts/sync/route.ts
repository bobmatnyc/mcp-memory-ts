/**
 * Google Contacts Sync API
 *
 * POST: Trigger Google Contacts synchronization
 * Supports import, export, and bidirectional sync with LLM deduplication
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { GoogleAuthService } from '@/lib/google-auth';
import { getDatabaseOperations } from '@/lib/database';
import { GoogleContactsSyncService } from '../../../../../../src/services/google-contacts-sync.js';

export async function POST(request: NextRequest) {
  try {
    const { userId, sessionClaims } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userEmail = sessionClaims?.email as string;

    // Parse request body
    const body = await request.json();
    const {
      direction = 'both',
      dryRun = false,
      forceFull = false,
      useLLM = true,
    } = body;

    // Validate direction
    if (!['import', 'export', 'both'].includes(direction)) {
      return NextResponse.json(
        { error: 'Invalid direction. Must be import, export, or both' },
        { status: 400 }
      );
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

    // Check if user is connected
    const isConnected = await googleAuth.isConnected(userEmail);
    if (!isConnected) {
      return NextResponse.json(
        { error: 'Google account not connected. Please connect your account first.' },
        { status: 400 }
      );
    }

    // Initialize sync service
    const syncService = new GoogleContactsSyncService(db, googleAuth);

    // Perform sync
    const result = await syncService.sync({
      userId: userEmail,
      direction,
      dryRun,
      forceFull,
      enableLLMDedup: useLLM,
      deduplicationThreshold: 0.8,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Failed to sync Google contacts:', error);
    return NextResponse.json(
      {
        success: false,
        exported: 0,
        imported: 0,
        updated: 0,
        duplicatesFound: 0,
        merged: 0,
        errors: [error instanceof Error ? error.message : 'Failed to sync contacts'],
      },
      { status: 500 }
    );
  }
}
