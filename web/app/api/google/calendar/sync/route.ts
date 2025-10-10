/**
 * Google Calendar Sync API
 *
 * POST: Trigger Google Calendar synchronization
 * Syncs events for specified week(s) with attendee tracking
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { GoogleAuthService, GOOGLE_SCOPES } from '@/lib/google-auth';
import { getDatabaseOperations } from '@/lib/database';
import { GoogleCalendarClient } from '../../../../../../src/integrations/google-calendar-client.js';
import { CalendarOperations } from '../../../../../../src/database/calendar-operations.js';
import { DatabaseConnection } from '../../../../../../src/database/connection.js';

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
      week = 'current',
      calendarId = 'primary',
    } = body;

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

    // Verify calendar scope
    const hasScopes = await googleAuth.hasRequiredScopes(userEmail, [GOOGLE_SCOPES.CALENDAR_READONLY]);
    if (!hasScopes) {
      return NextResponse.json(
        { error: 'Missing Calendar permission. Please reconnect your Google account.' },
        { status: 400 }
      );
    }

    // Get user
    let user = await db.getUserByEmail(userEmail);
    if (!user) {
      user = await db.getUserById(userId);
    }
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get auth client
    const authClient = await googleAuth.getAuthClient(userEmail);
    if (!authClient) {
      return NextResponse.json(
        { error: 'Failed to authenticate with Google' },
        { status: 500 }
      );
    }

    // Initialize calendar client
    const calendarClient = new GoogleCalendarClient(authClient);

    // Determine week identifier
    let weekIdentifier: string;
    if (week === 'current') {
      const now = new Date();
      const year = now.getFullYear();
      const startOfYear = new Date(year, 0, 1);
      const days = Math.floor((now.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
      const weekNumber = Math.ceil((days + startOfYear.getDay() + 1) / 7);
      weekIdentifier = `${year}-W${weekNumber.toString().padStart(2, '0')}`;
    } else {
      weekIdentifier = week;
    }

    // Fetch events from Google Calendar
    const result = await calendarClient.getEventsForWeek(weekIdentifier as any, calendarId);

    if (!result.ok) {
      return NextResponse.json(
        {
          success: false,
          eventsSynced: 0,
          weekIdentifier,
          errors: [result.error.message],
        },
        { status: 500 }
      );
    }

    // Initialize calendar operations
    const dbConnection = new DatabaseConnection({
      url: process.env.TURSO_URL!,
      authToken: process.env.TURSO_AUTH_TOKEN!,
    });
    await dbConnection.connect();

    const calendarOps = new CalendarOperations(dbConnection);

    // Store events in database
    let eventsSynced = 0;
    const errors: string[] = [];

    for (const event of result.data.events) {
      try {
        await calendarOps.upsertEvent({
          userId: user.id,
          weekIdentifier: weekIdentifier as any,
          eventId: event.id as any,
          summary: event.summary,
          description: event.description,
          startTime: event.startTime.toISOString(),
          endTime: event.endTime.toISOString(),
          location: event.location,
          attendees: event.attendees,
          recurrence: event.recurrence,
          isRecurring: event.isRecurring,
          recurringEventId: event.recurringEventId,
          status: event.status,
          metadata: event.metadata,
        });
        eventsSynced++;
      } catch (error) {
        errors.push(`Failed to store event "${event.summary}": ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    // Update user metadata with last sync time
    await db.updateUser(user.id, {
      metadata: {
        ...user.metadata,
        googleCalendarSyncAt: new Date().toISOString(),
      },
    });

    await dbConnection.disconnect();

    return NextResponse.json({
      success: true,
      eventsSynced,
      weekIdentifier,
      errors,
    });
  } catch (error) {
    console.error('Failed to sync Google calendar:', error);
    return NextResponse.json(
      {
        success: false,
        eventsSynced: 0,
        weekIdentifier: '',
        errors: [error instanceof Error ? error.message : 'Failed to sync calendar'],
      },
      { status: 500 }
    );
  }
}
