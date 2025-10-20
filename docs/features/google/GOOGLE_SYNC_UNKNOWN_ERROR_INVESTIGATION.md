# Google Contacts Sync "Unknown Error" Investigation Report

**Date**: 2025-10-16
**Status**: Root cause identified, fix required
**Priority**: HIGH - Blocking user from syncing contacts

## Issue Summary

Users are experiencing a generic "Unknown error" message when attempting to sync Google Contacts, despite:
- People API being enabled
- User authentication working
- Scopes validation passing (contacts scope confirmed)

## Investigation Findings

### 1. Error Flow Analysis

The "Unknown error" message originates from the **frontend** component:

**File**: `web/components/google/google-contacts-sync.tsx`
**Line**: 63

```typescript
setResult({
  success: false,
  exported: 0,
  imported: 0,
  updated: 0,
  duplicatesFound: 0,
  merged: 0,
  errors: [data.error || 'Unknown error'], // ← HERE
});
```

This happens when:
1. API response is NOT ok (`!response.ok`)
2. Response JSON doesn't have an `error` field

### 2. Backend Error Handling Chain

The error could occur at multiple points:

#### 2.1. API Route (`web/app/api/google/contacts/sync/route.ts`)

```typescript
catch (error) {
  console.error('Failed to sync Google contacts:', error);
  return NextResponse.json(
    {
      success: false,
      exported: 0,
      imported: 0,
      updated: 0,
      duplicatesFound: 0,
      merged: 0,
      errors: [error instanceof Error ? error.message : 'Failed to sync contacts'],
    },
    { status: 500 }
  );
}
```

**Problem**: If `error` is not an `Error` instance and doesn't have a message, it returns `'Failed to sync contacts'`, but the response has `errors` (array) not `error` (string).

The frontend expects `data.error` but the backend returns `data.errors` (array).

#### 2.2. GoogleContactsSyncService

The service properly handles errors and returns them in the result object:

```typescript
return {
  ok: true,
  data: {
    contacts: allContacts,
    nextSyncToken: finalSyncToken,
  },
};
```

But this is wrapped in the API route's try-catch.

### 3. Missing Error Propagation

**Root Cause Identified**:

The `GoogleContactsSyncService.sync()` method returns a `GoogleContactsSyncResult` with an `errors` array, but when the People API call fails, the error is caught by `GooglePeopleClient.handleError()` which returns:

```typescript
{
  ok: false,
  error: SyncError  // Single error object
}
```

This error needs to be properly propagated to the sync result.

### 4. Likely Failure Scenario

Based on the code analysis, the most probable failure path is:

1. User clicks "Sync Now"
2. API route validates scopes (✓ passes)
3. Creates `GoogleContactsSyncService` instance
4. Calls `syncService.sync()`
5. Calls `client.getAllContacts(syncToken)`
6. Google API call fails (possible reasons below)
7. Error is caught but not properly formatted
8. Frontend receives response without proper `error` field
9. Shows "Unknown error"

### 5. Possible Google API Failure Reasons

Even with People API enabled, the call could fail due to:

1. **OAuth Token Issues**:
   - Token doesn't have the right scopes (despite validation)
   - Token is expired and refresh failed
   - Token was revoked

2. **Google API Project Issues**:
   - People API quota exceeded
   - API key restrictions (IP, domain)
   - Project billing not enabled

3. **Network/Timeout Issues**:
   - 30-second timeout exceeded
   - Network connectivity problems

4. **Data Issues**:
   - Invalid syncToken in database
   - Sync token expired (HTTP 410)

## Missing Diagnostic Information

The PM2 logs show **NO error output** because:
1. Server is running in production mode
2. Logs are not being written (only startup messages)
3. Console.error might not be captured by PM2

## Recommended Fixes

### Fix 1: API Route Error Response Format (CRITICAL)

The API route catch block returns `errors` array but frontend expects `error` string.

**File**: `web/app/api/google/contacts/sync/route.ts`

Change line 133 from:
```typescript
errors: [error instanceof Error ? error.message : 'Failed to sync contacts'],
```

To include both formats:
```typescript
error: error instanceof Error ? error.message : 'Failed to sync contacts',
errors: [error instanceof Error ? error.message : 'Failed to sync contacts'],
```

### Fix 2: Better Error Logging (HIGH)

Add comprehensive error logging before returning error response:

```typescript
catch (error) {
  console.error('[GoogleContactsSync] Sync failed:', {
    error: error instanceof Error ? {
      name: error.name,
      message: error.message,
      stack: error.stack
    } : error,
    userId: userEmail,
    direction,
    timestamp: new Date().toISOString()
  });

  // Return error response...
}
```

### Fix 3: Check SyncResult Errors (HIGH)

The sync service returns a result object. Check if `result.success === false`:

```typescript
const result = await Promise.race([syncPromise, timeoutPromise]);

// Add this check:
if (!result.success && result.errors.length > 0) {
  console.error('[GoogleContactsSync] Sync reported errors:', result.errors);
}

return NextResponse.json(result);
```

### Fix 4: Frontend Error Display (MEDIUM)

Handle both `error` and `errors` in the frontend:

**File**: `web/components/google/google-contacts-sync.tsx`

```typescript
const errorMessage = data.error || (data.errors && data.errors[0]) || 'Unknown error';

setResult({
  success: false,
  exported: 0,
  imported: 0,
  updated: 0,
  duplicatesFound: 0,
  merged: 0,
  errors: [errorMessage],
});
```

### Fix 5: Enable Debug Logging (IMMEDIATE)

Temporarily enable detailed logging to capture the actual error:

Add to `.env` or PM2 ecosystem config:
```bash
LOG_LEVEL=debug
NODE_ENV=development
```

Restart and attempt sync again to capture error details.

## Testing Strategy

1. **Immediate**: Add debug logging and capture actual error
2. **Quick Fix**: Implement Fix #1 and Fix #4 (error format consistency)
3. **Comprehensive**: Implement all fixes
4. **Validation**:
   - Test with valid Google connection
   - Test with expired token
   - Test with revoked access
   - Test with network timeout
   - Test with invalid syncToken

## Next Steps

1. ✅ **Implement Fix #1** (API route error format) - 5 minutes
2. ✅ **Implement Fix #4** (frontend error handling) - 5 minutes
3. ✅ **Implement Fix #2** (better logging) - 10 minutes
4. 🔄 **Test sync with logging enabled** - capture actual error
5. 🔄 **Fix root cause** based on actual error message
6. ✅ **Add integration test** for error scenarios

## Files to Modify

1. `web/app/api/google/contacts/sync/route.ts` - Lines 123-137
2. `web/components/google/google-contacts-sync.tsx` - Lines 55-65
3. `ecosystem.config.cjs` - Add LOG_LEVEL=debug temporarily

## Risk Assessment

- **Impact**: HIGH - Users cannot sync contacts
- **Complexity**: LOW - Simple error formatting fix
- **Testing**: MEDIUM - Need to test multiple failure scenarios
- **Rollback**: EASY - Changes are non-breaking

## Conclusion

The "Unknown error" is caused by a mismatch between:
- **Frontend** expecting: `data.error` (string)
- **Backend** returning: `data.errors` (array)

Quick fix: Make backend return both `error` and `errors` fields.
Proper fix: Standardize error response format across the application.

The actual underlying Google API error is being masked by this formatting issue. Once we fix the error display, we'll see the real error message and can address the root cause.
