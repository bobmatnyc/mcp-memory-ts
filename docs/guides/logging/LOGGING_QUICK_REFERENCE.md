# Google Contacts Sync - Logging Quick Reference

**Quick access guide for monitoring Google Contacts sync operations**

## Quick Commands

### Start Monitoring (Most Common)
```bash
# Watch logs in real-time
pm2 logs mcp-memory-web

# Watch last 100 lines (recommended for catching up)
pm2 logs mcp-memory-web --lines 100
```

### Filter for Google Sync Only
```bash
# Live filtering
pm2 logs mcp-memory-web | grep GoogleContactsSync

# Last 100 lines, Google sync only
pm2 logs mcp-memory-web --lines 100 --nostream | grep GoogleContactsSync
```

### Search by Request ID
```bash
# Find all logs for a specific sync operation
pm2 logs mcp-memory-web --nostream | grep "req-abc12345"
```

### Find Errors Only
```bash
# Show only error logs
pm2 logs mcp-memory-web --err --lines 50

# Filter for Google sync errors
pm2 logs mcp-memory-web --err | grep GoogleContactsSync
```

### Check Server Status
```bash
# PM2 status
pm2 status mcp-memory-web

# Health check
curl http://localhost:3001/api/health | jq .
```

## Log Format Guide

### Request Start
```
[GoogleContactsSync] [req-abc12345] Starting sync request
[GoogleContactsSync] [req-abc12345] User: user@example.com
[GoogleContactsSync] [req-abc12345] Direction: import, Auto-merge: true
```

### Progress Updates
```
[GoogleContactsSync] [req-abc12345] Fetching contacts from Google API
[GoogleContactsSync] [req-abc12345] Retrieved 150 contacts
[GoogleContactsSync] [req-abc12345] Processing batch 1/3 (50 contacts)
[GoogleContactsSync] [req-abc12345] Created 47 new contacts
```

### Completion Summary
```
[GoogleContactsSync] [req-abc12345] Sync completed in 45.2s
[GoogleContactsSync] [req-abc12345] Summary: 147 created, 3 merged, 0 errors
```

### Error Messages
```
[GoogleContactsSync] [req-abc12345] ERROR: Failed to fetch contacts
[GoogleContactsSync] [req-abc12345] Error: Invalid access token
[GoogleContactsSync] [req-abc12345] Stack trace: ...
[GoogleContactsSync] [req-abc12345] Suggestion: Reconnect Google account
```

## What Each Log Tells You

| Log Message | Meaning |
|-------------|---------|
| `Starting sync request` | User initiated sync operation |
| `User authenticated: email` | Clerk auth successful |
| `Direction: import` | Syncing FROM Google TO MCP Memory |
| `Direction: export` | Syncing FROM MCP Memory TO Google |
| `Auto-merge: true` | LLM deduplication enabled |
| `Retrieved X contacts` | Successfully fetched from Google API |
| `Processing batch X/Y` | Working on batch X of Y total batches |
| `Found X duplicates` | LLM identified X potential duplicates |
| `Merged X contacts` | Successfully merged duplicate contacts |
| `Created X new contacts` | Added X new contacts to database |
| `Sync completed in Xs` | Total operation duration |
| `ERROR: ...` | Something went wrong (check details below) |

## Common Error Messages

### Authentication Errors
```
ERROR: Invalid access token
→ User needs to reconnect Google account

ERROR: User not authenticated
→ User needs to sign in with Clerk
```

### API Errors
```
ERROR: Google API rate limit exceeded
→ Wait a few minutes and retry

ERROR: Failed to fetch contacts
→ Check Google API status and credentials
```

### Database Errors
```
ERROR: Failed to save contact
→ Check database connection and schema

ERROR: Duplicate key violation
→ Contact already exists (this is normal if auto-merge is off)
```

## Log Verbosity Levels

### Error Only (Silent Mode)
```bash
LOG_LEVEL=error pm2 restart mcp-memory-web
# Only shows errors, no progress updates
```

### Info (Default - Recommended)
```bash
LOG_LEVEL=info pm2 restart mcp-memory-web
# Shows progress updates and errors
```

### Debug (Detailed)
```bash
LOG_LEVEL=debug pm2 restart mcp-memory-web
# Shows all details including API calls
```

## Troubleshooting Flowchart

```
No logs appearing?
├─ Check LOG_LEVEL is not 'error' only
├─ Verify sync actually started (check UI)
├─ Ensure user is signed in
└─ Check Google OAuth is connected

Server not responding?
├─ pm2 list (check status)
├─ pm2 restart mcp-memory-web
└─ pm2 logs mcp-memory-web --err

Sync failing?
├─ Look for ERROR in logs
├─ Check stack trace for details
├─ Verify Google OAuth tokens
└─ Test with curl to isolate issue

Slow performance?
├─ Look for duration metrics
├─ Check batch processing times
├─ Verify database connection
└─ Consider reducing batch size
```

## Testing Workflow

1. **Start monitoring in one terminal**
   ```bash
   pm2 logs mcp-memory-web --lines 100
   ```

2. **Open app in browser**
   ```bash
   open http://localhost:3001
   ```

3. **Sign in and navigate to Sync page**
   - Settings → Connect Google (if needed)
   - Sync → Google Contacts tab

4. **Start sync operation**
   - Choose direction
   - Enable auto-merge
   - Click "Start Sync"

5. **Watch logs in terminal**
   - Note the request ID (e.g., `req-abc12345`)
   - Follow progress updates
   - Check for errors
   - Verify completion summary

6. **If errors occur**
   - Copy the request ID
   - Search logs: `pm2 logs --nostream | grep "req-abc12345"`
   - Check full error context
   - Follow suggested recovery steps

## Log File Locations

```bash
# Output logs (includes console.log)
/Users/masa/Projects/mcp-memory-ts/web/logs/pm2-out-16.log

# Error logs (includes console.error)
/Users/masa/Projects/mcp-memory-ts/web/logs/pm2-error-16.log

# Direct file viewing
tail -f /Users/masa/Projects/mcp-memory-ts/web/logs/pm2-out-16.log
```

## Advanced Filtering

### Multiple Conditions
```bash
# Errors in Google sync only
pm2 logs --nostream | grep GoogleContactsSync | grep ERROR

# Specific user's sync operations
pm2 logs --nostream | grep GoogleContactsSync | grep "user@example.com"

# Performance metrics only
pm2 logs --nostream | grep GoogleContactsSync | grep "completed in"
```

### Time-based Analysis
```bash
# Last hour of logs
pm2 logs --nostream --lines 1000 | grep GoogleContactsSync

# Save logs to file for analysis
pm2 logs --nostream --lines 10000 > google-sync-logs.txt
grep GoogleContactsSync google-sync-logs.txt > filtered-logs.txt
```

## Performance Benchmarks

**Expected Performance**:
- Small sync (<50 contacts): 5-15 seconds
- Medium sync (50-200 contacts): 15-60 seconds
- Large sync (200+ contacts): 1-3 minutes

**What's Normal**:
- LLM deduplication adds ~1-2 seconds per duplicate check
- Batch processing happens in groups of 50
- API calls have ~200-500ms latency each

**When to Investigate**:
- Sync taking >5 minutes for <200 contacts
- Batch processing >30 seconds per batch
- Multiple retries or timeout errors
- High memory usage (>500MB)

## Quick Health Checks

```bash
# 1. Is server running?
pm2 status mcp-memory-web

# 2. Is database connected?
curl http://localhost:3001/api/health

# 3. Is Google auth working?
curl http://localhost:3001/api/google/status
# (Should return 200 or auth redirect)

# 4. Any recent errors?
pm2 logs mcp-memory-web --err --lines 20

# 5. Memory/CPU healthy?
pm2 monit
```

## Support Checklist

Before asking for help, gather:
- [ ] Request ID from logs (`req-abc12345`)
- [ ] Full error message if any
- [ ] User email (anonymize if needed)
- [ ] Sync direction attempted
- [ ] Number of contacts being synced
- [ ] PM2 server status
- [ ] Database health check result
- [ ] Recent log excerpt (last 50-100 lines)

---

**Quick Start**: `pm2 logs mcp-memory-web --lines 100`
**Most Useful**: `pm2 logs mcp-memory-web | grep GoogleContactsSync`
**Troubleshooting**: `pm2 logs mcp-memory-web --err --lines 50`
