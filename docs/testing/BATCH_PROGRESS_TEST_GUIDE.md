# Batch Progress Display - Testing Guide

## Quick Test Instructions

### Before You Start
1. Make sure you have Google Contacts connected
2. Have at least 100+ contacts for meaningful batch testing
3. Open browser DevTools Console to see detailed logs

### Test Steps

#### Test 1: Verify "Batch X of Y" Display
1. Go to `/settings` (Google Contacts Sync section)
2. **Enable Batch Mode** ✅
3. **Select Batch Size:** 25
4. **Direction:** Import
5. Click "Start Batch Sync"

**Expected Results:**
```
Batch 1 Status:
- Initially: "Processing batch 1..." → Display: "Batch 1"
- After API: "Batch 1 complete" → Display: "Batch 1 of 120" ✅

Batch 2+ Status:
- Before API: "Processing batch 2..." → Display: "Batch 2 of 120" ✅
- After API: "Batch 2 complete" → Display: "Batch 2 of 120" ✅
```

#### Test 2: Verify Processed Count
**Watch the "Processed: X of Y" line**

```
Batch 1:
- Before API: "Processed: 0"
- After API: "Processed: 25 of 3000" ✅

Batch 2:
- Before API: "Processed: 25 of 3000" ✅
- After API: "Processed: 50 of 3000" ✅

Batch 3:
- Before API: "Processed: 50 of 3000" ✅
- After API: "Processed: 75 of 3000" ✅
```

#### Test 3: Console Logging Verification
**Open Console (F12) and look for:**

```javascript
// First batch - calculates total
[GoogleContactsSync Frontend][frontend-xxx] Calculated total batches: 120 (3000 contacts / 25 batch size)

// Before fetch - shows preserved totalBatches
[GoogleContactsSync Frontend][frontend-xxx] Progress display updated (before fetch)
{
  batchNumber: 2,
  totalBatches: 120,        // ✅ Preserved from batch 1
  current: 25,
  displayWillShow: "Batch 2 of 120"  // ✅ Shows total
}

// After fetch - shows updated counts
[GoogleContactsSync Frontend][frontend-xxx] Progress display updated (after fetch)
{
  batchNumber: 2,
  totalBatches: 120,
  current: 50,              // ✅ Updated count
  total: 3000,
  displayWillShow: "Batch 2 of 120"
}
```

### What Was Fixed

#### Before Fix ❌
```
UI Display:
- "Processing batch 1..."
- "Batch 1" (missing total)
- "Processed: 0" (stuck at zero)

Console Logs:
- totalBatches calculated but not preserved
- No visibility into progress state
```

#### After Fix ✅
```
UI Display:
- "Processing batch 1..."
- "Batch 1" → then "Batch 1 of 120"
- "Processed: 0" → then "Processed: 25 of 3000"

Subsequent Batches:
- "Processing batch 2..."
- "Batch 2 of 120" (shows total immediately)
- "Processed: 25 of 3000" (shows current count)

Console Logs:
- Clear calculation log: "Calculated total batches: 120"
- Before/after fetch logs show state transitions
- Visibility into displayWillShow values
```

### Different Batch Sizes

#### Batch Size: 25 (Recommended)
- 3000 contacts = 120 batches
- Each batch ~2-3 seconds
- Total time: 4-6 minutes

#### Batch Size: 50 (Faster)
- 3000 contacts = 60 batches
- Each batch ~4-5 seconds
- Total time: 4-5 minutes

#### Batch Size: 100 (Fastest)
- 3000 contacts = 30 batches
- Each batch ~8-10 seconds
- Total time: 4-5 minutes

### Common Scenarios

#### Scenario 1: First Batch Only
**If you only see one batch:**
- Verify you have more contacts than batch size
- Check console for "hasMore: false" in logs

#### Scenario 2: Progress Bar
**The blue progress bar should:**
- Start at 0%
- Increment with each batch
- Show 100% at completion
- Width = (current / total) * 100%

#### Scenario 3: Cancel Mid-Sync
**Test cancellation:**
1. Start sync with large batch count
2. Click "Cancel Sync" after batch 2
3. **Verify:**
   - Sync stops cleanly
   - Shows results up to cancelled batch
   - No orphaned API calls

### Debug Checklist

If progress display still looks wrong:

- [ ] Check browser console for calculation logs
- [ ] Verify API response includes `totalAvailable` field
- [ ] Check that batch size divides into total correctly
- [ ] Look for "Progress display updated" logs
- [ ] Verify totalBatches is not undefined in logs

### Expected Console Output Example

```javascript
// Batch 1
[GoogleContactsSync Frontend][frontend-123] Starting batch sync mode
[GoogleContactsSync Frontend][frontend-123] Processing batch 1...
[GoogleContactsSync Frontend][frontend-123] Progress display updated (before fetch) {
  batchNumber: 1,
  totalBatches: undefined,  // ✅ First batch doesn't have it yet
  current: 0,
  displayWillShow: "Batch 1"
}
[GoogleContactsSync Frontend][frontend-123] Calculated total batches: 120 (3000 contacts / 25 batch size)
[GoogleContactsSync Frontend][frontend-123] Progress display updated (after fetch) {
  batchNumber: 1,
  totalBatches: 120,        // ✅ Now calculated
  current: 25,
  total: 3000,
  displayWillShow: "Batch 1 of 120"
}

// Batch 2
[GoogleContactsSync Frontend][frontend-123] Processing batch 2...
[GoogleContactsSync Frontend][frontend-123] Progress display updated (before fetch) {
  batchNumber: 2,
  totalBatches: 120,        // ✅ Preserved from batch 1!
  current: 25,
  displayWillShow: "Batch 2 of 120"
}
[GoogleContactsSync Frontend][frontend-123] Progress display updated (after fetch) {
  batchNumber: 2,
  totalBatches: 120,
  current: 50,
  total: 3000,
  displayWillShow: "Batch 2 of 120"
}
```

## Summary

### Key Improvements
1. ✅ **Batch Display:** "Batch X of Y" shows from batch 2 onwards (batch 1 shows after completion)
2. ✅ **Processed Count:** Increments correctly with each batch
3. ✅ **Progress Bar:** Accurate percentage based on actual progress
4. ✅ **Console Logging:** Complete visibility into state changes

### What to Report Back
- [ ] Does "Batch X of Y" display correctly?
- [ ] Does processed count increment?
- [ ] Are console logs showing totalBatches preservation?
- [ ] Any unexpected behavior?

### File Changed
- `web/components/google/google-contacts-sync.tsx`

### How to Deploy
```bash
# Rebuild web app
cd web
npm run build

# Restart PM2 (production)
pm2 restart mcp-memory-web

# Or restart dev server (staging)
# Kill existing dev server, then:
cd web && npm run dev -- -p 3002
```

---

**Status:** Ready for Testing ✅
**Risk Level:** Low (UI-only change, no API changes)
**Rollback:** Easy (just revert the component file)
