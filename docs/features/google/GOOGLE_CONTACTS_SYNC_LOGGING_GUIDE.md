# Google Contacts Sync - Comprehensive Logging Guide

## Overview

This guide explains the comprehensive logging system added to debug the "Unexpected end of JSON input" error during Google Contacts synchronization.

## Log Structure

All logs follow a consistent format with:
- **Prefix**: Identifies the component (`[GoogleContactsSync API]`, `[GoogleContactsSync Frontend]`, `[GoogleContactsSync Service]`)
- **Request ID**: Unique identifier for request correlation (e.g., `req-1729123456789-abc123`)
- **Log Level**: `console.log` for info, `console.error` for errors
- **Structured Data**: JSON objects with relevant context

## Logging Points

### 1. Frontend Component (`web/components/google/google-contacts-sync.tsx`)

#### Sync Start
```
[GoogleContactsSync Frontend][{requestId}] ===== SYNC STARTED =====
{
  timestamp: ISO timestamp,
  direction: 'import' | 'export' | 'both',
  dryRun: boolean,
  forceFull: boolean,
  useLLM: boolean
}
```

#### Fetch Request
```
[GoogleContactsSync Frontend][{requestId}] Preparing fetch request
{
  url: '/api/google/contacts/sync',
  method: 'POST',
  body: request parameters
}
```

#### Fetch Response
```
[GoogleContactsSync Frontend][{requestId}] Fetch completed ({duration}ms)
{
  ok: boolean,
  status: HTTP status code,
  statusText: HTTP status text,
  contentType: response Content-Type header,
  contentLength: response size
}
```

#### Response Body Inspection
```
[GoogleContactsSync Frontend][{requestId}] Response body received
{
  length: response text length,
  preview: first 300 characters,
  lastChars: last 100 characters (if > 300 chars)
}
```

#### JSON Parsing
**Success:**
```
[GoogleContactsSync Frontend][{requestId}] JSON parsed successfully
{
  success: boolean,
  exported: number,
  imported: number,
  updated: number,
  errorCount: number
}
```

**Error:**
```
[GoogleContactsSync Frontend][{requestId}] JSON PARSE ERROR
{
  error: parse error message,
  responseText: first 500 characters,
  responseLength: total length,
  isHTML: whether response starts with '<',
  firstChar: first character,
  lastChar: last character
}
```

### 2. Backend API Route (`web/app/api/google/contacts/sync/route.ts`)

#### Request Start
```
[GoogleContactsSync API][{requestId}] ===== REQUEST STARTED =====
{
  timestamp: ISO timestamp,
  method: 'POST',
  url: request URL
}
```

#### Authentication
```
[GoogleContactsSync API][{requestId}] Auth successful
{
  userId: Clerk user ID
}
```

#### User Data
```
[GoogleContactsSync API][{requestId}] User data retrieved
{
  userId: Clerk user ID,
  userEmail: user email address,
  emailCount: number of email addresses
}
```

#### Request Parameters
```
[GoogleContactsSync API][{requestId}] Request parameters
{
  direction: 'import' | 'export' | 'both',
  dryRun: boolean,
  forceFull: boolean,
  useLLM: boolean
}
```

#### Database & Services
```
[GoogleContactsSync API][{requestId}] Initializing database operations...
[GoogleContactsSync API][{requestId}] Database initialized

[GoogleContactsSync API][{requestId}] Initializing Google Auth Service...
[GoogleContactsSync API][{requestId}] Google Auth Service initialized

[GoogleContactsSync API][{requestId}] Checking Google connection...
[GoogleContactsSync API][{requestId}] Google connection status: {isConnected}

[GoogleContactsSync API][{requestId}] Validating contacts scope...
[GoogleContactsSync API][{requestId}] Scope validation result
{
  hasContactsScope: boolean,
  grantedScopes: array of scopes
}
```

#### Sync Operation
```
[GoogleContactsSync API][{requestId}] Starting sync operation (timeout: 60000ms)...
[GoogleContactsSync API][{requestId}] Initializing sync service...
[GoogleContactsSync API][{requestId}] Calling sync service...
{
  userId: user email,
  direction: sync direction,
  dryRun: boolean,
  forceFull: boolean,
  enableLLMDedup: boolean
}
```

#### Sync Completion
```
[GoogleContactsSync API][{requestId}] Sync service completed
{
  success: boolean,
  exported: number,
  imported: number,
  updated: number,
  errorCount: number
}

[GoogleContactsSync API][{requestId}] Sync operation finished
{
  success: boolean,
  duration: '{ms}ms',
  exported: number,
  imported: number,
  updated: number,
  merged: number,
  duplicatesFound: number,
  errorCount: number
}
```

#### Response Preparation
```
[GoogleContactsSync API][{requestId}] Preparing JSON response...

[GoogleContactsSync API][{requestId}] Response structure validated
{
  hasAllFields: boolean,
  responseSize: size in characters
}

[GoogleContactsSync API][{requestId}] ===== REQUEST COMPLETED ({duration}ms) =====
```

#### Error Handling
```
[GoogleContactsSync API][{requestId}] ===== REQUEST FAILED ({duration}ms) =====
{
  error: {
    name: error name,
    message: error message,
    stack: first 10 lines of stack trace
  },
  timestamp: ISO timestamp
}
```

### 3. Sync Service (`src/services/google-contacts-sync.ts`)

#### Service Start
```
[GoogleContactsSync Service][{syncId}] ===== SYNC SERVICE STARTED =====
{
  timestamp: ISO timestamp,
  userId: user identifier,
  direction: sync direction,
  dryRun: boolean,
  forceFull: boolean,
  enableLLMDedup: boolean
}
```

#### Authentication
```
[GoogleContactsSync Service][{syncId}] Getting auth client...
[GoogleContactsSync Service][{syncId}] Auth client obtained
```

#### Import Phase
```
[GoogleContactsSync Service][{syncId}] Starting IMPORT phase...
[GoogleContactsSync Service] 📥 Importing from Google Contacts...
[GoogleContactsSync Service] Looking up user: {userId}
[GoogleContactsSync Service] User found:
{
  id: user ID,
  email: user email
}

[GoogleContactsSync Service] Calling Google People API...
[GoogleContactsSync Service] API call completed ({duration}ms):
{
  success: boolean,
  error: error details (if any),
  contactCount: number of contacts fetched
}

[GoogleContactsSync Service][{syncId}] IMPORT phase completed ({duration}ms)
{
  imported: number,
  updated: number,
  errorCount: number
}
```

#### Export Phase
```
[GoogleContactsSync Service][{syncId}] Starting EXPORT phase...
[GoogleContactsSync Service] 📤 Exporting to Google Contacts...

[GoogleContactsSync Service][{syncId}] EXPORT phase completed ({duration}ms)
{
  exported: number,
  errorCount: number
}
```

#### Service Completion
```
[GoogleContactsSync Service][{syncId}] ===== SYNC SERVICE COMPLETED ({duration}ms) =====
{
  success: boolean,
  exported: number,
  imported: number,
  updated: number,
  duplicatesFound: number,
  merged: number,
  totalErrors: number
}
```

## Reading the Logs

### Finding JSON Parsing Errors

1. **Look for the request ID** in both frontend and backend logs
2. **Check the frontend logs** for JSON parse errors:
   ```
   [GoogleContactsSync Frontend][{requestId}] JSON PARSE ERROR
   ```
3. **Examine the response preview** to see what was actually received
4. **Check if response is HTML** (isHTML field):
   - If true, likely getting an error page instead of JSON
   - Check status code and error logs

### Correlating Frontend and Backend

Use the timestamp to match frontend requests with backend requests:
```
Frontend: [GoogleContactsSync Frontend][frontend-1729123456789-abc123] ===== SYNC STARTED =====
Backend:  [GoogleContactsSync API][req-1729123456790-def456] ===== REQUEST STARTED =====
```

The timestamps will be within milliseconds of each other.

### Identifying the Failure Point

Follow the log sequence:
1. **Frontend sends request** → logs request body
2. **Backend receives request** → logs all parameters
3. **Backend validates auth & scopes** → logs validation results
4. **Backend calls sync service** → logs sync options
5. **Service performs sync** → logs each phase
6. **Backend prepares response** → logs response structure
7. **Frontend receives response** → logs raw response text
8. **Frontend parses JSON** → logs parse result or error

The failure point is where logs stop or show an error.

## Common Issues and Patterns

### Issue: Empty Response
**Logs show:**
```
[GoogleContactsSync Frontend] Response body received { length: 0, preview: '', ... }
```
**Cause:** Request may have timed out or server crashed
**Solution:** Check backend logs for timeout or crash

### Issue: HTML Response
**Logs show:**
```
[GoogleContactsSync Frontend] JSON PARSE ERROR { isHTML: true, firstChar: '<', ... }
```
**Cause:** Getting error page instead of API response
**Solution:** Check status code and backend error logs

### Issue: Incomplete JSON
**Logs show:**
```
[GoogleContactsSync Frontend] JSON PARSE ERROR
{ responseLength: 1234, lastChar: ',' }
```
**Cause:** Response was truncated mid-JSON
**Solution:** Check for timeout, memory issues, or large response size

### Issue: Backend Error Before Response
**Logs show:**
```
[GoogleContactsSync API] Sync operation finished
[GoogleContactsSync API] ERROR creating JSON response
```
**Cause:** Response object contains invalid data
**Solution:** Check sync service logs for data issues

## Testing the Logging

### Enable Browser Console

1. Open Chrome DevTools (F12)
2. Go to Console tab
3. Filter by `GoogleContactsSync`
4. Click "Sync Now" button

### Check Server Logs

**Development (Next.js dev server):**
```bash
cd web
npm run dev
# Logs appear in terminal
```

**Production (PM2):**
```bash
pm2 logs mcp-memory-web
# Or check specific log files
tail -f ~/.pm2/logs/mcp-memory-web-out.log
tail -f ~/.pm2/logs/mcp-memory-web-error.log
```

### Reproduce the Error

1. Open browser console
2. Enable "Preserve log" in DevTools
3. Click "Sync Now"
4. Watch logs in both browser and server terminal
5. Look for the specific error pattern

## Log Analysis Checklist

When debugging "Unexpected end of JSON input":

- [ ] Check frontend logs for request ID
- [ ] Find matching backend request ID by timestamp
- [ ] Verify request reached backend (REQUEST STARTED log)
- [ ] Check authentication succeeded
- [ ] Verify sync service was called
- [ ] Check sync service completed successfully
- [ ] Verify response preparation (Response structure validated)
- [ ] Check if JSON response creation succeeded
- [ ] Verify frontend received response (Fetch completed)
- [ ] Check response Content-Type is application/json
- [ ] Examine raw response text preview
- [ ] Identify where JSON parsing failed
- [ ] Check for HTML error pages (isHTML: true)
- [ ] Look for truncated responses (lastChar != '}')
- [ ] Check response size (may be too large)

## Next Steps

After identifying the failure point:

1. **If error in sync service:** Check Google API errors and database operations
2. **If error in response creation:** Check for invalid data in result object
3. **If error in transmission:** Check network, timeouts, or size limits
4. **If error in parsing:** Check Content-Type and actual response format

## Additional Debugging

### Enable More Verbose Logging

Set environment variable for even more detail:
```bash
export DEBUG=*
npm run dev
```

### Check Network Tab

In Chrome DevTools Network tab:
1. Filter by `google/contacts/sync`
2. Click the request
3. Check Response tab (see raw response)
4. Check Headers tab (verify Content-Type)
5. Check Timing tab (identify slow operations)

### Test API Directly

Use curl to test the API endpoint:
```bash
curl -X POST http://localhost:3002/api/google/contacts/sync \
  -H "Content-Type: application/json" \
  -H "Cookie: YOUR_SESSION_COOKIE" \
  -d '{"direction":"import","dryRun":true}' \
  -v
```

This will show the raw HTTP response and help identify if the issue is in the API or the frontend.

---

**Note**: These logs will be verbose during debugging. Once the issue is resolved, consider reducing log verbosity for production by wrapping some logs in `if (process.env.DEBUG_SYNC)` conditions.
