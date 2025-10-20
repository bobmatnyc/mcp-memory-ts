# Logging Additions Summary

## Overview
Added extensive diagnostic logging to debug batch sync timeout and progress display issues.

## Problem Being Diagnosed

1. **Timeout Issue**: User sees "110 seconds" timeout instead of new 280s (4min 40s) timeout
2. **Progress Display**: Shows "Batch 1" without "of 120" total batches
3. **Root Cause**: Either browser cache serving old code OR backend not returning `totalAvailable`

## All Logging Additions

### 1. Frontend (`web/components/google/google-contacts-sync.tsx`)

| Line | Purpose | Log Output |
|------|---------|------------|
| 4 | Cache buster - verify fresh code | `[GoogleContactsSync Component] Loaded at: ... Build ID: ...` |
| 282-288 | Verify timeout calculation | `[TIMEOUT CALC DEBUG] Inputs: { batchSize, result: 280000, resultSeconds: 280 }` |
| 328-339 | Verify backend response structure | `[BATCH X RESPONSE DEBUG] { totalAvailable, hasMore, nextPageToken, ... }` |

**What Each Log Reveals:**

- **Cache Buster**: Build ID should change on every page refresh. If it doesn't → browser cache issue
- **Timeout Calc**: Should show 280 seconds (4min 40s). If shows 110 → old code cached
- **Response Debug**: Should show `totalAvailable` as a number. If undefined → backend issue

### 2. Backend API (`web/app/api/google/contacts/sync/route.ts`)

| Line | Purpose | Log Output |
|------|---------|------------|
| 159-170 | Verify service returns totalAvailable | `[GoogleContactsSync API] RESULT STRUCTURE: { hasTotalAvailable, totalAvailable, ... }` |

**What This Log Reveals:**
- Confirms sync service returned `totalAvailable` field
- Shows actual value before sending to frontend
- If `hasTotalAvailable: false` → service didn't set it

### 3. Sync Service (`src/services/google-contacts-sync.ts`)

| Line | Purpose | Log Output |
|------|---------|------------|
| 150-159 | Verify result before returning | `[GoogleContactsSync Service] RETURNING RESULT: { totalAvailable, ... }` |
| 355-363 | Track where totalAvailable comes from | `[GoogleContactsSync Service] BATCH RESULT SET: { totalAvailable, totalAvailableSource: 'API' or 'undefined' }` |

**What These Logs Reveal:**
- First log: Shows if service sets `totalAvailable` at all
- Second log: Shows if it came from Google API or is undefined
- `totalAvailableSource: 'undefined'` → Google API doesn't provide it

### 4. Google People Client (`src/integrations/google-people-client.ts`)

| Line | Purpose | Changes |
|------|---------|---------|
| 39 | Add field to interface | `totalItems?: number` added to `ListContactsResponse` |
| 89-99 | Inspect raw Google API response | `[GooglePeopleClient] Raw API response keys: { allKeys, totalPeople, totalItems, ... }` |
| 107-108 | Extract totalItems from API | `totalItems: response.data.totalPeople ?? response.data.totalItems` |

**What These Changes Reveal:**
- **Interface**: Allows passing total count through the chain
- **Raw API log**: Shows EXACTLY what Google API returns (critical!)
- **Extraction**: Attempts to get total from Google (may not exist!)

## Critical Discovery: Google API May Not Provide Total Count

**IMPORTANT**: Google People API (connections.list) documentation does NOT mention a `totalPeople` or `totalItems` field. The API only returns:
- `connections[]` - Array of contacts in this page
- `nextPageToken` - Token for next page
- `nextSyncToken` - Token for incremental sync

**This means we cannot show "Batch X of Y" unless:**
1. Google API secretly includes a total count field (logs will reveal this)
2. We fetch all pages first to count (defeats purpose of batching)
3. We use a different API endpoint that provides count
4. We estimate from previous sync stored in user metadata

## Diagnostic Flow

When user runs batch sync, logs will appear in this order:

```
1. Browser Console: [GoogleContactsSync Component] Loaded at: ... Build ID: abc123
   → Verify Build ID changes on each refresh

2. Browser Console: [TIMEOUT CALC DEBUG] Inputs: { batchSize: 50, result: 280000, resultSeconds: 280 }
   → Verify timeout is 280s, NOT 110s

3. Server (PM2): [GooglePeopleClient] Raw API response keys: { allKeys: [...], totalPeople: ???, totalItems: ??? }
   → CRITICAL: Check if totalPeople or totalItems exists

4. Server (PM2): [GoogleContactsSync Service] BATCH RESULT SET: { totalAvailable: ???, totalAvailableSource: 'API' or 'undefined' }
   → Shows if we extracted total from Google

5. Server (PM2): [GoogleContactsSync Service] RETURNING RESULT: { totalAvailable: ??? }
   → Confirms service is returning it

6. Server (PM2): [GoogleContactsSync API] RESULT STRUCTURE: { hasTotalAvailable: true/false, totalAvailable: ??? }
   → Confirms API route received it

7. Browser Console: [BATCH 1 RESPONSE DEBUG] { totalAvailable: ???, hasMore: true }
   → Confirms frontend received it

8. Browser Console: Progress display updated: { batchNumber: 1, totalBatches: 120 }
   → Only shows if totalAvailable was present and calculation succeeded
```

## Verification Steps

### Step 1: Rebuild and Restart
```bash
cd /Users/masa/Projects/mcp-memory-ts
npm run build
cd web
npm run build
cd ..
pm2 restart mcp-memory-web
```

### Step 2: Clear Browser Cache
- Open browser DevTools (F12)
- Application tab → Storage → Clear site data
- Or: Cmd+Shift+R (Mac) / Ctrl+Shift+R (Windows) for hard refresh

### Step 3: Monitor Both Logs Simultaneously
```bash
# Terminal 1: Server logs
pm2 logs mcp-memory-web --lines 200

# Terminal 2: Browser
# Open http://localhost:3001/utilities
# Open DevTools Console (F12)
# Filter by: "DEBUG" or "BATCH"
```

### Step 4: Run Test Sync
1. Go to Utilities page
2. Enable "Batch Mode"
3. Set batch size: 50
4. Click "Start Batch Sync"
5. Watch BOTH server logs AND browser console

## What to Look For

### If Timeout Still Shows 110 Seconds:
- ❌ Check browser console for `[TIMEOUT CALC DEBUG]`
- ❌ If it shows `resultSeconds: 110` → browser cache issue
- ✅ Solution: Hard refresh (Cmd+Shift+R) and check Build ID changed

### If Progress Shows "Batch 1" Without Total:
- ❌ Check `[GooglePeopleClient] Raw API response keys` in PM2 logs
- ❌ Look at `allKeys` array - does it include 'totalPeople' or 'totalItems'?
- ❌ If `totalPeople: undefined` and `totalItems: undefined` → **Google API doesn't provide it**
- ✅ Solution: We need to implement alternative progress display

### If `totalAvailable` is Undefined in Frontend:
- ❌ Trace backward through logs to find where it disappeared
- ❌ Check each log in sequence (GooglePeopleClient → Service → API → Frontend)
- ✅ The first place it's undefined is where the problem is

## Possible Outcomes

### Outcome 1: Cache Issue
**Symptoms**: Browser console shows old timeout calculation
**Evidence**: Build ID doesn't change on refresh, or timeout calc shows 110s
**Fix**: Hard refresh, clear cache, or force reload

### Outcome 2: Google API Doesn't Provide Total Count
**Symptoms**: `[GooglePeopleClient] Raw API response keys` shows no totalPeople/totalItems
**Evidence**: `allKeys` array doesn't include any total count field
**Fix**: Implement alternative progress display (see options below)

### Outcome 3: Data Lost in Transit
**Symptoms**: Google API has totalPeople but it doesn't reach frontend
**Evidence**: Logs show it disappears between two stages
**Fix**: Fix the code where it's being dropped

## Alternative Progress Display Options

If Google API doesn't provide total count:

### Option 1: Show Processed Count Only
```
"Processing... 50 contacts processed"
"Processing... 100 contacts processed"
```

### Option 2: Show Batch Number Without Total
```
"Processing Batch 1..."
"Processing Batch 2..."
```

### Option 3: Estimate from Previous Sync
```
"Batch 1 of ~120 (estimated from last sync)"
```

### Option 4: Two-Pass Approach
1. First pass: Quick count-only request
2. Second pass: Actual batch processing
(Only if Google API supports count-only queries)

## Files Modified

All changes are backward compatible and only add logging:

1. `web/components/google/google-contacts-sync.tsx` - Frontend debug logs
2. `web/app/api/google/contacts/sync/route.ts` - API route debug logs
3. `src/services/google-contacts-sync.ts` - Service debug logs
4. `src/integrations/google-people-client.ts` - Google API response inspection

## Next Steps

1. **User rebuilds and restarts**: `npm run build && pm2 restart mcp-memory-web`
2. **User clears browser cache**: Hard refresh (Cmd+Shift+R)
3. **User runs test sync**: Monitor both server and browser logs
4. **Analyze logs**: Determine which of 3 outcomes occurred
5. **Implement fix**: Based on which problem was found

## Success Criteria

Logs should reveal one of these:

✅ **Browser cache**: Build ID doesn't change → need to clear cache
✅ **No total count**: Google API response doesn't include totalPeople → need alternative UI
✅ **Data loss**: Total count exists but gets dropped → fix the code location

Once we know which problem it is, we can implement the appropriate fix.
