# Google API Reference

**Version**: 1.7.0
**Base URL**: `http://localhost:3000/api/google` (development)
**Authentication**: Clerk session required
**Last Updated**: 2025-10-09

## Table of Contents

- [Overview](#overview)
- [Authentication](#authentication)
- [Endpoints](#endpoints)
  - [Connection Status](#connection-status)
  - [Disconnect](#disconnect)
  - [Contacts Sync](#contacts-sync)
  - [Calendar Sync](#calendar-sync)
  - [Calendar Events](#calendar-events)
- [Data Models](#data-models)
- [Error Handling](#error-handling)
- [Rate Limiting](#rate-limiting)
- [Examples](#examples)

## Overview

The Google API provides programmatic access to Google Contacts and Calendar sync features. All endpoints are RESTful and return JSON responses.

### API Characteristics

- **Protocol**: HTTPS (production), HTTP (development)
- **Data Format**: JSON request/response bodies
- **Authentication**: Clerk session cookies or Bearer tokens
- **Rate Limits**: 100 requests/minute per user
- **Versioning**: URL-based (v1, v2, etc.) - currently unversioned

### Base URLs

| Environment | URL |
|-------------|-----|
| Development | `http://localhost:3000/api/google` |
| Production | `https://yourdomain.com/api/google` |

## Authentication

All API requests require authentication via Clerk session.

### Session-based Authentication (Web)

Clerk automatically manages sessions via cookies:

```javascript
// No explicit authentication needed in browser
fetch('/api/google/status', {
  credentials: 'include'  // Include session cookie
})
```

### Token-based Authentication (API)

For server-to-server or mobile apps, use Bearer tokens:

```bash
curl https://yourdomain.com/api/google/status \
  -H "Authorization: Bearer <clerk_session_token>"
```

**Get Clerk session token**:
```javascript
import { useAuth } from '@clerk/nextjs';

const { getToken } = useAuth();
const token = await getToken();
```

### Unauthorized Response

```json
{
  "error": "Unauthorized",
  "message": "Authentication required",
  "statusCode": 401
}
```

## Endpoints

### Connection Status

Get Google account connection status for the authenticated user.

#### Request

```
GET /api/google/status
```

**Headers**:
```
Content-Type: application/json
```

**Query Parameters**: None

#### Response

**Success (200)**:
```json
{
  "connected": true,
  "email": "bob@example.com",
  "scopes": [
    "https://www.googleapis.com/auth/contacts",
    "https://www.googleapis.com/auth/calendar.readonly"
  ],
  "tokenValid": true,
  "expiresAt": "2025-10-16T14:30:00Z",
  "lastSyncAt": "2025-10-09T10:15:00Z",
  "syncStats": {
    "contactsSynced": 150,
    "eventsSynced": 42,
    "lastContactSync": "2025-10-09T09:00:00Z",
    "lastCalendarSync": "2025-10-09T10:15:00Z"
  }
}
```

**Not Connected (200)**:
```json
{
  "connected": false,
  "connectUrl": "/api/auth/google/connect"
}
```

#### Example

```javascript
const response = await fetch('/api/google/status');
const status = await response.json();

if (status.connected) {
  console.log(`Connected as ${status.email}`);
} else {
  window.location.href = status.connectUrl;
}
```

---

### Disconnect

Disconnect Google account and revoke access.

#### Request

```
POST /api/google/disconnect
```

**Headers**:
```
Content-Type: application/json
```

**Body**: None

#### Response

**Success (200)**:
```json
{
  "success": true,
  "message": "Google account disconnected successfully"
}
```

**Error (500)**:
```json
{
  "error": "DisconnectFailed",
  "message": "Failed to revoke Google OAuth token",
  "details": "Token revocation failed"
}
```

#### Example

```javascript
const response = await fetch('/api/google/disconnect', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' }
});

const result = await response.json();
if (result.success) {
  console.log('Disconnected from Google');
}
```

---

### Contacts Sync

Synchronize contacts between Google and MCP Memory.

#### Request

```
POST /api/google/contacts/sync
```

**Headers**:
```
Content-Type: application/json
```

**Body**:
```json
{
  "direction": "both",
  "dryRun": false,
  "autoMerge": true,
  "threshold": 90,
  "useLLM": true
}
```

**Body Parameters**:

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `direction` | string | No | `"both"` | Sync direction: `import`, `export`, or `both` |
| `dryRun` | boolean | No | `false` | Preview changes without applying |
| `autoMerge` | boolean | No | `false` | Automatically merge duplicates |
| `threshold` | number | No | `90` | Confidence threshold (0-100) |
| `useLLM` | boolean | No | `true` | Use LLM for deduplication |

#### Response

**Success (200)**:
```json
{
  "success": true,
  "syncType": "incremental",
  "results": {
    "imported": 12,
    "exported": 8,
    "updated": 5,
    "merged": 3,
    "skipped": 2,
    "errors": 0
  },
  "duplicates": [
    {
      "id": "dup-1",
      "contacts": [
        { "name": "John Smith", "email": "jsmith@example.com" },
        { "name": "John D. Smith", "email": "john.smith@example.com" }
      ],
      "confidence": 94,
      "merged": true,
      "reason": "Same person, different email formats"
    }
  ],
  "syncToken": "CPDAlvoFEPDAlvoFGAEggICAwMeX9wI=",
  "nextSyncType": "incremental",
  "duration": 3456,
  "timestamp": "2025-10-09T10:30:00Z"
}
```

**Dry Run Response (200)**:
```json
{
  "success": true,
  "dryRun": true,
  "preview": {
    "wouldImport": 15,
    "wouldExport": 10,
    "wouldUpdate": 8,
    "wouldMerge": 3,
    "wouldSkip": 2
  },
  "duplicates": [...],
  "conflicts": [...],
  "estimatedDuration": 5000
}
```

**Error (400)**:
```json
{
  "error": "InvalidDirection",
  "message": "Direction must be 'import', 'export', or 'both'",
  "field": "direction",
  "provided": "invalid-value"
}
```

#### Example

```javascript
// Import with auto-merge
const response = await fetch('/api/google/contacts/sync', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    direction: 'import',
    autoMerge: true,
    threshold: 90
  })
});

const result = await response.json();
console.log(`Imported ${result.results.imported} contacts`);
console.log(`Merged ${result.results.merged} duplicates`);
```

---

### Calendar Sync

Synchronize calendar events from Google Calendar.

#### Request

```
POST /api/google/calendar/sync
```

**Headers**:
```
Content-Type: application/json
```

**Body**:
```json
{
  "weekIdentifier": "2025-41",
  "calendarIds": ["primary"],
  "createEntities": true,
  "skipRecurring": false,
  "maxEvents": 1000
}
```

**Body Parameters**:

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `weekIdentifier` | string | No | Current week | Week to sync (YYYY-WW format) |
| `calendarIds` | string[] | No | `["primary"]` | Calendar IDs to sync |
| `createEntities` | boolean | No | `false` | Auto-create entities for attendees |
| `skipRecurring` | boolean | No | `false` | Skip recurring event expansion |
| `maxEvents` | number | No | `1000` | Maximum events to fetch |

#### Response

**Success (200)**:
```json
{
  "success": true,
  "weekIdentifier": "2025-41",
  "weekDates": {
    "start": "2025-10-07",
    "end": "2025-10-13"
  },
  "results": {
    "eventsImported": 12,
    "attendeesLinked": 18,
    "entitiesCreated": 7,
    "recurringExpanded": 4
  },
  "calendars": [
    {
      "id": "primary",
      "name": "Personal",
      "eventCount": 8
    },
    {
      "id": "team@company.com",
      "name": "Team Calendar",
      "eventCount": 4
    }
  ],
  "duration": 2340,
  "timestamp": "2025-10-09T10:45:00Z"
}
```

**Error (400)**:
```json
{
  "error": "InvalidWeekIdentifier",
  "message": "Week identifier must be in YYYY-WW format",
  "field": "weekIdentifier",
  "provided": "2025-W41",
  "expected": "2025-41"
}
```

#### Example

```javascript
// Sync current week with entity creation
const response = await fetch('/api/google/calendar/sync', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    createEntities: true
  })
});

const result = await response.json();
console.log(`Synced ${result.results.eventsImported} events for week ${result.weekIdentifier}`);
```

---

### Calendar Events

Query calendar events from MCP Memory.

#### Request

```
GET /api/google/calendar/events
```

**Headers**:
```
Content-Type: application/json
```

**Query Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `week` | string | No | Week identifier (YYYY-WW) |
| `startDate` | string | No | Start date (YYYY-MM-DD) |
| `endDate` | string | No | End date (YYYY-MM-DD) |
| `attendee` | string | No | Filter by attendee email |
| `search` | string | No | Search in title/description |
| `limit` | number | No | Max results (default: 100) |
| `offset` | number | No | Pagination offset (default: 0) |

**Note**: Provide either `week` OR `startDate/endDate`, not both.

#### Response

**Success (200)**:
```json
{
  "events": [
    {
      "id": "event-123",
      "eventId": "abc123def456@google.com",
      "weekIdentifier": "2025-41",
      "summary": "Team Standup",
      "description": "Daily standup meeting",
      "startTime": "2025-10-07T10:00:00Z",
      "endTime": "2025-10-07T10:30:00Z",
      "location": "Conference Room A",
      "attendees": [
        {
          "email": "alice@example.com",
          "name": "Alice Johnson",
          "entityId": "entity-456",
          "responseStatus": "accepted"
        },
        {
          "email": "bob@example.com",
          "name": "Bob Smith",
          "entityId": "entity-789",
          "responseStatus": "tentative"
        }
      ],
      "isRecurring": true,
      "recurringEventId": "parent-event-id",
      "recurrence": "RRULE:FREQ=DAILY;BYDAY=MO,TU,WE,TH,FR",
      "status": "confirmed",
      "createdAt": "2025-10-09T10:30:00Z",
      "updatedAt": "2025-10-09T10:30:00Z"
    }
  ],
  "pagination": {
    "total": 12,
    "limit": 100,
    "offset": 0,
    "hasMore": false
  },
  "filters": {
    "week": "2025-41",
    "search": null,
    "attendee": null
  }
}
```

**No Events (200)**:
```json
{
  "events": [],
  "pagination": {
    "total": 0,
    "limit": 100,
    "offset": 0,
    "hasMore": false
  }
}
```

#### Example

```javascript
// Get events for a specific week
const response = await fetch('/api/google/calendar/events?week=2025-41');
const { events } = await response.json();

events.forEach(event => {
  console.log(`${event.summary} - ${event.startTime}`);
});

// Search events
const searchResponse = await fetch('/api/google/calendar/events?search=standup');
const { events: standupEvents } = await searchResponse.json();

// Get events with specific attendee
const attendeeResponse = await fetch('/api/google/calendar/events?attendee=alice@example.com');
const { events: aliceEvents } = await attendeeResponse.json();
```

---

## Data Models

### ContactSyncResult

```typescript
interface ContactSyncResult {
  success: boolean;
  syncType: 'full' | 'incremental';
  results: {
    imported: number;
    exported: number;
    updated: number;
    merged: number;
    skipped: number;
    errors: number;
  };
  duplicates?: Duplicate[];
  syncToken?: string;
  nextSyncType: 'full' | 'incremental';
  duration: number;  // milliseconds
  timestamp: string;  // ISO 8601
}
```

### Duplicate

```typescript
interface Duplicate {
  id: string;
  contacts: Contact[];
  confidence: number;  // 0-100
  merged: boolean;
  reason: string;
}
```

### CalendarSyncResult

```typescript
interface CalendarSyncResult {
  success: boolean;
  weekIdentifier: string;  // YYYY-WW
  weekDates: {
    start: string;  // YYYY-MM-DD
    end: string;    // YYYY-MM-DD
  };
  results: {
    eventsImported: number;
    attendeesLinked: number;
    entitiesCreated: number;
    recurringExpanded: number;
  };
  calendars: CalendarInfo[];
  duration: number;
  timestamp: string;
}
```

### CalendarEvent

```typescript
interface CalendarEvent {
  id: string;                    // MCP Memory internal ID
  eventId: string;               // Google Calendar event ID
  weekIdentifier: string;        // YYYY-WW
  summary: string;               // Event title
  description?: string;          // Event description
  startTime: string;             // ISO 8601
  endTime: string;               // ISO 8601
  location?: string;             // Event location
  attendees: Attendee[];         // List of attendees
  isRecurring: boolean;          // Is recurring event
  recurringEventId?: string;     // Parent recurring event ID
  recurrence?: string;           // RRULE string
  status: 'confirmed' | 'tentative' | 'cancelled';
  metadata?: Record<string, any>;
  createdAt: string;             // ISO 8601
  updatedAt: string;             // ISO 8601
}
```

### Attendee

```typescript
interface Attendee {
  email: string;
  name?: string;
  entityId?: string;             // Linked MCP entity ID
  responseStatus: 'needsAction' | 'declined' | 'tentative' | 'accepted';
  optional?: boolean;
  organizer?: boolean;
}
```

---

## Error Handling

### Error Response Format

All errors follow this structure:

```json
{
  "error": "ErrorCode",
  "message": "Human-readable error description",
  "statusCode": 400,
  "details": {},
  "timestamp": "2025-10-09T10:30:00Z"
}
```

### Common Error Codes

| Code | Status | Description | Solution |
|------|--------|-------------|----------|
| `Unauthorized` | 401 | Not authenticated | Sign in with Clerk |
| `Forbidden` | 403 | Insufficient permissions | Check OAuth scopes |
| `NotConnected` | 400 | Google account not connected | Connect Google account |
| `InvalidToken` | 401 | OAuth token invalid/expired | Reconnect Google account |
| `InvalidDirection` | 400 | Invalid sync direction | Use `import`, `export`, or `both` |
| `InvalidWeekIdentifier` | 400 | Invalid week format | Use YYYY-WW format |
| `RateLimitExceeded` | 429 | Too many requests | Wait and retry |
| `GoogleAPIError` | 502 | Google API error | Check Google status, retry |
| `SyncFailed` | 500 | Sync operation failed | Check logs, retry |
| `DatabaseError` | 500 | Database operation failed | Contact support |

### Error Handling Example

```javascript
async function syncContacts() {
  try {
    const response = await fetch('/api/google/contacts/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ direction: 'import' })
    });

    if (!response.ok) {
      const error = await response.json();

      if (error.error === 'NotConnected') {
        // Redirect to connect Google
        window.location.href = '/api/auth/google/connect';
      } else if (error.error === 'InvalidToken') {
        // Reconnect Google
        alert('Please reconnect your Google account');
      } else if (error.statusCode === 429) {
        // Rate limited, retry after delay
        await new Promise(r => setTimeout(r, 60000));
        return syncContacts();  // Retry
      } else {
        // Other error
        console.error('Sync failed:', error.message);
      }

      return;
    }

    const result = await response.json();
    console.log('Sync successful:', result);
  } catch (err) {
    console.error('Network error:', err);
  }
}
```

---

## Rate Limiting

### Limits

| Endpoint | Rate Limit | Window |
|----------|------------|--------|
| `/api/google/status` | 60 req/min | Per user |
| `/api/google/contacts/sync` | 10 req/min | Per user |
| `/api/google/calendar/sync` | 20 req/min | Per user |
| `/api/google/calendar/events` | 100 req/min | Per user |
| All endpoints | 100 req/min | Per user |

### Rate Limit Headers

Response includes rate limit information:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 87
X-RateLimit-Reset: 1696857600
```

### Rate Limit Exceeded Response

```json
{
  "error": "RateLimitExceeded",
  "message": "Rate limit exceeded. Please try again in 45 seconds.",
  "statusCode": 429,
  "retryAfter": 45,
  "limit": 100,
  "remaining": 0,
  "resetAt": "2025-10-09T11:00:00Z"
}
```

### Handling Rate Limits

```javascript
async function fetchWithRetry(url, options = {}) {
  const response = await fetch(url, options);

  if (response.status === 429) {
    const error = await response.json();
    const retryAfter = error.retryAfter * 1000;

    console.log(`Rate limited. Retrying in ${error.retryAfter}s...`);
    await new Promise(resolve => setTimeout(resolve, retryAfter));

    return fetchWithRetry(url, options);  // Retry
  }

  return response;
}
```

---

## Examples

### Complete Contact Sync Workflow

```javascript
import { useState } from 'react';

function ContactsSyncButton() {
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState(null);

  const syncContacts = async () => {
    setSyncing(true);

    try {
      // 1. Check connection status
      const statusRes = await fetch('/api/google/status');
      const status = await statusRes.json();

      if (!status.connected) {
        window.location.href = status.connectUrl;
        return;
      }

      // 2. Dry run first
      const dryRunRes = await fetch('/api/google/contacts/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          direction: 'import',
          dryRun: true,
          autoMerge: true,
          threshold: 90
        })
      });

      const preview = await dryRunRes.json();

      // 3. Confirm with user
      const confirmed = window.confirm(
        `Import ${preview.preview.wouldImport} contacts?\n` +
        `Merge ${preview.preview.wouldMerge} duplicates?`
      );

      if (!confirmed) {
        setSyncing(false);
        return;
      }

      // 4. Actual sync
      const syncRes = await fetch('/api/google/contacts/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          direction: 'import',
          dryRun: false,
          autoMerge: true,
          threshold: 90
        })
      });

      const syncResult = await syncRes.json();
      setResult(syncResult);

      alert(`Success! Imported ${syncResult.results.imported} contacts`);
    } catch (error) {
      console.error('Sync failed:', error);
      alert('Sync failed. Please try again.');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div>
      <button onClick={syncContacts} disabled={syncing}>
        {syncing ? 'Syncing...' : 'Sync Google Contacts'}
      </button>

      {result && (
        <div>
          <h3>Sync Results</h3>
          <p>Imported: {result.results.imported}</p>
          <p>Updated: {result.results.updated}</p>
          <p>Merged: {result.results.merged}</p>
          <p>Duration: {result.duration}ms</p>
        </div>
      )}
    </div>
  );
}
```

### Calendar Event Dashboard

```javascript
import { useEffect, useState } from 'react';

function CalendarDashboard() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [week, setWeek] = useState('2025-41');

  useEffect(() => {
    loadEvents();
  }, [week]);

  const loadEvents = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/google/calendar/events?week=${week}`);
      const data = await response.json();
      setEvents(data.events);
    } catch (error) {
      console.error('Failed to load events:', error);
    } finally {
      setLoading(false);
    }
  };

  const syncWeek = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/google/calendar/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          weekIdentifier: week,
          createEntities: true
        })
      });

      const result = await response.json();
      alert(`Synced ${result.results.eventsImported} events`);

      // Reload events
      await loadEvents();
    } catch (error) {
      console.error('Sync failed:', error);
      alert('Sync failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2>Calendar Events - Week {week}</h2>

      <button onClick={syncWeek} disabled={loading}>
        {loading ? 'Syncing...' : 'Sync This Week'}
      </button>

      <div>
        {events.map(event => (
          <div key={event.id}>
            <h4>{event.summary}</h4>
            <p>{new Date(event.startTime).toLocaleString()}</p>
            <p>Location: {event.location || 'N/A'}</p>
            <p>Attendees: {event.attendees.length}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

## Related Documentation

- **[Google Sync Overview](../features/GOOGLE_SYNC.md)**: Feature documentation
- **[Google Setup Guide](../guides/GOOGLE_SETUP_GUIDE.md)**: Setup instructions
- **[Google Contacts Sync Guide](../guides/GOOGLE_CONTACTS_SYNC_GUIDE.md)**: Contacts sync usage
- **[Google Calendar Sync Guide](../guides/GOOGLE_CALENDAR_SYNC_GUIDE.md)**: Calendar sync usage

---

**Last Updated**: 2025-10-09
**Version**: 1.7.0
