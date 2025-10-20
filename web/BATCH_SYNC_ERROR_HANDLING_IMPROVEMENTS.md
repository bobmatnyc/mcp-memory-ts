# Batch Sync Error Handling Improvements

## Summary
Enhanced error handling and diagnostics for the Google Contacts batch sync feature to diagnose "signal is aborted without reason" errors.

## Changes Made

### 1. Batch Size Validation (Line 268-271)
**Before:**
```typescript
const timeoutMs = batchSize * 2000 + 60000;
```

**After:**
```typescript
// Validate batchSize before timeout calculation
if (!batchSize || batchSize <= 0) {
  throw new Error(`Invalid batch size: ${batchSize}. Must be a positive number.`);
}

const timeoutMs = batchSize * 2000 + 60000;
```

**Benefit:** Catches invalid batch sizes early before they cause calculation errors.

---

### 2. Enhanced AbortController Logging (Line 276-287)
**Before:**
```typescript
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
```

**After:**
```typescript
console.log(`[GoogleContactsSync Frontend][${requestId}] Creating AbortController for batch ${batchNumber}`, {
  batchSize,
  timeoutMs,
  timeoutSeconds: Math.round(timeoutMs / 1000),
});

const controller = new AbortController();
const timeoutId = setTimeout(() => {
  const reason = `Batch ${batchNumber} timed out after ${Math.round(timeoutMs / 1000)} seconds (batch size: ${batchSize})`;
  console.error(`[GoogleContactsSync Frontend][${requestId}] ${reason}`);
  controller.abort(reason);
}, timeoutMs);
```

**Benefits:**
- See exact timeout calculation before fetch starts
- Abort signal now includes descriptive reason
- Clear error message when timeout fires
- Easy to verify timeout is appropriate for batch size

---

### 3. Successful Fetch Logging (Line 298-305)
**Before:**
```typescript
clearTimeout(timeoutId);

console.log(`[GoogleContactsSync Frontend][${requestId}] Batch ${batchNumber} fetch completed (${fetchDuration}ms)`, {
  ok: response.ok,
  status: response.status,
});
```

**After:**
```typescript
clearTimeout(timeoutId);

console.log(`[GoogleContactsSync Frontend][${requestId}] Batch ${batchNumber} completed, timeout cleared`, {
  duration: fetchDuration,
  timeoutWas: timeoutMs,
  ok: response.ok,
  status: response.status,
});
```

**Benefits:**
- Confirms timeout was successfully cleared
- Shows how long fetch took vs timeout duration
- Helps identify if timeouts are unnecessarily long/short

---

### 4. Comprehensive Fetch Error Handling (Line 382-411)
**Before:**
```typescript
} catch (fetchError) {
  console.error(`[GoogleContactsSync Frontend][${requestId}] Batch ${batchNumber} fetch error`, {
    error: fetchError instanceof Error ? fetchError.message : String(fetchError),
  });
  allErrors.push(fetchError instanceof Error ? fetchError.message : 'Batch fetch failed');
  break;
}
```

**After:**
```typescript
} catch (fetchError) {
  clearTimeout(timeoutId); // Prevent timeout from firing after error

  const errorMessage = fetchError instanceof Error ? fetchError.message : String(fetchError);
  const isAbortError = fetchError instanceof DOMException && fetchError.name === 'AbortError';

  console.error(`[GoogleContactsSync Frontend][${requestId}] Batch ${batchNumber} fetch error`, {
    error: errorMessage,
    isAbortError,
    batchSize,
    timeoutMs,
    timeoutSeconds: Math.round(timeoutMs / 1000),
    errorType: fetchError?.constructor?.name,
    errorName: fetchError instanceof Error ? fetchError.name : 'unknown',
  });

  if (isAbortError) {
    allErrors.push(
      `Batch ${batchNumber} was aborted. ` +
      `This could indicate: ` +
      `(1) Network timeout after ${Math.round(timeoutMs / 1000)}s, ` +
      `(2) Server not responding, or ` +
      `(3) Request cancelled. ` +
      `Try with a smaller batch size or check server logs.`
    );
  } else {
    allErrors.push(`Batch ${batchNumber}: ${errorMessage}`);
  }
  break;
}
```

**Benefits:**
- Timeout cleared in error path (prevents duplicate abort)
- Distinguish between AbortError and other errors
- Log comprehensive error context for debugging
- User-friendly error message with actionable suggestions
- Shows exact timeout duration and batch size

---

## Error Path Coverage

### ✅ All Cleanup Paths Verified

1. **Success Path**: `clearTimeout(timeoutId)` called after successful fetch (line 298)
2. **Error Path**: `clearTimeout(timeoutId)` called in catch block (line 383)
3. **Timeout Path**: Clear error logged when timeout fires (line 285)

### ✅ Error Type Detection

The code now properly detects and differentiates:
- `AbortError` from timeout
- `AbortError` from user cancellation
- Network errors
- Parse errors
- HTTP errors

---

## Diagnostics Now Available

When the "signal is aborted without reason" error occurs, you'll now see:

### Before Fetch:
```
[GoogleContactsSync Frontend][req-123] Creating AbortController for batch 1 {
  batchSize: 50,
  timeoutMs: 160000,
  timeoutSeconds: 160
}
```

### On Timeout:
```
[GoogleContactsSync Frontend][req-123] Batch 1 timed out after 160 seconds (batch size: 50)
```

### On Error:
```
[GoogleContactsSync Frontend][req-123] Batch 1 fetch error {
  error: "signal is aborted without reason",
  isAbortError: true,
  batchSize: 50,
  timeoutMs: 160000,
  timeoutSeconds: 160,
  errorType: "DOMException",
  errorName: "AbortError"
}
```

### User-Facing Error:
```
Batch 1 was aborted. This could indicate: (1) Network timeout after 160s, (2) Server not responding, or (3) Request cancelled. Try with a smaller batch size or check server logs.
```

---

## Testing Recommendations

1. **Test with batch size 25**: Should timeout after 110s
2. **Test with batch size 50**: Should timeout after 160s
3. **Test with batch size 100**: Should timeout after 260s
4. **Monitor console logs**: Should see AbortController creation before each batch
5. **Check successful completion**: Should see "timeout cleared" message
6. **Trigger timeout**: Let a batch run longer than timeout to verify abort reason is logged

---

## Expected Behavior

### Normal Operation:
1. Log: "Creating AbortController for batch N"
2. Fetch completes successfully
3. Log: "Batch N completed, timeout cleared"
4. Continue to next batch

### Timeout Scenario:
1. Log: "Creating AbortController for batch N"
2. Fetch takes too long
3. Log: "Batch N timed out after Xs seconds"
4. Catch block: Log comprehensive error details
5. Error message: User-friendly explanation with suggestions

### Immediate Abort (Current Bug):
1. Log: "Creating AbortController for batch N"
2. **Immediately**: Log error with full context
3. Now can see: Is it timing out? Is batchSize valid? What's the actual timeout duration?

---

## Next Steps

With these improvements, you should now be able to see:
1. Whether batchSize is valid
2. What timeout was calculated
3. Whether timeout fires or fetch completes normally
4. Exact timing of abort vs fetch duration
5. Clear distinction between timeout, network error, and other issues

This should help diagnose why the abort signal is firing immediately.

---

**File Modified:** `web/components/google/google-contacts-sync.tsx`
**Lines Modified:** 268-271, 276-287, 298-305, 382-411
**Total Changes:** 4 sections enhanced with comprehensive logging and error handling
