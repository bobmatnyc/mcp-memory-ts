# Google Sync - Quick Reference Guide

## Component Import Paths

```typescript
// Connection Status
import { GoogleConnectionStatus } from '@/components/dashboard/google-connection-status';

// Contacts Sync
import { GoogleContactsSync } from '@/components/google/google-contacts-sync';

// Calendar Sync
import { GoogleCalendarSync } from '@/components/google/google-calendar-sync';
```

## API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/google/status` | GET | Check connection status |
| `/api/google/disconnect` | POST | Disconnect Google account |
| `/api/google/contacts/sync` | POST | Sync contacts |
| `/api/google/calendar/sync` | POST | Sync calendar events |
| `/api/google/calendar/events` | GET | Fetch stored events |

## API Request/Response Examples

### Check Status
```typescript
// GET /api/google/status
const response = await fetch('/api/google/status');
const data = await response.json();
// Returns: { connected, email, lastSync, stats }
```

### Sync Contacts
```typescript
// POST /api/google/contacts/sync
const response = await fetch('/api/google/contacts/sync', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    direction: 'both',      // 'import' | 'export' | 'both'
    dryRun: false,          // Preview changes only
    forceFull: false,       // Force full sync (ignore incremental)
    useLLM: true,           // Enable LLM deduplication
  }),
});
const result = await response.json();
// Returns: { success, exported, imported, updated, duplicatesFound, errors }
```

### Sync Calendar
```typescript
// POST /api/google/calendar/sync
const response = await fetch('/api/google/calendar/sync', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    week: '2025-W41',       // Week identifier or 'current'
    calendarId: 'primary',  // Google Calendar ID
  }),
});
const result = await response.json();
// Returns: { success, eventsSynced, weekIdentifier, errors }
```

### Fetch Events
```typescript
// GET /api/google/calendar/events?week=2025-W41
const response = await fetch('/api/google/calendar/events?week=2025-W41');
const data = await response.json();
// Returns: { events, weekIdentifier, totalEvents }
```

## Component Usage Examples

### Basic Connection Status
```tsx
import { GoogleConnectionStatus } from '@/components/dashboard/google-connection-status';

export default function Page() {
  return <GoogleConnectionStatus />;
}
```

### With Callbacks
```tsx
<GoogleConnectionStatus
  onConnect={() => {
    console.log('Google account connected');
    // Refresh page data, show notification, etc.
  }}
  onDisconnect={() => {
    console.log('Google account disconnected');
    // Update UI, clear cached data, etc.
  }}
/>
```

### Contacts Sync with Handler
```tsx
import { GoogleContactsSync } from '@/components/google/google-contacts-sync';

export default function Page() {
  const handleSyncComplete = (result) => {
    console.log(`Imported: ${result.imported}`);
    console.log(`Exported: ${result.exported}`);
    console.log(`Updated: ${result.updated}`);

    if (result.errors.length > 0) {
      console.error('Errors:', result.errors);
    }
  };

  return (
    <GoogleContactsSync onSyncComplete={handleSyncComplete} />
  );
}
```

### Calendar Sync with Handler
```tsx
import { GoogleCalendarSync } from '@/components/google/google-calendar-sync';

export default function Page() {
  const handleSyncComplete = (result) => {
    console.log(`Synced ${result.eventsSynced} events for ${result.weekIdentifier}`);
  };

  return (
    <GoogleCalendarSync onSyncComplete={handleSyncComplete} />
  );
}
```

## Week Identifier Format

Week identifiers use ISO 8601 week numbering format:

```typescript
// Format: YYYY-Www
'2025-W41'  // Week 41 of 2025
'2025-W01'  // Week 1 of 2025
'2025-W52'  // Week 52 of 2025

// Calculate current week
function getCurrentWeek(): string {
  const now = new Date();
  const year = now.getFullYear();
  const startOfYear = new Date(year, 0, 1);
  const days = Math.floor((now.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
  const weekNumber = Math.ceil((days + startOfYear.getDay() + 1) / 7);
  return `${year}-W${weekNumber.toString().padStart(2, '0')}`;
}
```

## Database Schema

### User Metadata
```typescript
interface UserMetadata {
  googleOAuthTokens?: {
    access_token: string;
    refresh_token: string;
    scope: string;
    token_type: string;
    expiry_date: number;
  };
  googleContactsSyncToken?: string;
  googleContactsSyncAt?: string;  // ISO timestamp
  googleCalendarSyncAt?: string;   // ISO timestamp
}
```

### Calendar Events Table
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
  attendees TEXT,  -- JSON array
  recurrence TEXT, -- JSON array
  is_recurring INTEGER DEFAULT 0,
  recurring_event_id TEXT,
  status TEXT,
  metadata TEXT,   -- JSON object
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, event_id)
);
```

## Error Handling Patterns

### API Error Response
```typescript
interface ErrorResponse {
  error: string;
  details?: string;
}

// Example usage
try {
  const response = await fetch('/api/google/contacts/sync', { ... });
  if (!response.ok) {
    const error = await response.json();
    console.error('Sync failed:', error.error);
  }
} catch (error) {
  console.error('Network error:', error);
}
```

### Component Error States
```typescript
// Sync result with errors
interface SyncResult {
  success: boolean;
  exported: number;
  imported: number;
  updated: number;
  duplicatesFound: number;
  merged: number;
  errors: string[];  // Array of error messages
}

// Display errors in UI
{result.errors.length > 0 && (
  <div className="mt-3 pt-3 border-t">
    <p className="text-sm font-medium mb-2">Errors:</p>
    <ul className="text-sm space-y-1">
      {result.errors.slice(0, 5).map((error, i) => (
        <li key={i} className="text-red-700">• {error}</li>
      ))}
      {result.errors.length > 5 && (
        <li className="text-red-700">... and {result.errors.length - 5} more</li>
      )}
    </ul>
  </div>
)}
```

## Environment Setup

### Required Variables
```bash
# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# App Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3004  # or production URL

# Database
TURSO_URL=libsql://your-database.turso.io
TURSO_AUTH_TOKEN=your-turso-token

# OpenAI (for LLM deduplication)
OPENAI_API_KEY=sk-...

# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...
```

### Google Cloud Console Setup
1. Create project in Google Cloud Console
2. Enable APIs:
   - Google People API (for contacts)
   - Google Calendar API (for calendar)
   - Gmail API (for email extraction)
3. Create OAuth 2.0 credentials
4. Add authorized redirect URIs:
   - `http://localhost:3004/api/auth/google-connect/callback` (development)
   - `https://your-domain.com/api/auth/google-connect/callback` (production)
5. Configure OAuth consent screen
6. Add test users (for development)

## Testing Checklist

### Manual Testing
```bash
# 1. Start development server
cd web && npm run dev

# 2. Test OAuth flow
# - Visit /settings
# - Click "Connect Google Account"
# - Grant permissions
# - Verify connection status updates

# 3. Test contacts sync
# - Select sync direction
# - Enable dry run
# - Click "Sync Now"
# - Verify results display

# 4. Test calendar sync
# - Navigate weeks
# - Click "Sync Week"
# - Click "View Events"
# - Verify events display

# 5. Test disconnect
# - Click "Disconnect"
# - Confirm dialog
# - Verify status updates
```

### Automated Testing
```typescript
// Component test example
import { render, screen, fireEvent } from '@testing-library/react';
import { GoogleContactsSync } from '@/components/google/google-contacts-sync';

test('displays sync results', async () => {
  const mockOnComplete = jest.fn();
  render(<GoogleContactsSync onSyncComplete={mockOnComplete} />);

  // Mock API response
  global.fetch = jest.fn(() =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        imported: 10,
        exported: 5,
        updated: 3,
        duplicatesFound: 2,
        merged: 1,
        errors: [],
      }),
    })
  );

  // Click sync button
  fireEvent.click(screen.getByText('Sync Now'));

  // Wait for results
  await screen.findByText('Sync Completed');

  // Verify callback
  expect(mockOnComplete).toHaveBeenCalled();
});
```

## Performance Tips

### Optimize Sync Operations
```typescript
// Use incremental sync when possible
{
  direction: 'both',
  dryRun: false,
  forceFull: false,  // Let incremental sync work
  useLLM: true,
}

// For initial sync or full refresh
{
  direction: 'both',
  dryRun: false,
  forceFull: true,   // Force full sync
  useLLM: true,
}
```

### Batch Calendar Sync
```typescript
// Sync multiple weeks efficiently
async function syncMultipleWeeks(weeks: string[]) {
  const results = await Promise.all(
    weeks.map(week =>
      fetch('/api/google/calendar/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ week, calendarId: 'primary' }),
      }).then(r => r.json())
    )
  );

  const totalEvents = results.reduce((sum, r) => sum + r.eventsSynced, 0);
  console.log(`Synced ${totalEvents} total events across ${weeks.length} weeks`);
}
```

## Troubleshooting

### Issue: "Google account not connected"
**Solution**: User needs to complete OAuth flow first. Redirect to `/settings` and click "Connect Google Account".

### Issue: "Missing Calendar permission"
**Solution**: User needs to reconnect with calendar scope. Disconnect and reconnect.

### Issue: Sync returns 0 events
**Solution**:
1. Check if calendar has events for that week
2. Verify Calendar API is enabled
3. Check OAuth scopes include `calendar.readonly`

### Issue: LLM deduplication not working
**Solution**:
1. Verify OPENAI_API_KEY is set
2. Check OpenAI account has credits
3. Review API rate limits

### Issue: Events not displaying after sync
**Solution**:
1. Check database connection
2. Verify events were stored (check sync result)
3. Try refreshing the events list
4. Check browser console for errors

## Additional Resources

- [Full Implementation Guide](./GOOGLE_WEB_UI_IMPLEMENTATION.md)
- [OAuth Setup Guide](./docs/guides/GOOGLE_OAUTH_SETUP.md)
- [API Documentation](./docs/api/GOOGLE_SYNC_API.md)
- [Component Storybook](./web/stories/google-sync.stories.tsx)

---

**Last Updated**: October 9, 2025
**Version**: 1.0.0
