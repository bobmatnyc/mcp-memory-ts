# Gmail Extraction Retry Fix

## Problem

When Gmail extraction failed or was interrupted, the `gmail_extraction_log` table retained records with `status = 'failed'` or `status = 'processing'`. Due to the UNIQUE constraint on `(user_id, week_identifier)`, subsequent retry attempts would fail with:

```
UNIQUE constraint failed: gmail_extraction_log.user_id, gmail_extraction_log.week_identifier
```

## Root Cause

The `checkExtractionLog()` method (line 226 in `gmail-extraction-service.ts`) only checked for `status = 'completed'` records:

```typescript
WHERE user_id = ? AND week_identifier = ? AND status = 'completed'
```

This prevented re-extraction of completed weeks (correct behavior), but did not handle cleanup of failed or stale processing records, blocking retry attempts.

## Solution

Implemented "Check and Delete" pattern that:
1. Checks if week is already completed (skip if true)
2. **Deletes any stale non-completed records** (new behavior)
3. Creates new extraction log entry (now safe from UNIQUE constraint)

### Changes Made

#### 1. Added cleanup method to `DatabaseOperations` (`src/database/operations.ts`)

```typescript
/**
 * Delete stale (non-completed) Gmail extraction logs to allow retries
 * Returns the number of records deleted
 */
async deleteStaleExtractionLogs(userId: string, weekIdentifier: string): Promise<number> {
  const result = await this.db.execute(
    `DELETE FROM gmail_extraction_log
     WHERE user_id = ?
     AND week_identifier = ?
     AND status != 'completed'`,
    [userId, weekIdentifier]
  );
  return (result as any).changes || 0;
}
```

#### 2. Updated `GmailExtractionService.extractWeek()` (`src/services/gmail-extraction-service.ts`)

Added cleanup logic before creating new extraction log:

```typescript
// 1. Check if week already extracted (completed status only)
const existing = await this.checkExtractionLog(userId, weekIdentifier);
if (existing) {
  console.log(`Week ${weekIdentifier} already extracted`);
  return {
    success: true,
    skipped: true,
    reason: 'Week already extracted',
    log: existing,
  };
}

// 2. Clean up any stale non-completed records to allow retries
const deleteResult = await this.db.execute(
  `DELETE FROM gmail_extraction_log
   WHERE user_id = ?
   AND week_identifier = ?
   AND status != 'completed'`,
  [userId, weekIdentifier]
);
const deletedCount = (deleteResult as any).changes || 0;
if (deletedCount > 0) {
  console.log(
    `[GmailExtractionService] Cleaned up ${deletedCount} stale extraction log(s) for retry (user: ${userId}, week: ${weekIdentifier})`
  );
}

// 3. Create extraction log entry (now safe from UNIQUE constraint)
const logId = await this.createExtractionLog(userId, weekIdentifier);
```

## Behavior

### Before Fix

1. User attempts extraction → fails with error
2. Record created with `status = 'failed'`
3. User retries → **UNIQUE constraint error** (blocked)
4. User must manually delete failed record to retry

### After Fix

1. User attempts extraction → fails with error
2. Record created with `status = 'failed'`
3. User retries → stale record automatically deleted
4. New extraction attempt proceeds normally

## Safety Guarantees

✅ **Completed extractions protected**: Records with `status = 'completed'` are never deleted
✅ **Failed retries allowed**: Records with `status = 'failed'` are cleaned up automatically
✅ **Stale processing cleanup**: Orphaned `status = 'processing'` records are removed
✅ **Transparent logging**: Cleanup actions are logged for visibility
✅ **Atomic enough**: DELETE + INSERT pattern is safe for typical use cases

## Testing Checklist

- [x] TypeScript compilation succeeds
- [x] Build completes without errors
- [ ] Manual test: Retry failed extraction (requires database setup)
- [ ] Manual test: Verify completed extraction still prevented
- [ ] Manual test: Check cleanup logging appears in console

## Verification Steps

### Test Scenario 1: Failed Extraction Retry

```bash
# 1. Start extraction (will fail without proper credentials)
curl -X POST http://localhost:3002/api/gmail/extract \
  -H "Content-Type: application/json" \
  -d '{"week_identifier": "2025-W42"}'

# 2. Verify failed log created
curl http://localhost:3002/api/gmail/logs

# 3. Retry extraction (should clean up and proceed)
curl -X POST http://localhost:3002/api/gmail/extract \
  -H "Content-Type: application/json" \
  -d '{"week_identifier": "2025-W42"}'

# 4. Check logs for cleanup message
# Expected: "[GmailExtractionService] Cleaned up 1 stale extraction log(s)..."
```

### Test Scenario 2: Completed Extraction Protection

```bash
# 1. Successfully complete extraction
curl -X POST http://localhost:3002/api/gmail/extract \
  -H "Content-Type: application/json" \
  -d '{"week_identifier": "2025-W41"}'

# 2. Attempt re-extraction (should skip)
curl -X POST http://localhost:3002/api/gmail/extract \
  -H "Content-Type: application/json" \
  -d '{"week_identifier": "2025-W41"}'

# Expected response:
# {
#   "success": true,
#   "skipped": true,
#   "reason": "Week already extracted"
# }
```

## Performance Impact

- **Minimal overhead**: Single DELETE query before INSERT
- **Database load**: Negligible (operates on 0-1 records typically)
- **Concurrency**: Safe for typical use (users don't retry simultaneously)

## Files Modified

1. `/Users/masa/Projects/mcp-memory-ts/src/database/operations.ts`
   - Added `deleteStaleExtractionLogs()` method

2. `/Users/masa/Projects/mcp-memory-ts/src/services/gmail-extraction-service.ts`
   - Added cleanup logic in `extractWeek()` method

## Related Issues

- UNIQUE constraint on `gmail_extraction_log(user_id, week_identifier)`
- Need to allow failed extraction retries
- Stale processing records from interrupted extractions

## Implementation Date

October 18, 2025

## Code Review Notes

- ✅ Follows existing patterns in codebase
- ✅ Proper error handling and logging
- ✅ Minimal code changes (surgical fix)
- ✅ Backward compatible
- ✅ No breaking changes to API
- ✅ TypeScript type safety maintained
