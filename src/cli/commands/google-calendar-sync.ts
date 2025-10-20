/**
 * Google Calendar Sync CLI Command
 *
 * CLI command for syncing calendar events from Google Calendar.
 * Supports week-based syncing and attendee linking.
 */

import { GoogleCalendarClient } from '../../integrations/google-calendar-client.js';
import { GoogleAuthService, GOOGLE_SCOPES } from '../../utils/google-auth.js';
import { CalendarOperations } from '../../database/calendar-operations.js';
import { DatabaseConnection } from '../../database/connection.js';
import { DatabaseOperations } from '../../database/operations.js';
import {
  getCurrentWeekIdentifier,
  getWeekIdentifier,
  formatWeekIdentifier,
} from '../../utils/week-calculator.js';
import type { WeekIdentifier } from '../../types/google.js';
import { colors, icons } from '../colors.js';
import { loadUserConfig } from '../claude-desktop.js';

export interface GoogleCalendarSyncCommandOptions {
  userEmail: string;
  week?: string; // Week identifier or 'current'
  weeks?: string[]; // Array of week identifiers
  calendarId?: string; // Google Calendar ID (default: 'primary')
}

/**
 * Google Calendar Sync Command
 */
export async function googleCalendarSyncCommand(
  options: GoogleCalendarSyncCommandOptions
): Promise<void> {
  console.log(`\n${icons.calendar} ${colors.title('Google Calendar Sync')}`);
  console.log(`${colors.dim('User:')} ${options.userEmail}\n`);

  // Load configuration
  const config = loadUserConfig();
  if (!config) {
    console.error(`${icons.error} Configuration not found. Run "mcp-memory init" first.`);
    process.exit(1);
  }

  // Connect to database
  const dbUrl = process.env.TURSO_URL || config.tursoUrl;
  const authToken = process.env.TURSO_AUTH_TOKEN || config.tursoAuthToken;

  if (!dbUrl || !authToken) {
    console.error(`${icons.error} Database configuration missing.`);
    console.error('Set TURSO_URL and TURSO_AUTH_TOKEN environment variables.');
    process.exit(1);
  }

  const db = new DatabaseConnection({ url: dbUrl, authToken });
  await db.connect();

  const dbOps = new DatabaseOperations(db);
  const calendarOps = new CalendarOperations(db);

  try {
    // Check Google Client credentials
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/auth/google-connect/callback';

    if (!clientId || !clientSecret) {
      console.error(`${icons.error} Google OAuth credentials not configured.`);
      console.error('Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables.');
      process.exit(1);
    }

    // Initialize services
    const googleAuth = new GoogleAuthService(dbOps, clientId, clientSecret, redirectUri);

    // Check if user is connected
    const isConnected = await googleAuth.isConnected(options.userEmail);
    if (!isConnected) {
      console.error(`${icons.error} Google account not connected.`);
      console.error('Connect your Google account via the web interface first.');
      process.exit(1);
    }

    // Verify required scopes
    const hasScopes = await googleAuth.hasRequiredScopes(options.userEmail, [
      GOOGLE_SCOPES.CALENDAR_READONLY,
    ]);

    if (!hasScopes) {
      console.error(`${icons.error} Missing required Google Calendar permission.`);
      console.error('Reconnect your Google account with Calendar access.');
      process.exit(1);
    }

    // Get auth client
    const authClient = await googleAuth.getAuthClient(options.userEmail);
    if (!authClient) {
      console.error(`${icons.error} Failed to get Google auth client.`);
      process.exit(1);
    }

    const calendarClient = new GoogleCalendarClient(authClient);

    // Determine which weeks to sync
    const weekIdentifiers: WeekIdentifier[] = [];

    if (options.weeks && options.weeks.length > 0) {
      weekIdentifiers.push(...(options.weeks as WeekIdentifier[]));
    } else if (options.week) {
      if (options.week.toLowerCase() === 'current') {
        weekIdentifiers.push(getCurrentWeekIdentifier());
      } else {
        weekIdentifiers.push(options.week as WeekIdentifier);
      }
    } else {
      // Default: current week
      weekIdentifiers.push(getCurrentWeekIdentifier());
    }

    console.log(`${icons.success} Syncing ${weekIdentifiers.length} week(s):\n`);
    weekIdentifiers.forEach(week => {
      console.log(`  ${colors.dim('•')} ${formatWeekIdentifier(week)}`);
    });
    console.log('');

    // Get user
    let user = await dbOps.getUserByEmail(options.userEmail);
    if (!user) {
      user = await dbOps.getUserById(options.userEmail);
    }
    if (!user) {
      console.error(`${icons.error} User not found: ${options.userEmail}`);
      process.exit(1);
    }

    // Sync each week
    let totalEvents = 0;
    let totalAttendees = new Set<string>();

    for (const weekId of weekIdentifiers) {
      console.log(`\n${icons.cycle} Syncing ${formatWeekIdentifier(weekId)}...`);

      const result = await calendarClient.getEventsForWeek(
        weekId,
        options.calendarId || 'primary'
      );

      if (!result.ok) {
        const { error } = result;
        console.error(`${icons.error} Failed to fetch events: ${error.message}`);
        continue;
      }

      const { events } = result.data;
      console.log(`  Found ${events.length} events`);

      // Store events in database
      for (const event of events) {
        await calendarOps.upsertEvent({
          userId: user.id,
          weekIdentifier: weekId,
          eventId: event.id,
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

        totalEvents++;

        // Track unique attendees
        event.attendees.forEach(a => {
          if (a.email) totalAttendees.add(a.email);
        });
      }

      console.log(`  ${icons.success} Stored ${events.length} events`);
    }

    // Print statistics
    const stats = await calendarOps.getEventStats(user.id);

    console.log(`\n${colors.title('=== Sync Summary ===')}`);
    console.log(`${colors.dim('Events synced:')} ${totalEvents}`);
    console.log(`${colors.dim('Total events in DB:')} ${stats.totalEvents}`);
    console.log(`${colors.dim('Recurring events:')} ${stats.recurringEvents}`);
    console.log(`${colors.dim('Unique attendees:')} ${stats.uniqueAttendees}`);
    console.log(`${colors.dim('Weeks tracked:')} ${stats.weeksTracked}`);

    console.log(`\n${icons.success} ${colors.success('Sync completed successfully!')}`);
  } catch (error) {
    console.error(`\n${icons.error} ${colors.error('Sync failed:')}`);
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  } finally {
    await db.disconnect();
  }
}
