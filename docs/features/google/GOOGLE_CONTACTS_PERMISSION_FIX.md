# Google Contacts "Permission Denied" Error - Investigation Report

**Date**: 2025-10-15
**Status**: Root cause identified ✅
**Severity**: Configuration issue (non-critical)

## Executive Summary

The "Permission denied" error when syncing Google Contacts is **NOT** related to OAuth scopes or user authentication. The root cause is that the **Google People API is not enabled** in the Google Cloud Console project.

## Investigation Results

### 1. User OAuth Scopes ✅ CORRECT

The user (`bob@matsuoka.com`) has **ALL required OAuth scopes**:

```
✓ https://www.googleapis.com/auth/contacts (GRANTED)
✓ https://www.googleapis.com/auth/calendar.readonly (GRANTED)
✓ https://www.googleapis.com/auth/gmail.readonly (GRANTED)
```

**Finding**: Scopes are correctly configured. This is NOT a scope issue.

### 2. OAuth Token Status ✅ VALID

```
- Access token: Present
- Refresh token: Present
- Token type: Bearer
- Expiry date: 2025-10-16T04:32:16.382Z (valid, not expired)
```

**Finding**: OAuth tokens are valid and working. This is NOT a token expiration issue.

### 3. Google API Error 🔴 ROOT CAUSE

**Actual error from Google API**:

```
HTTP 403 Forbidden
Status: PERMISSION_DENIED

Message: "People API has not been used in project 409456389838 before
or it is disabled. Enable it by visiting
https://console.developers.google.com/apis/api/people.googleapis.com/overview?project=409456389838
then retry. If you enabled this API recently, wait a few minutes for
the action to propagate to our systems and retry."
```

**Finding**: The Google People API (Contacts API) is **not enabled** in the Google Cloud project with ID `409456389838`.

### 4. Code Review ✅ CORRECT

All application code is working correctly:

- ✅ OAuth flow requests correct scopes
- ✅ Scope validation is implemented properly
- ✅ Error handling is comprehensive
- ✅ Sync service is correctly implemented

**Finding**: No code changes needed. This is purely a Google Cloud Console configuration issue.

## Root Cause

**The Google People API is not enabled in the Google Cloud Console project.**

Even though:
- OAuth scopes are granted by the user
- Tokens are valid and not expired
- Code is correctly implemented

The API **cannot be called** until it is explicitly enabled in the Google Cloud Console.

## Solution: Enable People API in Google Cloud Console

### Step-by-Step Instructions

1. **Open the People API Configuration Page**

   Click this direct link (or visit manually):
   ```
   https://console.developers.google.com/apis/api/people.googleapis.com/overview?project=409456389838
   ```

2. **Enable the People API**

   - You'll see a page showing "People API"
   - Click the blue **"ENABLE"** button
   - Wait 30-60 seconds for the API to be enabled

3. **Verify API is Enabled**

   - After enabling, you should see "API enabled" status
   - The page will show usage quotas and metrics

4. **Wait for Propagation (if needed)**

   - Google states: "If you enabled this API recently, wait a few minutes for the action to propagate to our systems"
   - Typically takes 1-2 minutes, but can take up to 5 minutes in rare cases

5. **Test the Sync Again**

   - Return to the MCP Memory web interface
   - Go to Settings > Google Integration
   - Click "Sync Contacts" again
   - The sync should now work!

### Alternative: Enable via API Library

If the direct link doesn't work:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project (ID: `409456389838`)
3. Navigate to **"APIs & Services" > "Library"**
4. Search for **"People API"**
5. Click on "People API" in the results
6. Click **"ENABLE"**

## Verification

After enabling the People API, you can verify it's working by:

1. **Test via CLI** (if you have CLI access):
   ```bash
   npx tsx scripts/test-google-contacts-sync.ts
   ```

2. **Test via Web Interface**:
   - Go to Settings > Google Integration
   - Click "Sync Contacts"
   - Should see success message with contact counts

## Additional Notes

### Why This Happened

Google Cloud projects require **explicit enabling** of each API before use. Even if OAuth scopes are granted, the API endpoints cannot be called until the API is enabled in the Cloud Console.

This is a security and cost management feature from Google.

### Other APIs to Check

While you're in the Google Cloud Console, verify these APIs are also enabled for full functionality:

1. **People API** (Contacts) - 🔴 **REQUIRED - Currently disabled**
2. **Google Calendar API** - ✅ Check if enabled
3. **Gmail API** - ✅ Check if enabled

### User Experience Improvement

**Future improvement**: The application could detect this specific error (`PERMISSION_DENIED` with "API has not been used") and provide a more helpful error message directly in the UI, such as:

```
"Google People API is not enabled. Please enable it in Google Cloud Console:
https://console.developers.google.com/apis/api/people.googleapis.com/overview?project=YOUR_PROJECT_ID"
```

## Summary

| Component | Status | Action Required |
|-----------|--------|-----------------|
| OAuth Scopes | ✅ Correct | None |
| OAuth Tokens | ✅ Valid | None |
| Application Code | ✅ Working | None |
| People API | 🔴 Disabled | **Enable in Google Cloud Console** |
| Calendar API | ❓ Unknown | Verify if enabled |
| Gmail API | ❓ Unknown | Verify if enabled |

## Timeline

- **Initial report**: "Permission denied" error during Google Contacts sync
- **Investigation completed**: 2025-10-15
- **Root cause identified**: People API not enabled
- **Resolution time**: ~5 minutes (enable API + propagation)

## References

- Google Cloud Project ID: `409456389838`
- Direct link to enable People API: https://console.developers.google.com/apis/api/people.googleapis.com/overview?project=409456389838
- API Documentation: https://developers.google.com/people
- OAuth Scope Documentation: https://developers.google.com/identity/protocols/oauth2/scopes#people

---

**Status**: Waiting for user to enable People API in Google Cloud Console
