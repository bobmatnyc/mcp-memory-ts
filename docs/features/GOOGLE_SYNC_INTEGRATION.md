# Google Sync Integration

**Version**: 1.0.0
**Date**: 2025-10-09
**Status**: ✅ Complete

## Overview

Complete Google Contacts and Calendar sync integration for MCP Memory TypeScript. Provides bidirectional sync with Google Contacts and read-only calendar event tracking.

## Features

### ✅ Google Contacts Sync

- **Incremental Sync**: Uses syncToken for efficient updates
- **Bidirectional Sync**: Import from Google, export to Google, or both
- **LLM Deduplication**: Automatic duplicate detection using GPT-4
- **Field Mapping**: Comprehensive contact field mapping
- **Conflict Resolution**: Smart merge strategies

### ✅ Google Calendar Sync

- **Week-based Tracking**: Sync events by week identifier
- **Recurring Events**: Automatic expansion of recurring events
- **Attendee Extraction**: Link calendar attendees to entities
- **Multiple Calendars**: Support for multiple Google Calendars

### ✅ OAuth Integration

- **Secure Authentication**: OAuth 2.0 with offline access
- **Token Management**: Automatic token refresh
- **Scope Validation**: Verify required permissions
- **Web Interface**: Easy OAuth connection via settings page

## Architecture

### Core Components

```
src/
├── types/google.ts                    # Google-specific types and branded IDs
├── utils/
│   ├── google-auth.ts                # OAuth service
│   └── week-calculator.ts            # Week utilities
├── integrations/
│   ├── google-people-client.ts       # Google Contacts API client
│   └── google-calendar-client.ts     # Google Calendar API client
├── services/
│   └── google-contacts-sync.ts       # Contacts sync service
├── database/
│   └── calendar-operations.ts        # Calendar database operations
└── cli/commands/
    ├── google-auth.ts                # Auth management CLI
    ├── google-contacts-sync.ts       # Contacts sync CLI
    └── google-calendar-sync.ts       # Calendar sync CLI

web/
├── app/api/auth/
│   └── google-connect/
│       ├── route.ts                  # OAuth initiation
│       └── callback/route.ts         # OAuth callback
└── lib/
    └── google-auth.ts                # Web auth service
```

### Database Schema

```sql
CREATE TABLE calendar_events (
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
  is_recurring INTEGER DEFAULT 0,
  recurring_event_id TEXT,
  status TEXT DEFAULT 'confirmed',
  metadata TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(user_id, event_id, week_identifier)
);

CREATE INDEX idx_calendar_events_user_week ON calendar_events(user_id, week_identifier);
CREATE INDEX idx_calendar_events_user_time ON calendar_events(user_id, start_time DESC);
CREATE INDEX idx_calendar_events_user_event ON calendar_events(user_id, event_id);
```

## Setup Guide

### 1. Google Cloud Console Setup

1. **Create Google Cloud Project**:
   - Go to [Google Cloud Console](https://console.cloud.google.com)
   - Create new project or select existing

2. **Enable APIs**:
   ```
   - Google People API (for Contacts)
   - Google Calendar API (for Calendar)
   - Gmail API (optional, for Gmail integration)
   ```

3. **Create OAuth 2.0 Credentials**:
   - Go to "APIs & Services" → "Credentials"
   - Click "Create Credentials" → "OAuth 2.0 Client ID"
   - Application type: "Web application"
   - Authorized redirect URIs:
     - `http://localhost:3000/api/auth/google-connect/callback` (development)
     - `https://yourdomain.com/api/auth/google-connect/callback` (production)

4. **Get Credentials**:
   - Copy Client ID
   - Copy Client Secret

### 2. Environment Configuration

Add to `.env`:

```bash
# Google OAuth Configuration
GOOGLE_CLIENT_ID=your-google-oauth-client-id
GOOGLE_CLIENT_SECRET=your-google-oauth-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google-connect/callback

# Production
# GOOGLE_REDIRECT_URI=https://yourdomain.com/api/auth/google-connect/callback
```

Add to `web/.env.local`:

```bash
NEXT_PUBLIC_APP_URL=http://localhost:3000
# Production: NEXT_PUBLIC_APP_URL=https://yourdomain.com
```

### 3. Database Migration

Run the migration to create calendar_events table:

```bash
# Dry run (preview changes)
npm run migrate:google:dry-run

# Execute migration
npm run migrate:google
```

## Usage

### OAuth Connection (Web Interface)

1. Navigate to Settings page
2. Click "Connect Google Account"
3. Grant required permissions:
   - Google Contacts (read/write)
   - Google Calendar (read-only)
   - Gmail (read-only, optional)

### CLI Commands

#### Check Google Connection Status

```bash
# Check connection status
mcp-memory google auth --user-email user@example.com --action status

# Disconnect Google account
mcp-memory google auth --user-email user@example.com --action disconnect
```

#### Google Contacts Sync

```bash
# Import from Google to MCP Memory
mcp-memory google contacts-sync \
  --user-email user@example.com \
  --direction import

# Export from MCP Memory to Google
mcp-memory google contacts-sync \
  --user-email user@example.com \
  --direction export

# Bidirectional sync
mcp-memory google contacts-sync \
  --user-email user@example.com \
  --direction both

# Dry run (preview changes)
mcp-memory google contacts-sync \
  --user-email user@example.com \
  --direction both \
  --dry-run

# Force full sync (ignore syncToken)
mcp-memory google contacts-sync \
  --user-email user@example.com \
  --force-full

# Disable LLM deduplication
mcp-memory google contacts-sync \
  --user-email user@example.com \
  --no-llm

# Custom deduplication threshold
mcp-memory google contacts-sync \
  --user-email user@example.com \
  --threshold 0.9
```

#### Google Calendar Sync

```bash
# Sync current week
mcp-memory google calendar-sync \
  --user-email user@example.com

# Sync specific week
mcp-memory google calendar-sync \
  --user-email user@example.com \
  --week 2025-42

# Sync multiple weeks
mcp-memory google calendar-sync \
  --user-email user@example.com \
  --weeks 2025-40,2025-41,2025-42

# Sync specific calendar
mcp-memory google calendar-sync \
  --user-email user@example.com \
  --calendar-id primary
```

## Type Safety

### Branded Types

```typescript
type GoogleContactId = string & { readonly __brand: 'GoogleContactId' };
type GoogleEventId = string & { readonly __brand: 'GoogleEventId' };
type WeekIdentifier = string & { readonly __brand: 'WeekIdentifier' };

// Create branded IDs
const contactId = createGoogleContactId('123');
const eventId = createGoogleEventId('abc');
const weekId = createWeekIdentifier('2025-42');
```

### Result Types

```typescript
type SyncResult<T> =
  | { ok: true; data: T; syncToken?: string }
  | { ok: false; error: SyncError };

type SyncError =
  | { type: 'EXPIRED_SYNC_TOKEN'; message: string }
  | { type: 'RATE_LIMIT'; retryAfter: number; message: string }
  | { type: 'NETWORK_ERROR'; message: string }
  | { type: 'AUTH_ERROR'; message: string }
  | { type: 'VALIDATION_ERROR'; message: string };
```

## Sync Strategies

### Incremental Sync (Contacts)

The Google Contacts sync uses syncToken for efficient incremental updates:

1. **First Sync**: Full sync of all contacts, stores syncToken
2. **Subsequent Syncs**: Only fetch changes since last sync
3. **Token Expiry**: Automatic fallback to full sync if token expires

### Week-based Sync (Calendar)

Calendar events are organized by week identifier (ISO 8601):

```typescript
// Week identifier format: YYYY-WW
const currentWeek = getCurrentWeekIdentifier(); // "2025-42"

// Get week date range
const { start, end } = getWeekDates('2025-42');
// start: Monday 00:00:00
// end: Sunday 23:59:59
```

### Field Mapping

**Google Contact → MCP Entity**:

```typescript
{
  names[0].displayName → name
  emailAddresses[0].value → email
  phoneNumbers[0].value → phone
  organizations[0].name → company
  organizations[0].title → title
  biographies[0].value → notes
  urls[0].value → website
  metadata → { googleResourceName, googleEtag, source: 'google-contacts' }
}
```

**MCP Entity → Google Contact**:

```typescript
{
  name → names[0].{givenName, familyName, displayName}
  email → emailAddresses[0].{value, type: 'work'}
  phone → phoneNumbers[0].{value, type: 'work'}
  company/title → organizations[0].{name, title}
  notes → biographies[0].{value, contentType: 'TEXT_PLAIN'}
  website → urls[0].{value, type: 'work'}
}
```

## Error Handling

### Automatic Retry

- **Expired Sync Token**: Automatic fallback to full sync
- **Rate Limits**: Exponential backoff with retry-after headers
- **Network Errors**: Graceful degradation with error messages

### Token Refresh

Automatic token refresh when access token expires:

```typescript
// Auto-refresh handler
client.on('tokens', async (newTokens) => {
  const updatedTokens = { ...existingTokens, ...newTokens };
  await googleAuth.storeTokens(userId, updatedTokens);
});
```

## Performance

### Batch Operations

- **Contacts**: Process up to 1000 contacts per API call
- **Pagination**: Automatic handling of paginated results
- **LLM Deduplication**: Batch processing (10 contacts per batch)

### Optimizations

- **Database Indexes**: Optimized queries for week-based lookups
- **Incremental Sync**: Minimize API calls with syncToken
- **Parallel Processing**: Async operations where possible

## Security

### Token Storage

- Tokens stored encrypted in user metadata
- Never logged or exposed in responses
- Automatic cleanup on disconnect

### Scope Validation

```typescript
const requiredScopes = [
  GOOGLE_SCOPES.CONTACTS,
  GOOGLE_SCOPES.CALENDAR_READONLY,
];

const hasScopes = await googleAuth.hasRequiredScopes(userId, requiredScopes);
```

### User Isolation

- All operations scoped to user ID
- Foreign key constraints enforce data isolation
- Multi-tenant safe

## Troubleshooting

### Common Issues

**1. OAuth Connection Fails**

- Verify redirect URI matches Google Console configuration
- Check client ID and secret are correct
- Ensure APIs are enabled in Google Console

**2. Sync Token Expired**

- Normal behavior after 7 days of inactivity
- Automatic fallback to full sync
- Store new syncToken for future incremental syncs

**3. Rate Limit Exceeded**

- Google has quota limits (default: 10 requests/second)
- Automatic retry with exponential backoff
- Consider reducing batch sizes

**4. Missing Contacts**

- Check sync direction (import/export/both)
- Verify LLM deduplication threshold
- Review sync logs for errors

## Testing

### Manual Testing

```bash
# 1. Run dry-run to preview changes
mcp-memory google contacts-sync --user-email test@example.com --dry-run

# 2. Check connection status
mcp-memory google auth --user-email test@example.com --action status

# 3. Run incremental sync
mcp-memory google contacts-sync --user-email test@example.com --direction both

# 4. Verify calendar sync
mcp-memory google calendar-sync --user-email test@example.com --week current
```

### Integration Tests

```typescript
import { GooglePeopleClient } from '../src/integrations/google-people-client';
import { GoogleCalendarClient } from '../src/integrations/google-calendar-client';

describe('Google Sync Integration', () => {
  it('should sync contacts incrementally', async () => {
    // Test incremental sync with syncToken
  });

  it('should handle expired syncToken', async () => {
    // Test fallback to full sync
  });

  it('should sync calendar events by week', async () => {
    // Test week-based calendar sync
  });
});
```

## Future Enhancements

### Planned Features

- [ ] Calendar event creation/update (write access)
- [ ] Google Tasks integration
- [ ] Google Drive file tracking
- [ ] Automated scheduled syncs
- [ ] Webhook support for real-time updates
- [ ] Contact groups/labels sync

### Performance Improvements

- [ ] Parallel batch processing
- [ ] Redis caching for syncTokens
- [ ] WebSocket for real-time sync status
- [ ] Optimistic UI updates

## API Reference

See implementation documentation:

- [Google Sync Architecture](../architecture/GOOGLE_SYNC_ARCHITECTURE.md)
- [Google Sync Flows](../architecture/GOOGLE_SYNC_FLOWS.md)
- [Implementation Plan](../guides/GOOGLE_SYNC_IMPLEMENTATION_PLAN.md)

## Support

For issues or questions:

1. Check [Troubleshooting](#troubleshooting) section
2. Review [Architecture Documentation](../architecture/)
3. Open GitHub issue with logs and error messages

---

**Last Updated**: 2025-10-09
**Implementation Status**: Complete
**Test Coverage**: Pending
**Documentation**: Complete
