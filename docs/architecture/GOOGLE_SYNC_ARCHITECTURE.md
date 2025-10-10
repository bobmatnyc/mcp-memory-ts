# Google Contacts & Calendar Sync Architecture

**Version**: 1.0.0
**Date**: 2025-10-09
**Author**: TypeScript Engineer

## Executive Summary

This document specifies the complete architecture for integrating Google Contacts and Google Calendar synchronization into the MCP Memory TypeScript project. The design reuses existing patterns from macOS Contacts sync, Gmail extraction, and week-based tracking while introducing new OAuth 2.0 token management and incremental sync capabilities.

## Table of Contents

1. [Core Design Principles](#1-core-design-principles)
2. [Google Contacts Sync Architecture](#2-google-contacts-sync-architecture)
3. [Google Calendar Weekly Tracking](#3-google-calendar-weekly-tracking)
4. [OAuth 2.0 Service Design](#4-oauth-20-service-design)
5. [Database Schema Updates](#5-database-schema-updates)
6. [Code Structure & Integration](#6-code-structure--integration)
7. [Error Handling Strategy](#7-error-handling-strategy)
8. [Testing Strategy](#8-testing-strategy)

---

## 1. Core Design Principles

### 1.1 Reuse Existing Patterns

**From macOS Contacts Sync:**
- LLM-based deduplication (`batchCheckDuplicates`, `matchContacts`)
- Conflict resolution with user preferences
- Bidirectional sync with dry-run mode
- UUID-based matching in metadata

**From Gmail Client:**
- OAuth 2.0 token management pattern
- Week identifier format: `YYYY-WW`
- Week calculation utilities (`getWeekDates`, `getWeekIdentifier`)

**From Database Operations:**
- User isolation with `user_id` foreign keys
- Metadata JSON storage for flexible data
- Transaction-based batch operations

### 1.2 Type-First Development

All services designed with:
- Strict TypeScript interfaces
- Result types for error handling
- Branded types for IDs (ContactId, EventId)
- Zod schemas for API response validation

### 1.3 Performance & Scalability

- Incremental sync using syncToken (Google Contacts) or timeMin/timeMax (Calendar)
- Batch operations (max 200 contacts per request)
- Async processing for embedding generation
- Connection pooling for database operations

---

## 2. Google Contacts Sync Architecture

### 2.1 TypeScript Interfaces

```typescript
// src/integrations/google-people-client.ts

import { google, people_v1 } from 'googleapis';
import type { OAuth2Client } from 'google-auth-library';

/** Branded type for Google Contact resource name */
type GoogleContactId = string & { readonly __brand: 'GoogleContactId' };

/** Google Person API field mask */
export const CONTACT_FIELD_MASK = [
  'names',
  'emailAddresses',
  'phoneNumbers',
  'addresses',
  'organizations',
  'biographies',
  'urls',
  'metadata',
].join(',');

/** Sync token for incremental sync */
interface SyncToken {
  token: string;
  expiresAt: Date; // syncToken expires after 7 days
}

/** Result type for sync operations */
type SyncResult<T> =
  | { ok: true; data: T; syncToken?: string }
  | { ok: false; error: SyncError };

/** Sync error types */
type SyncError =
  | { type: 'EXPIRED_SYNC_TOKEN'; message: string }
  | { type: 'RATE_LIMIT'; retryAfter: number; message: string }
  | { type: 'NETWORK_ERROR'; message: string }
  | { type: 'AUTH_ERROR'; message: string };

/** Google Contact data normalized to our schema */
export interface GoogleContact {
  id: GoogleContactId;
  resourceName: string;
  etag: string;
  names?: people_v1.Schema$Name[];
  emailAddresses?: people_v1.Schema$EmailAddress[];
  phoneNumbers?: people_v1.Schema$PhoneNumber[];
  addresses?: people_v1.Schema$Address[];
  organizations?: people_v1.Schema$Organization[];
  biographies?: people_v1.Schema$Biography[];
  urls?: people_v1.Schema$Url[];
  metadata?: people_v1.Schema$PersonMetadata;
}

/** Google People API Client */
export class GooglePeopleClient {
  private people: people_v1.People;

  constructor(private auth: OAuth2Client) {
    this.people = google.people({ version: 'v1', auth });
  }

  /**
   * List contacts with incremental sync support
   * Uses syncToken if available, falls back to full sync
   */
  async listContacts(
    syncToken?: string,
    pageSize = 200
  ): Promise<SyncResult<{
    contacts: GoogleContact[];
    nextSyncToken: string;
    nextPageToken?: string;
  }>> {
    try {
      const params: people_v1.Params$Resource$People$Connections$List = {
        resourceName: 'people/me',
        pageSize,
        personFields: CONTACT_FIELD_MASK,
        requestSyncToken: true,
      };

      // Use syncToken for incremental sync
      if (syncToken) {
        params.syncToken = syncToken;
      } else {
        // Full sync: sort by modification time
        params.sortOrder = 'LAST_MODIFIED_DESCENDING';
      }

      const response = await this.people.people.connections.list(params);

      return {
        ok: true,
        data: {
          contacts: (response.data.connections || []) as GoogleContact[],
          nextSyncToken: response.data.nextSyncToken || '',
          nextPageToken: response.data.nextPageToken,
        },
      };
    } catch (error: any) {
      return this.handleSyncError(error);
    }
  }

  /**
   * Get a single contact by resource name
   */
  async getContact(resourceName: string): Promise<SyncResult<GoogleContact>> {
    try {
      const response = await this.people.people.get({
        resourceName,
        personFields: CONTACT_FIELD_MASK,
      });

      return {
        ok: true,
        data: response.data as GoogleContact,
      };
    } catch (error: any) {
      return this.handleSyncError(error);
    }
  }

  /**
   * Create a new contact
   */
  async createContact(contact: Partial<GoogleContact>): Promise<SyncResult<GoogleContact>> {
    try {
      const response = await this.people.people.createContact({
        requestBody: contact,
      });

      return {
        ok: true,
        data: response.data as GoogleContact,
      };
    } catch (error: any) {
      return this.handleSyncError(error);
    }
  }

  /**
   * Update an existing contact
   */
  async updateContact(
    resourceName: string,
    contact: Partial<GoogleContact>,
    updateMask: string[]
  ): Promise<SyncResult<GoogleContact>> {
    try {
      const response = await this.people.people.updateContact({
        resourceName,
        updatePersonFields: updateMask.join(','),
        requestBody: contact,
      });

      return {
        ok: true,
        data: response.data as GoogleContact,
      };
    } catch (error: any) {
      return this.handleSyncError(error);
    }
  }

  /**
   * Delete a contact
   */
  async deleteContact(resourceName: string): Promise<SyncResult<void>> {
    try {
      await this.people.people.deleteContact({ resourceName });
      return { ok: true, data: undefined };
    } catch (error: any) {
      return this.handleSyncError(error);
    }
  }

  /**
   * Batch get contacts (max 200 per batch)
   */
  async batchGetContacts(resourceNames: string[]): Promise<SyncResult<GoogleContact[]>> {
    try {
      const response = await this.people.people.getBatchGet({
        resourceNames,
        personFields: CONTACT_FIELD_MASK,
      });

      const contacts = (response.data.responses || [])
        .filter(r => r.person && r.httpStatusCode === 200)
        .map(r => r.person as GoogleContact);

      return { ok: true, data: contacts };
    } catch (error: any) {
      return this.handleSyncError(error);
    }
  }

  /**
   * Handle sync errors with proper typing
   */
  private handleSyncError(error: any): { ok: false; error: SyncError } {
    if (error.code === 410 || error.message?.includes('Sync token expired')) {
      return {
        ok: false,
        error: {
          type: 'EXPIRED_SYNC_TOKEN',
          message: 'Sync token expired, full sync required',
        },
      };
    }

    if (error.code === 429 || error.code === 403) {
      const retryAfter = parseInt(error.response?.headers['retry-after'] || '60');
      return {
        ok: false,
        error: {
          type: 'RATE_LIMIT',
          retryAfter,
          message: `Rate limit exceeded, retry after ${retryAfter}s`,
        },
      };
    }

    if (error.code === 401 || error.code === 403) {
      return {
        ok: false,
        error: {
          type: 'AUTH_ERROR',
          message: 'Authentication failed, token refresh required',
        },
      };
    }

    return {
      ok: false,
      error: {
        type: 'NETWORK_ERROR',
        message: error.message || 'Unknown network error',
      },
    };
  }
}
```

### 2.2 Contact Sync Service

```typescript
// src/services/google-contacts-sync.ts

import { DatabaseOperations } from '../database/operations.js';
import { GooglePeopleClient } from '../integrations/google-people-client.js';
import { GoogleAuthService } from '../utils/google-auth.js';
import { batchCheckDuplicates, entityToContactInfo, type ContactPair } from '../utils/deduplication.js';
import { matchContacts, extractMcpUuid } from '../utils/contact-matching.js';
import type { Entity } from '../types/base.js';
import { EntityType, ImportanceLevel } from '../types/enums.js';

export interface GoogleContactsSyncOptions {
  userId: string;
  direction: 'export' | 'import' | 'both';
  dryRun?: boolean;
  autoMerge?: boolean;
  threshold?: number; // LLM deduplication threshold (0.8 default)
  noLlm?: boolean; // Skip LLM deduplication
  forceFull?: boolean; // Force full sync instead of incremental
}

export interface GoogleContactsSyncResult {
  success: boolean;
  exported: number;
  imported: number;
  updated: number;
  merged: number;
  failed: number;
  skipped: number;
  duplicatesFound: number;
  syncToken?: string; // New syncToken for next incremental sync
  errors: string[];
}

export class GoogleContactsSyncService {
  constructor(
    private db: DatabaseOperations,
    private googleAuth: GoogleAuthService
  ) {}

  /**
   * Main sync entry point
   */
  async sync(options: GoogleContactsSyncOptions): Promise<GoogleContactsSyncResult> {
    const result: GoogleContactsSyncResult = {
      success: true,
      exported: 0,
      imported: 0,
      updated: 0,
      merged: 0,
      failed: 0,
      skipped: 0,
      duplicatesFound: 0,
      errors: [],
    };

    try {
      // Get OAuth client for user
      const authClient = await this.googleAuth.getAuthClient(options.userId);
      if (!authClient) {
        throw new Error('Google authentication required. Please connect Google account.');
      }

      const peopleClient = new GooglePeopleClient(authClient);

      // Execute sync based on direction
      if (options.direction === 'import' || options.direction === 'both') {
        await this.importFromGoogle(peopleClient, options, result);
      }

      if (options.direction === 'export' || options.direction === 'both') {
        await this.exportToGoogle(peopleClient, options, result);
      }

      return result;
    } catch (error) {
      result.success = false;
      result.errors.push(error instanceof Error ? error.message : String(error));
      return result;
    }
  }

  /**
   * Import contacts from Google to MCP Memory (with incremental sync)
   */
  private async importFromGoogle(
    client: GooglePeopleClient,
    options: GoogleContactsSyncOptions,
    result: GoogleContactsSyncResult
  ): Promise<void> {
    // Get stored syncToken from user metadata
    const user = await this.db.getUserByEmail(options.userId);
    const metadata = user?.metadata || {};
    const storedSyncToken = metadata.googleContactsSyncToken as string | undefined;

    // Determine if we should use incremental sync
    const syncToken = options.forceFull ? undefined : storedSyncToken;

    console.log(syncToken ? '🔄 Incremental sync...' : '📥 Full sync...');

    let allContacts: any[] = [];
    let nextPageToken: string | undefined;
    let newSyncToken: string | undefined;

    // Paginated fetch with syncToken
    do {
      const syncResult = await client.listContacts(syncToken, 200);

      if (!syncResult.ok) {
        // Handle expired syncToken - fallback to full sync
        if (syncResult.error.type === 'EXPIRED_SYNC_TOKEN') {
          console.log('⚠️  Sync token expired, performing full sync...');
          return this.importFromGoogle(client, { ...options, forceFull: true }, result);
        }

        throw new Error(`Google API error: ${syncResult.error.message}`);
      }

      allContacts.push(...syncResult.data.contacts);
      nextPageToken = syncResult.data.nextPageToken;
      newSyncToken = syncResult.data.nextSyncToken;
    } while (nextPageToken);

    console.log(`📊 Fetched ${allContacts.length} contacts from Google`);

    // Map Google contacts to our Entity schema
    const googleEntities = allContacts.map(gc => this.googleContactToEntity(gc, options.userId));

    // Get existing entities from database
    const existingEntities = await this.db.getEntitiesByUserId(options.userId, 10000);

    // Use existing deduplication logic from contacts-sync
    if (!options.noLlm && googleEntities.length > 0) {
      const pairs: ContactPair[] = googleEntities.map(ge => ({
        contact1: entityToContactInfo(ge),
        contact2: entityToContactInfo(ge), // Placeholder, will compare with existing
      }));

      // Batch check duplicates using LLM
      const duplicates = await batchCheckDuplicates(pairs, options.threshold);
      result.duplicatesFound = duplicates.filter(d => d.isDuplicate).length;

      console.log(`🔍 Found ${result.duplicatesFound} potential duplicates`);
    }

    // Match contacts using UUID-based matching
    const matches = matchContacts(
      googleEntities,
      existingEntities,
      gc => this.extractGoogleContactId(gc),
      e => extractMcpUuid(e)
    );

    // Process matches and create/update entities
    for (const match of matches.matched) {
      if (options.dryRun) {
        console.log(`[DRY RUN] Would update: ${match.google.name}`);
        result.updated++;
      } else {
        await this.db.updateEntity(match.mcp.id!, match.google, options.userId);
        result.updated++;
      }
    }

    // Create new entities
    for (const newContact of matches.googleOnly) {
      if (options.dryRun) {
        console.log(`[DRY RUN] Would create: ${newContact.name}`);
        result.imported++;
      } else {
        await this.db.createEntity(newContact);
        result.imported++;
      }
    }

    // Store new syncToken for next incremental sync
    if (newSyncToken && !options.dryRun) {
      await this.db.updateUser(user!.id, {
        metadata: {
          ...metadata,
          googleContactsSyncToken: newSyncToken,
          googleContactsSyncAt: new Date().toISOString(),
        },
      });
      result.syncToken = newSyncToken;
    }
  }

  /**
   * Export contacts from MCP Memory to Google
   */
  private async exportToGoogle(
    client: GooglePeopleClient,
    options: GoogleContactsSyncOptions,
    result: GoogleContactsSyncResult
  ): Promise<void> {
    // Get entities that are PERSON type
    const entities = await this.db.getEntitiesByUserId(options.userId, 10000);
    const personEntities = entities.filter(e => e.entityType === EntityType.PERSON);

    console.log(`📤 Exporting ${personEntities.length} contacts to Google...`);

    // Get existing Google contacts for matching
    const googleResult = await client.listContacts(undefined, 1000);
    if (!googleResult.ok) {
      throw new Error(`Failed to fetch Google contacts: ${googleResult.error.message}`);
    }

    const googleContacts = googleResult.data.contacts;

    // Match entities with Google contacts
    const matches = matchContacts(
      personEntities,
      googleContacts.map(gc => this.googleContactToEntity(gc, options.userId)),
      e => extractMcpUuid(e),
      gc => this.extractGoogleContactId(gc)
    );

    // Update existing contacts
    for (const match of matches.matched) {
      const googleContact = this.entityToGoogleContact(match.mcp);
      const updateMask = ['names', 'emailAddresses', 'phoneNumbers', 'organizations'];

      if (options.dryRun) {
        console.log(`[DRY RUN] Would update Google contact: ${match.mcp.name}`);
        result.exported++;
      } else {
        const updateResult = await client.updateContact(
          match.google.metadata?.googleResourceName as string,
          googleContact,
          updateMask
        );

        if (updateResult.ok) {
          result.exported++;
        } else {
          result.failed++;
          result.errors.push(`Failed to update ${match.mcp.name}`);
        }
      }
    }

    // Create new contacts in Google
    for (const newEntity of matches.mcpOnly) {
      const googleContact = this.entityToGoogleContact(newEntity);

      if (options.dryRun) {
        console.log(`[DRY RUN] Would create Google contact: ${newEntity.name}`);
        result.exported++;
      } else {
        const createResult = await client.createContact(googleContact);

        if (createResult.ok) {
          // Store Google resource name in entity metadata
          await this.db.updateEntity(
            newEntity.id!,
            {
              metadata: {
                ...(newEntity.metadata || {}),
                googleResourceName: createResult.data.resourceName,
                googleEtag: createResult.data.etag,
              },
            },
            options.userId
          );
          result.exported++;
        } else {
          result.failed++;
          result.errors.push(`Failed to create ${newEntity.name}`);
        }
      }
    }
  }

  /**
   * Map Google Contact to Entity
   */
  private googleContactToEntity(contact: any, userId: string): Entity {
    const name = contact.names?.[0];
    const email = contact.emailAddresses?.[0]?.value;
    const phone = contact.phoneNumbers?.[0]?.value;
    const org = contact.organizations?.[0];

    return {
      userId,
      name: name?.displayName || 'Unknown',
      entityType: EntityType.PERSON,
      email,
      phone,
      company: org?.name,
      title: org?.title,
      notes: contact.biographies?.[0]?.value,
      importance: ImportanceLevel.MEDIUM,
      interactionCount: 0,
      isArchived: false,
      metadata: {
        googleResourceName: contact.resourceName,
        googleEtag: contact.etag,
      },
    } as Entity;
  }

  /**
   * Map Entity to Google Contact
   */
  private entityToGoogleContact(entity: Entity): any {
    const [firstName, ...lastNameParts] = (entity.name || '').split(' ');
    const lastName = lastNameParts.join(' ');

    return {
      names: [
        {
          givenName: firstName,
          familyName: lastName,
          displayName: entity.name,
        },
      ],
      emailAddresses: entity.email ? [{ value: entity.email }] : [],
      phoneNumbers: entity.phone ? [{ value: entity.phone }] : [],
      organizations: entity.company
        ? [{ name: entity.company, title: entity.title }]
        : [],
      biographies: entity.notes ? [{ value: entity.notes }] : [],
    };
  }

  /**
   * Extract Google Contact ID from entity metadata
   */
  private extractGoogleContactId(entity: Entity): string | null {
    return (entity.metadata?.googleResourceName as string) || null;
  }
}
```

---

## 3. Google Calendar Weekly Tracking

### 3.1 TypeScript Interfaces

```typescript
// src/integrations/google-calendar-client.ts

import { google, calendar_v3 } from 'googleapis';
import type { OAuth2Client } from 'google-auth-library';

/** Branded type for Calendar Event ID */
type CalendarEventId = string & { readonly __brand: 'CalendarEventId' };

/** Week identifier (YYYY-WW format) */
type WeekIdentifier = string & { readonly __brand: 'WeekIdentifier' };

/** Calendar event with expanded recurrence */
export interface CalendarEvent {
  id: CalendarEventId;
  summary: string;
  description?: string;
  start: Date;
  end: Date;
  location?: string;
  attendees: Attendee[];
  recurrence?: string[]; // RRULE array
  isRecurring: boolean;
  originalEventId?: string; // For recurring instances
  metadata: {
    etag: string;
    calendarId: string;
    iCalUID: string;
  };
}

/** Event attendee */
export interface Attendee {
  email: string;
  displayName?: string;
  responseStatus: 'accepted' | 'declined' | 'tentative' | 'needsAction';
  organizer?: boolean;
}

/** Google Calendar API Client */
export class GoogleCalendarClient {
  private calendar: calendar_v3.Calendar;

  constructor(private auth: OAuth2Client) {
    this.calendar = google.calendar({ version: 'v3', auth });
  }

  /**
   * Get events for a specific week (expands recurring events)
   */
  async getEventsForWeek(
    weekIdentifier: WeekIdentifier,
    calendarId = 'primary'
  ): Promise<{ ok: true; data: CalendarEvent[] } | { ok: false; error: string }> {
    try {
      const { start, end } = this.getWeekDates(weekIdentifier);

      const response = await this.calendar.events.list({
        calendarId,
        timeMin: start.toISOString(),
        timeMax: end.toISOString(),
        singleEvents: true, // Expand recurring events
        orderBy: 'startTime',
        maxResults: 2500, // Max allowed by API
      });

      const events = (response.data.items || []).map(item =>
        this.mapToCalendarEvent(item, calendarId)
      );

      return { ok: true, data: events };
    } catch (error: any) {
      return {
        ok: false,
        error: error.message || 'Failed to fetch calendar events',
      };
    }
  }

  /**
   * Get events across multiple weeks
   */
  async getEventsForWeeks(
    weekIdentifiers: WeekIdentifier[],
    calendarId = 'primary'
  ): Promise<Map<WeekIdentifier, CalendarEvent[]>> {
    const resultMap = new Map<WeekIdentifier, CalendarEvent[]>();

    for (const week of weekIdentifiers) {
      const result = await this.getEventsForWeek(week, calendarId);
      if (result.ok) {
        resultMap.set(week, result.data);
      }
    }

    return resultMap;
  }

  /**
   * Get current week's events
   */
  async getCurrentWeekEvents(
    calendarId = 'primary'
  ): Promise<{ ok: true; data: CalendarEvent[] } | { ok: false; error: string }> {
    const weekId = this.getCurrentWeekIdentifier() as WeekIdentifier;
    return this.getEventsForWeek(weekId, calendarId);
  }

  /**
   * Map Google Calendar event to our schema
   */
  private mapToCalendarEvent(
    event: calendar_v3.Schema$Event,
    calendarId: string
  ): CalendarEvent {
    return {
      id: event.id as CalendarEventId,
      summary: event.summary || '(No title)',
      description: event.description,
      start: new Date(event.start?.dateTime || event.start?.date || ''),
      end: new Date(event.end?.dateTime || event.end?.date || ''),
      location: event.location,
      attendees:
        event.attendees?.map(a => ({
          email: a.email || '',
          displayName: a.displayName,
          responseStatus: (a.responseStatus as any) || 'needsAction',
          organizer: a.organizer || false,
        })) || [],
      recurrence: event.recurrence,
      isRecurring: !!event.recurringEventId,
      originalEventId: event.recurringEventId,
      metadata: {
        etag: event.etag || '',
        calendarId,
        iCalUID: event.iCalUID || '',
      },
    };
  }

  /**
   * Get week dates from identifier (reuse from gmail-client)
   */
  private getWeekDates(weekIdentifier: string): { start: Date; end: Date } {
    const [yearStr, weekStr] = weekIdentifier.split('-');
    const year = parseInt(yearStr);
    const week = parseInt(weekStr);

    const jan1 = new Date(year, 0, 1);
    const dayOfWeek = jan1.getDay();
    const daysToMonday = dayOfWeek === 0 ? 1 : (8 - dayOfWeek) % 7;
    const firstMonday = new Date(year, 0, 1 + daysToMonday);

    const weekStart = new Date(firstMonday);
    weekStart.setDate(firstMonday.getDate() + (week - 1) * 7);
    weekStart.setHours(0, 0, 0, 0);

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    return { start: weekStart, end: weekEnd };
  }

  /**
   * Get current week identifier (reuse from gmail-client)
   */
  private getCurrentWeekIdentifier(): string {
    const date = new Date();
    const year = date.getFullYear();
    const jan1 = new Date(year, 0, 1);
    const dayOfYear = Math.floor((date.getTime() - jan1.getTime()) / (24 * 60 * 60 * 1000));
    const weekNumber = Math.ceil((dayOfYear + jan1.getDay() + 1) / 7);
    return `${year}-${String(weekNumber).padStart(2, '0')}`;
  }
}
```

### 3.2 Calendar Sync Service

```typescript
// src/services/google-calendar-sync.ts

import { DatabaseOperations } from '../database/operations.js';
import { GoogleCalendarClient, type CalendarEvent } from '../integrations/google-calendar-client.js';
import { GoogleAuthService } from '../utils/google-auth.js';
import { CalendarOperations } from '../database/calendar-operations.js';

export interface CalendarSyncOptions {
  userId: string;
  weekIdentifier?: string; // If not provided, use current week
  calendarId?: string; // Default: 'primary'
}

export interface CalendarSyncResult {
  success: boolean;
  weekIdentifier: string;
  eventsImported: number;
  entitiesLinked: number;
  errors: string[];
}

export class GoogleCalendarSyncService {
  constructor(
    private db: DatabaseOperations,
    private calendarDb: CalendarOperations,
    private googleAuth: GoogleAuthService
  ) {}

  /**
   * Sync calendar events for a specific week
   */
  async syncWeek(options: CalendarSyncOptions): Promise<CalendarSyncResult> {
    const weekId =
      options.weekIdentifier || this.getCurrentWeekIdentifier();

    const result: CalendarSyncResult = {
      success: true,
      weekIdentifier: weekId,
      eventsImported: 0,
      entitiesLinked: 0,
      errors: [],
    };

    try {
      // Get OAuth client
      const authClient = await this.googleAuth.getAuthClient(options.userId);
      if (!authClient) {
        throw new Error('Google Calendar authentication required');
      }

      const calendarClient = new GoogleCalendarClient(authClient);

      // Fetch events for week
      const eventsResult = await calendarClient.getEventsForWeek(
        weekId as any,
        options.calendarId
      );

      if (!eventsResult.ok) {
        throw new Error(eventsResult.error);
      }

      const events = eventsResult.data;
      console.log(`📅 Fetched ${events.length} events for week ${weekId}`);

      // Store events in database
      for (const event of events) {
        await this.calendarDb.createEvent({
          userId: options.userId,
          weekIdentifier: weekId,
          eventId: event.id,
          summary: event.summary,
          description: event.description,
          startTime: event.start.toISOString(),
          endTime: event.end.toISOString(),
          location: event.location,
          attendees: event.attendees,
          recurrence: event.recurrence,
          isRecurring: event.isRecurring,
          metadata: event.metadata,
        });

        result.eventsImported++;

        // Link attendees to existing entities
        const linkedCount = await this.linkAttendeesToEntities(
          options.userId,
          event
        );
        result.entitiesLinked += linkedCount;
      }

      return result;
    } catch (error) {
      result.success = false;
      result.errors.push(error instanceof Error ? error.message : String(error));
      return result;
    }
  }

  /**
   * Link event attendees to existing entities by email
   */
  private async linkAttendeesToEntities(
    userId: string,
    event: CalendarEvent
  ): Promise<number> {
    let linkedCount = 0;

    for (const attendee of event.attendees) {
      // Find entity by email
      const entities = await this.db.getEntitiesByUserId(userId, 1000);
      const matchingEntity = entities.find(e => e.email === attendee.email);

      if (matchingEntity) {
        // Update entity metadata with calendar event reference
        await this.db.updateEntity(
          matchingEntity.id!,
          {
            metadata: {
              ...(matchingEntity.metadata || {}),
              calendarEvents: [
                ...((matchingEntity.metadata?.calendarEvents as string[]) || []),
                event.id,
              ],
            },
            lastInteraction: event.start.toISOString(),
            interactionCount: matchingEntity.interactionCount + 1,
          },
          userId
        );

        linkedCount++;
      }
    }

    return linkedCount;
  }

  /**
   * Get current week identifier
   */
  private getCurrentWeekIdentifier(): string {
    const date = new Date();
    const year = date.getFullYear();
    const jan1 = new Date(year, 0, 1);
    const dayOfYear = Math.floor((date.getTime() - jan1.getTime()) / (24 * 60 * 60 * 1000));
    const weekNumber = Math.ceil((dayOfYear + jan1.getDay() + 1) / 7);
    return `${year}-${String(weekNumber).padStart(2, '0')}`;
  }
}
```

---

## 4. OAuth 2.0 Service Design

### 4.1 OAuth Service Interface

```typescript
// src/utils/google-auth.ts

import { google, Auth } from 'googleapis';
import type { OAuth2Client } from 'google-auth-library';
import { DatabaseOperations } from '../database/operations.js';

/** OAuth token data stored in user metadata */
export interface GoogleOAuthTokens {
  access_token: string;
  refresh_token: string;
  scope: string;
  token_type: string;
  expiry_date: number;
}

/** OAuth scopes */
export const GOOGLE_SCOPES = {
  CONTACTS_READONLY: 'https://www.googleapis.com/auth/contacts.readonly',
  CONTACTS: 'https://www.googleapis.com/auth/contacts',
  CALENDAR_READONLY: 'https://www.googleapis.com/auth/calendar.readonly',
  CALENDAR: 'https://www.googleapis.com/auth/calendar',
  GMAIL_READONLY: 'https://www.googleapis.com/auth/gmail.readonly',
} as const;

/** Google OAuth Service */
export class GoogleAuthService {
  private oauth2Client: OAuth2Client;

  constructor(
    private db: DatabaseOperations,
    private clientId: string,
    private clientSecret: string,
    private redirectUri: string
  ) {
    this.oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      redirectUri
    );
  }

  /**
   * Generate OAuth authorization URL
   */
  generateAuthUrl(scopes: string[], state?: string): string {
    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline', // Get refresh token
      scope: scopes,
      state, // Can include userId for callback
      prompt: 'consent', // Force consent to get refresh token
    });
  }

  /**
   * Exchange authorization code for tokens
   */
  async getTokensFromCode(code: string): Promise<GoogleOAuthTokens> {
    const { tokens } = await this.oauth2Client.getToken(code);
    return tokens as GoogleOAuthTokens;
  }

  /**
   * Store tokens in user metadata
   */
  async storeTokens(userId: string, tokens: GoogleOAuthTokens): Promise<void> {
    const user = await this.db.getUserByEmail(userId);
    if (!user) {
      throw new Error(`User not found: ${userId}`);
    }

    await this.db.updateUser(user.id, {
      metadata: {
        ...(user.metadata || {}),
        googleOAuthTokens: tokens,
        googleOAuthConnectedAt: new Date().toISOString(),
      },
    });
  }

  /**
   * Get authenticated OAuth client for user
   * Automatically refreshes token if expired
   */
  async getAuthClient(userId: string): Promise<OAuth2Client | null> {
    const user = await this.db.getUserByEmail(userId);
    if (!user?.metadata?.googleOAuthTokens) {
      return null;
    }

    const tokens = user.metadata.googleOAuthTokens as GoogleOAuthTokens;

    // Create new client with stored tokens
    const client = new google.auth.OAuth2(
      this.clientId,
      this.clientSecret,
      this.redirectUri
    );

    client.setCredentials(tokens);

    // Auto-refresh on 401/403
    client.on('tokens', async (newTokens) => {
      console.log('🔄 OAuth tokens refreshed');
      const updatedTokens = { ...tokens, ...newTokens };
      await this.storeTokens(userId, updatedTokens);
    });

    return client;
  }

  /**
   * Revoke OAuth access
   */
  async revokeAccess(userId: string): Promise<void> {
    const client = await this.getAuthClient(userId);
    if (client) {
      await client.revokeCredentials();
    }

    // Clear tokens from database
    const user = await this.db.getUserByEmail(userId);
    if (user) {
      await this.db.updateUser(user.id, {
        metadata: {
          ...(user.metadata || {}),
          googleOAuthTokens: undefined,
          googleOAuthConnectedAt: undefined,
        },
      });
    }
  }

  /**
   * Check if user has specific scope
   */
  async hasScope(userId: string, scope: string): Promise<boolean> {
    const user = await this.db.getUserByEmail(userId);
    const tokens = user?.metadata?.googleOAuthTokens as GoogleOAuthTokens | undefined;

    if (!tokens) return false;

    const grantedScopes = tokens.scope.split(' ');
    return grantedScopes.includes(scope);
  }
}
```

### 4.2 OAuth Web Interface Integration

```typescript
// web/app/api/auth/google/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs';
import { GoogleAuthService } from '@/lib/google-auth';
import { GOOGLE_SCOPES } from '@/lib/google-auth';

/** Initiate Google OAuth flow */
export async function GET(request: NextRequest) {
  const { userId } = auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const scopes = [
    GOOGLE_SCOPES.CONTACTS,
    GOOGLE_SCOPES.CALENDAR_READONLY,
    GOOGLE_SCOPES.GMAIL_READONLY,
  ];

  const googleAuth = new GoogleAuthService(
    process.env.GOOGLE_CLIENT_ID!,
    process.env.GOOGLE_CLIENT_SECRET!,
    `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/google/callback`
  );

  const authUrl = googleAuth.generateAuthUrl(scopes, userId);

  return NextResponse.redirect(authUrl);
}

// web/app/api/auth/google/callback/route.ts

/** Handle OAuth callback */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state'); // Contains userId

  if (!code || !state) {
    return NextResponse.json({ error: 'Invalid callback' }, { status: 400 });
  }

  try {
    const googleAuth = new GoogleAuthService(
      process.env.GOOGLE_CLIENT_ID!,
      process.env.GOOGLE_CLIENT_SECRET!,
      `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/google/callback`
    );

    const tokens = await googleAuth.getTokensFromCode(code);
    await googleAuth.storeTokens(state, tokens);

    return NextResponse.redirect('/dashboard?google_connected=true');
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to authenticate' },
      { status: 500 }
    );
  }
}
```

---

## 5. Database Schema Updates

### 5.1 Calendar Events Table

```sql
-- Create calendar_events table
CREATE TABLE IF NOT EXISTS calendar_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  week_identifier TEXT NOT NULL, -- YYYY-WW format
  event_id TEXT NOT NULL, -- Google Calendar event ID
  summary TEXT NOT NULL,
  description TEXT,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  location TEXT,
  attendees TEXT, -- JSON array of attendees
  recurrence TEXT, -- JSON array of RRULE strings
  is_recurring BOOLEAN DEFAULT 0,
  metadata TEXT, -- JSON: etag, calendarId, iCalUID
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(user_id, event_id, week_identifier)
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_calendar_events_user_week
  ON calendar_events(user_id, week_identifier);

CREATE INDEX IF NOT EXISTS idx_calendar_events_user_time
  ON calendar_events(user_id, start_time DESC);

CREATE INDEX IF NOT EXISTS idx_calendar_events_event_id
  ON calendar_events(event_id);
```

### 5.2 User Metadata Extensions

```typescript
// Extend User metadata type
interface UserMetadata {
  // Existing fields
  googleOAuthTokens?: GoogleOAuthTokens;
  googleOAuthConnectedAt?: string;

  // Google Contacts sync
  googleContactsSyncToken?: string;
  googleContactsSyncAt?: string;

  // Sync preferences
  googleSyncPreferences?: {
    autoSync: boolean;
    syncInterval: number; // minutes
    conflictResolution: 'google' | 'mcp' | 'manual';
  };
}
```

### 5.3 Entity Metadata Extensions

```typescript
// Extend Entity metadata type
interface EntityMetadata {
  // Existing fields

  // Google Contacts integration
  googleResourceName?: string; // people/c12345
  googleEtag?: string;
  googleSyncedAt?: string;

  // Google Calendar integration
  calendarEvents?: string[]; // Array of event IDs
}
```

### 5.4 Migration Script

```typescript
// scripts/migrate-google-sync.ts

import { DatabaseConnection } from '../src/database/connection.js';

export async function migrateGoogleSync(db: DatabaseConnection): Promise<void> {
  console.log('🔄 Migrating database for Google Sync...');

  // Create calendar_events table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS calendar_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      week_identifier TEXT NOT NULL,
      event_id TEXT NOT NULL,
      summary TEXT NOT NULL,
      description TEXT,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      location TEXT,
      attendees TEXT,
      recurrence TEXT,
      is_recurring BOOLEAN DEFAULT 0,
      metadata TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(user_id, event_id, week_identifier)
    )
  `);

  // Create indexes
  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_calendar_events_user_week
    ON calendar_events(user_id, week_identifier)
  `);

  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_calendar_events_user_time
    ON calendar_events(user_id, start_time DESC)
  `);

  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_calendar_events_event_id
    ON calendar_events(event_id)
  `);

  console.log('✅ Google Sync migration complete');
}
```

---

## 6. Code Structure & Integration

### 6.1 File Structure

```
src/
├── integrations/
│   ├── google-people-client.ts      # People API wrapper
│   ├── google-calendar-client.ts    # Calendar API wrapper
│   └── gmail-client.ts               # Existing Gmail client
│
├── services/
│   ├── google-contacts-sync.ts      # Contacts sync service
│   ├── google-calendar-sync.ts      # Calendar sync service
│   └── gmail-extraction-service.ts  # Existing Gmail service
│
├── utils/
│   ├── google-auth.ts               # OAuth helper (NEW)
│   ├── week-calculator.ts           # Week utils (extract from gmail-client)
│   ├── contact-matching.ts          # Existing matching logic
│   └── deduplication.ts             # Existing LLM deduplication
│
├── database/
│   ├── operations.ts                # Existing DB ops
│   ├── calendar-operations.ts       # Calendar DB ops (NEW)
│   └── schema.ts                    # Schema definitions
│
├── cli/commands/
│   ├── google-contacts-sync.ts      # CLI for Google Contacts
│   ├── google-calendar-sync.ts      # CLI for Google Calendar
│   └── contacts-sync.ts             # Existing macOS sync
│
web/app/api/
├── auth/
│   └── google/
│       ├── route.ts                 # OAuth initiation
│       └── callback/
│           └── route.ts             # OAuth callback
│
└── google-sync/
    ├── contacts/route.ts            # Contacts sync API
    └── calendar/route.ts            # Calendar sync API
```

### 6.2 Calendar Database Operations

```typescript
// src/database/calendar-operations.ts

import type { DatabaseConnection } from './connection.js';

export interface CalendarEventData {
  userId: string;
  weekIdentifier: string;
  eventId: string;
  summary: string;
  description?: string;
  startTime: string;
  endTime: string;
  location?: string;
  attendees: any[];
  recurrence?: string[];
  isRecurring: boolean;
  metadata: any;
}

export class CalendarOperations {
  constructor(private db: DatabaseConnection) {}

  /**
   * Create calendar event
   */
  async createEvent(event: CalendarEventData): Promise<void> {
    const sql = `
      INSERT OR REPLACE INTO calendar_events
      (user_id, week_identifier, event_id, summary, description,
       start_time, end_time, location, attendees, recurrence,
       is_recurring, metadata, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      JSON.stringify(event.metadata),
      new Date().toISOString(),
      new Date().toISOString(),
    ]);
  }

  /**
   * Get events for a specific week
   */
  async getEventsForWeek(
    userId: string,
    weekIdentifier: string
  ): Promise<CalendarEventData[]> {
    const result = await this.db.execute(
      `SELECT * FROM calendar_events
       WHERE user_id = ? AND week_identifier = ?
       ORDER BY start_time ASC`,
      [userId, weekIdentifier]
    );

    return result.rows.map(row => this.mapRowToEvent(row as any));
  }

  /**
   * Get events for multiple weeks
   */
  async getEventsForWeeks(
    userId: string,
    weekIdentifiers: string[]
  ): Promise<Map<string, CalendarEventData[]>> {
    const resultMap = new Map<string, CalendarEventData[]>();

    for (const week of weekIdentifiers) {
      const events = await this.getEventsForWeek(userId, week);
      resultMap.set(week, events);
    }

    return resultMap;
  }

  /**
   * Map database row to CalendarEventData
   */
  private mapRowToEvent(row: any): CalendarEventData {
    return {
      userId: row.user_id,
      weekIdentifier: row.week_identifier,
      eventId: row.event_id,
      summary: row.summary,
      description: row.description,
      startTime: row.start_time,
      endTime: row.end_time,
      location: row.location,
      attendees: JSON.parse(row.attendees || '[]'),
      recurrence: row.recurrence ? JSON.parse(row.recurrence) : undefined,
      isRecurring: !!row.is_recurring,
      metadata: JSON.parse(row.metadata || '{}'),
    };
  }
}
```

### 6.3 Week Calculator Utility (Extract from gmail-client)

```typescript
// src/utils/week-calculator.ts

/** Week identifier type (YYYY-WW) */
export type WeekIdentifier = string & { readonly __brand: 'WeekIdentifier' };

/**
 * Get week dates from identifier
 */
export function getWeekDates(weekIdentifier: string): { start: Date; end: Date } {
  const [yearStr, weekStr] = weekIdentifier.split('-');
  const year = parseInt(yearStr);
  const week = parseInt(weekStr);

  const jan1 = new Date(year, 0, 1);
  const dayOfWeek = jan1.getDay();
  const daysToMonday = dayOfWeek === 0 ? 1 : (8 - dayOfWeek) % 7;
  const firstMonday = new Date(year, 0, 1 + daysToMonday);

  const weekStart = new Date(firstMonday);
  weekStart.setDate(firstMonday.getDate() + (week - 1) * 7);
  weekStart.setHours(0, 0, 0, 0);

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  return { start: weekStart, end: weekEnd };
}

/**
 * Get week identifier for a date
 */
export function getWeekIdentifier(date: Date): WeekIdentifier {
  const year = date.getFullYear();
  const jan1 = new Date(year, 0, 1);
  const dayOfYear = Math.floor((date.getTime() - jan1.getTime()) / (24 * 60 * 60 * 1000));
  const weekNumber = Math.ceil((dayOfYear + jan1.getDay() + 1) / 7);
  return `${year}-${String(weekNumber).padStart(2, '0')}` as WeekIdentifier;
}

/**
 * Get current week identifier
 */
export function getCurrentWeekIdentifier(): WeekIdentifier {
  return getWeekIdentifier(new Date());
}

/**
 * Get week identifiers for a date range
 */
export function getWeekIdentifiersInRange(start: Date, end: Date): WeekIdentifier[] {
  const weeks: WeekIdentifier[] = [];
  const current = new Date(start);

  while (current <= end) {
    weeks.push(getWeekIdentifier(current));
    current.setDate(current.getDate() + 7);
  }

  return [...new Set(weeks)]; // Deduplicate
}
```

### 6.4 CLI Commands

```typescript
// src/cli/commands/google-contacts-sync.ts

import { GoogleContactsSyncService } from '../../services/google-contacts-sync.js';
import { GoogleAuthService } from '../../utils/google-auth.js';
import { DatabaseConnection } from '../../database/connection.js';
import { DatabaseOperations } from '../../database/operations.js';
import { colors, icons } from '../colors.js';

export async function googleContactsSyncCommand(options: any): Promise<void> {
  console.log(`${icons.cloud} Google Contacts Sync\n`);

  const db = await DatabaseConnection.getInstance();
  const dbOps = new DatabaseOperations(db);

  const googleAuth = new GoogleAuthService(
    dbOps,
    process.env.GOOGLE_CLIENT_ID!,
    process.env.GOOGLE_CLIENT_SECRET!,
    process.env.GOOGLE_REDIRECT_URI!
  );

  const syncService = new GoogleContactsSyncService(dbOps, googleAuth);

  const result = await syncService.sync({
    userId: options.userId,
    direction: options.direction || 'both',
    dryRun: options.dryRun || false,
    autoMerge: options.autoMerge || false,
    threshold: options.threshold || 0.8,
    noLlm: options.noLlm || false,
    forceFull: options.forceFull || false,
  });

  console.log(`\n${icons.success} Sync Complete:`);
  console.log(`  Exported: ${result.exported}`);
  console.log(`  Imported: ${result.imported}`);
  console.log(`  Updated: ${result.updated}`);
  console.log(`  Duplicates: ${result.duplicatesFound}`);

  if (result.errors.length > 0) {
    console.log(`\n${icons.error} Errors:`);
    result.errors.forEach(err => console.log(`  - ${err}`));
  }
}

// src/cli/commands/google-calendar-sync.ts

import { GoogleCalendarSyncService } from '../../services/google-calendar-sync.js';
import { GoogleAuthService } from '../../utils/google-auth.js';
import { CalendarOperations } from '../../database/calendar-operations.js';
import { DatabaseConnection } from '../../database/connection.js';
import { DatabaseOperations } from '../../database/operations.js';
import { colors, icons } from '../colors.js';

export async function googleCalendarSyncCommand(options: any): Promise<void> {
  console.log(`${icons.calendar} Google Calendar Sync\n`);

  const db = await DatabaseConnection.getInstance();
  const dbOps = new DatabaseOperations(db);
  const calendarOps = new CalendarOperations(db);

  const googleAuth = new GoogleAuthService(
    dbOps,
    process.env.GOOGLE_CLIENT_ID!,
    process.env.GOOGLE_CLIENT_SECRET!,
    process.env.GOOGLE_REDIRECT_URI!
  );

  const syncService = new GoogleCalendarSyncService(dbOps, calendarOps, googleAuth);

  const result = await syncService.syncWeek({
    userId: options.userId,
    weekIdentifier: options.week,
    calendarId: options.calendarId || 'primary',
  });

  console.log(`\n${icons.success} Week ${result.weekIdentifier} Sync Complete:`);
  console.log(`  Events Imported: ${result.eventsImported}`);
  console.log(`  Entities Linked: ${result.entitiesLinked}`);

  if (result.errors.length > 0) {
    console.log(`\n${icons.error} Errors:`);
    result.errors.forEach(err => console.log(`  - ${err}`));
  }
}
```

---

## 7. Error Handling Strategy

### 7.1 Sync Error Types

```typescript
// src/types/sync-errors.ts

/** Base sync error */
export interface SyncError {
  type: SyncErrorType;
  message: string;
  recoverable: boolean;
  retryAfter?: number;
}

/** Sync error types */
export enum SyncErrorType {
  // Google API errors
  EXPIRED_SYNC_TOKEN = 'EXPIRED_SYNC_TOKEN',
  RATE_LIMIT = 'RATE_LIMIT',
  AUTH_ERROR = 'AUTH_ERROR',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',

  // Network errors
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT = 'TIMEOUT',

  // Data errors
  INVALID_DATA = 'INVALID_DATA',
  DUPLICATE_CONFLICT = 'DUPLICATE_CONFLICT',

  // Database errors
  DB_ERROR = 'DB_ERROR',
}

/** Error recovery strategy */
export interface ErrorRecoveryStrategy {
  shouldRetry: boolean;
  retryDelay: number;
  fallbackAction?: 'full_sync' | 'skip' | 'manual';
}

/** Get recovery strategy for error */
export function getRecoveryStrategy(error: SyncError): ErrorRecoveryStrategy {
  switch (error.type) {
    case SyncErrorType.EXPIRED_SYNC_TOKEN:
      return { shouldRetry: true, retryDelay: 0, fallbackAction: 'full_sync' };

    case SyncErrorType.RATE_LIMIT:
      return {
        shouldRetry: true,
        retryDelay: error.retryAfter || 60000,
        fallbackAction: 'skip'
      };

    case SyncErrorType.AUTH_ERROR:
      return { shouldRetry: false, retryDelay: 0, fallbackAction: 'manual' };

    case SyncErrorType.NETWORK_ERROR:
      return { shouldRetry: true, retryDelay: 5000 };

    default:
      return { shouldRetry: false, retryDelay: 0 };
  }
}
```

### 7.2 Retry Logic

```typescript
// src/utils/retry-with-backoff.ts

/** Retry with exponential backoff */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    initialDelay?: number;
    maxDelay?: number;
    shouldRetry?: (error: any) => boolean;
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 30000,
    shouldRetry = () => true,
  } = options;

  let lastError: any;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt === maxRetries || !shouldRetry(error)) {
        throw error;
      }

      const delay = Math.min(initialDelay * Math.pow(2, attempt), maxDelay);
      console.log(`⏳ Retry ${attempt + 1}/${maxRetries} after ${delay}ms...`);

      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}
```

---

## 8. Testing Strategy

### 8.1 Unit Tests

```typescript
// tests/unit/google-people-client.test.ts

import { describe, it, expect, vi } from 'vitest';
import { GooglePeopleClient } from '../../src/integrations/google-people-client';

describe('GooglePeopleClient', () => {
  it('should handle expired sync token', async () => {
    const mockAuth = {} as any;
    const client = new GooglePeopleClient(mockAuth);

    // Mock API to return 410 error
    vi.spyOn(client['people'].people.connections, 'list').mockRejectedValue({
      code: 410,
      message: 'Sync token expired',
    });

    const result = await client.listContacts('expired-token');

    expect(result.ok).toBe(false);
    expect(result.error?.type).toBe('EXPIRED_SYNC_TOKEN');
  });

  it('should handle rate limiting', async () => {
    const mockAuth = {} as any;
    const client = new GooglePeopleClient(mockAuth);

    vi.spyOn(client['people'].people.connections, 'list').mockRejectedValue({
      code: 429,
      response: { headers: { 'retry-after': '120' } },
    });

    const result = await client.listContacts();

    expect(result.ok).toBe(false);
    expect(result.error?.type).toBe('RATE_LIMIT');
    expect(result.error?.retryAfter).toBe(120);
  });
});

// tests/unit/google-calendar-client.test.ts

import { describe, it, expect } from 'vitest';
import { GoogleCalendarClient } from '../../src/integrations/google-calendar-client';

describe('GoogleCalendarClient', () => {
  it('should expand recurring events', async () => {
    const mockAuth = {} as any;
    const client = new GoogleCalendarClient(mockAuth);

    // Test week identifier conversion
    const { start, end } = client['getWeekDates']('2025-41');

    expect(start.getFullYear()).toBe(2025);
    expect(end.getTime()).toBeGreaterThan(start.getTime());
  });
});
```

### 8.2 Integration Tests

```typescript
// tests/integration/google-contacts-sync.test.ts

import { describe, it, expect, beforeAll } from 'vitest';
import { GoogleContactsSyncService } from '../../src/services/google-contacts-sync';
import { DatabaseConnection } from '../../src/database/connection';

describe('Google Contacts Sync Integration', () => {
  let db: DatabaseConnection;

  beforeAll(async () => {
    db = await DatabaseConnection.getInstance();
  });

  it('should sync contacts bidirectionally', async () => {
    // Test full bidirectional sync
    const syncService = new GoogleContactsSyncService(db as any, {} as any);

    const result = await syncService.sync({
      userId: 'test@example.com',
      direction: 'both',
      dryRun: true,
    });

    expect(result.success).toBe(true);
    expect(result.exported).toBeGreaterThanOrEqual(0);
    expect(result.imported).toBeGreaterThanOrEqual(0);
  });
});
```

### 8.3 E2E Tests

```typescript
// tests/e2e/google-oauth-flow.test.ts

import { describe, it, expect } from 'vitest';
import { GoogleAuthService } from '../../src/utils/google-auth';

describe('Google OAuth Flow', () => {
  it('should generate valid auth URL', () => {
    const service = new GoogleAuthService(
      {} as any,
      'test-client-id',
      'test-secret',
      'http://localhost:3000/callback'
    );

    const authUrl = service.generateAuthUrl([
      'https://www.googleapis.com/auth/contacts',
    ]);

    expect(authUrl).toContain('accounts.google.com');
    expect(authUrl).toContain('test-client-id');
    expect(authUrl).toContain('access_type=offline');
  });
});
```

### 8.4 Performance Tests

```typescript
// tests/performance/batch-sync.test.ts

import { describe, it, expect } from 'vitest';
import { GoogleContactsSyncService } from '../../src/services/google-contacts-sync';

describe('Batch Sync Performance', () => {
  it('should handle 1000 contacts in under 30s', async () => {
    const startTime = Date.now();

    // Simulate syncing 1000 contacts
    const syncService = new GoogleContactsSyncService({} as any, {} as any);

    // Mock batch operation
    const batchSize = 200;
    const totalContacts = 1000;

    for (let i = 0; i < totalContacts; i += batchSize) {
      // Simulate batch sync
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    const elapsed = Date.now() - startTime;
    expect(elapsed).toBeLessThan(30000);
  }, 35000);
});
```

---

## Summary & Next Steps

### Architecture Highlights

✅ **Reuses Existing Patterns**: LLM deduplication, week tracking, OAuth from Gmail
✅ **Type-Safe Design**: Branded types, Result types, strict interfaces
✅ **Incremental Sync**: syncToken for Contacts, timeMin/timeMax for Calendar
✅ **Scalable**: Batch operations, async processing, connection pooling
✅ **Error Resilient**: Comprehensive error handling with retry logic

### Implementation Phases

**Phase 1: OAuth Infrastructure** (Week 1)
- Implement GoogleAuthService
- Add web interface OAuth routes
- Test token storage and refresh

**Phase 2: Google Contacts Sync** (Week 2-3)
- Build GooglePeopleClient
- Implement GoogleContactsSyncService
- Add CLI commands and dry-run mode
- Integrate LLM deduplication

**Phase 3: Google Calendar Tracking** (Week 4)
- Build GoogleCalendarClient
- Implement GoogleCalendarSyncService
- Create calendar_events table
- Link attendees to entities

**Phase 4: Testing & Refinement** (Week 5)
- Unit, integration, and E2E tests
- Performance optimization
- Documentation and examples

### Environment Variables Needed

```bash
# .env additions
GOOGLE_CLIENT_ID=your-google-oauth-client-id
GOOGLE_CLIENT_SECRET=your-google-oauth-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Files to Create (36 files)

**Core Services (7 files)**:
- `src/integrations/google-people-client.ts`
- `src/integrations/google-calendar-client.ts`
- `src/services/google-contacts-sync.ts`
- `src/services/google-calendar-sync.ts`
- `src/utils/google-auth.ts`
- `src/utils/week-calculator.ts`
- `src/database/calendar-operations.ts`

**CLI Commands (2 files)**:
- `src/cli/commands/google-contacts-sync.ts`
- `src/cli/commands/google-calendar-sync.ts`

**Web API Routes (4 files)**:
- `web/app/api/auth/google/route.ts`
- `web/app/api/auth/google/callback/route.ts`
- `web/app/api/google-sync/contacts/route.ts`
- `web/app/api/google-sync/calendar/route.ts`

**Type Definitions (2 files)**:
- `src/types/sync-errors.ts`
- `src/types/calendar-types.ts`

**Tests (12 files)**:
- Unit tests (6)
- Integration tests (4)
- E2E tests (2)

**Scripts & Migrations (3 files)**:
- `scripts/migrate-google-sync.ts`
- `scripts/verify-google-sync.ts`
- `scripts/test-google-sync.ts`

**Documentation (6 files)**:
- `docs/features/GOOGLE_CONTACTS_SYNC.md`
- `docs/features/GOOGLE_CALENDAR_TRACKING.md`
- `docs/guides/GOOGLE_OAUTH_SETUP.md`
- `docs/guides/GOOGLE_SYNC_QUICKSTART.md`
- `docs/api/GOOGLE_SYNC_API.md`
- `docs/architecture/GOOGLE_SYNC_ARCHITECTURE.md` (this file)

---

**Total LOC Estimate**: ~2,500 lines (with aggressive code reuse)

**Dependencies to Add**:
```json
{
  "googleapis": "^144.0.0" // Already installed ✅
}
```

This architecture leverages 70% existing code patterns while introducing Google-specific sync capabilities. The design prioritizes type safety, error resilience, and incremental sync performance.
