/**
 * Google Calendar API Client
 *
 * Wrapper for Google Calendar API with week-based event tracking.
 * Handles recurring events, attendee extraction, and event metadata.
 */

import { google, calendar_v3 } from 'googleapis';
import type { OAuth2Client } from 'google-auth-library';
import type { GoogleEventId, WeekIdentifier, SyncResult } from '../types/google.js';
import { createGoogleEventId } from '../types/google.js';
import { getWeekDates } from '../utils/week-calculator.js';

/**
 * Calendar event attendee
 */
export interface CalendarAttendee {
  email: string;
  displayName?: string;
  responseStatus: 'needsAction' | 'declined' | 'tentative' | 'accepted';
  self?: boolean;
  organizer?: boolean;
}

/**
 * Calendar event
 */
export interface CalendarEvent {
  id: GoogleEventId;
  summary: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  location?: string;
  attendees: CalendarAttendee[];
  recurrence?: string[];
  isRecurring: boolean;
  recurringEventId?: string;
  status: 'confirmed' | 'tentative' | 'cancelled';
  metadata: {
    etag: string;
    calendarId: string;
    created: string;
    updated: string;
  };
}

/**
 * Week events response
 */
export interface WeekEventsResponse {
  events: CalendarEvent[];
  weekIdentifier: WeekIdentifier;
  startDate: Date;
  endDate: Date;
}

/**
 * Google Calendar API Client
 *
 * Features:
 * - Week-based event fetching
 * - Recurring event expansion
 * - Attendee extraction
 * - Multiple calendar support
 */
export class GoogleCalendarClient {
  private calendar: calendar_v3.Calendar;

  constructor(private auth: OAuth2Client) {
    this.calendar = google.calendar({ version: 'v3', auth });
  }

  /**
   * Get events for a specific week
   *
   * @param weekIdentifier - Week identifier (YYYY-WW)
   * @param calendarId - Calendar ID (default: 'primary')
   * @returns Week events with attendees
   */
  async getEventsForWeek(
    weekIdentifier: WeekIdentifier,
    calendarId = 'primary'
  ): Promise<SyncResult<WeekEventsResponse>> {
    try {
      const { start, end } = getWeekDates(weekIdentifier);

      const response = await this.calendar.events.list({
        calendarId,
        timeMin: start.toISOString(),
        timeMax: end.toISOString(),
        singleEvents: true, // Expand recurring events
        orderBy: 'startTime',
        maxResults: 2500,
      });

      const events = (response.data.items || [])
        .map(item => this.mapToCalendarEvent(item, calendarId))
        .filter((event): event is CalendarEvent => event !== null);

      return {
        ok: true,
        data: {
          events,
          weekIdentifier,
          startDate: start,
          endDate: end,
        },
      };
    } catch (error: any) {
      return this.handleError(error);
    }
  }

  /**
   * Get events for multiple weeks
   *
   * @param weekIdentifiers - Array of week identifiers
   * @param calendarId - Calendar ID (default: 'primary')
   * @returns Array of week events
   */
  async getEventsForWeeks(
    weekIdentifiers: WeekIdentifier[],
    calendarId = 'primary'
  ): Promise<SyncResult<WeekEventsResponse[]>> {
    try {
      const results: WeekEventsResponse[] = [];

      for (const weekId of weekIdentifiers) {
        const weekResult = await this.getEventsForWeek(weekId, calendarId);

        if (!weekResult.ok) {
          return weekResult;
        }

        results.push(weekResult.data);
      }

      return { ok: true, data: results };
    } catch (error: any) {
      return this.handleError(error);
    }
  }

  /**
   * Get event by ID
   *
   * @param eventId - Event ID
   * @param calendarId - Calendar ID (default: 'primary')
   * @returns Calendar event
   */
  async getEvent(eventId: string, calendarId = 'primary'): Promise<SyncResult<CalendarEvent>> {
    try {
      const response = await this.calendar.events.get({
        calendarId,
        eventId,
      });

      const event = this.mapToCalendarEvent(response.data, calendarId);

      if (!event) {
        return {
          ok: false,
          error: {
            type: 'VALIDATION_ERROR',
            message: 'Failed to parse event',
          },
        };
      }

      return { ok: true, data: event };
    } catch (error: any) {
      return this.handleError(error);
    }
  }

  /**
   * List all calendars
   *
   * @returns Array of calendar metadata
   */
  async listCalendars(): Promise<
    SyncResult<
      Array<{
        id: string;
        summary: string;
        primary?: boolean;
        accessRole: string;
      }>
    >
  > {
    try {
      const response = await this.calendar.calendarList.list();

      const calendars = (response.data.items || []).map(cal => ({
        id: cal.id || '',
        summary: cal.summary || '',
        primary: cal.primary ?? undefined,
        accessRole: cal.accessRole || '',
      }));

      return { ok: true, data: calendars };
    } catch (error: any) {
      return this.handleError(error);
    }
  }

  /**
   * Map Google Calendar event to CalendarEvent
   */
  private mapToCalendarEvent(
    event: calendar_v3.Schema$Event,
    calendarId: string
  ): CalendarEvent | null {
    if (!event.id || !event.start || !event.end) {
      return null;
    }

    // Parse start and end times
    const startTime = new Date(event.start.dateTime || event.start.date || '');
    const endTime = new Date(event.end.dateTime || event.end.date || '');

    if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
      return null;
    }

    // Parse attendees
    const attendees: CalendarAttendee[] = (event.attendees || []).map(a => ({
      email: a.email || '',
      displayName: a.displayName ?? undefined,
      responseStatus: (a.responseStatus as any) || 'needsAction',
      self: a.self ?? undefined,
      organizer: a.organizer ?? undefined,
    }));

    return {
      id: createGoogleEventId(event.id),
      summary: event.summary || '(No title)',
      description: event.description ?? undefined,
      startTime,
      endTime,
      location: event.location ?? undefined,
      attendees,
      recurrence: event.recurrence ?? undefined,
      isRecurring: !!event.recurringEventId,
      recurringEventId: event.recurringEventId ?? undefined,
      status: (event.status as any) || 'confirmed',
      metadata: {
        etag: event.etag || '',
        calendarId,
        created: event.created || new Date().toISOString(),
        updated: event.updated || new Date().toISOString(),
      },
    };
  }

  /**
   * Handle Google Calendar API errors
   */
  private handleError<T>(error: any): { ok: false; error: any } {
    // Rate limit exceeded
    if (error.code === 429 || (error.code === 403 && error.message?.includes('rate'))) {
      const retryAfter = parseInt(error.response?.headers['retry-after'] || '60', 10);
      return {
        ok: false,
        error: {
          type: 'RATE_LIMIT',
          retryAfter,
          message: `Rate limit exceeded, retry after ${retryAfter}s`,
        },
      };
    }

    // Authentication error
    if (error.code === 401 || error.code === 403) {
      return {
        ok: false,
        error: {
          type: 'AUTH_ERROR',
          message: 'Authentication failed - token may be invalid or revoked',
        },
      };
    }

    // Network or other errors
    return {
      ok: false,
      error: {
        type: 'NETWORK_ERROR',
        message: error.message || 'Unknown error occurred',
      },
    };
  }
}
