# Example Google Contacts Sync Logs

**Visual guide showing what you'll see during sync operations**

## Successful Sync Example

### Small Sync (20 contacts, no duplicates)

```
[GoogleContactsSync] [req-a7b3c9d2] ========================================
[GoogleContactsSync] [req-a7b3c9d2] Starting sync request
[GoogleContactsSync] [req-a7b3c9d2] ========================================
[GoogleContactsSync] [req-a7b3c9d2] User authenticated: john.doe@example.com (Clerk ID: user_abc123)
[GoogleContactsSync] [req-a7b3c9d2] Sync direction: import (Google → MCP Memory)
[GoogleContactsSync] [req-a7b3c9d2] Auto-merge duplicates: true
[GoogleContactsSync] [req-a7b3c9d2] ----------------------------------------
[GoogleContactsSync] [req-a7b3c9d2] Validating Google OAuth tokens
[GoogleContactsSync] [req-a7b3c9d2] Google OAuth tokens valid
[GoogleContactsSync] [req-a7b3c9d2] Fetching contacts from Google People API
[GoogleContactsSync] [req-a7b3c9d2] Retrieved 20 contacts from Google
[GoogleContactsSync] [req-a7b3c9d2] Processing batch 1/1 (20 contacts)
[GoogleContactsSync] [req-a7b3c9d2] Creating 20 new entities in database
[GoogleContactsSync] [req-a7b3c9d2] Successfully created 20 contacts
[GoogleContactsSync] [req-a7b3c9d2] ----------------------------------------
[GoogleContactsSync] [req-a7b3c9d2] Sync completed in 8.4s
[GoogleContactsSync] [req-a7b3c9d2] Summary:
[GoogleContactsSync] [req-a7b3c9d2]   - Contacts processed: 20
[GoogleContactsSync] [req-a7b3c9d2]   - New contacts created: 20
[GoogleContactsSync] [req-a7b3c9d2]   - Duplicates merged: 0
[GoogleContactsSync] [req-a7b3c9d2]   - Errors: 0
[GoogleContactsSync] [req-a7b3c9d2]   - Duration: 8.4 seconds
[GoogleContactsSync] [req-a7b3c9d2] ========================================
```

**What happened**: Clean import of 20 contacts, no duplicates found, completed quickly.

---

## Medium Sync with Duplicates

### Medium Sync (150 contacts, some duplicates)

```
[GoogleContactsSync] [req-e5f8a1b4] ========================================
[GoogleContactsSync] [req-e5f8a1b4] Starting sync request
[GoogleContactsSync] [req-e5f8a1b4] ========================================
[GoogleContactsSync] [req-e5f8a1b4] User authenticated: jane.smith@example.com (Clerk ID: user_xyz789)
[GoogleContactsSync] [req-e5f8a1b4] Sync direction: import (Google → MCP Memory)
[GoogleContactsSync] [req-e5f8a1b4] Auto-merge duplicates: true
[GoogleContactsSync] [req-e5f8a1b4] ----------------------------------------
[GoogleContactsSync] [req-e5f8a1b4] Validating Google OAuth tokens
[GoogleContactsSync] [req-e5f8a1b4] Google OAuth tokens valid
[GoogleContactsSync] [req-e5f8a1b4] Fetching contacts from Google People API
[GoogleContactsSync] [req-e5f8a1b4] Retrieved 150 contacts from Google
[GoogleContactsSync] [req-e5f8a1b4] Processing batch 1/3 (50 contacts)
[GoogleContactsSync] [req-e5f8a1b4] Checking for duplicates using LLM deduplication
[GoogleContactsSync] [req-e5f8a1b4] Found 3 potential duplicates in batch 1
[GoogleContactsSync] [req-e5f8a1b4] Duplicate: "John Smith" (john.smith@company.com) matches existing contact ID: ent_123abc
[GoogleContactsSync] [req-e5f8a1b4] Merging contact data (keeping most recent)
[GoogleContactsSync] [req-e5f8a1b4] Successfully merged 1 contact
[GoogleContactsSync] [req-e5f8a1b4] Duplicate: "Jane Doe" matches but confidence too low (0.65 < 0.85), creating new contact
[GoogleContactsSync] [req-e5f8a1b4] Duplicate: "Robert Johnson" matches existing contact ID: ent_456def
[GoogleContactsSync] [req-e5f8a1b4] Successfully merged 1 contact
[GoogleContactsSync] [req-e5f8a1b4] Creating 48 new entities in database
[GoogleContactsSync] [req-e5f8a1b4] Successfully created 48 contacts
[GoogleContactsSync] [req-e5f8a1b4] Batch 1 complete: 48 created, 2 merged
[GoogleContactsSync] [req-e5f8a1b4] ----------------------------------------
[GoogleContactsSync] [req-e5f8a1b4] Processing batch 2/3 (50 contacts)
[GoogleContactsSync] [req-e5f8a1b4] Checking for duplicates using LLM deduplication
[GoogleContactsSync] [req-e5f8a1b4] Found 1 potential duplicate in batch 2
[GoogleContactsSync] [req-e5f8a1b4] Duplicate: "Sarah Wilson" matches existing contact ID: ent_789ghi
[GoogleContactsSync] [req-e5f8a1b4] Successfully merged 1 contact
[GoogleContactsSync] [req-e5f8a1b4] Creating 49 new entities in database
[GoogleContactsSync] [req-e5f8a1b4] Successfully created 49 contacts
[GoogleContactsSync] [req-e5f8a1b4] Batch 2 complete: 49 created, 1 merged
[GoogleContactsSync] [req-e5f8a1b4] ----------------------------------------
[GoogleContactsSync] [req-e5f8a1b4] Processing batch 3/3 (50 contacts)
[GoogleContactsSync] [req-e5f8a1b4] Checking for duplicates using LLM deduplication
[GoogleContactsSync] [req-e5f8a1b4] No duplicates found in batch 3
[GoogleContactsSync] [req-e5f8a1b4] Creating 50 new entities in database
[GoogleContactsSync] [req-e5f8a1b4] Successfully created 50 contacts
[GoogleContactsSync] [req-e5f8a1b4] Batch 3 complete: 50 created, 0 merged
[GoogleContactsSync] [req-e5f8a1b4] ----------------------------------------
[GoogleContactsSync] [req-e5f8a1b4] Sync completed in 52.7s
[GoogleContactsSync] [req-e5f8a1b4] Summary:
[GoogleContactsSync] [req-e5f8a1b4]   - Contacts processed: 150
[GoogleContactsSync] [req-e5f8a1b4]   - New contacts created: 147
[GoogleContactsSync] [req-e5f8a1b4]   - Duplicates merged: 3
[GoogleContactsSync] [req-e5f8a1b4]   - Errors: 0
[GoogleContactsSync] [req-e5f8a1b4]   - Duration: 52.7 seconds
[GoogleContactsSync] [req-e5f8a1b4] ========================================
```

**What happened**: Imported 150 contacts, LLM found 4 potential duplicates, merged 3 (1 rejected due to low confidence), created 147 new contacts. Took under a minute.

---

## Export Sync Example

### Export from MCP Memory to Google

```
[GoogleContactsSync] [req-c2d9f3a8] ========================================
[GoogleContactsSync] [req-c2d9f3a8] Starting sync request
[GoogleContactsSync] [req-c2d9f3a8] ========================================
[GoogleContactsSync] [req-c2d9f3a8] User authenticated: alice.jones@example.com (Clerk ID: user_def456)
[GoogleContactsSync] [req-c2d9f3a8] Sync direction: export (MCP Memory → Google)
[GoogleContactsSync] [req-c2d9f3a8] Auto-merge duplicates: false (not applicable for export)
[GoogleContactsSync] [req-c2d9f3a8] ----------------------------------------
[GoogleContactsSync] [req-c2d9f3a8] Validating Google OAuth tokens
[GoogleContactsSync] [req-c2d9f3a8] Google OAuth tokens valid
[GoogleContactsSync] [req-c2d9f3a8] Fetching contacts from MCP Memory database
[GoogleContactsSync] [req-c2d9f3a8] Retrieved 85 contacts from database
[GoogleContactsSync] [req-c2d9f3a8] Converting to Google People API format
[GoogleContactsSync] [req-c2d9f3a8] Processing batch 1/2 (50 contacts)
[GoogleContactsSync] [req-c2d9f3a8] Creating contacts in Google (batch request)
[GoogleContactsSync] [req-c2d9f3a8] Successfully created 50 contacts in Google
[GoogleContactsSync] [req-c2d9f3a8] Batch 1 complete: 50 exported
[GoogleContactsSync] [req-c2d9f3a8] ----------------------------------------
[GoogleContactsSync] [req-c2d9f3a8] Processing batch 2/2 (35 contacts)
[GoogleContactsSync] [req-c2d9f3a8] Creating contacts in Google (batch request)
[GoogleContactsSync] [req-c2d9f3a8] Successfully created 35 contacts in Google
[GoogleContactsSync] [req-c2d9f3a8] Batch 2 complete: 35 exported
[GoogleContactsSync] [req-c2d9f3a8] ----------------------------------------
[GoogleContactsSync] [req-c2d9f3a8] Sync completed in 18.3s
[GoogleContactsSync] [req-c2d9f3a8] Summary:
[GoogleContactsSync] [req-c2d9f3a8]   - Contacts processed: 85
[GoogleContactsSync] [req-c2d9f3a8]   - Contacts exported to Google: 85
[GoogleContactsSync] [req-c2d9f3a8]   - Errors: 0
[GoogleContactsSync] [req-c2d9f3a8]   - Duration: 18.3 seconds
[GoogleContactsSync] [req-c2d9f3a8] ========================================
```

**What happened**: Exported 85 contacts from MCP Memory to Google in 2 batches, completed successfully.

---

## Error Examples

### Authentication Error

```
[GoogleContactsSync] [req-b8e4a7c1] ========================================
[GoogleContactsSync] [req-b8e4a7c1] Starting sync request
[GoogleContactsSync] [req-b8e4a7c1] ========================================
[GoogleContactsSync] [req-b8e4a7c1] ERROR: User not authenticated
[GoogleContactsSync] [req-b8e4a7c1] Clerk authentication failed
[GoogleContactsSync] [req-b8e4a7c1] Request headers: { ... }
[GoogleContactsSync] [req-b8e4a7c1] Error details: {
  "code": "UNAUTHENTICATED",
  "message": "No valid Clerk session found",
  "statusCode": 401
}
[GoogleContactsSync] [req-b8e4a7c1] Suggestion: User must sign in at /sign-in
[GoogleContactsSync] [req-b8e4a7c1] ========================================
```

**What happened**: User tried to sync without being signed in. Needs to authenticate with Clerk first.

---

### Google OAuth Error

```
[GoogleContactsSync] [req-f9d6c2e3] ========================================
[GoogleContactsSync] [req-f9d6c2e3] Starting sync request
[GoogleContactsSync] [req-f9d6c2e3] ========================================
[GoogleContactsSync] [req-f9d6c2e3] User authenticated: bob.miller@example.com (Clerk ID: user_ghi789)
[GoogleContactsSync] [req-f9d6c2e3] Sync direction: import (Google → MCP Memory)
[GoogleContactsSync] [req-f9d6c2e3] Auto-merge duplicates: true
[GoogleContactsSync] [req-f9d6c2e3] ----------------------------------------
[GoogleContactsSync] [req-f9d6c2e3] Validating Google OAuth tokens
[GoogleContactsSync] [req-f9d6c2e3] ERROR: Google OAuth tokens invalid or expired
[GoogleContactsSync] [req-f9d6c2e3] Token check failed: {
  "error": "invalid_grant",
  "error_description": "Token has been expired or revoked."
}
[GoogleContactsSync] [req-f9d6c2e3] Error details: {
  "code": "GOOGLE_AUTH_ERROR",
  "message": "Invalid or expired OAuth tokens",
  "statusCode": 401
}
[GoogleContactsSync] [req-f9d6c2e3] Stack trace:
    at GoogleAuthService.validateTokens (/app/lib/google-auth.ts:145)
    at GoogleContactsSync.execute (/app/api/google/contacts/sync/route.ts:89)
[GoogleContactsSync] [req-f9d6c2e3] User: bob.miller@example.com
[GoogleContactsSync] [req-f9d6c2e3] Suggestion: Disconnect and reconnect Google account in Settings
[GoogleContactsSync] [req-f9d6c2e3] ========================================
```

**What happened**: Google OAuth token expired. User needs to reconnect their Google account in Settings.

---

### API Rate Limit Error

```
[GoogleContactsSync] [req-a3c8f5d7] ========================================
[GoogleContactsSync] [req-a3c8f5d7] Starting sync request
[GoogleContactsSync] [req-a3c8f5d7] ========================================
[GoogleContactsSync] [req-a3c8f5d7] User authenticated: carol.davis@example.com (Clerk ID: user_jkl012)
[GoogleContactsSync] [req-a3c8f5d7] Sync direction: import (Google → MCP Memory)
[GoogleContactsSync] [req-a3c8f5d7] Auto-merge duplicates: true
[GoogleContactsSync] [req-a3c8f5d7] ----------------------------------------
[GoogleContactsSync] [req-a3c8f5d7] Validating Google OAuth tokens
[GoogleContactsSync] [req-a3c8f5d7] Google OAuth tokens valid
[GoogleContactsSync] [req-a3c8f5d7] Fetching contacts from Google People API
[GoogleContactsSync] [req-a3c8f5d7] ERROR: Google API rate limit exceeded
[GoogleContactsSync] [req-a3c8f5d7] API response: {
  "error": {
    "code": 429,
    "message": "Quota exceeded for quota metric 'Read requests' and limit 'Read requests per user per 100 seconds'",
    "status": "RESOURCE_EXHAUSTED"
  }
}
[GoogleContactsSync] [req-a3c8f5d7] Error details: {
  "code": "RATE_LIMIT_EXCEEDED",
  "message": "Google API rate limit exceeded",
  "statusCode": 429,
  "retryAfter": 120
}
[GoogleContactsSync] [req-a3c8f5d7] Suggestion: Wait 120 seconds and retry. Consider reducing sync frequency.
[GoogleContactsSync] [req-a3c8f5d7] ========================================
```

**What happened**: Hit Google API rate limits. Need to wait 2 minutes before retrying.

---

### Partial Failure Example

```
[GoogleContactsSync] [req-d7b2e9f4] ========================================
[GoogleContactsSync] [req-d7b2e9f4] Starting sync request
[GoogleContactsSync] [req-d7b2e9f4] ========================================
[GoogleContactsSync] [req-d7b2e9f4] User authenticated: david.wilson@example.com (Clerk ID: user_mno345)
[GoogleContactsSync] [req-d7b2e9f4] Sync direction: import (Google → MCP Memory)
[GoogleContactsSync] [req-d7b2e9f4] Auto-merge duplicates: true
[GoogleContactsSync] [req-d7b2e9f4] ----------------------------------------
[GoogleContactsSync] [req-d7b2e9f4] Validating Google OAuth tokens
[GoogleContactsSync] [req-d7b2e9f4] Google OAuth tokens valid
[GoogleContactsSync] [req-d7b2e9f4] Fetching contacts from Google People API
[GoogleContactsSync] [req-d7b2e9f4] Retrieved 100 contacts from Google
[GoogleContactsSync] [req-d7b2e9f4] Processing batch 1/2 (50 contacts)
[GoogleContactsSync] [req-d7b2e9f4] Checking for duplicates using LLM deduplication
[GoogleContactsSync] [req-d7b2e9f4] WARNING: LLM deduplication failed for 1 contact
[GoogleContactsSync] [req-d7b2e9f4] Error: OpenAI API timeout for contact "Emily Brown"
[GoogleContactsSync] [req-d7b2e9f4] Falling back to simple matching for this contact
[GoogleContactsSync] [req-d7b2e9f4] Creating 50 new entities in database
[GoogleContactsSync] [req-d7b2e9f4] ERROR: Failed to create contact "Michael Green"
[GoogleContactsSync] [req-d7b2e9f4] Database error: Unique constraint violation on email
[GoogleContactsSync] [req-d7b2e9f4] Skipping contact and continuing
[GoogleContactsSync] [req-d7b2e9f4] Successfully created 49 contacts
[GoogleContactsSync] [req-d7b2e9f4] Batch 1 complete: 49 created, 0 merged, 1 failed
[GoogleContactsSync] [req-d7b2e9f4] ----------------------------------------
[GoogleContactsSync] [req-d7b2e9f4] Processing batch 2/2 (50 contacts)
[GoogleContactsSync] [req-d7b2e9f4] Checking for duplicates using LLM deduplication
[GoogleContactsSync] [req-d7b2e9f4] No duplicates found in batch 2
[GoogleContactsSync] [req-d7b2e9f4] Creating 50 new entities in database
[GoogleContactsSync] [req-d7b2e9f4] Successfully created 50 contacts
[GoogleContactsSync] [req-d7b2e9f4] Batch 2 complete: 50 created, 0 merged
[GoogleContactsSync] [req-d7b2e9f4] ----------------------------------------
[GoogleContactsSync] [req-d7b2e9f4] Sync completed with warnings in 45.8s
[GoogleContactsSync] [req-d7b2e9f4] Summary:
[GoogleContactsSync] [req-d7b2e9f4]   - Contacts processed: 100
[GoogleContactsSync] [req-d7b2e9f4]   - New contacts created: 99
[GoogleContactsSync] [req-d7b2e9f4]   - Duplicates merged: 0
[GoogleContactsSync] [req-d7b2e9f4]   - Errors: 1 (see details above)
[GoogleContactsSync] [req-d7b2e9f4]   - Duration: 45.8 seconds
[GoogleContactsSync] [req-d7b2e9f4] Warning: Some contacts failed to sync. Review errors above.
[GoogleContactsSync] [req-d7b2e9f4] ========================================
```

**What happened**: Mostly successful sync but encountered 1 duplicate email that couldn't be created. LLM also had a timeout on one contact but fell back gracefully. 99 out of 100 contacts synced successfully.

---

## Log Pattern Reference

### Visual Markers
```
========================================  # Major section separator (start/end)
----------------------------------------  # Minor section separator (between phases)
ERROR:                                   # Critical error
WARNING:                                 # Non-critical issue
Summary:                                 # Final results
Suggestion:                              # Recovery recommendation
```

### Request ID Format
- Format: `req-` + 8 random hex characters
- Example: `req-a7b3c9d2`
- Purpose: Trace all logs for a single sync operation

### Timestamp Format
- Automatically added by PM2
- Format: `YYYY-MM-DDTHH:mm:ss`
- Example: `2025-10-16T13:45:22`

### Component Prefix
- Always present: `[GoogleContactsSync]`
- Helps filter logs from other components
- Easy to grep: `grep GoogleContactsSync`

---

## What Good Logs Look Like

✅ **Clean, successful sync:**
- Clear request ID
- User authentication confirmed
- Progress updates for each batch
- No errors or warnings
- Completion summary with statistics
- Duration metric

✅ **Sync with expected duplicates:**
- Duplicate detection working
- Merge decisions logged
- Confidence scores shown
- Final counts accurate

✅ **Graceful error handling:**
- Error clearly identified
- Full context provided
- Recovery suggestion given
- Operation stopped safely

---

## What Bad Logs Look Like

❌ **Missing context:**
```
Error: Failed to sync
```
→ No request ID, no user info, no details

❌ **Unclear errors:**
```
Something went wrong
```
→ No error code, no suggestion, no stack trace

❌ **Silent failures:**
```
Sync started
Sync completed
```
→ No progress updates, can't tell what happened

---

**The improved logging ensures you always get the GOOD kind of logs!** ✨

Every operation is traceable, every error is detailed, every decision is logged.
