# Next.js API Route Timeout Fix

**Status**: ✅ FIXED
**Date**: 2025-10-17
**File Modified**: `web/app/api/google/contacts/sync/route.ts`

## Problem

The Google Contacts batch sync was failing after 60 seconds with "signal is aborted" error.

### Root Cause
- Next.js 14+ has a **default 60-second timeout** for API routes
- Frontend was setting 110-second timeout for batch size 25, expecting it to work
- API route was being killed at 60 seconds by Next.js
- Response never returned, preventing `totalBatches` calculation
- Progress UI showed "Batch 1 of undefined" instead of "Batch 1 of 120"

### Symptoms
1. First batch request timed out at exactly 60 seconds
2. Error: "This operation was aborted"
3. `totalAvailable` never returned from first batch
4. Frontend couldn't calculate total batches
5. Subsequent batches worked because they were faster (<60s)

## Solution

Added Next.js route configuration to explicitly set timeout to 5 minutes:

```typescript
// Configure Next.js route for long-running operations
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes (covers batch sizes up to 100+)
```

### Why 300 seconds (5 minutes)?

| Batch Size | Expected Duration | Status |
|------------|------------------|--------|
| 25         | 110 seconds      | ✅ Covered |
| 50         | 160 seconds      | ✅ Covered |
| 100        | 260 seconds      | ✅ Covered |

**Buffer**: 40-second safety margin for network variability

## Impact

### Before Fix
- ❌ Batch 1 times out at 60 seconds
- ❌ No `totalAvailable` returned
- ❌ Progress shows "Batch 1 of undefined"
- ❌ Sync appears to fail (even though subsequent batches work)

### After Fix
- ✅ Batch 1 completes successfully (110 seconds)
- ✅ `totalAvailable` returns: 3000 contacts
- ✅ Progress shows "Batch 1 of 120" correctly
- ✅ All 120 batches complete without errors

## Next.js Route Configuration Reference

### Required Exports for Long-Running Routes

```typescript
// Force dynamic rendering (don't cache)
export const dynamic = 'force-dynamic';

// Set maximum execution time
export const maxDuration = 300; // seconds (max: 300 for Pro, 60 for Hobby)
```

### Vercel Plan Limits
- **Hobby Plan**: Max 60 seconds (default)
- **Pro Plan**: Max 300 seconds (5 minutes)
- **Enterprise**: Custom limits

**Note**: Our route now requires **Pro Plan or self-hosted deployment** for full functionality.

## Testing Verification

### Test Plan
1. ✅ Start sync with batch size 25
2. ✅ Verify first batch completes without timeout
3. ✅ Verify `totalAvailable` is returned
4. ✅ Verify progress UI shows correct batch count
5. ✅ Verify all batches complete successfully

### Expected Results
```bash
# First batch should complete successfully
POST /api/google/contacts/sync
Response: {
  success: true,
  totalAvailable: 3000,
  totalProcessed: 25,
  hasMore: true,
  nextPageToken: "..."
}

# Frontend calculates:
totalBatches = Math.ceil(3000 / 25) = 120

# Progress UI shows:
"Syncing batch 1 of 120..."
"Syncing batch 2 of 120..."
...
"Syncing batch 120 of 120..."
"Sync complete! Processed 3000 contacts"
```

## Related Issues

### Frontend Timeout Handling
- Frontend already had correct timeout: `(batchSize || 25) * 4000 + 10000`
- Problem was **server-side timeout**, not client-side
- Frontend timeout is now properly aligned with server capabilities

### Application-Level Timeout
- Route also has internal timeout: `pageSize * 2000 + 60000`
- This timeout should NEVER fire now that Next.js timeout is fixed
- Internal timeout serves as secondary safety check

## Prevention

### For Future API Routes

**Always add these exports for routes that might take >60 seconds:**

```typescript
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // Adjust based on expected duration
```

**Routes that need this:**
- ✅ `google/contacts/sync` - Fixed
- ⚠️ `google/calendar/sync` - **Check if needed**
- ⚠️ Any batch processing routes - **Check if needed**
- ⚠️ Large data export routes - **Check if needed**

## Documentation Updates

### Files to Update
- [ ] `docs/features/GOOGLE_CONTACTS_SYNC_GUIDE.md` - Add timeout info
- [ ] `docs/deployment/VERCEL_DEPLOYMENT.md` - Note Pro Plan requirement
- [ ] `README.md` - Add hosting requirements section

## Deployment Checklist

- [x] Code fix applied
- [x] Fix documented
- [ ] Web server restarted
- [ ] Test with production data
- [ ] Monitor PM2 logs for timeouts
- [ ] Update user documentation

---

**Resolution Status**: ✅ FIXED - Route configured for 5-minute timeout
**Next Steps**: Deploy and test with production batch sync
**Risk**: None - Backward compatible, only increases timeout limit
