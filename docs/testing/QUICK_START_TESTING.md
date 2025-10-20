# 🚀 Quick Start: Test Google Contacts Sync Logging

**One-page guide to start testing immediately**

---

## Step 1: Open Two Terminal Windows

### Terminal 1 - Monitor Logs
```bash
pm2 logs mcp-memory-web --lines 100
```
Keep this running to watch logs in real-time.

### Terminal 2 - Quick Commands
Keep this ready for status checks and troubleshooting.

---

## Step 2: Open Application

```bash
open http://localhost:3001
```

Or paste in browser: `http://localhost:3001`

---

## Step 3: Authenticate

1. Click "Sign In"
2. Use your Clerk credentials
3. Wait for dashboard to load

---

## Step 4: Connect Google (if needed)

1. Go to **Settings** (top right menu)
2. Scroll to **Google Integration** section
3. Click **Connect Google Account**
4. Authorize access to Google Contacts
5. Wait for confirmation

**Skip if already connected** - check status in Settings first.

---

## Step 5: Start Test Sync

1. Navigate to **Sync** page (left sidebar)
2. Click **Google Contacts** tab
3. Configure sync:
   - **Direction**: Import (Google → MCP Memory)
   - **Auto-merge duplicates**: ✅ Enabled
4. Click **Start Sync**

---

## Step 6: Watch Logs in Terminal 1

You should immediately see:

```
[GoogleContactsSync] [req-xxxxxxxx] Starting sync request
[GoogleContactsSync] [req-xxxxxxxx] User authenticated: your-email@example.com
[GoogleContactsSync] [req-xxxxxxxx] Sync direction: import
[GoogleContactsSync] [req-xxxxxxxx] Fetching contacts from Google API
[GoogleContactsSync] [req-xxxxxxxx] Retrieved X contacts from Google
[GoogleContactsSync] [req-xxxxxxxx] Processing batch 1/Y (Z contacts)
...
[GoogleContactsSync] [req-xxxxxxxx] Sync completed in X.Xs
[GoogleContactsSync] [req-xxxxxxxx] Summary: X created, Y merged, 0 errors
```

**Note the request ID** (e.g., `req-a7b3c9d2`) - all logs for this sync will have it.

---

## Step 7: Verify Logging Quality

**Check for**:
- ✅ Request ID present on every log line
- ✅ Component prefix `[GoogleContactsSync]`
- ✅ User email shown
- ✅ Sync parameters logged
- ✅ Progress updates per batch
- ✅ Completion summary with counts
- ✅ Duration metric at end

**If errors occur**:
- ✅ ERROR prefix visible
- ✅ Full error message
- ✅ Stack trace included
- ✅ Recovery suggestion provided

---

## Common Scenarios

### First Time Setup
```
[GoogleContactsSync] [req-abc123] Starting sync request
[GoogleContactsSync] [req-abc123] User authenticated: you@example.com
[GoogleContactsSync] [req-abc123] Retrieved 150 contacts from Google
[GoogleContactsSync] [req-abc123] Processing batch 1/3 (50 contacts)
[GoogleContactsSync] [req-abc123] No duplicates found
[GoogleContactsSync] [req-abc123] Created 50 new contacts
[GoogleContactsSync] [req-abc123] Processing batch 2/3 (50 contacts)
...
[GoogleContactsSync] [req-abc123] Sync completed in 35.4s
[GoogleContactsSync] [req-abc123] Summary: 150 created, 0 merged, 0 errors
```

### Sync with Duplicates
```
[GoogleContactsSync] [req-def456] Processing batch 1/2 (50 contacts)
[GoogleContactsSync] [req-def456] Checking for duplicates using LLM
[GoogleContactsSync] [req-def456] Found 3 potential duplicates
[GoogleContactsSync] [req-def456] Duplicate: "John Smith" matches existing contact
[GoogleContactsSync] [req-def456] Merged 1 contact
[GoogleContactsSync] [req-def456] Created 49 new contacts
...
[GoogleContactsSync] [req-def456] Summary: 97 created, 3 merged, 0 errors
```

### Error Example
```
[GoogleContactsSync] [req-ghi789] ERROR: Google OAuth tokens invalid
[GoogleContactsSync] [req-ghi789] Token has been expired or revoked
[GoogleContactsSync] [req-ghi789] Suggestion: Reconnect Google account in Settings
```

---

## Quick Troubleshooting

### No logs appearing?
```bash
# In Terminal 2, check server status
pm2 status mcp-memory-web

# If stopped, restart
pm2 restart mcp-memory-web

# Check last 50 error logs
pm2 logs mcp-memory-web --err --lines 50
```

### Sync button disabled?
1. Check you're signed in (Clerk)
2. Verify Google account connected (Settings)
3. Ensure no sync is currently running

### "Not authenticated" error?
1. Sign out and sign in again
2. Clear browser cookies for localhost
3. Check Clerk status in Settings

### Google OAuth error?
1. Go to Settings
2. Click "Disconnect" Google account
3. Click "Connect" again
4. Re-authorize access
5. Retry sync

---

## Success Checklist

After your test sync, verify:

- [ ] Request ID was visible in logs
- [ ] All log lines had `[GoogleContactsSync]` prefix
- [ ] User email was logged at start
- [ ] Sync direction was clearly stated
- [ ] Progress updates showed batch processing
- [ ] Contact counts were accurate
- [ ] Completion summary matched actual results
- [ ] Duration metric was shown
- [ ] No unexpected errors occurred
- [ ] If errors did occur, they had full context

---

## Next Steps After Testing

### If Everything Worked
1. Try different sync directions (Export, Both)
2. Test with larger contact lists
3. Intentionally disconnect Google to see error logging
4. Monitor performance with different batch sizes

### If Issues Found
1. **Note the request ID** from logs
2. **Save relevant log excerpt** to file
3. **Document what you expected** vs what happened
4. **Check the troubleshooting guides**:
   - `LOGGING_QUICK_REFERENCE.md` for commands
   - `EXAMPLE_SYNC_LOGS.md` for expected output
   - `PRODUCTION_DEPLOYMENT_REPORT.md` for detailed help

### Share Feedback
What worked well:
- Log detail level
- Error clarity
- Performance visibility

What needs improvement:
- Missing information
- Confusing messages
- Performance issues

---

## Time Estimates

**Setup**: 2-3 minutes
- Terminal setup: 30 seconds
- Sign in: 1 minute
- Connect Google: 1-2 minutes

**Test Sync**: Depends on contacts
- <50 contacts: ~10 seconds
- 50-150 contacts: 30-60 seconds
- 150+ contacts: 1-3 minutes

**Verification**: 2 minutes
- Review logs
- Check results
- Run checklist

**Total**: ~5-10 minutes for complete test

---

## Documentation Reference

| Document | Purpose | When to Use |
|----------|---------|-------------|
| `DEPLOYMENT_COMPLETE.md` | Overall status and what's deployed | Before testing |
| `QUICK_START_TESTING.md` | This file - immediate testing | Right now! |
| `LOGGING_QUICK_REFERENCE.md` | Commands and log formats | During testing |
| `EXAMPLE_SYNC_LOGS.md` | Visual examples | Learning what to expect |
| `PRODUCTION_DEPLOYMENT_REPORT.md` | Detailed troubleshooting | If issues occur |

---

## Ready?

1. ✅ Server running (`pm2 status mcp-memory-web`)
2. ✅ Terminal 1 monitoring logs
3. ✅ Browser open to http://localhost:3001
4. ✅ Signed in with Clerk
5. ✅ Google account connected
6. 🚀 Click "Start Sync" and watch the logs!

**That's it!** The comprehensive logging will show you exactly what's happening every step of the way.

---

**Happy Testing!** 🎉

If you see detailed logs with request IDs, progress updates, and clear summaries - the deployment was successful!
