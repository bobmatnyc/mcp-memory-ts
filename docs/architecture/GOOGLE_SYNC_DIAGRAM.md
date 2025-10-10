# Google Sync Architecture Diagram

**Version**: 1.0.0
**Date**: 2025-10-09

## System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           USER INTERFACES                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│   ┌──────────────┐        ┌──────────────┐        ┌──────────────┐         │
│   │  Web UI      │        │  CLI Tool    │        │  MCP Server  │         │
│   │  (Next.js)   │        │  (mcp-memory)│        │  (Claude)    │         │
│   └──────┬───────┘        └──────┬───────┘        └──────┬───────┘         │
│          │                       │                       │                   │
└──────────┼───────────────────────┼───────────────────────┼───────────────────┘
           │                       │                       │
           ▼                       ▼                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         AUTHENTICATION LAYER                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│   ┌────────────────────────────────────────────────────────────────┐        │
│   │                    GoogleAuthService                            │        │
│   │  • Generate OAuth URLs                                          │        │
│   │  • Exchange code for tokens                                     │        │
│   │  • Auto-refresh expired tokens                                  │        │
│   │  • Store/retrieve from user.metadata                            │        │
│   └────────────┬───────────────────────────────────────────────────┘        │
│                │                                                              │
│                ├─── Scopes:                                                  │
│                │    • contacts (read/write)                                  │
│                │    • calendar.readonly                                      │
│                │    • gmail.readonly                                         │
│                │                                                              │
└────────────────┼──────────────────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         GOOGLE API CLIENTS                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│   ┌───────────────────┐   ┌────────────────────┐   ┌──────────────────┐    │
│   │ GooglePeopleClient│   │GoogleCalendarClient│   │   GmailClient    │    │
│   │                   │   │                    │   │   (existing)     │    │
│   │ • listContacts    │   │ • getEventsForWeek │   │ • getEmails      │    │
│   │ • createContact   │   │ • singleEvents=true│   │ • week-based     │    │
│   │ • updateContact   │   │ • timeMin/timeMax  │   │                  │    │
│   │ • syncToken logic │   │ • map attendees    │   │                  │    │
│   └─────────┬─────────┘   └──────────┬─────────┘   └────────┬─────────┘    │
│             │                        │                       │               │
│             │                        │                       │               │
└─────────────┼────────────────────────┼───────────────────────┼───────────────┘
              │                        │                       │
              ▼                        ▼                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         SYNC SERVICES LAYER                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│   ┌──────────────────────────────────────────────────────────────────┐      │
│   │            GoogleContactsSyncService                              │      │
│   │  ┌─────────────────┐         ┌──────────────────────┐           │      │
│   │  │ Import Flow     │         │ Export Flow          │           │      │
│   │  │                 │         │                      │           │      │
│   │  │ 1. Get syncToken│         │ 1. Get PERSON        │           │      │
│   │  │ 2. API call     │         │    entities          │           │      │
│   │  │ 3. Map to Entity│         │ 2. Get Google        │           │      │
│   │  │ 4. LLM dedup    │         │    contacts          │           │      │
│   │  │ 5. UUID match   │         │ 3. Match (UUID)      │           │      │
│   │  │ 6. Update/Create│         │ 4. Update/Create     │           │      │
│   │  │ 7. Store token  │         │    in Google         │           │      │
│   │  └─────────────────┘         └──────────────────────┘           │      │
│   └──────────────────────────────────────────────────────────────────┘      │
│                                                                               │
│   ┌──────────────────────────────────────────────────────────────────┐      │
│   │            GoogleCalendarSyncService                              │      │
│   │  ┌──────────────────────────────────────────────────────┐        │      │
│   │  │ Weekly Sync Flow                                      │        │      │
│   │  │                                                        │        │      │
│   │  │ 1. Get week dates (YYYY-WW)                          │        │      │
│   │  │ 2. Fetch events (timeMin/timeMax)                    │        │      │
│   │  │ 3. Expand recurring events                            │        │      │
│   │  │ 4. Store in calendar_events table                    │        │      │
│   │  │ 5. Link attendees to entities (by email)             │        │      │
│   │  │ 6. Update entity.lastInteraction                      │        │      │
│   │  └──────────────────────────────────────────────────────┘        │      │
│   └──────────────────────────────────────────────────────────────────┘      │
│                                                                               │
└───────────────────────────────┬───────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      DEDUPLICATION & MATCHING                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│   ┌────────────────────────┐         ┌─────────────────────────┐           │
│   │  LLM Deduplication     │         │  UUID Matching          │           │
│   │  (Reused from macOS)   │         │  (Reused from macOS)    │           │
│   │                        │         │                         │           │
│   │  batchCheckDuplicates()│         │  matchContacts()        │           │
│   │  • ChatGPT-4 analysis  │         │  • Extract MCP UUID     │           │
│   │  • Confidence scoring  │         │  • Extract Google ID    │           │
│   │  • Batch processing    │         │  • Find matches         │           │
│   └────────────────────────┘         └─────────────────────────┘           │
│                                                                               │
│   ┌────────────────────────────────────────────────────────────────┐        │
│   │  Conflict Resolution (Reused from macOS)                        │        │
│   │  • hasConflict()                                                │        │
│   │  • resolveConflict(strategy)                                    │        │
│   │  • User preferences: 'google' | 'mcp' | 'manual'               │        │
│   └────────────────────────────────────────────────────────────────┘        │
│                                                                               │
└───────────────────────────────┬───────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         DATABASE LAYER                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│   ┌────────────────┐   ┌─────────────────┐   ┌──────────────────────┐      │
│   │ users          │   │ entities        │   │ calendar_events      │      │
│   │ ─────────────  │   │ ──────────────  │   │ ───────────────────  │      │
│   │ id             │   │ id              │   │ id                   │      │
│   │ email          │   │ user_id (FK)    │   │ user_id (FK)         │      │
│   │ metadata ◄─────┼───┤ name            │   │ week_identifier      │      │
│   │   {            │   │ entity_type     │   │ event_id             │      │
│   │     google     │   │ email           │   │ summary              │      │
│   │     OAuthTokens│   │ phone           │   │ start_time           │      │
│   │     syncToken  │   │ metadata ◄──────┼───┤ attendees (JSON)     │      │
│   │   }            │   │   {             │   │ recurrence (JSON)    │      │
│   └────────────────┘   │     google      │   │ is_recurring         │      │
│                        │     ResourceName│   └──────────────────────┘      │
│                        │     googleEtag  │                                  │
│                        │     calendar    │                                  │
│                        │     Events[]    │                                  │
│                        │   }             │                                  │
│                        └─────────────────┘                                  │
│                                                                               │
│   Indexes:                                                                   │
│   • users(email)                                                             │
│   • entities(user_id, entity_type)                                           │
│   • calendar_events(user_id, week_identifier)                               │
│   • calendar_events(user_id, start_time DESC)                               │
│                                                                               │
└─────────────────────────────────────────────────────────────────────────────┘


                               EXTERNAL SERVICES
                               ─────────────────

         ┌──────────────────┐         ┌──────────────────┐
         │  Google People   │         │ Google Calendar  │
         │  API             │         │ API              │
         │                  │         │                  │
         │ • Contacts CRUD  │         │ • Events listing │
         │ • syncToken      │         │ • Recurring      │
         │ • Batch ops      │         │   expansion      │
         └──────────────────┘         └──────────────────┘

                 ┌────────────────────────────┐
                 │  Google OAuth 2.0          │
                 │                            │
                 │ • Authorization            │
                 │ • Token exchange           │
                 │ • Auto-refresh             │
                 └────────────────────────────┘
```

---

## Data Flow Diagrams

### 1. OAuth Flow

```
User                     Web UI                  GoogleAuthService      Google OAuth
 │                        │                           │                     │
 │── Click "Connect" ────>│                           │                     │
 │                        │                           │                     │
 │                        │── generateAuthUrl() ─────>│                     │
 │                        │                           │                     │
 │                        │<── Auth URL ──────────────│                     │
 │                        │                           │                     │
 │<── Redirect ──────────────────────────────────────────────────────────>│
 │                        │                           │                     │
 │── Grant Permissions ──────────────────────────────────────────────────>│
 │                        │                           │                     │
 │<── Callback (/callback?code=xyz) ──────────────────────────────────────│
 │                        │                           │                     │
 │                        │── getTokensFromCode() ───>│                     │
 │                        │                           │                     │
 │                        │                           │── Exchange code ───>│
 │                        │                           │                     │
 │                        │                           │<── Tokens ──────────│
 │                        │                           │                     │
 │                        │<── Tokens ────────────────│                     │
 │                        │                           │                     │
 │                        │── storeTokens() ─────────>│                     │
 │                        │                           │                     │
 │                        │                           │── Update user       │
 │                        │                           │   metadata ────────>│
 │                        │                           │                  [DB]
 │<── Success ────────────│                           │                     │
```

### 2. Google Contacts Import (Incremental Sync)

```
SyncService          Database          PeopleClient        Google API        LLM
    │                   │                    │                   │             │
    │── Get syncToken ──>│                   │                   │             │
    │                   │                    │                   │             │
    │<── "token123" ────│                    │                   │             │
    │                   │                    │                   │             │
    │── listContacts(syncToken) ───────────>│                   │             │
    │                   │                    │                   │             │
    │                   │                    │── API call ──────>│             │
    │                   │                    │   (only changes)  │             │
    │                   │                    │                   │             │
    │                   │                    │<── Modified ──────│             │
    │                   │                    │   contacts +      │             │
    │                   │                    │   new syncToken   │             │
    │                   │                    │                   │             │
    │<── Contacts + new token ──────────────│                   │             │
    │                   │                    │                   │             │
    │── Map to entities ─                   │                   │             │
    │                   │                    │                   │             │
    │── Get existing ───>│                   │                   │             │
    │   entities        │                    │                   │             │
    │                   │                    │                   │             │
    │<── Entities ───────│                   │                   │             │
    │                   │                    │                   │             │
    │── batchCheckDuplicates() ───────────────────────────────────────────────>│
    │                   │                    │                   │             │
    │<── Dedup results ───────────────────────────────────────────────────────│
    │                   │                    │                   │             │
    │── UUID matching ──                    │                   │             │
    │                   │                    │                   │             │
    │── updateEntity() ──>│                  │                   │             │
    │                   │                    │                   │             │
    │── createEntity() ──>│                  │                   │             │
    │                   │                    │                   │             │
    │── Store new       │                    │                   │             │
    │   syncToken ──────>│                   │                   │             │
    │                   │                    │                   │             │
```

### 3. Google Calendar Weekly Sync

```
CalendarService     CalendarClient      Google API      CalendarDB      EntityDB
      │                   │                   │              │              │
      │── getEventsForWeek("2025-41") ───────>│              │              │
      │                   │                   │              │              │
      │                   │── Calculate week dates ─         │              │
      │                   │   start: Oct 6, end: Oct 12      │              │
      │                   │                   │              │              │
      │                   │── API call ──────>│              │              │
      │                   │   timeMin: Oct 6  │              │              │
      │                   │   timeMax: Oct 12 │              │              │
      │                   │   singleEvents: true            │              │
      │                   │                   │              │              │
      │                   │<── Events ────────│              │              │
      │                   │   (expanded recurring)          │              │
      │                   │                   │              │              │
      │<── Mapped events ─│                   │              │              │
      │                   │                   │              │              │
      │── FOR EACH event ────────────────────────────────────              │
      │   │                                                                  │
      │   │── createEvent() ──────────────────────────────>│                │
      │   │                                                 │                │
      │   │── FOR EACH attendee ──────────────────────────────────────────>│
      │   │   │                                             │                │
      │   │   │── Find entity by email ────────────────────────────────────>│
      │   │   │                                             │                │
      │   │   │<── Entity (if exists) ──────────────────────────────────────│
      │   │   │                                             │                │
      │   │   │── updateEntity(                             │                │
      │   │   │   metadata.calendarEvents += eventId,       │                │
      │   │   │   lastInteraction = event.start             │                │
      │   │   │   ) ────────────────────────────────────────────────────────>│
      │   │   │                                             │                │
```

---

## Component Relationships

```
┌─────────────────────────────────────────────────────────────────────┐
│                         REUSED COMPONENTS                            │
│                         (70% of codebase)                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌────────────────────┐    ┌─────────────────────┐                  │
│  │ LLM Deduplication  │    │ UUID Matching       │                  │
│  │ ─────────────────  │    │ ──────────────────  │                  │
│  │ • batchCheck       │    │ • matchContacts()   │                  │
│  │   Duplicates()     │    │ • extractMcpUuid()  │                  │
│  │ • ChatGPT-4        │    │                     │                  │
│  └────────────────────┘    └─────────────────────┘                  │
│            ▲                         ▲                               │
│            │                         │                               │
│            └─────────────┬───────────┘                               │
│                          │                                           │
│                ┌─────────▼────────────┐                              │
│                │  Conflict Resolution │                              │
│                │  ─────────────────── │                              │
│                │  • hasConflict()     │                              │
│                │  • resolveConflict() │                              │
│                └──────────────────────┘                              │
│                                                                       │
│  ┌─────────────────────┐    ┌──────────────────────┐                │
│  │ Week Calculator     │    │ OAuth Token Pattern  │                │
│  │ ──────────────────  │    │ ───────────────────  │                │
│  │ • getWeekDates()    │    │ • Token storage      │                │
│  │ • getWeekId()       │    │ • Auto-refresh       │                │
│  └─────────────────────┘    └──────────────────────┘                │
│                                                                       │
└───────────────────────────────┬───────────────────────────────────────┘
                                │
                                │ USED BY
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         NEW COMPONENTS                               │
│                         (30% of codebase)                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌──────────────────────┐    ┌───────────────────────┐              │
│  │ GoogleAuthService    │    │ GooglePeopleClient    │              │
│  │ ───────────────────  │    │ ────────────────────  │              │
│  │ • OAuth URLs         │    │ • listContacts()      │              │
│  │ • Token exchange     │    │ • syncToken logic     │              │
│  │ • Auto-refresh       │    │ • CRUD operations     │              │
│  └──────────────────────┘    └───────────────────────┘              │
│                                                                       │
│  ┌──────────────────────┐    ┌───────────────────────┐              │
│  │ GoogleCalendarClient │    │ CalendarOperations    │              │
│  │ ───────────────────  │    │ ────────────────────  │              │
│  │ • getEventsForWeek() │    │ • createEvent()       │              │
│  │ • Expand recurring   │    │ • getEventsForWeek()  │              │
│  └──────────────────────┘    └───────────────────────┘              │
│                                                                       │
│  ┌──────────────────────────────────────────────┐                    │
│  │ Sync Services                                │                    │
│  │ ───────────────────────────────────────────  │                    │
│  │ • GoogleContactsSyncService                  │                    │
│  │ • GoogleCalendarSyncService                  │                    │
│  └──────────────────────────────────────────────┘                    │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Error Flow & Recovery

```
                          ERROR SCENARIOS

┌─────────────────────────────────────────────────────────────┐
│                    EXPIRED_SYNC_TOKEN                        │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  listContacts(expiredToken)                                  │
│         │                                                     │
│         ▼                                                     │
│  Google API returns 410 GONE                                │
│         │                                                     │
│         ▼                                                     │
│  Catch error, check type === 'EXPIRED_SYNC_TOKEN'           │
│         │                                                     │
│         ▼                                                     │
│  Log: "Sync token expired, performing full sync"            │
│         │                                                     │
│         ▼                                                     │
│  Recursively call importFromGoogle(forceFull: true)         │
│         │                                                     │
│         ▼                                                     │
│  listContacts(syncToken: undefined)                          │
│         │                                                     │
│         ▼                                                     │
│  Full sync with all contacts                                 │
│         │                                                     │
│         ▼                                                     │
│  Store new syncToken for future incremental syncs           │
│                                                               │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                       RATE_LIMIT                             │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  API call                                                    │
│         │                                                     │
│         ▼                                                     │
│  Google API returns 429 Too Many Requests                   │
│  Headers: { "Retry-After": "120" }                          │
│         │                                                     │
│         ▼                                                     │
│  Parse retryAfter from headers                              │
│         │                                                     │
│         ▼                                                     │
│  getRecoveryStrategy(error)                                  │
│  Returns: {shouldRetry: true, retryDelay: 120000}           │
│         │                                                     │
│         ▼                                                     │
│  Wait 120 seconds (retryDelay)                              │
│         │                                                     │
│         ▼                                                     │
│  Retry API call                                              │
│         │                                                     │
│         ▼                                                     │
│  Success or fail (max 3 retries)                            │
│                                                               │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    NETWORK_ERROR                             │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  API call                                                    │
│         │                                                     │
│         ▼                                                     │
│  Network timeout or connection error                        │
│         │                                                     │
│         ▼                                                     │
│  retryWithBackoff(fn, {                                      │
│    maxRetries: 3,                                            │
│    initialDelay: 1000,                                       │
│    maxDelay: 30000                                           │
│  })                                                          │
│         │                                                     │
│         ▼                                                     │
│  ┌─── Attempt 1: Wait 1s, retry                            │
│  │    ▼                                                      │
│  │    Fail → Attempt 2: Wait 2s, retry                     │
│  │    ▼                                                      │
│  │    Fail → Attempt 3: Wait 4s, retry                     │
│  │    ▼                                                      │
│  └─── Success or final failure                              │
│                                                               │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                     AUTH_ERROR                               │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  API call with expired access token                         │
│         │                                                     │
│         ▼                                                     │
│  Google API returns 401 Unauthorized                        │
│         │                                                     │
│         ▼                                                     │
│  OAuth2Client 'tokens' event triggered                      │
│         │                                                     │
│         ▼                                                     │
│  Auto-refresh using refresh_token                           │
│         │                                                     │
│         ▼                                                     │
│  Get new access_token from Google                           │
│         │                                                     │
│         ▼                                                     │
│  Update user.metadata with new tokens                       │
│         │                                                     │
│         ▼                                                     │
│  Retry original API call with new token                     │
│         │                                                     │
│         ▼                                                     │
│  Success or manual re-authentication required               │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## Performance Optimization Points

```
┌──────────────────────────────────────────────────────────────┐
│                   OPTIMIZATION LAYERS                         │
└──────────────────────────────────────────────────────────────┘

LAYER 1: API Optimization
┌────────────────────────────────────────────────────────────┐
│ • Incremental sync with syncToken (avg 50-200ms)           │
│ • Batch operations (200 contacts/request)                  │
│ • Parallel requests where possible                         │
│ • Request deduplication                                    │
└────────────────────────────────────────────────────────────┘
                           │
                           ▼
LAYER 2: Database Optimization
┌────────────────────────────────────────────────────────────┐
│ • Composite indexes for common queries                     │
│   - entities(user_id, entity_type)                         │
│   - calendar_events(user_id, week_identifier)             │
│ • Transaction-based batch inserts                          │
│ • Connection pooling                                       │
└────────────────────────────────────────────────────────────┘
                           │
                           ▼
LAYER 3: Processing Optimization
┌────────────────────────────────────────────────────────────┐
│ • LLM batch processing (100 pairs at a time)               │
│ • UUID matching before LLM (faster fallback)               │
│ • Async embedding generation (queued)                      │
│ • Memoized week calculations                               │
└────────────────────────────────────────────────────────────┘
                           │
                           ▼
LAYER 4: Caching
┌────────────────────────────────────────────────────────────┐
│ • OAuth tokens cached in user metadata                     │
│ • syncToken stored for incremental sync                    │
│ • Entity lookups with indexed queries                      │
│ • Week date calculations memoized                          │
└────────────────────────────────────────────────────────────┘

PERFORMANCE TARGETS:
─────────────────────
• 1000 contacts sync: < 30 seconds
• Incremental sync: 50-200ms (10-50 changes)
• Full sync: 5-15s (1000 contacts)
• Calendar week sync: < 10 seconds
• Token refresh: < 500ms
• LLM deduplication: < 5s per 100 pairs
```

---

## Security Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                       SECURITY LAYERS                            │
└─────────────────────────────────────────────────────────────────┘

LAYER 1: Authentication
┌───────────────────────────────────────────────────────────────┐
│ ┌────────────────┐         ┌──────────────────────┐          │
│ │ Clerk Auth     │         │ Google OAuth 2.0     │          │
│ │ ─────────────  │         │ ───────────────────  │          │
│ │ • Session      │         │ • Authorization code │          │
│ │   management   │  ◄────► │   flow               │          │
│ │ • JWT tokens   │         │ • Refresh tokens     │          │
│ └────────────────┘         └──────────────────────┘          │
└───────────────────────────────────────────────────────────────┘
                              │
                              ▼
LAYER 2: Data Protection
┌───────────────────────────────────────────────────────────────┐
│ User Isolation:                                                │
│   • All queries filtered by user_id                           │
│   • Foreign key constraints enforced                          │
│   • Multi-tenant architecture                                 │
│                                                                │
│ Token Security:                                                │
│   • Stored encrypted in Turso database                        │
│   • Never logged in error messages                            │
│   • Auto-rotation on refresh                                  │
│                                                                │
│ PII Protection:                                                │
│   • No sensitive data in logs                                 │
│   • HTTPS only for all API calls                              │
│   • Data minimization principle                               │
└───────────────────────────────────────────────────────────────┘
                              │
                              ▼
LAYER 3: API Security
┌───────────────────────────────────────────────────────────────┐
│ Rate Limiting:                                                 │
│   • Per-user quotas tracked                                   │
│   • Exponential backoff on 429                                │
│   • Circuit breaker pattern                                   │
│                                                                │
│ Input Validation:                                              │
│   • Zod schemas for all inputs                                │
│   • Sanitize before database storage                          │
│   • Type-safe API boundaries                                  │
│                                                                │
│ Scope Validation:                                              │
│   • Check scopes before operations                            │
│   • Minimal privilege principle                               │
│   • Explicit user consent                                     │
└───────────────────────────────────────────────────────────────┘
                              │
                              ▼
LAYER 4: Audit & Monitoring
┌───────────────────────────────────────────────────────────────┐
│ • Sync operations logged with timestamps                      │
│ • OAuth token refresh tracked                                 │
│ • API quota usage monitored                                   │
│ • Failed authentication attempts logged                       │
│ • Error types analyzed for security issues                    │
└───────────────────────────────────────────────────────────────┘
```

---

## Deployment Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                       DEPLOYMENT TOPOLOGY                        │
└─────────────────────────────────────────────────────────────────┘

                         ┌──────────────────┐
                         │   End Users      │
                         └────────┬─────────┘
                                  │
                ┌─────────────────┴─────────────────┐
                │                                    │
                ▼                                    ▼
    ┌──────────────────────┐          ┌──────────────────────┐
    │   Web Interface      │          │   CLI Tool           │
    │   (Vercel/Netlify)   │          │   (Local/Server)     │
    │                      │          │                      │
    │   Next.js App        │          │   mcp-memory         │
    │   Port: 3000         │          │   commands           │
    └──────────┬───────────┘          └──────────┬───────────┘
               │                                  │
               │         ┌────────────────────────┘
               │         │
               ▼         ▼
    ┌─────────────────────────────────────────────┐
    │          API Layer (Next.js API Routes)     │
    │                                              │
    │  /api/auth/google          → OAuth init     │
    │  /api/auth/google/callback → OAuth callback │
    │  /api/google-sync/contacts → Sync trigger   │
    │  /api/google-sync/calendar → Calendar sync  │
    └────────────────────┬────────────────────────┘
                         │
                         ▼
    ┌─────────────────────────────────────────────┐
    │          Service Layer                       │
    │                                              │
    │  GoogleAuthService                           │
    │  GoogleContactsSyncService                   │
    │  GoogleCalendarSyncService                   │
    └────────────────────┬────────────────────────┘
                         │
           ┌─────────────┴─────────────┐
           │                           │
           ▼                           ▼
┌────────────────────┐      ┌────────────────────┐
│  Google APIs       │      │  Database          │
│                    │      │  (Turso/LibSQL)    │
│  • People API      │      │                    │
│  • Calendar API    │      │  Tables:           │
│  • OAuth 2.0       │      │  • users           │
└────────────────────┘      │  • entities        │
                            │  • calendar_events │
                            └────────────────────┘

DEPLOYMENT OPTIONS:
───────────────────

1. Web Interface:
   • Vercel (recommended)
   • Netlify
   • Self-hosted (PM2/Docker)

2. CLI Tool:
   • npm global install
   • npx execution
   • Docker container

3. MCP Server:
   • Claude Desktop integration
   • Local process (stdio)
   • Remote MCP server (SSE)

4. Database:
   • Turso (cloud)
   • Local LibSQL (development)
   • Docker LibSQL (self-hosted)
```

This visual architecture provides a comprehensive overview of the Google sync system design, data flows, error handling, and deployment topology.
