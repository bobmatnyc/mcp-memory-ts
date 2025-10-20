# Google OAuth Fix Testing Checklist

## Pre-Testing Setup

### Environment Configuration

- [ ] **Google Cloud Console Setup**
  - [ ] Google People API is enabled
  - [ ] OAuth 2.0 credentials configured
  - [ ] Redirect URI: `http://localhost:3002/api/auth/google-connect/callback`
  - [ ] Contacts scope in OAuth consent screen

- [ ] **Local Environment Variables**
  ```bash
  GOOGLE_CLIENT_ID=your-client-id
  GOOGLE_CLIENT_SECRET=your-client-secret
  NEXT_PUBLIC_APP_URL=http://localhost:3002
  TURSO_URL=your-database-url
  TURSO_AUTH_TOKEN=your-auth-token
  ```

- [ ] **Build Project**
  ```bash
  npm run build
  cd web && npm run build && cd ..
  ```

- [ ] **Start Web Server**
  ```bash
  ./START_WEB_SERVER.sh
  # Or: cd web && npm run dev -- -p 3002
  ```

---

## Test Suite 1: Valid OAuth Flow

### Test 1.1: Fresh Connection (No Existing Tokens)

**Objective**: Verify new OAuth connection works with enhanced logging

**Steps**:
1. [ ] Open browser: `http://localhost:3002`
2. [ ] Log in with Clerk account
3. [ ] Navigate to Google Contacts sync page
4. [ ] Click "Connect Google Account"
5. [ ] Complete OAuth consent flow
6. [ ] Grant "See and download contact info" permission
7. [ ] Redirect back to app

**Expected Results**:
- [ ] OAuth callback succeeds
- [ ] Tokens stored in database
- [ ] Console logs:
  ```
  [GoogleAuthService] Storing tokens for user: ...
  [GoogleAuthService] Token storage result: { tokensStored: true }
  ```
- [ ] Status shows "Connected"

**Actual Results**:
```
[ ] PASS / [ ] FAIL
Notes:
```

---

### Test 1.2: Successful Sync with Valid Tokens

**Objective**: Verify sync works with proper logging and completes successfully

**Steps**:
1. [ ] Ensure Google account is connected (from Test 1.1)
2. [ ] Navigate to Contacts Sync page
3. [ ] Select direction: "Import from Google"
4. [ ] Click "Start Sync"
5. [ ] Monitor browser console and server logs

**Expected Results**:
- [ ] Console logs show:
  ```
  [GoogleContactsSync] Processing contacts sync for user: { userId, userEmail }
  [GoogleContactsSync] User has valid contacts scope
  [GooglePeopleClient] Starting getAllContacts with syncToken: false
  [GooglePeopleClient] Calling People API (page)...
  [GooglePeopleClient] Received X contacts in page
  [GooglePeopleClient] getAllContacts completed: { totalContacts: X, durationMs: Y }
  [GoogleContactsSync] API call completed: { success: true, contactCount: X }
  ```
- [ ] Sync completes successfully
- [ ] Response includes imported/updated counts
- [ ] Sync duration < 30 seconds (for reasonable contact count)

**Actual Results**:
```
[ ] PASS / [ ] FAIL
Contacts synced:
Duration:
Notes:
```

---

## Test Suite 2: Token Refresh

### Test 2.1: Auto Token Refresh During Sync

**Objective**: Verify token auto-refresh works without race condition

**Setup**:
1. [ ] Modify OAuth tokens in database to be near expiry:
   ```sql
   UPDATE users
   SET metadata = json_set(metadata, '$.googleOAuthTokens.expiry_date', CAST((strftime('%s', 'now') + 300) * 1000 AS INTEGER))
   WHERE email = 'your-email@example.com';
   ```
2. [ ] Wait for tokens to expire (or manually expire them)

**Steps**:
1. [ ] Trigger sync immediately after token expiry
2. [ ] Monitor logs for token refresh

**Expected Results**:
- [ ] Console logs show:
  ```
  🔄 OAuth tokens auto-refreshed for user: ...
  [GoogleAuthService] Storing tokens for user: ...
  [GoogleAuthService] Token storage result: { tokensStored: true }
  ```
- [ ] No error about "Waiting for existing token refresh"
- [ ] Sync continues successfully after refresh
- [ ] Database contains new access token
- [ ] No duplicate token storage operations

**Actual Results**:
```
[ ] PASS / [ ] FAIL
Token refresh observed: [ ] YES / [ ] NO
Sync success after refresh: [ ] YES / [ ] NO
Notes:
```

---

### Test 2.2: Concurrent API Calls During Token Refresh

**Objective**: Verify no race condition when multiple requests trigger refresh

**Steps**:
1. [ ] Expire OAuth tokens (similar to Test 2.1)
2. [ ] Trigger 3 simultaneous API calls:
   - Import sync
   - Export sync
   - Status check
3. [ ] Monitor logs for synchronization

**Expected Results**:
- [ ] Only one token refresh operation starts
- [ ] Other operations wait: `[GoogleAuthService] Waiting for existing token refresh...`
- [ ] All operations complete successfully
- [ ] No "Failed to store refreshed tokens" errors
- [ ] Database has consistent token state

**Actual Results**:
```
[ ] PASS / [ ] FAIL
Simultaneous refreshes prevented: [ ] YES / [ ] NO
Notes:
```

---

## Test Suite 3: Scope Validation

### Test 3.1: Missing Contacts Scope

**Objective**: Verify sync rejects users without contacts permission

**Setup**:
1. [ ] Modify OAuth scopes in database to exclude contacts:
   ```sql
   UPDATE users
   SET metadata = json_set(metadata, '$.googleOAuthTokens.scope', 'openid email profile')
   WHERE email = 'your-email@example.com';
   ```

**Steps**:
1. [ ] Trigger sync
2. [ ] Observe error response

**Expected Results**:
- [ ] HTTP 403 Forbidden response
- [ ] Error message: "Missing Google Contacts permission. Please reconnect your Google account with contacts access."
- [ ] Response includes: `requiresReconnect: true`
- [ ] Response includes: `grantedScopes: ["openid", "email", "profile"]`
- [ ] Console logs:
  ```
  [GoogleContactsSync] Missing contacts scope for user: ... { grantedScopes: [...] }
  ```

**Actual Results**:
```
[ ] PASS / [ ] FAIL
Error caught: [ ] YES / [ ] NO
Notes:
```

---

## Test Suite 4: Timeout Protection

### Test 4.1: API Call Timeout

**Objective**: Verify 30-second timeout prevents indefinite hangs

**Setup**:
1. [ ] Use network throttling to simulate slow connection:
   - Chrome DevTools: Network tab → Throttling → Custom (1 KB/s)
   - Or use `curl` with `--limit-rate 1K`

**Steps**:
1. [ ] Enable network throttling
2. [ ] Trigger sync with large contact list
3. [ ] Wait and observe timeout

**Expected Results**:
- [ ] Operation times out after ~30 seconds
- [ ] Console logs show:
  ```
  [GooglePeopleClient] Raw error details: { message: "Google People API connections.list timed out after 30000ms" }
  ```
- [ ] User sees error: "Request timed out after 30 seconds. Please try again or check your internet connection."
- [ ] Sync does not hang indefinitely

**Actual Results**:
```
[ ] PASS / [ ] FAIL
Timeout occurred: [ ] YES / [ ] NO
Time to timeout:
Notes:
```

---

### Test 4.2: Sync Operation Timeout

**Objective**: Verify entire sync operation times out after 60 seconds

**Setup**:
1. [ ] Simulate very slow sync (e.g., large contact list + LLM deduplication)

**Steps**:
1. [ ] Trigger sync with `useLLM: true` and large contact count
2. [ ] Monitor for 60-second timeout

**Expected Results**:
- [ ] Operation times out after ~60 seconds
- [ ] Error message: "Sync operation timed out after 60 seconds. This may be due to a large number of contacts or network issues."
- [ ] Partial results may be visible in logs
- [ ] User can retry sync

**Actual Results**:
```
[ ] PASS / [ ] FAIL
Timeout occurred: [ ] YES / [ ] NO
Notes:
```

---

## Test Suite 5: Error Handling

### Test 5.1: Invalid/Revoked Token

**Objective**: Verify proper error message for authentication failures

**Setup**:
1. [ ] Revoke OAuth access in Google account settings:
   - Visit: https://myaccount.google.com/permissions
   - Remove access for your app
2. [ ] Do NOT disconnect in the app (tokens still in database)

**Steps**:
1. [ ] Trigger sync with revoked token
2. [ ] Observe error response

**Expected Results**:
- [ ] HTTP 500 or error response
- [ ] Console logs:
  ```
  [GooglePeopleClient] Raw error details: { statusCode: 401, ... }
  [GoogleContactsSync] API call completed: { success: false, error: { type: "AUTH_ERROR", statusCode: 401 } }
  ```
- [ ] User sees: "Authentication expired. Please reconnect your Google account."

**Actual Results**:
```
[ ] PASS / [ ] FAIL
Error message correct: [ ] YES / [ ] NO
Notes:
```

---

### Test 5.2: Rate Limit Error

**Objective**: Verify rate limit handling with retry guidance

**Setup**:
1. [ ] Trigger many rapid syncs to hit Google API quota
   - Run sync 50+ times in quick succession
   - Or manually mock rate limit error

**Steps**:
1. [ ] Trigger sync until rate limited
2. [ ] Observe error response

**Expected Results**:
- [ ] Console logs:
  ```
  [GooglePeopleClient] Raw error details: { statusCode: 429, ... }
  ```
- [ ] User sees: "Google API rate limit exceeded. Please try again in 60 seconds."
- [ ] Error includes `retryAfter` value

**Actual Results**:
```
[ ] PASS / [ ] FAIL
Rate limit detected: [ ] YES / [ ] NO
Notes:
```

---

### Test 5.3: Network Error

**Objective**: Verify network error handling

**Setup**:
1. [ ] Disconnect internet or firewall block googleapis.com

**Steps**:
1. [ ] Trigger sync with no network
2. [ ] Observe error

**Expected Results**:
- [ ] Console logs show network error
- [ ] User sees: "Network error: ... Please check your internet connection and try again."

**Actual Results**:
```
[ ] PASS / [ ] FAIL
Notes:
```

---

## Test Suite 6: Performance and Logging

### Test 6.1: Performance Metrics

**Objective**: Verify performance logging works

**Steps**:
1. [ ] Trigger sync with moderate contact count (50-200 contacts)
2. [ ] Review performance logs

**Expected Results**:
- [ ] Console logs include:
  ```
  [GooglePeopleClient] getAllContacts completed: {
    totalContacts: X,
    durationMs: Y,
    hasSyncToken: true
  }
  ```
- [ ] Duration is reasonable (< 10 seconds for 100 contacts)
- [ ] Sync token is saved for next incremental sync

**Actual Results**:
```
[ ] PASS / [ ] FAIL
Duration for X contacts: Y ms
Notes:
```

---

### Test 6.2: Incremental Sync (with syncToken)

**Objective**: Verify incremental sync uses saved token

**Steps**:
1. [ ] Complete full sync (Test 1.2)
2. [ ] Add/modify 1-2 contacts in Google Contacts
3. [ ] Trigger sync again (without `forceFull`)
4. [ ] Observe logs

**Expected Results**:
- [ ] Console logs show:
  ```
  🔄 Incremental sync...
  [GooglePeopleClient] Starting getAllContacts with syncToken: true
  ```
- [ ] Only changed contacts are fetched (not all contacts)
- [ ] Sync is faster than full sync

**Actual Results**:
```
[ ] PASS / [ ] FAIL
Incremental sync used: [ ] YES / [ ] NO
Notes:
```

---

## Test Suite 7: Edge Cases

### Test 7.1: Empty Contact List

**Objective**: Verify sync handles empty contact list gracefully

**Steps**:
1. [ ] Delete all contacts in Google Contacts
2. [ ] Trigger sync

**Expected Results**:
- [ ] No errors
- [ ] Console logs: `📊 Fetched 0 contacts from Google`
- [ ] Message: "✅ No contacts to import"

**Actual Results**:
```
[ ] PASS / [ ] FAIL
Notes:
```

---

### Test 7.2: Very Large Contact List

**Objective**: Verify sync handles pagination correctly

**Steps**:
1. [ ] Import 1000+ contacts into Google Contacts
2. [ ] Trigger full sync

**Expected Results**:
- [ ] Multiple pagination requests logged:
  ```
  [GooglePeopleClient] Received 1000 contacts in page
  [GooglePeopleClient] Received 234 contacts in page
  ```
- [ ] All contacts fetched: `totalContacts: 1234`
- [ ] Completes within 60-second timeout

**Actual Results**:
```
[ ] PASS / [ ] FAIL
Total contacts: X
Duration: Y seconds
Notes:
```

---

## Post-Testing Verification

### Database Integrity

- [ ] Check tokens are properly stored:
  ```sql
  SELECT
    email,
    json_extract(metadata, '$.googleOAuthTokens.access_token') as has_access_token,
    json_extract(metadata, '$.googleOAuthTokens.refresh_token') as has_refresh_token,
    json_extract(metadata, '$.googleOAuthConnectedAt') as connected_at
  FROM users
  WHERE email = 'your-email@example.com';
  ```

- [ ] Verify sync tokens saved:
  ```sql
  SELECT
    json_extract(metadata, '$.googleContactsSyncToken') as sync_token,
    json_extract(metadata, '$.googleContactsSyncAt') as sync_at
  FROM users
  WHERE email = 'your-email@example.com';
  ```

### Log Analysis

- [ ] No unexpected errors in logs
- [ ] All API calls have corresponding completion logs
- [ ] Token refreshes are logged correctly
- [ ] Performance metrics are reasonable

---

## Test Summary

| Test Suite | Tests Passed | Tests Failed | Notes |
|------------|--------------|--------------|-------|
| 1. Valid OAuth Flow | / 2 | / 2 | |
| 2. Token Refresh | / 2 | / 2 | |
| 3. Scope Validation | / 1 | / 1 | |
| 4. Timeout Protection | / 2 | / 2 | |
| 5. Error Handling | / 3 | / 3 | |
| 6. Performance | / 2 | / 2 | |
| 7. Edge Cases | / 2 | / 2 | |
| **TOTAL** | **/ 14** | **/ 14** | |

---

## Issues Found

| # | Test | Issue Description | Severity | Status |
|---|------|------------------|----------|--------|
| 1 | | | | |
| 2 | | | | |

---

## Sign-Off

- [ ] All critical tests passing
- [ ] No regressions identified
- [ ] Performance acceptable
- [ ] Error messages user-friendly
- [ ] Ready for production deployment

**Tested By**: ___________________
**Date**: ___________________
**Environment**: ___________________
**Version**: 1.7.2+

---

## Notes

```
Additional observations, issues, or recommendations:




```
