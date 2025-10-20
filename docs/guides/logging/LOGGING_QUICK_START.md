# Google Contacts Sync Logging - Quick Start Guide

## 🚀 Quick Start (5 Minutes)

### 1. Start Web Server
```bash
cd /Users/masa/Projects/mcp-memory-ts
./START_WEB_SERVER.sh
```

### 2. Open Browser
1. Navigate to: `http://localhost:3002`
2. Press **F12** to open DevTools
3. Click **Console** tab
4. Type in filter box: `GoogleContactsSync`
5. Check ☑️ **Preserve log**

### 3. Trigger Sync
1. Go to Google Contacts Sync page
2. Click **"Sync Now"** button
3. Watch logs appear in console

### 4. Capture Logs
**Browser Console:**
- Right-click in console → "Save as..."
- Or: Select all logs → Copy

**Server Logs:**
```bash
# If using npm run dev
# Logs are in the terminal where you ran START_WEB_SERVER.sh

# If using PM2
pm2 logs mcp-memory-web --lines 200
```

## 🔍 What to Look For

### ✅ Success Pattern
```
[GoogleContactsSync Frontend] SYNC STARTED
[GoogleContactsSync Frontend] Fetch completed (ok: true)
[GoogleContactsSync Frontend] Response body received (length: XXX)
[GoogleContactsSync Frontend] JSON parsed successfully
[GoogleContactsSync Frontend] SYNC COMPLETED
```

### ❌ JSON Parse Error Pattern
```
[GoogleContactsSync Frontend] SYNC STARTED
[GoogleContactsSync Frontend] Fetch completed (ok: true)
[GoogleContactsSync Frontend] Response body received (length: XXX)
[GoogleContactsSync Frontend] JSON PARSE ERROR  ← THE ISSUE
{
  error: "Unexpected end of JSON input",
  responseText: "...",      ← Check what this contains
  isHTML: true/false,       ← If true, getting error page
  responseLength: XXX,      ← Response size
  lastChar: "X"             ← If not '}', response truncated
}
```

## 🎯 Key Questions to Answer

When you see `JSON PARSE ERROR`, check these fields:

1. **`isHTML: true`** → Server returned HTML error page
   - Check `responseText` preview
   - Look for status code in earlier logs
   - Server may have crashed or route missing

2. **`responseLength: 0`** → Empty response
   - Request timed out
   - Server crashed before sending response
   - Check server logs for errors

3. **`lastChar: ','`** (not `}`) → Truncated JSON
   - Response too large
   - Timeout during response streaming
   - Network connection dropped

4. **`responseText` starts with `{`** → Malformed JSON
   - Check `responseText` preview for syntax errors
   - May have control characters or encoding issues

## 📋 Debugging Checklist

Copy this and fill in as you go:

```
□ Web server running (port 3002)
□ Browser DevTools open with console filter
□ Server logs visible
□ Clicked "Sync Now"
□ Frontend SYNC STARTED log appeared
□ Frontend Fetch completed log appeared
  └─ Status code: _______
  └─ Content-Type: _______
□ Response body received log appeared
  └─ Response length: _______
  └─ Preview contains: _______
□ JSON PARSE ERROR appeared
  └─ isHTML: _______
  └─ responseLength: _______
  └─ firstChar: _______
  └─ lastChar: _______
  └─ Error message: _______
□ Backend logs show REQUEST STARTED
□ Backend logs show REQUEST COMPLETED
□ Backend logs show any errors: _______
```

## 🆘 Common Issues & Quick Fixes

### Issue 1: No logs appearing
**Symptom**: Console is empty after clicking Sync
**Fix**:
- Clear filter in DevTools
- Check "Preserve log" is enabled
- Refresh page and try again

### Issue 2: Server logs not visible
**Symptom**: Can't see backend logs
**Fix**:
```bash
# Kill any existing servers
pkill -f "next dev"

# Restart with visible logs
cd /Users/masa/Projects/mcp-memory-ts
./START_WEB_SERVER.sh

# Logs will appear in this terminal
```

### Issue 3: "Unexpected end of JSON input" but can't find details
**Symptom**: Error shows in UI but no detailed logs
**Fix**:
- Browser may have suppressed logs
- Open new incognito window
- Press F12 before clicking Sync
- Try again

### Issue 4: Too many logs, can't find relevant ones
**Symptom**: Console flooded with logs
**Fix**:
- Use filter: `GoogleContactsSync Frontend`
- Look for lines with `JSON PARSE ERROR`
- Right-click → "Filter out messages from this source" on unrelated logs

## 📖 Full Documentation

For complete details, see:

1. **GOOGLE_CONTACTS_SYNC_LOGGING_GUIDE.md** - Complete logging reference
2. **GOOGLE_CONTACTS_SYNC_LOGGING_SUMMARY.md** - Implementation details
3. **COMPREHENSIVE_LOGGING_IMPLEMENTATION.md** - Full implementation summary

## 🧪 Test Logging System

Run the automated test:
```bash
cd /Users/masa/Projects/mcp-memory-ts
./scripts/test-sync-logging.sh
```

This will verify all logging is in place.

## 📞 What to Share

When reporting the issue, share:

1. **Browser console logs** (filtered for GoogleContactsSync)
2. **Server logs** (from terminal or PM2)
3. **Completed debugging checklist** (from above)
4. **Screenshots** of error (if helpful)

Specifically look for the `JSON PARSE ERROR` log entry and share:
- The full error object
- The `responseText` preview
- The `isHTML`, `firstChar`, `lastChar` fields
- Any backend errors that occurred around the same timestamp

## ⚡ One-Command Debug

If you just want to reproduce and capture everything:

```bash
# Terminal 1: Start server with logs
cd /Users/masa/Projects/mcp-memory-ts
./START_WEB_SERVER.sh 2>&1 | tee server-logs.txt

# Terminal 2: Browser already open with DevTools
# Click Sync Now
# Copy console logs to: frontend-logs.txt

# Then share both files:
# - server-logs.txt
# - frontend-logs.txt
```

## 🎓 Understanding the Logs

**Log Format**:
```
[Component Name][Request ID] Message
{
  structured: "data",
  with: "context"
}
```

**Example**:
```
[GoogleContactsSync Frontend][frontend-1729123456789-abc] JSON PARSE ERROR
{
  error: "Unexpected end of JSON input",
  responseText: "...",
  responseLength: 1234
}
```

**Key Components**:
- `[GoogleContactsSync Frontend]` - Which component logged this
- `[frontend-1729123456789-abc]` - Unique ID for this request
- `JSON PARSE ERROR` - What happened
- `{ ... }` - Details about what happened

**Matching Frontend and Backend**:
```
Frontend: [frontend-1729123456789-abc] (12:34:56.789)
Backend:  [req-1729123456790-def]      (12:34:56.790)
          └─ Just 1ms later, this is the matching backend request
```

---

**Ready to debug!** 🚀

Start the server, open the browser, click Sync, and watch the logs tell you exactly what's happening.
