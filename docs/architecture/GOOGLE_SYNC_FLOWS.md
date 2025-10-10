# Google Sync Sequence Diagrams

**Version**: 1.0.0
**Date**: 2025-10-09

This document provides detailed sequence diagrams for all Google sync operations.

## Table of Contents

1. [OAuth 2.0 Flow](#1-oauth-20-flow)
2. [Google Contacts Incremental Sync](#2-google-contacts-incremental-sync)
3. [Google Contacts Full Sync (Fallback)](#3-google-contacts-full-sync-fallback)
4. [Google Calendar Weekly Sync](#4-google-calendar-weekly-sync)
5. [Error Recovery Flows](#5-error-recovery-flows)

---

## 1. OAuth 2.0 Flow

### 1.1 Initial OAuth Connection

```
User                Web UI              OAuth API          Google OAuth       Database
  |                   |                    |                    |                |
  |-- Click Connect --|                    |                    |                |
  |                   |                    |                    |                |
  |                   |-- GET /api/auth/google --------------->  |                |
  |                   |                    |                    |                |
  |                   |                    |-- Generate Auth URL (with scopes) ->|
  |                   |                    |                    |                |
  |                   |<-------------------- 302 Redirect ----------------------- |
  |                   |                    |                    |                |
  |<-- Redirect to Google Consent Screen ----------------------------------------|
  |                   |                    |                    |                |
  |-- Grant Permissions -------------------------------------------------->      |
  |                   |                    |                    |                |
  |<-- Redirect to /api/auth/google/callback?code=xyz&state=userId -------------|
  |                   |                    |                    |                |
  |                   |-- POST /api/auth/google/callback ------>|                |
  |                   |                    |                    |                |
  |                   |                    |-- Exchange code for tokens -------->|
  |                   |                    |                    |                |
  |                   |                    |<--- Return tokens -----------------|
  |                   |                    |   {                                 |
  |                   |                    |     access_token,                   |
  |                   |                    |     refresh_token,                  |
  |                   |                    |     expiry_date                     |
  |                   |                    |   }                                 |
  |                   |                    |                    |                |
  |                   |                    |-- Store tokens in user.metadata -->|
  |                   |                    |                    |                |
  |                   |<------------------- 302 /dashboard?google_connected=true |
  |                   |                    |                    |                |
  |<-- Success Notification ------------------------------------------------------|
```

### 1.2 Token Refresh Flow (Automatic)

```
Sync Service        OAuth Client        Google OAuth       Database
     |                   |                    |                |
     |-- getAuthClient(userId) -->           |                |
     |                   |                    |                |
     |                   |-- Load tokens from DB ------------->|
     |                   |                    |                |
     |                   |<-- Return tokens -------------------|
     |                   |                    |                |
     |                   |-- Check token expiry              |
     |                   |   (expiry_date < now)            |
     |                   |                    |                |
     |                   |-- Refresh token ------------------>|
     |                   |   (using refresh_token)           |
     |                   |                    |                |
     |                   |<-- New tokens --------------------|
     |                   |   {                                 |
     |                   |     access_token,                   |
     |                   |     expiry_date                     |
     |                   |   }                                 |
     |                   |                    |                |
     |                   |-- Update user.metadata ----------->|
     |                   |                    |                |
     |<-- Return authenticated client ------------------------|
```

---

## 2. Google Contacts Incremental Sync

### 2.1 Import Flow (Google → MCP Memory)

```
CLI/Web             SyncService         PeopleClient        Google API         Database          LLM Service
   |                    |                    |                    |                |                 |
   |-- sync(import) --->|                    |                    |                |                 |
   |                    |                    |                    |                |                 |
   |                    |-- Load syncToken from user.metadata ------------------->|                 |
   |                    |                    |                    |                |                 |
   |                    |<-- syncToken: "abc123" ---------------------------------|                 |
   |                    |                    |                    |                |                 |
   |                    |-- listContacts(syncToken) ------------>|                |                 |
   |                    |                    |                    |                |                 |
   |                    |                    |-- GET /people/me/connections ---->|                 |
   |                    |                    |   ?syncToken=abc123              |                 |
   |                    |                    |                    |                |                 |
   |                    |                    |<-- Return incremental changes ----|                 |
   |                    |                    |   {                                                  |
   |                    |                    |     connections: [modified],                         |
   |                    |                    |     nextSyncToken: "xyz789"                          |
   |                    |                    |   }                                                  |
   |                    |                    |                    |                |                 |
   |                    |<-- {ok: true, data, nextSyncToken} ----|                |                 |
   |                    |                    |                    |                |                 |
   |                    |-- Map Google contacts to Entities ---                  |                 |
   |                    |                    |                    |                |                 |
   |                    |-- Get existing entities ----------------------------------->|                 |
   |                    |                    |                    |                |                 |
   |                    |<-- Existing entities -------------------------------------| |                 |
   |                    |                    |                    |                |                 |
   |                    |-- Batch check duplicates (LLM) --------------------------------------------->|
   |                    |                    |                    |                |                 |
   |                    |<-- Deduplication results -------------------------------------------------|
   |                    |   [{isDuplicate: true, confidence: 0.95}]                                |
   |                    |                    |                    |                |                 |
   |                    |-- UUID-based matching (extractMcpUuid) ----------------                  |
   |                    |                    |                    |                |                 |
   |                    |-- FOR EACH matched contact ----------                   |                 |
   |                    |   |-- updateEntity(id, updates, userId) ---------------->|                 |
   |                    |   |                                                      |                 |
   |                    |   |<-- Updated entity ----------------------------------| |                 |
   |                    |   |                                                      |                 |
   |                    |                    |                    |                |                 |
   |                    |-- FOR EACH new contact (googleOnly) --                  |                 |
   |                    |   |-- createEntity(newContact) ----------------------->|                 |
   |                    |   |                                                      |                 |
   |                    |   |<-- Created entity with ID --------------------------| |                 |
   |                    |   |                                                      |                 |
   |                    |                    |                    |                |                 |
   |                    |-- Store new syncToken "xyz789" ------------------------->|                 |
   |                    |   in user.metadata                                       |                 |
   |                    |                    |                    |                |                 |
   |<-- Result {imported: 5, updated: 3, syncToken: "xyz789"} -------------------|                 |
```

### 2.2 Export Flow (MCP Memory → Google)

```
SyncService         Database           PeopleClient        Google API
     |                 |                    |                    |
     |-- Get PERSON entities (userId) ----->|                    |
     |                 |                    |                    |
     |<-- personEntities[] ----------------|                    |
     |                 |                    |                    |
     |-- Get Google contacts for matching ->|                    |
     |                 |                    |                    |
     |                 |                    |-- GET /people/me/connections ->|
     |                 |                    |                    |
     |                 |                    |<-- Google contacts ------------|
     |                 |                    |                    |
     |<-- googleContacts[] ---------------|                    |
     |                 |                    |                    |
     |-- matchContacts(personEntities, googleContacts) -         |
     |   (UUID-based matching)                                    |
     |                 |                    |                    |
     |-- FOR EACH matched contact --------                       |
     |   |                                                        |
     |   |-- entityToGoogleContact(entity)                       |
     |   |                                                        |
     |   |-- updateContact(resourceName, contact, updateMask) -->|
     |   |                 |                    |                    |
     |   |                 |                    |-- PATCH /people/{resourceName} ->|
     |   |                 |                    |   updatePersonFields: "names,emailAddresses" |
     |   |                 |                    |                    |
     |   |                 |                    |<-- Updated contact -------------|
     |   |                 |                    |                    |
     |   |<-- {ok: true, data} --------------|                    |
     |   |                                                        |
     |                 |                    |                    |
     |-- FOR EACH new entity (mcpOnly) ---                       |
     |   |                                                        |
     |   |-- createContact(googleContact) ---------------------->|
     |   |                 |                    |                    |
     |   |                 |                    |-- POST /people:createContact ->|
     |   |                 |                    |                    |
     |   |                 |                    |<-- Created contact with resourceName --|
     |   |                 |                    |                    |
     |   |<-- {ok: true, data: {resourceName, etag}} -----------|
     |   |                                                        |
     |   |-- Store resourceName in entity.metadata ------------->|
     |   |                                                        |
     |                 |                    |                    |
     |<-- Result {exported: 8, failed: 0} -----------------------|
```

---

## 3. Google Contacts Full Sync (Fallback)

### 3.1 Expired syncToken Recovery

```
SyncService         PeopleClient        Google API         Database
     |                   |                    |                |
     |-- listContacts(expiredToken) -------->|                |
     |                   |                    |                |
     |                   |-- GET /people/me/connections ------>|
     |                   |   ?syncToken=expired123            |
     |                   |                    |                |
     |                   |<-- 410 GONE: Sync token expired ---|
     |                   |                    |                |
     |<-- {ok: false, error: {type: EXPIRED_SYNC_TOKEN}} ----|
     |                   |                    |                |
     |-- Log: "Sync token expired, performing full sync"      |
     |                   |                    |                |
     |-- Recursively call importFromGoogle(forceFull: true) ->|
     |                   |                    |                |
     |-- listContacts(syncToken: undefined) ---------------->|
     |                   |                    |                |
     |                   |-- GET /people/me/connections ------>|
     |                   |   ?sortOrder=LAST_MODIFIED_DESCENDING |
     |                   |   &requestSyncToken=true             |
     |                   |                    |                |
     |                   |<-- ALL contacts + new syncToken ----|
     |                   |   {                                 |
     |                   |     connections: [all contacts],    |
     |                   |     nextSyncToken: "new-token-456"  |
     |                   |   }                                 |
     |                   |                    |                |
     |<-- Full contacts list ----------------|                |
     |                   |                    |                |
     |-- Process all contacts (same as incremental) ----------|
     |                   |                    |                |
     |-- Store new syncToken "new-token-456" ----------------->|
     |                   |                    |                |
     |<-- Result {imported: 150, full_sync: true} ------------|
```

---

## 4. Google Calendar Weekly Sync

### 4.1 Weekly Event Import

```
CLI/Web             CalendarService     CalendarClient      Google API         CalendarDB        EntityDB
   |                    |                    |                    |                |                |
   |-- syncWeek(week) ->|                    |                    |                |                |
   |                    |                    |                    |                |                |
   |                    |-- getWeekDates("2025-41") -----------                   |                |
   |                    |   Returns: {                                                              |
   |                    |     start: Mon Oct 6 00:00,                                               |
   |                    |     end: Sun Oct 12 23:59                                                 |
   |                    |   }                                                                       |
   |                    |                    |                    |                |                |
   |                    |-- getEventsForWeek(weekId) ----------->|                |                |
   |                    |                    |                    |                |                |
   |                    |                    |-- GET /calendars/primary/events -->|                |
   |                    |                    |   ?timeMin=2025-10-06T00:00:00Z   |                |
   |                    |                    |   &timeMax=2025-10-12T23:59:59Z   |                |
   |                    |                    |   &singleEvents=true (expand recurring)          |
   |                    |                    |   &orderBy=startTime                             |
   |                    |                    |                    |                |                |
   |                    |                    |<-- Events with expanded recurrences -------------|
   |                    |                    |   {                                              |
   |                    |                    |     items: [                                     |
   |                    |                    |       {                                          |
   |                    |                    |         id: "event123",                          |
   |                    |                    |         summary: "Team Meeting",                 |
   |                    |                    |         attendees: [{email: "alice@example.com"}]|
   |                    |                    |         recurrence: ["RRULE:FREQ=WEEKLY"],       |
   |                    |                    |         recurringEventId: "parent123"            |
   |                    |                    |       }                                          |
   |                    |                    |     ]                                            |
   |                    |                    |   }                                              |
   |                    |                    |                    |                |                |
   |                    |<-- {ok: true, data: CalendarEvent[]} --|                |                |
   |                    |                    |                    |                |                |
   |                    |-- FOR EACH event -----------------------------------------                |
   |                    |   |                                                                       |
   |                    |   |-- createEvent(event, userId, weekId) --------------->|                |
   |                    |   |                                    INSERT OR REPLACE |                |
   |                    |   |                                                      |                |
   |                    |   |<-- Event stored ------------------------------------|                |
   |                    |   |                                                      |                |
   |                    |   |-- FOR EACH attendee in event.attendees ------------                  |
   |                    |   |   |                                                  |                |
   |                    |   |   |-- Find entity by email ----------------------------------------->|
   |                    |   |   |                                                  |                |
   |                    |   |   |<-- Matching entity (if exists) ---------------------------------|
   |                    |   |   |                                                  |                |
   |                    |   |   |-- IF entity found:                              |                |
   |                    |   |   |   updateEntity(                                  |                |
   |                    |   |   |     metadata: {                                  |                |
   |                    |   |   |       calendarEvents: [..., eventId],            |                |
   |                    |   |   |     },                                           |                |
   |                    |   |   |     lastInteraction: event.start,                |                |
   |                    |   |   |     interactionCount++                           |                |
   |                    |   |   |   ) ----------------------------------------------------------->|
   |                    |   |   |                                                  |                |
   |                    |   |                                                      |                |
   |                    |                    |                    |                |                |
   |<-- Result {weekId: "2025-41", eventsImported: 12, entitiesLinked: 8} ------------------------|
```

### 4.2 Recurring Event Handling

```
CalendarClient      Google API
     |                   |
     |-- getEventsForWeek("2025-41") ->|
     |                   |
     |-- GET /calendars/primary/events ->|
     |   ?timeMin=2025-10-06T00:00:00Z |
     |   &timeMax=2025-10-12T23:59:59Z |
     |   &singleEvents=true              | <-- KEY: Expands recurring events
     |                   |
     |<-- Expanded instances ----------|
     |   [                              |
     |     {                            |
     |       id: "event123_20251006",   | <-- Instance for Oct 6
     |       recurringEventId: "event123", | <-- Parent recurring event
     |       summary: "Weekly Standup", |
     |       recurrence: null,          | <-- Instance has no recurrence
     |       start: "2025-10-06T10:00"  |
     |     },                           |
     |     {                            |
     |       id: "event123_20251013",   | <-- NEXT instance (Oct 13)
     |       recurringEventId: "event123", | <-- Same parent
     |       summary: "Weekly Standup", |
     |       recurrence: null,          |
     |       start: "2025-10-13T10:00"  |
     |     }                            |
     |   ]                              |
     |                                  |
     |-- Each instance stored separately in calendar_events table
     |   with week_identifier for the week it occurs in
```

---

## 5. Error Recovery Flows

### 5.1 Rate Limit Handling

```
SyncService         PeopleClient        Google API         RetryUtil
     |                   |                    |                |
     |-- listContacts() ---------------------->|                |
     |                   |                    |                |
     |                   |<-- 429 Too Many Requests ----------|
     |                   |   Headers: {                        |
     |                   |     "Retry-After": "120"            |
     |                   |   }                                 |
     |                   |                    |                |
     |<-- {ok: false, error: {type: RATE_LIMIT, retryAfter: 120}} --|
     |                   |                    |                |
     |-- getRecoveryStrategy(error) --------------------------->|
     |                   |                    |                |
     |<-- {shouldRetry: true, retryDelay: 120000} ------------|
     |                   |                    |                |
     |-- Log: "Rate limited, retrying in 120s"                 |
     |                   |                    |                |
     |-- Wait 120 seconds --------------------------------------                |
     |                   |                    |                |
     |-- Retry: listContacts() ------------------------------>|                |
     |                   |                    |                |
     |                   |<-- Success with contacts ----------|                |
     |                   |                    |                |
     |<-- Continue sync -------------------------------------------            |
```

### 5.2 Network Error with Exponential Backoff

```
SyncService         PeopleClient        Google API         RetryUtil
     |                   |                    |                |
     |-- listContacts() ---------------------->|                |
     |                   |                    X   <-- Network timeout
     |                   |                    |                |
     |<-- {ok: false, error: {type: NETWORK_ERROR}} -----------|
     |                   |                    |                |
     |-- retryWithBackoff(fn, options) ------------------------>|
     |                   |                    |                |
     |                   |                    |   Attempt 1 (delay: 1s)
     |                   |                    |                |
     |-- Wait 1s ----------------------------------------------                |
     |-- Retry ---->|                                                          |
     |              X   <-- Timeout again                                      |
     |              |                                                          |
     |                   |                    |   Attempt 2 (delay: 2s)       |
     |-- Wait 2s ----------------------------------------------                |
     |-- Retry ---->|                                                          |
     |              X   <-- Timeout again                                      |
     |              |                                                          |
     |                   |                    |   Attempt 3 (delay: 4s)       |
     |-- Wait 4s ----------------------------------------------                |
     |-- Retry ---->|                    Success!                              |
     |              |                                                          |
     |<-- {ok: true, data} ----------------------------------------            |
     |                   |                    |                |
     |-- Continue sync -------------------------------------------            |
```

### 5.3 Authentication Error (Token Expired)

```
SyncService         OAuth Client        Google API         Database
     |                   |                    |                |
     |-- listContacts() ---------------------->|                |
     |                   |                    |                |
     |                   |<-- 401 Unauthorized ---------------|
     |                   |   (Token expired)                   |
     |                   |                    |                |
     |<-- {ok: false, error: {type: AUTH_ERROR}} -------------|
     |                   |                    |                |
     |-- getRecoveryStrategy(error) --------                   |
     |<-- {shouldRetry: false, fallbackAction: 'manual'} ---  |
     |                   |                    |                |
     |-- OAuth Client auto-refresh (via 'tokens' event) ----->|
     |                   |                    |                |
     |                   |-- Refresh token ------------------>|
     |                   |   (using refresh_token)            |
     |                   |                    |                |
     |                   |<-- New access token --------------|
     |                   |                    |                |
     |                   |-- Update user.metadata ----------->|
     |                   |                    |                |
     |<-- OAuth client updated with new credentials ----------|
     |                   |                    |                |
     |-- Retry: listContacts() with new token --------------->|
     |                   |                    |                |
     |                   |<-- Success with contacts ----------|
     |                   |                    |                |
     |<-- Continue sync -------------------------------------------
```

### 5.4 Duplicate Conflict Resolution

```
SyncService         LLM Service         ConflictResolver    User/Config
     |                   |                    |                |
     |-- batchCheckDuplicates(pairs) --------->|                |
     |                   |                    |                |
     |<-- [{isDuplicate: true, confidence: 0.95, ...}] --------|
     |                   |                    |                |
     |-- FOR EACH duplicate pair -----------                   |
     |   |                                                      |
     |   |-- hasConflict(google, mcp) ----------------------->|
     |   |                                                      |
     |   |<-- Conflict: {                                      |
     |   |      field: "phone",                                |
     |   |      googleValue: "+1-555-1234",                    |
     |   |      mcpValue: "+1-555-5678"                        |
     |   |    } ------------------------------------------------|
     |   |                                                      |
     |   |-- resolveConflict(conflict, resolution strategy) -->|
     |   |                                    |                |
     |   |                                    |-- Check user preference ------->|
     |   |                                    |                |                |
     |   |                                    |<-- Strategy: 'google' or 'manual' --|
     |   |                                    |                |                |
     |   |<-- Resolution: {                                    |                |
     |   |      action: 'use_google',                          |                |
     |   |      value: "+1-555-1234"                           |                |
     |   |    } ------------------------------------------------|                |
     |   |                                                      |                |
     |   |-- IF action === 'use_google':                       |                |
     |   |   updateEntity(mcp.id, {phone: googleValue})        |                |
     |   |                                                      |                |
     |   |-- IF action === 'use_mcp':                          |                |
     |   |   updateContact(google.resourceName, {phone: mcpValue})             |
     |   |                                                      |                |
     |   |-- IF action === 'manual':                           |                |
     |   |   Store conflict in user.metadata for review        |                |
     |                                                          |                |
     |<-- Result with conflicts resolved/deferred --------------------------------
```

---

## Summary

### Key Flow Characteristics

✅ **OAuth Flow**: Web-based with automatic token refresh
✅ **Incremental Sync**: Uses syncToken for efficient Google Contacts sync
✅ **Full Sync Fallback**: Automatic recovery from expired syncToken
✅ **Weekly Calendar Tracking**: Expands recurring events with `singleEvents=true`
✅ **Entity Linking**: Attendees automatically linked to existing entities
✅ **Error Recovery**: Comprehensive retry logic with exponential backoff
✅ **Conflict Resolution**: LLM-powered deduplication with user preferences

### Performance Optimizations

- Batch operations (max 200 contacts per request)
- Parallel processing where possible
- Connection pooling for database operations
- Async embedding generation (queued)
- Incremental sync to minimize API calls

### Security Considerations

- OAuth tokens stored in encrypted user metadata
- Refresh tokens for long-lived access
- Automatic token refresh on expiration
- User isolation enforced at database level
- Scope validation before operations
