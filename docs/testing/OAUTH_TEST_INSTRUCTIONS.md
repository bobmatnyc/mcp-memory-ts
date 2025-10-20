# Google OAuth Flow Test Instructions

## Pre-Test Verification ✓

The following has been verified:
- ✅ User exists in database with Clerk ID `user_33ZB97Sz4n775IAjl8pY5YZHqYd`
- ✅ User can be found by Clerk ID (OAuth callback lookup will work)
- ✅ Web server is running on port 3002
- ✅ OAuth endpoints are available

## Testing Steps

### 1. Navigate to Settings Page

Open in your browser:
```
http://localhost:3002/settings
```

Sign in with Clerk if prompted (you should already be authenticated).

### 2. Monitor Logs (Optional but Recommended)

Open a separate terminal and run:
```bash
cd /Users/masa/Projects/mcp-memory-ts
pm2 logs mcp-memory-web-3002 --lines 0
```

This will show real-time logs during the OAuth flow.

### 3. Initiate Google Connection

In the Settings page:
1. Find the "Google Integration" section
2. Click the "Connect Google Account" button
3. You'll be redirected to Google's OAuth consent screen

### 4. Complete Google OAuth

On Google's consent screen:
1. Sign in to your Google account (bob@matsuoka.com or other)
2. Review the requested permissions:
   - **Google Contacts** - Read and write access
   - **Google Calendar** - Read access
   - **Gmail** - Read access (if configured)
3. Click "Allow" or "Continue" to grant permissions

### 5. Verify Redirect

After granting permissions:
1. You should be redirected back to: `http://localhost:3002/settings`
2. Check the URL for result parameters:
   - **Success**: `?google_connected=true`
   - **Error**: `?google_error=...`

### 6. Check Connection Status

In the Settings page:
1. The Google Integration status should update to "Connected" with a green indicator
2. You should see:
   - "Connected to Google" message
   - "Disconnect" button (instead of "Connect")
3. If the status doesn't update immediately, refresh the page

### 7. Verify Token Storage

After successful OAuth, run this verification script:

```bash
cd /Users/masa/Projects/mcp-memory-ts
npx tsx /tmp/check-tokens-after-oauth.ts
```

**Expected output:**
```
=== POST-OAUTH VERIFICATION ===
✅ User found
User ID: user_33ZB97Sz4n775IAjl8pY5YZHqYd
Email: bob@matsuoka.com

✅ Metadata exists

✅✅✅ SUCCESS! Google OAuth tokens stored!

Token details:
- Connected at: 2025-10-14T...
- Has access_token? Yes ✓
- Has refresh_token? Yes ✓
- Token type: Bearer
- Expires at: ...
- Scope: ...

OAuth flow completed successfully! 🎉
```

## Expected Behavior

### Success Indicators
- ✅ OAuth callback finds user by Clerk ID
- ✅ No "User not found" errors in logs
- ✅ Tokens stored in `users.metadata` field
- ✅ Status changes to "Connected"
- ✅ Redirect to `/settings?google_connected=true`
- ✅ Green "Connected" indicator in UI

### What to Look For in Logs

**Good signs:**
```
[Google OAuth] Callback received
[Google OAuth] Retrieved tokens successfully
[Google OAuth] User found: user_33ZB97Sz4n775IAjl8pY5YZHqYd
[Google OAuth] Tokens stored successfully
```

**Bad signs (should NOT see these):**
```
[Google OAuth] Error: User not found
[Google OAuth] Error storing tokens
Missing state parameter
Invalid state parameter
```

## Troubleshooting

### Issue: "User not found" error
**Cause**: OAuth callback couldn't find user by Clerk ID
**Solution**: Run pre-test verification again:
```bash
cd /Users/masa/Projects/mcp-memory-ts
npx tsx /tmp/test-oauth-lookup.ts
```

### Issue: Redirect fails or shows error
**Cause**: OAuth configuration issue or Google API error
**Solution**:
1. Check PM2 logs for specific error message
2. Verify Google Cloud Console OAuth configuration
3. Ensure redirect URI matches: `http://localhost:3002/api/auth/google-callback`

### Issue: Status doesn't update to "Connected"
**Cause**: Frontend not detecting token storage
**Solution**:
1. Hard refresh the page (Cmd+Shift+R)
2. Check browser console for errors
3. Run post-OAuth verification script to confirm tokens were stored

### Issue: OAuth flow hangs or times out
**Cause**: State parameter mismatch or session issue
**Solution**:
1. Clear browser cookies for localhost:3002
2. Sign out and sign back in to Clerk
3. Try OAuth flow again

## Post-Test Actions

After successful OAuth:

1. **Test Google Contacts Sync:**
   ```bash
   cd /Users/masa/Projects/mcp-memory-ts
   mcp-memory google contacts-sync --user-email bob@matsuoka.com --direction import
   ```

2. **Test Google Calendar Sync:**
   ```bash
   mcp-memory google calendar-sync --user-email bob@matsuoka.com
   ```

3. **Check Connection Status:**
   ```bash
   mcp-memory google auth --user-email bob@matsuoka.com
   ```

## Summary

This test verifies that:
1. The Clerk ID migration was successful
2. OAuth callback can find user by Clerk ID
3. Google tokens are stored correctly
4. The full OAuth flow works end-to-end

**Key Fix**: User ID changed from UUID to Clerk ID, allowing OAuth callback to find the user record and store tokens successfully.

---

**Created**: 2025-10-14
**User**: bob@matsuoka.com
**Clerk ID**: user_33ZB97Sz4n775IAjl8pY5YZHqYd
