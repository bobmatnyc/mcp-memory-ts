/**
 * Calendar Database Operations
 *
 * Database operations for Google Calendar event storage and retrieval.
 * Supports week-based queries and attendee linking.
 */

import type { DatabaseConnection } from './connection.js';
import type { WeekIdentifier, GoogleEventId } from '../types/google.js';
import type { CalendarEvent, CalendarAttendee } from '../integrations/google-calendar-client.js';
import { createGoogleEventId, createWeekIdentifier } from '../types/google.js';

/**
 * Calendar event data for database storage
 */
export interface CalendarEventData {
  userId: string;
  weekIdentifier: WeekIdentifier;
  eventId: GoogleEventId;
  summary: string;
  description?: string;
  startTime: string; // ISO 8601 format
  endTime: string; // ISO 8601 format
  location?: string;
  attendees: CalendarAttendee[];
  recurrence?: string[];
  isRecurring: boolean;
  recurringEventId?: string;
  status: string;
  metadata: {
    etag: string;
    calendarId: string;
    created: string;
    updated: string;
  };
}

/**
 * Calendar Operations
 *
 * Features:
 * - Week-based event storage
 * - Attendee tracking
 * - Event deduplication
 * - Efficient queries with indexes
 */
export class CalendarOperations {
  constructor(private db: DatabaseConnection) {}

  /**
   * Create or update a calendar event
   *
   * @param event - Calendar event data
   */
  async upsertEvent(event: CalendarEventData): Promise<void> {
    const sql = `
      INSERT OR REPLACE INTO calendar_events (
        user_id, week_identifier, event_id, summary, description,
        start_time, end_time, location, attendees, recurrence,
        is_recurring, recurring_event_id, status, metadata,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `;

    await this.db.execute(sql, [
      event.userId,
      event.weekIdentifier,
      event.eventId,
      event.summary,
      event.description || null,
      event.startTime,
      event.endTime,
      event.location || null,
      JSON.stringify(event.attendees),
      event.recurrence ? JSON.stringify(event.recurrence) : null,
      event.isRecurring ? 1 : 0,
      event.recurringEventId || null,
      event.status,
      JSON.stringify(event.metadata),
    ]);
  }

  /**
   * Get events for a specific week
   *
   * @param userId - User ID
   * @param weekIdentifier - Week identifier (YYYY-WW)
   * @returns Array of calendar events
   */
  async getEventsForWeek(userId: string, weekIdentifier: WeekIdentifier): Promise<CalendarEventData[]> {
    const result = await this.db.execute(
      `SELECT * FROM calendar_events
       WHERE user_id = ? AND week_identifier = ?
       ORDER BY start_time ASC`,
      [userId, weekIdentifier]
    );

    return (result.rows || []).map((row: any) => this.mapRowToEvent(row as any));
  }

  /**
   * Get events for multiple weeks
   *
   * @param userId - User ID
   * @param weekIdentifiers - Array of week identifiers
   * @returns Array of calendar events
   */
  async getEventsForWeeks(userId: string, weekIdentifiers: WeekIdentifier[]): Promise<CalendarEventData[]> {
    const placeholders = weekIdentifiers.map(() => '?').join(',');
    const sql = `
      SELECT * FROM calendar_events
      WHERE user_id = ? AND week_identifier IN (${placeholders})
      ORDER BY start_time ASC
    `;

    const result = await this.db.execute(sql, [userId, ...weekIdentifiers]);
    return (result.rows || []).map((row: any) => this.mapRowToEvent(row as any));
  }

  /**
   * Get events within a date range
   *
   * @param userId - User ID
   * @param startDate - Start date (ISO 8601)
   * @param endDate - End date (ISO 8601)
   * @returns Array of calendar events
   */
  async getEventsInRange(userId: string, startDate: string, endDate: string): Promise<CalendarEventData[]> {
    const result = await this.db.execute(
      `SELECT * FROM calendar_events
       WHERE user_id = ? AND start_time >= ? AND start_time <= ?
       ORDER BY start_time ASC`,
      [userId, startDate, endDate]
    );

    return (result.rows || []).map((row: any) => this.mapRowToEvent(row as any));
  }

  /**
   * Get event by ID
   *
   * @param userId - User ID
   * @param eventId - Event ID
   * @returns Calendar event or null
   */
  async getEventById(userId: string, eventId: GoogleEventId): Promise<CalendarEventData | null> {
    const result = await this.db.execute(
      `SELECT * FROM calendar_events
       WHERE user_id = ? AND event_id = ?
       LIMIT 1`,
      [userId, eventId]
    );

    const row = result.rows?.[0] as any;
    return row ? this.mapRowToEvent(row) : null;
  }

  /**
   * Get events with a specific attendee
   *
   * @param userId - User ID
   * @param attendeeEmail - Attendee email
   * @returns Array of calendar events
   */
  async getEventsByAttendee(userId: string, attendeeEmail: string): Promise<CalendarEventData[]> {
    const result = await this.db.execute(
      `SELECT * FROM calendar_events
       WHERE user_id = ? AND attendees LIKE ?
       ORDER BY start_time DESC`,
      [userId, `%${attendeeEmail}%`]
    );

    return (result.rows || []).map((row: any) => this.mapRowToEvent(row as any));
  }

  /**
   * Delete event
   *
   * @param userId - User ID
   * @param eventId - Event ID
   */
  async deleteEvent(userId: string, eventId: GoogleEventId): Promise<void> {
    await this.db.execute(
      `DELETE FROM calendar_events
       WHERE user_id = ? AND event_id = ?`,
      [userId, eventId]
    );
  }

  /**
   * Delete events for a week
   *
   * @param userId - User ID
   * @param weekIdentifier - Week identifier
   */
  async deleteEventsForWeek(userId: string, weekIdentifier: WeekIdentifier): Promise<void> {
    await this.db.execute(
      `DELETE FROM calendar_events
       WHERE user_id = ? AND week_identifier = ?`,
      [userId, weekIdentifier]
    );
  }

  /**
   * Get all unique attendee emails for a user
   *
   * @param userId - User ID
   * @returns Array of attendee emails
   */
  async getAllAttendees(userId: string): Promise<string[]> {
    const result = await this.db.execute(
      `SELECT DISTINCT attendees FROM calendar_events
       WHERE user_id = ?`,
      [userId]
    );

    const attendeeEmails = new Set<string>();

    for (const row of result.rows || []) {
      const attendees = JSON.parse((row as any).attendees || '[]');
      for (const attendee of attendees) {
        if (attendee.email) {
          attendeeEmails.add(attendee.email);
        }
      }
    }

    return Array.from(attendeeEmails);
  }

  /**
   * Get event statistics for a user
   *
   * @param userId - User ID
   * @returns Event statistics
   */
  async getEventStats(userId: string): Promise<{
    totalEvents: number;
    recurringEvents: number;
    uniqueAttendees: number;
    weeksTracked: number;
  }> {
    const totalResult = await this.db.execute(
      `SELECT COUNT(*) as count FROM calendar_events WHERE user_id = ?`,
      [userId]
    );

    const recurringResult = await this.db.execute(
      `SELECT COUNT(*) as count FROM calendar_events WHERE user_id = ? AND is_recurring = 1`,
      [userId]
    );

    const weeksResult = await this.db.execute(
      `SELECT COUNT(DISTINCT week_identifier) as count FROM calendar_events WHERE user_id = ?`,
      [userId]
    );

    const attendees = await this.getAllAttendees(userId);

    return {
      totalEvents: (totalResult.rows?.[0] as any)?.count || 0,
      recurringEvents: (recurringResult.rows?.[0] as any)?.count || 0,
      uniqueAttendees: attendees.length,
      weeksTracked: (weeksResult.rows?.[0] as any)?.count || 0,
    };
  }

  /**
   * Map database row to CalendarEventData
   */
  private mapRowToEvent(row: any): CalendarEventData {
    return {
      userId: row.user_id,
      weekIdentifier: createWeekIdentifier(row.week_identifier),
      eventId: createGoogleEventId(row.event_id),
      summary: row.summary,
      description: row.description,
      startTime: row.start_time,
      endTime: row.end_time,
      location: row.location,
      attendees: JSON.parse(row.attendees || '[]'),
      recurrence: row.recurrence ? JSON.parse(row.recurrence) : undefined,
      isRecurring: !!row.is_recurring,
      recurringEventId: row.recurring_event_id,
      status: row.status,
      metadata: JSON.parse(row.metadata || '{}'),
    };
  }
}
