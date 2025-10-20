# Quick Start: Google Contacts Sync with Batch Size 25

**Updated**: 2025-10-16
**Status**: ✅ Ready to use

---

## TL;DR - I Just Want to Sync!

```bash
# 1. Start the server (choose one)
./START_WEB_SERVER.sh        # Staging (port 3002)
# OR
pm2 restart mcp-memory-web   # Production (port 3001)

# 2. Watch logs while syncing
pm2 logs mcp-memory-web

# 3. Open browser
# Staging: http://localhost:3002/utilities
# Production: http://localhost:3001/utilities

# 4. Configure sync
# ✓ Direction: Import
# ✓ Batch Mode: ON
# ✓ Batch Size: 25 or 50
# ✓ Dry Run: ON (for testing)
# ✓ Click "Start Batch Sync"
```

---

## New Features (2025-10-16)

### ✅ Batch Size 25 Now Available
- **Safest option** for slow networks
- **Timeout**: 1 minute 50 seconds per batch
- **Recommended for**: First-time syncs, unreliable networks

### ✅ Logs Now Work in PM2
- All sync logs appear in `pm2 logs mcp-memory-web`
- No more silent failures
- Real-time monitoring works

### ✅ No More False Timeouts
- Timeout adjusts based on batch size
- 25 contacts: 110 seconds
- 50 contacts: 160 seconds
- 100 contacts: 260 seconds

---

## Step-by-Step: First Sync with Batch Size 25

### Step 1: Start Server

**Option A: Staging (Recommended for Testing)**
```bash
cd /Users/masa/Projects/mcp-memory-ts
./START_WEB_SERVER.sh
```

**Option B: Production**
```bash
pm2 restart mcp-memory-web
pm2 logs mcp-memory-web
```

### Step 2: Open Web Interface

**Staging**: http://localhost:3002/utilities
**Production**: http://localhost:3001/utilities

### Step 3: Configure Sync

1. **Direction**: Select "Import" (Google → MCP Memory)
2. **Batch Mode**: ✅ Enable checkbox
3. **Batch Size**: Select "25 (Slowest, safest)"
4. **Dry Run Mode**: ✅ Enable (recommended for first test)
5. **LLM Deduplication**: ✅ Enable (optional, for better duplicate detection)

### Step 4: Start Sync

Click **"Start Batch Sync"**

You'll see:
- Progress bar updating in real-time
- "Processing batch 1...", "Processing batch 2...", etc.
- Contact counts increasing

### Step 5: Monitor Logs

In another terminal:
```bash
pm2 logs mcp-memory-web --lines 100
```

Look for:
```
[GoogleContactsSync Service] Fetched 25 contacts from Google
[GoogleContactsSync Service] Match results: 20 matched, 5 new, 0 unmatched MCP
[GoogleContactsSync Service] Batch complete: 5 imported, 20 updated, hasMore: true
```

### Step 6: Verify Results

After sync completes, you'll see:
- ✅ Green success message
- **Imported**: Number of new contacts
- **Updated**: Number of existing contacts updated
- **Exported**: 0 (we only imported)

---

## Troubleshooting

### "Logs not appearing in PM2"

**Solution**:
```bash
# Rebuild and restart
cd web && npm run build && cd ..
pm2 restart mcp-memory-web
pm2 logs mcp-memory-web
```

### "Still getting timeout errors"

**Try**:
1. Use batch size **25** instead of 50
2. Check your internet connection
3. Try disabling LLM deduplication
4. Enable dry run mode first

**Verify timeout settings**:
```bash
# Should see: "Starting sync (timeout: 110000ms)..." for batch size 25
pm2 logs mcp-memory-web | grep timeout
```

### "Sync seems slow"

**This is normal for batch size 25**:
- Batch size 25: ~45-90 seconds per batch
- Batch size 50: ~60-120 seconds per batch

**Why it's worth it**:
- ✅ No timeout errors
- ✅ More reliable
- ✅ Better error handling
- ✅ Can cancel mid-sync

### "No contacts imported"

**Check**:
1. Google account is connected (Settings page)
2. Google Contacts permission granted
3. You have contacts in Google Contacts
4. Logs show: `Fetched X contacts from Google`

**If "Fetched 0 contacts"**:
- Sync token may have expired
- Try enabling "Force Full Sync" (disable batch mode temporarily)

---

## Recommended Settings

### First-Time Sync
```
Direction: Import
Batch Mode: ON
Batch Size: 25 (safest)
Dry Run: ON (test first!)
LLM Deduplication: OFF (faster)
```

### Regular Sync
```
Direction: Import
Batch Mode: ON
Batch Size: 50 (recommended)
Dry Run: OFF
LLM Deduplication: ON (better quality)
```

### Fast Sync (Good Network)
```
Direction: Import
Batch Mode: ON
Batch Size: 100
Dry Run: OFF
LLM Deduplication: ON
```

---

## Common Commands

### Monitoring
```bash
# Real-time logs
pm2 logs mcp-memory-web

# Last 200 lines
pm2 logs mcp-memory-web --lines 200

# Error logs only
pm2 logs mcp-memory-web --err

# System resources
pm2 monit
```

### Management
```bash
# Restart server
pm2 restart mcp-memory-web

# Stop server
pm2 stop mcp-memory-web

# Start server
pm2 start ecosystem.config.cjs

# Status
pm2 list
```

### Testing
```bash
# Run test script
./TEST_GOOGLE_SYNC_OPTIMIZATION.sh

# Start staging server
./START_WEB_SERVER.sh
```

---

## Performance Expectations

### Batch Size 25 (Safest)
- ⏱️ **Time per batch**: 45-90 seconds
- ✅ **Timeout**: 110 seconds (plenty of buffer)
- 📊 **100 contacts**: ~6-12 minutes (4 batches)
- 🎯 **Best for**: Slow networks, first sync

### Batch Size 50 (Recommended)
- ⏱️ **Time per batch**: 60-120 seconds
- ✅ **Timeout**: 160 seconds
- 📊 **100 contacts**: ~4-8 minutes (2 batches)
- 🎯 **Best for**: Normal usage, balanced

### Batch Size 100 (Fast)
- ⏱️ **Time per batch**: 90-180 seconds
- ✅ **Timeout**: 260 seconds
- 📊 **100 contacts**: ~2-4 minutes (1 batch)
- 🎯 **Best for**: Fast networks, many contacts

---

## What's in the Logs

### Successful Sync
```
✅ REQUEST STARTED
✅ Auth successful
✅ User data retrieved
✅ Google connection: true
✅ Starting sync (timeout: 110000ms)...
✅ Fetched 25 contacts from Google
✅ Match results: 20 matched, 5 new
✅ Batch complete: 5 imported, 20 updated
✅ REQUEST COMPLETED (67890ms)
```

### Error Example
```
❌ REQUEST FAILED (110000ms)
❌ Sync operation timed out. Try using a smaller batch size (currently 100).
```

### No Changes
```
✅ Fetched 25 contacts from Google
✅ Match results: 25 matched, 0 new
✅ Batch complete: 0 imported, 0 updated
```

---

## Quick Reference: Batch Sizes

| Size | Timeout | Use When | Risk |
|------|---------|----------|------|
| **25** | 1m 50s | Slow network, first sync | Lowest ✅ |
| **50** | 2m 40s | Normal usage | Low ✅ |
| 100 | 4m 20s | Fast network | Medium ⚠️ |
| 150 | 6m 0s | Very fast network | High ⚠️ |

---

## Next Steps

1. **Test in staging**: `./START_WEB_SERVER.sh`
2. **Run with dry mode**: See what would happen
3. **Try batch size 25**: Safest option
4. **Monitor logs**: `pm2 logs mcp-memory-web`
5. **Check results**: Verify imported contacts
6. **Run real sync**: Disable dry mode when ready

---

## Need Help?

**Check logs first**:
```bash
pm2 logs mcp-memory-web --lines 200
```

**Run diagnostics**:
```bash
./TEST_GOOGLE_SYNC_OPTIMIZATION.sh
```

**Review documentation**:
- Full details: `GOOGLE_CONTACTS_SYNC_OPTIMIZATION.md`
- Implementation summary: `IMPLEMENTATION_SUMMARY.md`

---

**That's it! You're ready to sync with batch size 25. Good luck! 🚀**
