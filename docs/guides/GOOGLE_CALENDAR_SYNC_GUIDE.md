# Google Calendar Sync Guide

**Version**: 1.7.0
**Status**: Production Ready
**Last Updated**: 2025-10-09

## Table of Contents

- [Overview](#overview)
- [Quick Start](#quick-start)
- [How It Works](#how-it-works)
- [Week Identifier Format](#week-identifier-format)
- [CLI Usage](#cli-usage)
- [Web UI Usage](#web-ui-usage)
- [Recurring Events](#recurring-events)
- [Attendee Linking](#attendee-linking)
- [Event Querying](#event-querying)
- [Best Practices](#best-practices)
- [Advanced Usage](#advanced-usage)
- [Troubleshooting](#troubleshooting)

## Overview

Google Calendar sync provides **read-only** access to your Google Calendar events, organizing them by week for efficient tracking and querying. This integration enables your AI assistant to understand your schedule, meeting history, and professional relationships.

### Key Features

✅ **Week-based Organization**: Events grouped by ISO week identifier (YYYY-WW)
✅ **Recurring Events**: Automatic expansion of recurring events
✅ **Attendee Linking**: Automatically connects calendar attendees to MCP entities
✅ **Multiple Calendars**: Support for syncing multiple Google Calendars
✅ **Read-only**: Safe, non-intrusive calendar access (never modifies your calendar)
✅ **Efficient Queries**: Fast searches by date range, attendee, or keyword
✅ **Privacy Aware**: Only syncs events you choose; respects calendar visibility

### What You Can Do

- **Track meetings**: Know who you met with and when
- **Build context**: AI assistant understands your work relationships
- **Schedule awareness**: AI knows when you're busy or available
- **Meeting history**: Query past meetings with specific people or organizations
- **Relationship mapping**: Automatically build professional network graph

### What It Doesn't Do

- ❌ **Modify calendar**: Read-only access; never changes your Google Calendar
- ❌ **Create events**: Cannot add new events to your calendar
- ❌ **Real-time sync**: Manual sync only (not live updates)
- ❌ **All calendars**: Only syncs calendars you specify

## Quick Start

### Prerequisites

Before syncing calendar events, ensure:

1. **Google account connected**: Complete [Google Setup Guide](./GOOGLE_SETUP_GUIDE.md)
2. **OAuth scopes granted**: `calendar.readonly` scope must be authorized
3. **Environment configured**: Google OAuth credentials set

### Sync Current Week

Sync the current week's calendar events:

```bash
mcp-memory google calendar-sync \
  --user-email your-email@example.com
```

### Sync Specific Week

Sync a specific week by identifier:

```bash
mcp-memory google calendar-sync \
  --user-email your-email@example.com \
  --week 2025-41
```

### Sync Multiple Weeks

Sync a range of weeks:

```bash
# Sync last 4 weeks
mcp-memory google calendar-sync \
  --user-email your-email@example.com \
  --weeks 2025-38,2025-39,2025-40,2025-41
```

## How It Works

### Week-based Tracking

Calendar events are organized by **week identifier** (YYYY-WW format):

```
┌─────────────────────────────────────────────────────────┐
│              Calendar Event Timeline                     │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Week 2025-40 (Sep 30 - Oct 6)                         │
│  ┌───────────────────────────────────────────────┐     │
│  │ Mon: Team Standup (10am)                      │     │
│  │ Tue: Client Meeting (2pm)                     │     │
│  │ Wed: Project Review (11am)                    │     │
│  │ Fri: Weekly Planning (3pm)                    │     │
│  └───────────────────────────────────────────────┘     │
│                                                         │
│  Week 2025-41 (Oct 7 - Oct 13)                         │
│  ┌───────────────────────────────────────────────┐     │
│  │ Mon: Team Standup (10am) [Recurring]          │     │
│  │ Tue: Sales Call (1pm)                         │     │
│  │ Thu: Strategy Session (10am)                  │     │
│  │ Fri: Weekly Planning (3pm) [Recurring]        │     │
│  └───────────────────────────────────────────────┘     │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Benefits**:
- 📅 **Organized chronologically**: Easy to query by time period
- 🔍 **Efficient searches**: Find events in specific weeks quickly
- 📊 **Analytics-ready**: Aggregate meeting data by week/month
- 🔄 **Clean sync**: Re-sync weeks without affecting others

### Sync Flow

```
┌──────────────────────────────────────────────────────────────┐
│                  GOOGLE CALENDAR SYNC                         │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│  Phase 1: Calculate Week Range                               │
│  • Determine week identifier (e.g., 2025-41)                 │
│  • Calculate start/end dates (ISO week standard)             │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│  Phase 2: Fetch Events from Google                           │
│  • Query Google Calendar API for date range                  │
│  • Expand recurring events (if any)                          │
│  • Filter by calendar IDs (if specified)                     │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│  Phase 3: Extract Attendees                                  │
│  • Parse attendee list from each event                       │
│  • Extract email addresses and names                         │
│  • Deduplicate attendees across events                       │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│  Phase 4: Link to Entities                                   │
│  • Match attendees to existing MCP entities by email         │
│  • Create new entities for unknown attendees (optional)      │
│  • Build relationship graph                                  │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│  Phase 5: Store Events                                       │
│  • Save events to calendar_events table                      │
│  • Link events to entities                                   │
│  • Update week sync status                                   │
└──────────────────────────────────────────────────────────────┘
```

## Week Identifier Format

### ISO Week Date Standard

MCP Memory uses **ISO 8601 week dates**:

- **Format**: `YYYY-WW`
- **Year (YYYY)**: 4-digit year
- **Week (WW)**: Two-digit week number (01-53)

**Examples**:
- `2025-01`: First week of 2025 (Dec 30, 2024 - Jan 5, 2025)
- `2025-41`: 41st week of 2025 (Oct 7-13, 2025)
- `2025-52`: Last week of 2025 (Dec 22-28, 2025)

### Week Boundaries

ISO weeks always start on **Monday** and end on **Sunday**:

```
       October 2025
Su Mo Tu We Th Fr Sa
          1  2  3  4   ← Week 2025-40 (Sep 30 - Oct 4)
 5  6  7  8  9 10 11   ← Week 2025-41 (Oct 7 - Oct 13)
12 13 14 15 16 17 18   ← Week 2025-42 (Oct 14 - Oct 20)
19 20 21 22 23 24 25   ← Week 2025-43 (Oct 21 - Oct 27)
26 27 28 29 30 31      ← Week 2025-44 (Oct 28 - Nov 3)
```

### Getting Week Identifier

**For current week**:
```bash
# macOS/Linux
date +%Y-%V
# Output: 2025-41

# Or use MCP Memory CLI
mcp-memory google calendar-sync -u your@email.com
# Automatically uses current week
```

**For specific date**:
```bash
# Get week for October 15, 2025
date -d "2025-10-15" +%Y-%V
# Output: 2025-42
```

**For date ranges**:
```bash
# Get weeks for entire month
for day in {1..31}; do
  date -d "2025-10-$day" +%Y-%V 2>/dev/null
done | sort -u
# Output: 2025-40, 2025-41, 2025-42, 2025-43, 2025-44
```

## CLI Usage

### Command Syntax

```bash
mcp-memory google calendar-sync [options]
```

### Required Options

| Option | Description | Example |
|--------|-------------|---------|
| `--user-email <email>` | User email or ID for MCP Memory | `--user-email bob@example.com` |
| `-u <email>` | Short form of `--user-email` | `-u bob@example.com` |

### Sync Options

| Option | Default | Description |
|--------|---------|-------------|
| `-w, --week <identifier>` | Current week | Week identifier (YYYY-WW) |
| `--weeks <list>` | - | Comma-separated list of weeks |
| `--calendar-ids <list>` | Primary | Comma-separated calendar IDs |
| `--create-entities` | `false` | Create entities for unknown attendees |
| `--skip-recurring` | `false` | Skip recurring event expansion |
| `--max-events <num>` | `1000` | Maximum events to sync per week |

### Examples

#### Sync Current Week (Default)

```bash
mcp-memory google calendar-sync \
  --user-email bob@example.com
```

Output:
```
📅 Google Calendar Sync

📊 Syncing week 2025-41 (Oct 7 - Oct 13, 2025)
🔍 Fetching events from Google Calendar...
📊 Fetched 12 events
🔗 Extracting attendees...
✅ Found 25 attendees across 12 events
🔗 Linking to existing entities...
✅ Linked 18 attendees to existing entities
⚠️  7 attendees not found (use --create-entities to auto-create)

✅ Week 2025-41 Sync Complete:
  Events imported: 12
  Attendees linked: 18
  New entities: 0
  Recurring events: 4 (expanded)
```

#### Sync Specific Week

```bash
mcp-memory google calendar-sync \
  --user-email bob@example.com \
  --week 2025-40
```

Output:
```
📅 Google Calendar Sync

📊 Syncing week 2025-40 (Sep 30 - Oct 6, 2025)
...
✅ Week 2025-40 Sync Complete
```

#### Sync Multiple Weeks

```bash
mcp-memory google calendar-sync \
  --user-email bob@example.com \
  --weeks 2025-38,2025-39,2025-40,2025-41
```

Output:
```
📅 Google Calendar Sync

📊 Syncing 4 weeks...

Week 2025-38: ✅ 8 events imported
Week 2025-39: ✅ 10 events imported
Week 2025-40: ✅ 9 events imported
Week 2025-41: ✅ 12 events imported

✅ Multi-week Sync Complete:
  Total events: 39
  Total attendees: 87
  Entities linked: 65
```

#### Sync with Entity Creation

Automatically create entities for unknown attendees:

```bash
mcp-memory google calendar-sync \
  --user-email bob@example.com \
  --create-entities
```

Output:
```
📅 Google Calendar Sync

📊 Syncing week 2025-41...
🔗 Linking attendees...
✅ Linked 18 attendees to existing entities
✨ Created 7 new entities for unknown attendees:
  1. Alice Johnson <alice@example.com>
  2. Bob Smith <bob@company.com>
  3. Carol White <carol@startup.io>
  ... (4 more)

✅ Sync Complete:
  Events: 12
  Attendees linked: 18
  New entities: 7
```

#### Sync Specific Calendars

Sync only specific calendars by ID:

```bash
mcp-memory google calendar-sync \
  --user-email bob@example.com \
  --calendar-ids "primary,team@company.com,project-x@company.com"
```

Output:
```
📅 Google Calendar Sync

📊 Syncing 3 calendars:
  • primary (Personal)
  • team@company.com (Team Calendar)
  • project-x@company.com (Project X)

✅ Sync Complete:
  Calendar 1 (primary): 8 events
  Calendar 2 (team): 12 events
  Calendar 3 (project-x): 5 events
  Total: 25 events
```

#### Skip Recurring Event Expansion

Sync only single instances (skip recurring):

```bash
mcp-memory google calendar-sync \
  --user-email bob@example.com \
  --skip-recurring
```

Use this when:
- You only want one-off meetings
- Recurring events are not relevant
- Reducing sync time/storage

## Web UI Usage

### Accessing Calendar Sync

1. Open MCP Memory web interface: `http://localhost:3000`
2. Navigate to **Dashboard** or **Calendar** page
3. Find **Google Calendar Sync** section

### Sync Interface

**Sync Current Week**:
1. Click **Sync This Week** button
2. Monitor progress bar
3. View imported events in the event list below

**Sync Custom Week**:
1. Use the week picker (calendar icon)
2. Select desired week
3. Click **Sync Selected Week**
4. View results

**Sync Multiple Weeks**:
1. Click **Sync Multiple Weeks**
2. Select start and end weeks
3. Click **Start Sync**
4. Progress shows per-week status
5. Review summary when complete

### Viewing Events

**Event List View**:
- Shows all synced events for the selected week
- Displays: Title, Time, Location, Attendees
- Click event to see details

**Calendar Grid View**:
- Visual calendar showing events by day
- Color-coded by calendar source
- Click date to see day's events

**Search Events**:
- Use search bar to filter by keyword
- Filter by attendee name or email
- Filter by date range

### Attendee Management

**View Linked Entities**:
- Click on an attendee name
- See their entity profile
- View all meetings with that person

**Create Entity from Attendee**:
1. Click on unknown attendee (marked with ?)
2. Click **Create Entity**
3. Fill in additional details (optional)
4. Save to link to entity

## Recurring Events

### How Recurring Events Work

Google Calendar supports recurring events (daily, weekly, monthly, etc.). MCP Memory expands these into individual instances for each occurrence within the synced week.

**Example**:

```
Recurring Event Definition:
  Title: Team Standup
  Recurrence: Every Monday, Wednesday, Friday at 10:00 AM
  Start: Jan 1, 2025
  End: Dec 31, 2025

Week 2025-41 (Oct 7-13, 2025) Expansion:
  ┌────────────────────────────────────────┐
  │ Mon Oct 7:  Team Standup @ 10:00 AM   │
  │ Wed Oct 9:  Team Standup @ 10:00 AM   │
  │ Fri Oct 11: Team Standup @ 10:00 AM   │
  └────────────────────────────────────────┘

Database Storage:
  Event 1:
    event_id: team-standup-20251007
    recurring_event_id: team-standup-parent
    is_recurring: 1
    start_time: 2025-10-07T10:00:00
    recurrence: RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR

  Event 2:
    event_id: team-standup-20251009
    recurring_event_id: team-standup-parent
    is_recurring: 1
    start_time: 2025-10-09T10:00:00
    recurrence: RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR

  Event 3:
    event_id: team-standup-20251011
    recurring_event_id: team-standup-parent
    is_recurring: 1
    start_time: 2025-10-11T10:00:00
    recurrence: RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR
```

### Recurrence Patterns Supported

- **Daily**: Every day, every N days, weekdays only
- **Weekly**: Specific days of week (e.g., Mon/Wed/Fri)
- **Monthly**: Specific date (e.g., 15th) or day (e.g., 2nd Tuesday)
- **Yearly**: Specific date each year

### Querying Recurring Events

**Find all instances of a recurring event**:
```sql
SELECT * FROM calendar_events
WHERE recurring_event_id = 'team-standup-parent'
ORDER BY start_time;
```

**Find recurring events in a week**:
```sql
SELECT * FROM calendar_events
WHERE week_identifier = '2025-41'
  AND is_recurring = 1;
```

### Modifying Recurring Events

Since calendar sync is **read-only**, modifications to recurring events must be done in Google Calendar:

1. Edit event in Google Calendar
2. Re-sync the affected weeks in MCP Memory
3. Updated instances will be reflected

## Attendee Linking

### Automatic Entity Matching

The sync process automatically links calendar attendees to existing MCP entities:

```
┌────────────────────────────────────────────────────────────┐
│  Calendar Event: Project Kickoff                           │
├────────────────────────────────────────────────────────────┤
│  Attendees:                                                │
│  • alice@example.com                                       │
│  • bob@company.com                                         │
│  • carol@startup.io                                        │
└────────────────────────────────────────────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────────────────┐
│  Entity Matching (by email)                                │
├────────────────────────────────────────────────────────────┤
│  ✅ alice@example.com  → Entity: Alice Johnson (ID: 123)  │
│  ✅ bob@company.com    → Entity: Bob Smith (ID: 456)      │
│  ❌ carol@startup.io   → No match found                   │
└────────────────────────────────────────────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────────────────┐
│  Store Event with Attendee Links                           │
├────────────────────────────────────────────────────────────┤
│  Event ID: project-kickoff-20251007                        │
│  Attendees JSON:                                           │
│  [                                                         │
│    {                                                       │
│      "email": "alice@example.com",                        │
│      "name": "Alice Johnson",                             │
│      "entityId": "123",                                   │
│      "responseStatus": "accepted"                         │
│    },                                                      │
│    {                                                       │
│      "email": "bob@company.com",                          │
│      "name": "Bob Smith",                                 │
│      "entityId": "456",                                   │
│      "responseStatus": "accepted"                         │
│    },                                                      │
│    {                                                       │
│      "email": "carol@startup.io",                         │
│      "name": "Carol White",                               │
│      "entityId": null,                                    │
│      "responseStatus": "needsAction"                      │
│    }                                                       │
│  ]                                                         │
└────────────────────────────────────────────────────────────┘
```

### Benefits of Entity Linking

1. **Relationship Mapping**: Build professional network graph
2. **Meeting History**: See all meetings with a specific person
3. **Context for AI**: AI assistant knows who you met with
4. **Smart Suggestions**: Suggest relevant contacts based on past meetings

### Creating Entities for Unknown Attendees

Use `--create-entities` to automatically create entities:

```bash
mcp-memory google calendar-sync \
  --user-email bob@example.com \
  --create-entities
```

This creates a basic entity:
```json
{
  "name": "Carol White",
  "email": "carol@startup.io",
  "entity_type": "PERSON",
  "importance": "NORMAL",
  "metadata": {
    "source": "google_calendar",
    "firstSeenAt": "2025-10-07T14:30:00Z"
  }
}
```

## Event Querying

### CLI Queries

**Get events for a week**:
```bash
mcp-memory get-calendar-events \
  --user-email bob@example.com \
  --week 2025-41
```

**Get events in date range**:
```bash
mcp-memory get-calendar-events \
  --user-email bob@example.com \
  --start-date 2025-10-01 \
  --end-date 2025-10-31
```

**Search events by keyword**:
```bash
mcp-memory search-calendar-events \
  --user-email bob@example.com \
  --query "standup"
```

**Get events with specific attendee**:
```bash
mcp-memory get-calendar-events \
  --user-email bob@example.com \
  --attendee alice@example.com
```

### API Queries

Use the REST API for programmatic access:

**Get events for a week**:
```bash
curl http://localhost:3000/api/google/calendar/events?week=2025-41 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Search events**:
```bash
curl http://localhost:3000/api/google/calendar/events/search?q=standup \
  -H "Authorization: Bearer YOUR_TOKEN"
```

See [Google API Reference](../api/GOOGLE_API_REFERENCE.md) for complete API documentation.

### SQL Queries

Direct database queries for advanced use:

```sql
-- Get all events for a week
SELECT * FROM calendar_events
WHERE user_id = 'bob@example.com'
  AND week_identifier = '2025-41'
ORDER BY start_time;

-- Find meetings with specific person
SELECT e.*
FROM calendar_events e
WHERE user_id = 'bob@example.com'
  AND attendees LIKE '%alice@example.com%'
ORDER BY start_time DESC;

-- Count meetings per week
SELECT week_identifier, COUNT(*) as meeting_count
FROM calendar_events
WHERE user_id = 'bob@example.com'
GROUP BY week_identifier
ORDER BY week_identifier DESC;

-- Find recurring meetings
SELECT summary, COUNT(*) as occurrences
FROM calendar_events
WHERE user_id = 'bob@example.com'
  AND is_recurring = 1
GROUP BY recurring_event_id
ORDER BY occurrences DESC;
```

## Best Practices

### Sync Frequency

**Weekly Sync (Recommended)**:
```bash
# Cron: Every Monday at 9 AM
0 9 * * 1 mcp-memory google calendar-sync -u bob@example.com
```

**Daily Sync (Active Users)**:
```bash
# Cron: Every day at 6 AM
0 6 * * * mcp-memory google calendar-sync -u bob@example.com
```

**On-Demand Sync**:
- Before important meetings
- After major calendar changes
- When AI assistant needs updated context

### Data Management

1. **Regular cleanup**:
   ```sql
   -- Delete events older than 1 year
   DELETE FROM calendar_events
   WHERE start_time < DATE('now', '-1 year');
   ```

2. **Archive old events**:
   ```bash
   # Export events before deletion
   mcp-memory export-calendar-events \
     --user-email bob@example.com \
     --before 2024-01-01 \
     -o archived-events.json
   ```

3. **Monitor storage**:
   ```sql
   -- Check event count and size
   SELECT COUNT(*) as event_count,
          SUM(LENGTH(attendees)) as storage_bytes
   FROM calendar_events
   WHERE user_id = 'bob@example.com';
   ```

### Privacy and Security

1. **Selective sync**: Only sync necessary calendars
2. **Exclude private events**: Use Google Calendar visibility settings
3. **Review attendee data**: Be aware of who's being tracked
4. **Regular audits**: Check what's synced periodically

## Advanced Usage

### Batch Sync Multiple Users

Sync calendars for multiple users:

```bash
#!/bin/bash
# batch-calendar-sync.sh

USERS=(
  "alice@example.com"
  "bob@example.com"
  "carol@example.com"
)

for user in "${USERS[@]}"; do
  echo "Syncing calendar for $user..."
  mcp-memory google calendar-sync \
    --user-email "$user" \
    --create-entities
  echo "✅ $user sync complete"
  sleep 2  # Rate limiting
done

echo "🎉 All users synced!"
```

### Historical Sync

Sync entire year's events:

```bash
#!/bin/bash
# sync-year.sh

YEAR=2025
USER="bob@example.com"

# Generate all weeks for the year
for week in {1..52}; do
  WEEK_ID=$(printf "%d-%02d" $YEAR $week)
  echo "Syncing week $WEEK_ID..."
  mcp-memory google calendar-sync \
    --user-email "$USER" \
    --week "$WEEK_ID"
  sleep 1  # Rate limiting
done

echo "✅ Year $YEAR sync complete!"
```

### Custom Event Processing

Process events after sync:

```typescript
import { CalendarOperations } from 'mcp-memory-ts';

const calOps = new CalendarOperations(db);

// Sync events
const events = await syncService.syncWeek({
  userId: 'bob@example.com',
  weekIdentifier: '2025-41',
});

// Custom processing
for (const event of events) {
  // Extract attendees
  const attendees = JSON.parse(event.attendees || '[]');

  // Create relationship links
  for (const attendee of attendees) {
    if (attendee.entityId) {
      await createRelationship(event, attendee.entityId);
    }
  }

  // Extract action items from meeting notes
  if (event.description) {
    const actionItems = extractActionItems(event.description);
    await storeActionItems(event.id, actionItems);
  }
}
```

## Troubleshooting

### No Events Found

**Issue**: Sync completes but 0 events imported

**Solutions**:

1. **Check week has events**:
   - Open Google Calendar
   - Verify events exist in the selected week

2. **Verify calendar ID**:
   ```bash
   # List available calendars
   curl https://www.googleapis.com/calendar/v3/users/me/calendarList \
     -H "Authorization: Bearer YOUR_TOKEN"
   ```

3. **Check calendar visibility**:
   - Ensure calendar is not hidden
   - Verify events are not marked as private

### Attendees Not Linked

**Issue**: Attendees in events but not linked to entities

**Solutions**:

1. **Check email matching**:
   ```sql
   -- Find entities with matching email
   SELECT * FROM entities
   WHERE user_id = 'bob@example.com'
     AND email = 'alice@example.com';
   ```

2. **Create entities manually**:
   ```bash
   mcp-memory create-entity \
     --user-email bob@example.com \
     --name "Alice Johnson" \
     --email alice@example.com \
     --type PERSON
   ```

3. **Use auto-create**:
   ```bash
   # Re-sync with entity creation
   mcp-memory google calendar-sync \
     -u bob@example.com \
     --create-entities
   ```

### Recurring Events Not Expanded

**Issue**: Only seeing one instance of recurring events

**Solutions**:

1. **Remove `--skip-recurring` flag**:
   ```bash
   # Don't use this flag
   mcp-memory google calendar-sync -u bob@example.com
   ```

2. **Check recurrence rules**:
   ```sql
   SELECT recurrence FROM calendar_events
   WHERE is_recurring = 1 LIMIT 1;
   ```

3. **Verify Google Calendar has recurrence**:
   - Open event in Google Calendar
   - Check "Repeat" settings

### Sync is Slow

**Issue**: Calendar sync takes too long

**Solutions**:

1. **Limit calendar sources**:
   ```bash
   # Sync only primary calendar
   mcp-memory google calendar-sync \
     -u bob@example.com \
     --calendar-ids primary
   ```

2. **Reduce event count**:
   ```bash
   # Limit to 100 events
   mcp-memory google calendar-sync \
     -u bob@example.com \
     --max-events 100
   ```

3. **Skip entity creation**:
   ```bash
   # Don't auto-create entities
   mcp-memory google calendar-sync \
     -u bob@example.com
   ```

## Related Documentation

- **[Google Sync Overview](../features/GOOGLE_SYNC.md)**: Feature overview
- **[Google Setup Guide](./GOOGLE_SETUP_GUIDE.md)**: Initial setup
- **[Google Contacts Sync Guide](./GOOGLE_CONTACTS_SYNC_GUIDE.md)**: Contacts sync
- **[Google API Reference](../api/GOOGLE_API_REFERENCE.md)**: API documentation
- **[CLI Guide](./CLI-GUIDE.md)**: Complete CLI reference

---

**Need Help?**

- **Documentation**: Check guides linked above
- **Debug Mode**: Use `DEBUG=* mcp-memory google calendar-sync ...`
- **GitHub Issues**: [File a bug report](https://github.com/your-org/mcp-memory-ts/issues)
- **Community**: [Join our Discord](https://discord.gg/your-server)

**Last Updated**: 2025-10-09
**Version**: 1.7.0
