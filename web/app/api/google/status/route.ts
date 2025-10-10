/**
 * Google Connection Status API
 *
 * GET: Check Google OAuth connection status
 * Returns connection state, connected account, last sync times, and statistics
 */

import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { GoogleAuthService } from '@/lib/google-auth';
import { getDatabaseOperations } from '@/lib/database';
import { CalendarOperations } from '../../../../../src/database/calendar-operations.js';
import { DatabaseConnection } from '../../../../../src/database/connection.js';

export async function GET() {
  try {
    const { userId, sessionClaims } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userEmail = sessionClaims?.email as string;

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
      return NextResponse.json({
        connected: false,
      });
    }

    // Get user details
    let user = await db.getUserByEmail(userEmail);
    if (!user) {
      user = await db.getUserById(userId);
    }

    if (!user) {
      return NextResponse.json({
        connected: false,
      });
    }

    // Get last sync times from user metadata
    const lastSync = {
      contacts: user.metadata?.googleContactsSyncAt as string | undefined,
      calendar: user.metadata?.googleCalendarSyncAt as string | undefined,
    };

    // Get sync statistics
    const entities = await db.getEntitiesByUserId(user.id, 10000);
    const contactsSynced = entities.filter(
      e => e.metadata?.source === 'google-contacts'
    ).length;

    // Get calendar statistics
    const dbConnection = new DatabaseConnection({
      url: process.env.TURSO_URL!,
      authToken: process.env.TURSO_AUTH_TOKEN!,
    });
    await dbConnection.connect();

    const calendarOps = new CalendarOperations(dbConnection);
    const calendarStats = await calendarOps.getEventStats(user.id);

    await dbConnection.disconnect();

    // Get connected account email from OAuth tokens
    const tokens = user.metadata?.googleOAuthTokens as any;
    const connectedEmail = tokens?.email || userEmail;

    return NextResponse.json({
      connected: true,
      email: connectedEmail,
      lastSync,
      stats: {
        contactsSynced,
        eventsSynced: calendarStats.totalEvents,
      },
    });
  } catch (error) {
    console.error('Failed to get Google status:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve Google connection status' },
      { status: 500 }
    );
  }
}
