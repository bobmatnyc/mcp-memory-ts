/**
 * Google Calendar Events API
 *
 * GET: Fetch calendar events for display
 * Query params: week (week identifier), calendarId (optional)
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getDatabaseOperations } from '@/lib/database';
import { CalendarOperations } from '../../../../../../src/database/calendar-operations.js';
import { DatabaseConnection } from '../../../../../../src/database/connection.js';

export async function GET(request: NextRequest) {
  try {
    const { userId, sessionClaims } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userEmail = sessionClaims?.email as string;

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const week = searchParams.get('week');

    if (!week) {
      return NextResponse.json(
        { error: 'Week parameter is required' },
        { status: 400 }
      );
    }

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

    // Initialize calendar operations
    const dbConnection = new DatabaseConnection({
      url: process.env.TURSO_URL!,
      authToken: process.env.TURSO_AUTH_TOKEN!,
    });
    await dbConnection.connect();

    const calendarOps = new CalendarOperations(dbConnection);

    // Fetch events for the week
    const events = await calendarOps.getEventsForWeek(user.id, week as any);

    await dbConnection.disconnect();

    // Transform events for frontend
    const transformedEvents = events.map(event => ({
      eventId: event.eventId,
      summary: event.summary,
      description: event.description,
      startTime: event.startTime,
      endTime: event.endTime,
      location: event.location,
      attendees: event.attendees,
      isRecurring: event.isRecurring,
      recurringEventId: event.recurringEventId,
      status: event.status,
    }));

    return NextResponse.json({
      events: transformedEvents,
      weekIdentifier: week,
      totalEvents: transformedEvents.length,
    });
  } catch (error) {
    console.error('Failed to fetch calendar events:', error);
    return NextResponse.json(
      { error: 'Failed to fetch calendar events' },
      { status: 500 }
    );
  }
}
