# Google Contacts & Calendar Sync - Architecture Summary

**Version**: 1.0.0
**Date**: 2025-10-09
**Status**: Design Complete, Ready for Implementation

## 📋 Quick Reference

| Document | Purpose | Audience |
|----------|---------|----------|
| [GOOGLE_SYNC_ARCHITECTURE.md](./GOOGLE_SYNC_ARCHITECTURE.md) | Complete technical architecture | Engineers |
| [GOOGLE_SYNC_FLOWS.md](./GOOGLE_SYNC_FLOWS.md) | Sequence diagrams for all flows | Engineers, QA |
| [GOOGLE_SYNC_IMPLEMENTATION_PLAN.md](../guides/GOOGLE_SYNC_IMPLEMENTATION_PLAN.md) | Phased implementation guide | Engineers, PM |
| This document | Executive summary | All stakeholders |

---

## Executive Summary

This architecture designs a **production-ready Google Contacts and Calendar sync integration** for the MCP Memory TypeScript project. The design leverages 70% existing codebase patterns while introducing 30% Google-specific capabilities.

### Key Features

✅ **OAuth 2.0 Integration**: Secure authentication with automatic token refresh
✅ **Incremental Sync**: syncToken-based for Google Contacts (7-day expiry)
✅ **Weekly Calendar Tracking**: Time-based filtering with recurring event expansion
✅ **LLM Deduplication**: Reuses existing ChatGPT-4 matching from macOS sync
✅ **Bidirectional Sync**: Import/export with conflict resolution
✅ **Error Recovery**: Comprehensive retry logic with exponential backoff
✅ **Dry-Run Mode**: Preview changes before applying
✅ **Multi-User Support**: Clerk authentication with user isolation

---

## Architecture Highlights

### 1. OAuth 2.0 Service (`GoogleAuthService`)

**Capabilities**:
- Authorization URL generation with scopes
- Token exchange and storage in user metadata
- Automatic token refresh on expiration
- Revocation and scope management

**Integration Points**:
- Web interface: `/api/auth/google` → Google consent → `/api/auth/google/callback`
- CLI: Manual OAuth flow with local server
- MCP Server: Uses stored tokens from user metadata

### 2. Google Contacts Sync (`GoogleContactsSyncService`)

**Sync Strategy**:
```
1. Check user metadata for syncToken
2. If present: Incremental sync (only changes since last sync)
3. If expired (410 error): Fallback to full sync
4. Map Google contacts ↔ MCP entities
5. LLM deduplication (batchCheckDuplicates)
6. UUID-based matching (extractMcpUuid)
7. Update/create entities
8. Store new syncToken for next sync
```

**Key APIs**:
- `listContacts(syncToken)`: Incremental fetch (max 200/request)
- `createContact()`: Export to Google
- `updateContact(resourceName, updateMask)`: Update existing
- `batchGetContacts()`: Efficient batch operations

### 3. Google Calendar Tracking (`GoogleCalendarSyncService`)

**Weekly Tracking Strategy**:
```
1. Calculate week dates from identifier (YYYY-WW)
2. Fetch events with timeMin/timeMax
3. Expand recurring events (singleEvents: true)
4. Store events in calendar_events table
5. Link attendees to existing entities by email
6. Update entity.lastInteraction and interactionCount
```

**Database Schema**:
- `calendar_events` table with week_identifier index
- Attendees stored as JSON array
- Recurring events tracked with RRULE

### 4. Database Updates

**New Table**:
```sql
CREATE TABLE calendar_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  week_identifier TEXT NOT NULL, -- "YYYY-WW"
  event_id TEXT NOT NULL,
  summary TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  attendees TEXT, -- JSON
  recurrence TEXT, -- JSON array of RRULE
  is_recurring BOOLEAN DEFAULT 0,
  metadata TEXT, -- etag, calendarId, iCalUID
  ...
  UNIQUE(user_id, event_id, week_identifier)
);
```

**User Metadata Extensions**:
```typescript
interface UserMetadata {
  googleOAuthTokens?: GoogleOAuthTokens;
  googleContactsSyncToken?: string;
  googleContactsSyncAt?: string;
  googleSyncPreferences?: {
    autoSync: boolean;
    conflictResolution: 'google' | 'mcp' | 'manual';
  };
}
```

**Entity Metadata Extensions**:
```typescript
interface EntityMetadata {
  googleResourceName?: string; // people/c12345
  googleEtag?: string;
  calendarEvents?: string[]; // Array of event IDs
}
```

---

## Implementation Roadmap

### Phase 1: OAuth Infrastructure (Week 1)
**Effort**: 5 days
**Files**: 7 files (GoogleAuthService, web routes, tests)
**Deliverable**: Working OAuth flow with token storage

**Key Tasks**:
- [ ] Implement `GoogleAuthService` with token refresh
- [ ] Create web routes: `/api/auth/google` + `/api/auth/google/callback`
- [ ] Add environment variables (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET)
- [ ] Unit tests for OAuth service
- [ ] E2E test for OAuth flow

### Phase 2: Google Contacts Sync (Week 2-3)
**Effort**: 10 days
**Files**: 15 files (PeopleClient, sync service, CLI, tests)
**Deliverable**: Bidirectional contacts sync with LLM deduplication

**Key Tasks**:
- [ ] Build `GooglePeopleClient` with error handling
- [ ] Implement `GoogleContactsSyncService` with incremental sync
- [ ] Integrate `batchCheckDuplicates()` from contacts-sync
- [ ] Add CLI command: `mcp-memory google-contacts-sync`
- [ ] Create API endpoint: `/api/google-sync/contacts`
- [ ] Integration tests with mock Google API

### Phase 3: Google Calendar Tracking (Week 4)
**Effort**: 5 days
**Files**: 8 files (CalendarClient, DB migration, sync service, tests)
**Deliverable**: Weekly calendar event tracking with entity linking

**Key Tasks**:
- [ ] Database migration for `calendar_events` table
- [ ] Build `GoogleCalendarClient` with week filtering
- [ ] Implement `GoogleCalendarSyncService`
- [ ] Create `CalendarOperations` for DB access
- [ ] Link attendees to entities by email
- [ ] CLI command: `mcp-memory google-calendar-sync`

### Phase 4: Testing & Refinement (Week 5)
**Effort**: 5 days
**Files**: 6 files (tests, docs, performance optimization)
**Deliverable**: Production-ready deployment

**Key Tasks**:
- [ ] Unit tests (95% coverage target)
- [ ] Integration tests (OAuth, sync, calendar)
- [ ] E2E tests (web flow, CLI commands)
- [ ] Performance optimization (1000+ contacts < 30s)
- [ ] Error recovery testing (rate limits, token expiry)
- [ ] Documentation and deployment guide

---

## Code Reuse Analysis

### Existing Patterns Leveraged (70%)

| Component | Source | Reuse |
|-----------|--------|-------|
| LLM Deduplication | `contacts-sync.ts` | `batchCheckDuplicates()`, `matchContacts()` |
| OAuth Pattern | `gmail-client.ts` | Token storage, refresh mechanism |
| Week Calculation | `gmail-client.ts` | `getWeekDates()`, `getWeekIdentifier()` |
| Conflict Resolution | `contacts-sync.ts` | `resolveConflict()`, `hasConflict()` |
| UUID Matching | `contact-matching.ts` | `extractMcpUuid()`, `matchContacts()` |
| Database Operations | `operations.ts` | `createEntity()`, `updateEntity()` |
| CLI Framework | `cli/commands/*` | Command structure, colors, icons |

### New Google-Specific Code (30%)

| Component | LOC | Complexity |
|-----------|-----|------------|
| `GoogleAuthService` | 150 | Medium |
| `GooglePeopleClient` | 200 | Medium |
| `GoogleCalendarClient` | 150 | Low |
| `GoogleContactsSyncService` | 300 | High |
| `GoogleCalendarSyncService` | 200 | Medium |
| `CalendarOperations` | 100 | Low |
| Web OAuth Routes | 100 | Low |
| CLI Commands | 150 | Low |
| **Total** | **~1,350 LOC** | **Medium** |

**Total Project Impact**: ~2,500 LOC (including tests, docs)

---

## Error Handling Strategy

### Error Types & Recovery

| Error Type | Recovery Strategy | Retry? | Fallback |
|------------|------------------|--------|----------|
| EXPIRED_SYNC_TOKEN | Full sync | No | Automatic full sync |
| RATE_LIMIT | Exponential backoff | Yes | Wait + retry (max 3x) |
| AUTH_ERROR | Token refresh | Auto | OAuth re-authentication |
| NETWORK_ERROR | Exponential backoff | Yes | Wait + retry (max 3x) |
| QUOTA_EXCEEDED | Log + skip | No | Manual intervention |
| DUPLICATE_CONFLICT | LLM resolution | No | User preference or manual |

### Retry Logic Pattern

```typescript
async function retryWithBackoff<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries) throw error;

      const delay = Math.min(1000 * Math.pow(2, attempt), 30000);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error('Retry exhausted');
}
```

---

## Performance Considerations

### Optimization Strategies

**Batch Operations**:
- Google Contacts: 200 contacts per request (API limit)
- Calendar Events: 2500 events per request (API limit)
- Database: Batch inserts with transactions

**Incremental Sync**:
- Average sync with syncToken: 50-200ms (only changes)
- Full sync without syncToken: 5-15s (all contacts)
- syncToken expires after 7 days → automatic fallback

**Caching**:
- OAuth tokens cached in user metadata
- Entity lookups optimized with indexes
- Week calculations memoized

**Performance Targets**:
- 1000 contacts sync: < 30 seconds
- Calendar week sync: < 10 seconds
- OAuth token refresh: < 500ms
- LLM deduplication batch: < 5 seconds per 100 pairs

---

## Security Considerations

### OAuth Security

✅ **Token Storage**: Encrypted in user metadata (Turso database)
✅ **Refresh Tokens**: Stored securely, auto-refreshed on expiration
✅ **Scope Validation**: Checked before each operation
✅ **Revocation**: User can revoke access via web interface

### Data Protection

✅ **User Isolation**: All operations filtered by `user_id` (foreign key)
✅ **Multi-Tenant**: Clerk authentication for web interface
✅ **HTTPS Only**: All Google API calls over TLS
✅ **No PII Logging**: Sensitive data excluded from error logs

### API Security

✅ **Rate Limiting**: Exponential backoff on 429 errors
✅ **Quota Monitoring**: Track API usage per user
✅ **Error Sanitization**: Remove tokens from error messages
✅ **Input Validation**: Zod schemas for all API inputs

---

## Testing Strategy

### Test Coverage Targets

| Layer | Coverage | Tests |
|-------|----------|-------|
| Unit Tests | 95% | 25 tests |
| Integration Tests | 80% | 15 tests |
| E2E Tests | Critical paths | 8 tests |
| Performance Tests | Key operations | 5 tests |

### Test Categories

**Unit Tests** (25 tests):
- GoogleAuthService: token management, URL generation
- GooglePeopleClient: error handling, syncToken logic
- GoogleCalendarClient: week calculations, event mapping
- Sync services: business logic, matching algorithms

**Integration Tests** (15 tests):
- OAuth flow: initiation → callback → token storage
- Incremental sync: syncToken → API call → entity update
- Full sync fallback: expired token → full sync
- Calendar sync: week filtering → event storage → entity linking

**E2E Tests** (8 tests):
- Web OAuth: user click → Google consent → callback redirect
- CLI sync: dry-run → actual sync → verify results
- Error recovery: rate limit → retry → success
- Conflict resolution: duplicate detection → LLM decision → merge

**Performance Tests** (5 tests):
- 1000 contacts sync benchmark (< 30s)
- Calendar week sync benchmark (< 10s)
- LLM deduplication batch (< 5s per 100 pairs)
- Database query optimization
- OAuth token refresh latency

---

## Deployment Guide

### Prerequisites

1. **Google Cloud Console Setup**:
   - Create OAuth 2.0 client ID
   - Configure authorized redirect URIs
   - Enable People API and Calendar API

2. **Environment Variables**:
   ```bash
   GOOGLE_CLIENT_ID=your-google-oauth-client-id
   GOOGLE_CLIENT_SECRET=your-google-oauth-client-secret
   GOOGLE_REDIRECT_URI=https://yourdomain.com/api/auth/google/callback
   ```

3. **Database Migration**:
   ```bash
   tsx scripts/migrate-google-calendar.ts
   ```

### Deployment Steps

**Step 1: Build Project**
```bash
npm run build-full
```

**Step 2: Run Database Migration**
```bash
tsx scripts/migrate-google-calendar.ts
```

**Step 3: Deploy Web Interface**
```bash
cd web
npm run build
vercel deploy --prod
```

**Step 4: Configure OAuth**
- Add production redirect URI to Google Cloud Console
- Update environment variables in production

**Step 5: Test OAuth Flow**
- Visit `/api/auth/google`
- Grant permissions
- Verify token storage in database

**Step 6: Test Sync**
```bash
mcp-memory google-contacts-sync --user-email user@example.com --dry-run
mcp-memory google-contacts-sync --user-email user@example.com --direction both
```

---

## Success Metrics

### KPIs

| Metric | Target | Measurement |
|--------|--------|-------------|
| Sync Success Rate | > 99% | Successful syncs / total syncs |
| Incremental Sync Usage | > 90% | syncToken syncs / total syncs |
| Performance (1000 contacts) | < 30s | Time to complete sync |
| LLM Deduplication Accuracy | > 95% | Correct matches / total matches |
| Token Refresh Success | 100% | Auto-refreshed / expired tokens |
| Error Recovery Rate | > 95% | Recovered errors / total errors |

### Monitoring Dashboard

**Track**:
- Sync operations per day
- syncToken expiry rate
- OAuth token refresh frequency
- API quota usage per user
- Error types distribution
- Deduplication confidence scores

---

## Risk Mitigation

### Identified Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Google API quota exceeded | High | Rate limiting, batch operations, caching |
| syncToken expiry | Medium | Automatic full sync fallback |
| OAuth token revocation | Medium | Graceful error handling, re-auth flow |
| LLM deduplication errors | Low | Fallback to UUID matching, manual review |
| Database migration issues | High | Dry-run mode, automatic backups |
| Network timeouts | Medium | Exponential backoff, retry logic |

### Contingency Plans

**API Quota Issues**:
- Implement request caching
- Add user-level rate limits
- Batch operations more aggressively

**OAuth Issues**:
- Clear error messages for re-authentication
- Admin dashboard for token management
- Automated token health checks

**Data Consistency**:
- Transaction-based operations
- Rollback on partial failures
- Audit logs for sync operations

---

## Next Steps

### Immediate Actions (This Week)

1. **Review Architecture** ✅
   - Stakeholder approval of design
   - Security team review of OAuth implementation
   - Database team review of schema changes

2. **Set Up Google Cloud Project**
   - Create OAuth 2.0 credentials
   - Enable required APIs
   - Configure redirect URIs

3. **Prepare Development Environment**
   - Add environment variables
   - Install any additional dependencies
   - Set up test data

### Phase 1 Start (Next Week)

- Begin GoogleAuthService implementation
- Create web OAuth routes
- Write unit tests for OAuth flow
- Set up integration test environment

---

## Questions & Answers

**Q: Why use syncToken instead of datetime filtering for Contacts?**
A: Google People API does not support datetime filtering. syncToken is the only way to get incremental changes efficiently.

**Q: How do we handle recurring events?**
A: We use `singleEvents: true` in the Calendar API to automatically expand recurring events into individual instances.

**Q: What happens if syncToken expires after 7 days?**
A: The API returns a 410 error. We catch this, log it, and automatically fallback to a full sync.

**Q: How is deduplication different from macOS Contacts sync?**
A: We reuse the exact same `batchCheckDuplicates()` and `matchContacts()` functions. The only difference is the source (Google vs. macOS).

**Q: Can users control conflict resolution?**
A: Yes, via `googleSyncPreferences.conflictResolution` in user metadata: 'google', 'mcp', or 'manual'.

---

## Conclusion

This architecture provides a **production-ready, type-safe, and performant** Google Contacts and Calendar sync integration. By leveraging 70% existing code patterns and introducing 30% Google-specific functionality, we achieve:

✅ **Rapid Development**: 4-5 weeks to production
✅ **Code Efficiency**: ~2,500 LOC total (including tests)
✅ **Maintainability**: Reuses proven patterns from macOS sync
✅ **Scalability**: Incremental sync, batch operations, optimized queries
✅ **Reliability**: Comprehensive error handling and retry logic

The design is ready for implementation starting **Phase 1: OAuth Infrastructure**.

---

**Architecture Status**: ✅ Complete
**Implementation Status**: 🟡 Ready to Start
**Estimated Completion**: 5 weeks from start

---

## Appendix: File Checklist

### Core Services (7 files)
- [ ] `src/utils/google-auth.ts`
- [ ] `src/integrations/google-people-client.ts`
- [ ] `src/integrations/google-calendar-client.ts`
- [ ] `src/services/google-contacts-sync.ts`
- [ ] `src/services/google-calendar-sync.ts`
- [ ] `src/database/calendar-operations.ts`
- [ ] `src/utils/week-calculator.ts`

### Web Interface (4 files)
- [ ] `web/app/api/auth/google/route.ts`
- [ ] `web/app/api/auth/google/callback/route.ts`
- [ ] `web/app/api/google-sync/contacts/route.ts`
- [ ] `web/app/api/google-sync/calendar/route.ts`

### CLI Commands (2 files)
- [ ] `src/cli/commands/google-contacts-sync.ts`
- [ ] `src/cli/commands/google-calendar-sync.ts`

### Database (2 files)
- [ ] `scripts/migrate-google-calendar.ts`
- [ ] `scripts/verify-google-sync.ts`

### Tests (12 files)
- [ ] `tests/unit/google-auth.test.ts`
- [ ] `tests/unit/google-people-client.test.ts`
- [ ] `tests/unit/google-calendar-client.test.ts`
- [ ] `tests/unit/google-contacts-sync.test.ts`
- [ ] `tests/unit/week-calculator.test.ts`
- [ ] `tests/integration/google-oauth-flow.test.ts`
- [ ] `tests/integration/google-contacts-sync.test.ts`
- [ ] `tests/integration/google-calendar-sync.test.ts`
- [ ] `tests/e2e/google-web-oauth.test.ts`
- [ ] `tests/e2e/google-cli-sync.test.ts`
- [ ] `tests/performance/batch-sync.test.ts`
- [ ] `tests/performance/calendar-sync.test.ts`

### Documentation (6 files)
- [x] `docs/architecture/GOOGLE_SYNC_ARCHITECTURE.md`
- [x] `docs/architecture/GOOGLE_SYNC_FLOWS.md`
- [x] `docs/architecture/GOOGLE_SYNC_SUMMARY.md`
- [x] `docs/guides/GOOGLE_SYNC_IMPLEMENTATION_PLAN.md`
- [ ] `docs/features/GOOGLE_CONTACTS_SYNC.md`
- [ ] `docs/features/GOOGLE_CALENDAR_TRACKING.md`

**Total Files**: 36 files (4 complete, 32 to create)
