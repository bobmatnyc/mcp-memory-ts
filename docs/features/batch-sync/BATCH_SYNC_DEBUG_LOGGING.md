# Batch Sync Debug Logging Summary

## Problem Description

User reports:
1. **Timeout issue**: Seeing "timed out after 110 seconds" (old timeout, not new 220s)
2. **Progress stuck**: Displays "Batch 1" without showing "of 120" total batches
3. **Possible cache**: Either browser cache or backend not returning proper data

## Logging Added

### 1. Frontend Component (`web/components/google/google-contacts-sync.tsx`)

#### A. Component Load Cache Buster (Line 4)
```typescript
console.log(`[GoogleContactsSync Component] Loaded at: ${new Date().toISOString()}, Build ID: ${Math.random().toString(36).substr(2, 9)}`);
```
**Purpose**: Verify browser is loading fresh code, not cached version
**What to check**: Each page refresh should show different Build ID

#### B. Timeout Calculation Debug (Line 282-288)
```typescript
console.log(`[TIMEOUT CALC DEBUG] Inputs:`, {
  batchSize,
  formula: 'Math.min(batchSize * 4000 + 120000, 280000)',
  calculation: `Math.min(${batchSize} * 4000 + 120000, 280000)`,
  result: timeoutMs,
  resultSeconds: Math.round(timeoutMs / 1000),
});
```
**Purpose**: Verify timeout calculation uses new formula (280000ms = 4min 40s)
**What to check**:
- With batchSize=50: result should be 320000ms BUT capped at 280000ms (280s = 4min 40s)
- resultSeconds should show 280, NOT 110

#### C. Batch Response Structure Debug (Line 328-339)
```typescript
console.log(`[BATCH ${batchNumber} RESPONSE DEBUG]`, {
  responseOk: response.ok,
  status: response.status,
  dataKeys: Object.keys(data),
  imported: data.imported,
  exported: data.exported,
  updated: data.updated,
  totalAvailable: data.totalAvailable,
  hasMore: data.hasMore,
  nextPageToken: data.nextPageToken ? 'present' : 'missing',
  errorsCount: data.errors?.length || 0,
});
```
**Purpose**: Verify backend returns `totalAvailable` field
**What to check**:
- `dataKeys` should include 'totalAvailable'
- `totalAvailable` should be a number (e.g., 6000 for 6000 contacts)
- `hasMore` should be true until last batch

### 2. Backend API Route (`web/app/api/google/contacts/sync/route.ts`)

#### Result Structure Debug (Line 159-170)
```typescript
process.stderr.write(`[GoogleContactsSync API][${requestId}] RESULT STRUCTURE: ${JSON.stringify({
  hasSuccess: !!result.success,
  hasExported: !!result.exported,
  hasImported: !!result.imported,
  hasUpdated: !!result.updated,
  hasTotalAvailable: !!result.totalAvailable,
  hasNextPageToken: !!result.nextPageToken,
  hasHasMore: !!result.hasMore,
  totalAvailable: result.totalAvailable,
  nextPageToken: result.nextPageToken ? 'present' : 'missing',
  hasMore: result.hasMore,
})}\n`);
```
**Purpose**: Verify sync service returns totalAvailable to API route
**What to check**:
- `hasTotalAvailable` should be true
- `totalAvailable` should be a number
- This runs BEFORE response is sent to frontend

### 3. Sync Service (`src/services/google-contacts-sync.ts`)

#### A. Service Return Debug (Line 150-159)
```typescript
process.stderr.write(`[GoogleContactsSync Service] RETURNING RESULT: ${JSON.stringify({
  success: result.success,
  imported: result.imported,
  exported: result.exported,
  updated: result.updated,
  totalAvailable: result.totalAvailable,
  nextPageToken: result.nextPageToken ? 'present' : 'missing',
  hasMore: result.hasMore,
  errorsCount: result.errors?.length || 0,
})}\n`);
```
**Purpose**: Verify service sets totalAvailable before returning
**What to check**: `totalAvailable` should be defined here

#### B. Batch Result Set Debug (Line 355-363)
```typescript
process.stderr.write(`[GoogleContactsSync Service] BATCH RESULT SET: ${JSON.stringify({
  imported: result.imported,
  updated: result.updated,
  nextPageToken: result.nextPageToken ? 'present' : 'missing',
  hasMore: result.hasMore,
  totalProcessed: result.totalProcessed,
  totalAvailable: result.totalAvailable,
  totalAvailableSource: syncResult.data.totalItems !== undefined ? 'API' : 'undefined',
})}\n`);
```
**Purpose**: Track where totalAvailable comes from
**What to check**:
- `totalAvailableSource` should be 'API' if Google provides it
- `totalAvailable` should match Google's total contact count

### 4. Google People Client (`src/integrations/google-people-client.ts`)

#### A. Interface Update (Line 39)
```typescript
export interface ListContactsResponse {
  contacts: GoogleContact[];
  nextSyncToken: string;
  nextPageToken?: string;
  totalItems?: number; // Total available contacts (if provided by Google API)
}
```
**Purpose**: Add field to return total contact count from Google

#### B. Raw API Response Debug (Line 89-99)
```typescript
process.stderr.write(`[GooglePeopleClient] Raw API response keys: ${JSON.stringify({
  hasConnections: !!response.data.connections,
  connectionCount: response.data.connections?.length || 0,
  hasNextPageToken: !!response.data.nextPageToken,
  hasNextSyncToken: !!response.data.nextSyncToken,
  hasTotalPeople: !!(response.data as any).totalPeople,
  hasTotalItems: !!(response.data as any).totalItems,
  totalPeople: (response.data as any).totalPeople,
  totalItems: (response.data as any).totalItems,
  allKeys: Object.keys(response.data),
})}\n`);
```
**Purpose**: Inspect raw Google API response to find total count field
**What to check**:
- `allKeys` shows all fields Google API returns
- Check if `totalPeople` or `totalItems` exists
- **CRITICAL**: Google API may NOT provide total count at all!

#### C. Include totalItems in Response (Line 107-108)
```typescript
totalItems: (response.data as any).totalPeople ?? (response.data as any).totalItems,
```
**Purpose**: Pass through Google's total count if available

## Expected Log Flow

For a successful batch sync, you should see this sequence:

```
# 1. Component loads (browser console)
[GoogleContactsSync Component] Loaded at: 2025-10-17T... Build ID: abc123

# 2. User clicks "Start Batch Sync"
[GoogleContactsSync Frontend][frontend-...] ===== SYNC STARTED =====

# 3. Timeout calculation (browser console)
[TIMEOUT CALC DEBUG] Inputs: { batchSize: 50, result: 280000, resultSeconds: 280 }

# 4. Google API call (server logs via PM2)
[GooglePeopleClient] Raw API response keys: { allKeys: [...], totalPeople: 6000 }

# 5. Sync service sets batch result (server logs)
[GoogleContactsSync Service] BATCH RESULT SET: { totalAvailable: 6000, totalAvailableSource: 'API' }

# 6. Sync service returns (server logs)
[GoogleContactsSync Service] RETURNING RESULT: { totalAvailable: 6000 }

# 7. API route receives result (server logs)
[GoogleContactsSync API][req-...] RESULT STRUCTURE: { hasTotalAvailable: true, totalAvailable: 6000 }

# 8. Frontend receives response (browser console)
[BATCH 1 RESPONSE DEBUG] { totalAvailable: 6000, hasMore: true }

# 9. Progress updates (browser console)
Progress display updated: { batchNumber: 1, totalBatches: 120, displayWillShow: "Batch 1 of 120" }
```

## Diagnostic Checklist

### If Timeout Shows 110 Seconds:
- ✅ Check `[TIMEOUT CALC DEBUG]` in browser console
- ✅ Verify `resultSeconds` is 280, not 110
- ✅ If still 110, browser cache issue - hard refresh (Cmd+Shift+R)
- ✅ Check Build ID changes on each refresh

### If Progress Shows "Batch 1" Without Total:
- ✅ Check `[GooglePeopleClient] Raw API response keys` in PM2 logs
- ✅ Verify `totalPeople` or `totalItems` exists
- ✅ If missing, Google API doesn't provide total count
- ✅ Check `[BATCH 1 RESPONSE DEBUG]` for `totalAvailable` field
- ✅ If `totalAvailable` is undefined, backend issue

### If Backend Returns Wrong Data:
- ✅ Check `[GoogleContactsSync Service] RETURNING RESULT` in PM2 logs
- ✅ Verify `totalAvailable` is set before return
- ✅ Check `[GoogleContactsSync API] RESULT STRUCTURE` confirms field
- ✅ Compare server logs to browser console logs

## Important Notes

### Google API Limitation
**CRITICAL**: Google People API may NOT provide a total count field. According to Google's documentation, the API returns:
- `connections[]` - Array of contacts
- `nextPageToken` - For pagination
- `nextSyncToken` - For incremental sync
- **NO `totalPeople` or `totalItems` field**

This means we CANNOT show "Batch X of Y" because we don't know Y until we've fetched all pages!

### Workaround Options

If Google API doesn't provide total count:

1. **Show processed count only**: "Processed 50 contacts..."
2. **Estimate from previous sync**: Store last sync count in user metadata
3. **Count on first page**: Do a quick count-only request first (if API supports it)
4. **Progressive display**: "Batch 1 (50 contacts)..." → "Batch 2 (100 contacts)..."

## Verification Steps

1. **Rebuild and restart**:
   ```bash
   cd /Users/masa/Projects/mcp-memory-ts
   npm run build
   pm2 restart mcp-memory-web
   ```

2. **Clear browser cache**:
   - Open DevTools (F12)
   - Application tab → Clear storage → Clear site data
   - Or: Cmd+Shift+R (hard refresh)

3. **Monitor logs**:
   ```bash
   # Server logs
   pm2 logs mcp-memory-web --lines 100

   # Browser console (F12)
   # Filter by "DEBUG" or "BATCH"
   ```

4. **Run test sync**:
   - Go to http://localhost:3001/utilities
   - Enable Batch Mode
   - Set batch size to 50
   - Start sync
   - Watch both server logs AND browser console

## Files Modified

1. `/Users/masa/Projects/mcp-memory-ts/web/components/google/google-contacts-sync.tsx`
   - Added cache buster log
   - Added timeout calculation debug
   - Added batch response structure debug

2. `/Users/masa/Projects/mcp-memory-ts/web/app/api/google/contacts/sync/route.ts`
   - Added result structure debug before response

3. `/Users/masa/Projects/mcp-memory-ts/src/services/google-contacts-sync.ts`
   - Added return result debug
   - Added batch result set debug with source tracking

4. `/Users/masa/Projects/mcp-memory-ts/src/integrations/google-people-client.ts`
   - Added ListContactsResponse.totalItems field
   - Added raw API response debug
   - Added totalItems extraction from Google API

## Next Steps

After rebuilding and testing, analyze logs to determine:

1. **Is timeout calculation correct?** (Should show 280s, not 110s)
2. **Does Google API provide total count?** (Check allKeys in raw API response)
3. **Is totalAvailable reaching frontend?** (Check BATCH RESPONSE DEBUG)
4. **Is browser cache cleared?** (Check Build ID changes on refresh)
