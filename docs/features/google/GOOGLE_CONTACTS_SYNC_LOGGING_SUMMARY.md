# Google Contacts Sync Logging Implementation Summary

## Overview

Added comprehensive logging throughout the Google Contacts sync flow to debug the "Unexpected end of JSON input" error. The logging system provides complete visibility into every step of the sync process from frontend request to backend response.

## Files Modified

### 1. Backend API Route
**File:** `web/app/api/google/contacts/sync/route.ts`

**Changes:**
- Added unique request ID generation for request correlation
- Added timing measurements (startTime, duration)
- Added detailed logging at every step:
  - Request start with full context
  - Authentication status
  - User data retrieval
  - Request parameter parsing
  - Database initialization
  - Google Auth Service setup
  - Connection validation
  - Scope validation
  - Sync operation start/completion
  - Response preparation and validation
  - JSON response creation with error handling
- Enhanced error handling with comprehensive error logging
- Added fallback to plain text response if JSON creation fails
- All logs include request ID for correlation

**Key Improvements:**
- Every step is logged with structured data
- Response size is validated before sending
- JSON stringification is wrapped in try/catch
- Detailed error context including stack traces
- Duration tracking for performance analysis

### 2. Frontend Component
**File:** `web/components/google/google-contacts-sync.tsx`

**Changes:**
- Added unique request ID generation (prefixed with "frontend-")
- Added timing measurements throughout
- Enhanced request logging with full parameters
- Added response inspection before parsing:
  - Read response as text first
  - Log raw response preview (first 300 and last 100 chars)
  - Log response headers (Content-Type, Content-Length)
  - Log HTTP status details
- Added detailed JSON parsing with comprehensive error handling:
  - Try/catch around JSON.parse()
  - Log parse success or failure
  - Identify if response is HTML instead of JSON
  - Show first/last characters to identify truncation
- All logs include frontend request ID
- Better error messages with response preview

**Key Improvements:**
- Can see exact raw response before parsing attempts
- Identifies HTML error pages vs JSON
- Detects truncated responses
- Shows response size and headers
- Complete error context for debugging

### 3. Sync Service
**File:** `src/services/google-contacts-sync.ts`

**Changes:**
- Added unique sync ID generation
- Added timing measurements for entire sync and phases
- Enhanced service-level logging:
  - Sync service start with full options
  - Auth client retrieval
  - Import phase start/completion with timing
  - Export phase start/completion with timing
  - User lookup with details
  - Google API call timing
  - Detailed API response logging
  - Service completion with full results
- Enhanced error handling with detailed error logging
- All logs include sync ID for correlation

**Key Improvements:**
- Can track sync performance by phase
- Detailed visibility into Google API calls
- User lookup process fully logged
- Error context includes stack traces
- Complete timing data for optimization

## Log Flow Architecture

### Request Correlation

Each request generates unique IDs at three levels:

1. **Frontend Request ID**: `frontend-{timestamp}-{random}`
   - Tracks user interaction through browser
   - Visible in browser console

2. **Backend Request ID**: `req-{timestamp}-{random}`
   - Tracks API request handling
   - Visible in server logs

3. **Sync Service ID**: `sync-{timestamp}-{random}`
   - Tracks sync operation execution
   - Visible in server logs

**Correlation**: Use timestamps to match IDs across layers (timestamps are within milliseconds).

### Log Levels

- **`console.log`**: Informational logs for normal operation flow
- **`console.error`**: Error conditions, failures, and warnings

### Log Structure

All logs follow consistent format:
```
[Component Name][ID] Message
{
  structured: 'data',
  with: 'context'
}
```

Example:
```
[GoogleContactsSync Frontend][frontend-1729123456789-abc123] ===== SYNC STARTED =====
{
  timestamp: '2025-10-16T12:34:56.789Z',
  direction: 'import',
  dryRun: false
}
```

## Debugging the JSON Parse Error

### Step 1: Reproduce the Error

1. Open browser DevTools Console (F12)
2. Enable "Preserve log"
3. Click "Sync Now" button
4. Watch console for error

### Step 2: Identify the Request

Look for:
```
[GoogleContactsSync Frontend][frontend-XXXXXXXXX-XXX] ===== SYNC STARTED =====
```

Note the request ID.

### Step 3: Check Response Inspection

Find the response logs:
```
[GoogleContactsSync Frontend][frontend-XXXXXXXXX-XXX] Response body received
{
  length: XXX,
  preview: "...",
  lastChars: "..."
}
```

**Key checks:**
- Is `length` 0? → Response is empty
- Does `preview` start with `<`? → Getting HTML error page
- Does response look truncated? → Check `lastChars`

### Step 4: Check JSON Parse Attempt

Look for:
```
[GoogleContactsSync Frontend][frontend-XXXXXXXXX-XXX] JSON PARSE ERROR
{
  error: "Unexpected end of JSON input",
  responseText: "...",
  responseLength: XXX,
  isHTML: false/true,
  firstChar: "X",
  lastChar: "X"
}
```

**Key indicators:**
- `isHTML: true` → Server returned error page instead of JSON
- `lastChar` not `}` → JSON truncated mid-response
- `responseLength: 0` → Empty response

### Step 5: Check Server Logs

Match the frontend request by timestamp to backend request:

**Development:**
```bash
cd web
npm run dev
# Logs appear in terminal
```

**Production:**
```bash
pm2 logs mcp-memory-web
```

Find the matching request:
```
[GoogleContactsSync API][req-XXXXXXXXX-XXX] ===== REQUEST STARTED =====
{
  timestamp: '2025-10-16T12:34:56.790Z',  // Just after frontend
  ...
}
```

### Step 6: Trace the Failure Point

Follow the log sequence to find where it stops or shows errors:

1. ✅ Request started
2. ✅ Auth successful
3. ✅ User data retrieved
4. ✅ Database initialized
5. ✅ Google Auth initialized
6. ✅ Connection validated
7. ✅ Scope validated
8. ✅ Sync service started
9. ❌ **[STOPS HERE]** ← This is where the problem occurred

### Step 7: Analyze the Error

Check the error logs at the failure point:
```
[GoogleContactsSync API][req-XXXXXXXXX-XXX] ===== REQUEST FAILED (XXXms) =====
{
  error: {
    name: "Error",
    message: "Actual error message",
    stack: "..."
  }
}
```

## Common Patterns and Solutions

### Pattern 1: Empty Response

**Logs:**
```
[GoogleContactsSync Frontend] Response body received { length: 0 }
```

**Cause:** Server crashed or request timed out before response sent

**Solution:**
- Check server logs for crash or exception
- Check timeout settings (currently 60s)
- Check server resources (memory, CPU)

### Pattern 2: HTML Error Page

**Logs:**
```
[GoogleContactsSync Frontend] JSON PARSE ERROR { isHTML: true, firstChar: '<' }
[GoogleContactsSync Frontend] responseText: "<!DOCTYPE html>..."
```

**Cause:** Server returned error page (404, 500, etc.) instead of JSON

**Solution:**
- Check HTTP status code
- Check server error logs
- Verify API route exists
- Check middleware/auth interceptors

### Pattern 3: Truncated JSON

**Logs:**
```
[GoogleContactsSync Frontend] JSON PARSE ERROR { lastChar: ',', responseLength: 5000 }
```

**Cause:** Response was cut off mid-JSON (timeout, memory limit, connection issue)

**Solution:**
- Check for timeout during response streaming
- Check response size limits (Next.js defaults)
- Check network stability
- Check server memory during sync

### Pattern 4: Invalid JSON Structure

**Logs:**
```
[GoogleContactsSync API] Response structure validated { hasAllFields: true, responseSize: 1234 }
[GoogleContactsSync API] ERROR creating JSON response { error: "..." }
```

**Cause:** Result object contains data that can't be serialized to JSON

**Solution:**
- Check sync result for circular references
- Check for undefined or function values
- Check for BigInt values (not JSON-serializable)
- Check for special objects (Date, Map, Set)

### Pattern 5: Sync Service Failure

**Logs:**
```
[GoogleContactsSync Service][sync-XXX] ===== SYNC SERVICE FAILED (XXXms) =====
{
  error: { message: "..." }
}
```

**Cause:** Error during actual sync operation

**Solution:**
- Check Google API credentials
- Check database connection
- Check OpenAI API key (if using LLM dedup)
- Check network to Google APIs
- Review specific error message

## Testing Instructions

### Test 1: Successful Sync

**Expected logs:**
```
1. [Frontend] SYNC STARTED
2. [Frontend] Preparing fetch request
3. [API] REQUEST STARTED
4. [API] Auth successful
5. [API] User data retrieved
6. [API] Database initialized
7. [API] Google Auth initialized
8. [API] Connection validated
9. [API] Scope validated
10. [API] Starting sync operation
11. [Service] SYNC SERVICE STARTED
12. [Service] Auth client obtained
13. [Service] Starting IMPORT phase
14. [Service] User found
15. [Service] Calling Google People API
16. [Service] API call completed
17. [Service] IMPORT phase completed
18. [Service] SYNC SERVICE COMPLETED
19. [API] Sync service completed
20. [API] Sync operation finished
21. [API] Response structure validated
22. [API] REQUEST COMPLETED
23. [Frontend] Fetch completed
24. [Frontend] Response body received
25. [Frontend] JSON parsed successfully
26. [Frontend] SYNC COMPLETED
```

### Test 2: Authentication Error

**Expected logs:**
```
1-4. [Same as above]
5. [API] User not connected to Google
6. [API] Sending error response
7. [Frontend] JSON parsed successfully
8. [Frontend] Sync failed (HTTP 400)
```

### Test 3: Parse Error (Current Issue)

**Expected logs:**
```
1-22. [Same as successful sync]
23. [Frontend] Fetch completed
24. [Frontend] Response body received { preview: "..." }
25. [Frontend] JSON PARSE ERROR
26. [Frontend] SYNC FAILED
```

**Analysis needed:**
- What does `preview` contain?
- Is `isHTML` true?
- What is `responseLength`?
- What is `lastChar`?

## Performance Monitoring

The logging system also tracks timing:

- **Request duration**: Total time from start to completion
- **Fetch duration**: Network round-trip time
- **Sync operation duration**: Total sync time
- **Import phase duration**: Time to import from Google
- **Export phase duration**: Time to export to Google
- **API call duration**: Time for Google People API call

Use these to identify slow operations:
```
[GoogleContactsSync API][req-XXX] REQUEST COMPLETED (45678ms)
```

If duration is near timeout (60000ms), consider:
- Increasing timeout
- Optimizing sync logic
- Batching operations
- Using incremental sync instead of full sync

## Next Steps

1. **Run the sync operation** with logging enabled
2. **Copy all console logs** (both browser and server)
3. **Analyze the logs** following this guide
4. **Identify the exact failure point**
5. **Implement targeted fix** based on the failure pattern
6. **Re-test** and verify fix with logs

## Log Cleanup (Future)

Once the issue is resolved, consider:

1. **Reduce verbosity** in production:
   ```typescript
   const DEBUG = process.env.DEBUG_SYNC === 'true';
   if (DEBUG) console.log(...);
   ```

2. **Keep critical logs**:
   - Request/sync start and end
   - Errors and failures
   - Performance timing

3. **Remove debugging logs**:
   - Step-by-step progress
   - Parameter dumps
   - Response previews

4. **Add log levels**:
   - ERROR: Only errors
   - INFO: Start/end of operations
   - DEBUG: Detailed step-by-step
   - TRACE: Everything including data dumps

## Additional Resources

- **Full Logging Guide**: See `GOOGLE_CONTACTS_SYNC_LOGGING_GUIDE.md`
- **API Documentation**: See `docs/api/GOOGLE_API_REFERENCE.md`
- **Sync Guide**: See `docs/guides/GOOGLE_CONTACTS_SYNC_GUIDE.md`

---

**Implementation Date**: October 16, 2025
**Version**: 1.7.2
**Status**: Ready for debugging
