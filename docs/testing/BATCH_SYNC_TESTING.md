# Batch Sync Testing Guide

## Quick Start Testing

### Test 1: Small Contact List (< 100 contacts)

**Purpose:** Verify batch mode works for small lists and completes in 1 batch

**Steps:**
1. Open web interface: `http://localhost:3002`
2. Navigate to Google Contacts sync
3. Enable "Batch Mode"
4. Set batch size to 100
5. Click "Start Batch Sync"

**Expected Results:**
- ✅ Completes in 1 batch (Batch 1 shown)
- ✅ Progress shows "X of X" (total contacts)
- ✅ All contacts imported successfully
- ✅ No errors displayed
- ✅ Completes within 30-60 seconds

**Verification:**
```bash
# Check imported contacts in database
cd /Users/masa/Projects/mcp-memory-ts
npm run cli -- contacts list --user-email your@email.com
```

---

### Test 2: Medium Contact List (200-500 contacts)

**Purpose:** Verify batch mode handles multiple batches correctly

**Steps:**
1. Open web interface
2. Enable "Batch Mode"
3. Set batch size to 100
4. Click "Start Batch Sync"
5. Watch progress through batches

**Expected Results:**
- ✅ Processes 2-5 batches
- ✅ Progress updates after each batch
- ✅ Batch number increments: Batch 1, Batch 2, Batch 3...
- ✅ All contacts imported without duplicates
- ✅ Completes within 5-10 minutes

**Verification:**
```bash
# Count total contacts
npm run cli -- contacts list --user-email your@email.com | wc -l

# Check for duplicates (should be 0)
npm run cli -- contacts list --user-email your@email.com | sort | uniq -d | wc -l
```

---

### Test 3: Large Contact List (1000+ contacts)

**Purpose:** Verify batch mode handles very large lists

**Steps:**
1. Open web interface
2. Enable "Batch Mode"
3. Set batch size to 100
4. Click "Start Batch Sync"
5. Monitor progress for 10-20 minutes

**Expected Results:**
- ✅ Processes 10+ batches
- ✅ Progress bar updates smoothly
- ✅ Each batch completes within 60 seconds
- ✅ No timeout errors
- ✅ All contacts imported successfully

**Performance Metrics:**
- Batch processing time: 30-60s per batch
- Total time: ~1 minute per 100 contacts
- Memory usage: Stable (no leaks)
- Network usage: Consistent

---

### Test 4: Cancellation

**Purpose:** Verify user can cancel mid-sync and partial results are saved

**Steps:**
1. Start batch sync with large contact list
2. Wait for 2-3 batches to complete
3. Click "Cancel Sync" button
4. Verify partial results

**Expected Results:**
- ✅ Cancel button appears during sync
- ✅ Sync stops after current batch
- ✅ Partial results displayed (e.g., "200 imported")
- ✅ No errors or corruption
- ✅ Can restart sync later

**Verification:**
```bash
# Check contacts imported so far
npm run cli -- contacts list --user-email your@email.com | wc -l

# Restart sync and verify no duplicates created
```

---

### Test 5: Compare Full Sync vs Batch Mode

**Purpose:** Verify results are identical between modes

**Steps:**
1. **Full Sync:**
   - Disable "Batch Mode"
   - Run sync
   - Note contact count

2. **Clear Database:**
   ```bash
   # Backup first!
   npm run cli -- contacts export --user-email your@email.com -o backup.vcf

   # Delete contacts (be careful!)
   # (Manual deletion via web interface)
   ```

3. **Batch Sync:**
   - Enable "Batch Mode"
   - Run sync
   - Note contact count

**Expected Results:**
- ✅ Same number of contacts imported
- ✅ No missing contacts
- ✅ No duplicate contacts
- ✅ Batch mode handles larger lists without timeout

---

### Test 6: Error Handling

**Purpose:** Verify graceful error handling

**Test Cases:**

#### 6a. Network Failure
1. Start batch sync
2. Disconnect network after 1-2 batches
3. Observe error handling

**Expected:**
- ✅ Error message displayed
- ✅ Partial results preserved
- ✅ Can retry after reconnecting

#### 6b. Invalid Credentials
1. Revoke Google access
2. Try batch sync

**Expected:**
- ✅ Clear error message: "Google account not connected"
- ✅ Prompt to reconnect

#### 6c. API Rate Limit
1. Run multiple syncs back-to-back
2. Observe rate limiting

**Expected:**
- ✅ 500ms delay between batches prevents most issues
- ✅ If rate limited, clear error with retry time
- ✅ Can adjust batch size to reduce load

---

### Test 7: Progress Accuracy

**Purpose:** Verify progress tracking is accurate

**Steps:**
1. Start batch sync with known contact count
2. Watch progress after each batch
3. Verify numbers add up

**Check:**
- ✅ "Processed: X" increases correctly
- ✅ Batch number increments: 1, 2, 3...
- ✅ Final total matches actual imports
- ✅ Progress bar fills correctly (if total known)

**Example Log:**
```
Batch 1: Processed 100
Batch 2: Processed 200
Batch 3: Processed 300
...
Final: 534 contacts imported
```

---

### Test 8: Batch Size Comparison

**Purpose:** Find optimal batch size for different scenarios

**Test Matrix:**

| Batch Size | 100 Contacts | 500 Contacts | 1000 Contacts |
|------------|--------------|--------------|---------------|
| 50         | ~1 min       | ~10 min      | ~20 min       |
| 100        | ~1 min       | ~7 min       | ~15 min       |
| 150        | ~1 min       | ~5 min       | ~12 min       |
| 200        | ~1 min       | ~4 min       | ~10 min       |

**Expected Results:**
- ✅ Larger batch sizes = faster total time
- ✅ All batch sizes complete successfully
- ✅ 100 is good default balance
- ✅ 200 is faster but may timeout on slow connections

---

### Test 9: LLM Deduplication in Batch Mode

**Purpose:** Verify deduplication works correctly across batches

**Steps:**
1. Enable "Batch Mode"
2. Enable "LLM Deduplication"
3. Run sync with contacts that have duplicates in Google
4. Check results

**Expected Results:**
- ✅ Duplicates detected across batches
- ✅ Merge suggestions provided
- ✅ No duplicate entities created
- ✅ Process takes longer (expected with LLM)

**Performance:**
- Without LLM: ~1 min per 100 contacts
- With LLM: ~2-3 min per 100 contacts

---

### Test 10: Browser Refresh During Sync

**Purpose:** Test resilience to user actions

**Steps:**
1. Start batch sync
2. After 2-3 batches, refresh browser
3. Check results

**Current Behavior:**
- ⚠️ Sync stops
- ⚠️ Partial results preserved
- ⚠️ Must restart sync manually

**Future Enhancement:**
- Resume from last successful batch (not implemented yet)

---

## Automated Test Script

```bash
#!/bin/bash
# batch-sync-test.sh

echo "🧪 Batch Sync Testing Script"
echo "=============================="

# Test 1: Small list
echo "Test 1: Small contact list (batch mode)"
curl -X POST http://localhost:3002/api/google/contacts/sync \
  -H "Content-Type: application/json" \
  -d '{
    "direction": "import",
    "useLLM": false,
    "pageSize": 100
  }'

# Wait between tests
sleep 5

# Test 2: Multiple batches
echo "Test 2: Multiple batches (pageToken)"
FIRST_RESPONSE=$(curl -s -X POST http://localhost:3002/api/google/contacts/sync \
  -H "Content-Type: application/json" \
  -d '{"direction": "import", "pageSize": 50}')

echo "First batch response: $FIRST_RESPONSE"

# Extract nextPageToken (requires jq)
PAGE_TOKEN=$(echo $FIRST_RESPONSE | jq -r '.nextPageToken')

if [ "$PAGE_TOKEN" != "null" ]; then
  echo "Second batch with pageToken: $PAGE_TOKEN"
  curl -X POST http://localhost:3002/api/google/contacts/sync \
    -H "Content-Type: application/json" \
    -d "{\"direction\": \"import\", \"pageSize\": 50, \"pageToken\": \"$PAGE_TOKEN\"}"
fi

echo "✅ Tests complete"
```

**Run Tests:**
```bash
chmod +x batch-sync-test.sh
./batch-sync-test.sh
```

---

## Performance Benchmarks

### Expected Performance

| Metric | Value |
|--------|-------|
| Batch processing time | 30-60s per batch |
| Contacts per second | 2-3 contacts/sec |
| API timeout risk | Near zero with batching |
| Memory usage | < 500MB throughout |
| Network usage | ~100KB per contact |

### Actual Performance (to be measured)

| Test Case | Batch Size | Total Contacts | Batches | Time | Notes |
|-----------|------------|----------------|---------|------|-------|
| Test 1    | 100        | 87             | 1       | ?    | Fill in after testing |
| Test 2    | 100        | 345            | 4       | ?    |  |
| Test 3    | 100        | 1250           | 13      | ?    |  |
| Test 4    | 50         | 345            | 7       | ?    | Smaller batches |
| Test 5    | 200        | 345            | 2       | ?    | Larger batches |

---

## Debug Commands

### Check Current Sync State
```bash
# View sync logs
tail -f /Users/masa/Projects/mcp-memory-ts/web/logs/sync.log

# Check PM2 logs (if using PM2)
pm2 logs mcp-memory-web

# Check database contact count
npm run cli -- contacts list --user-email user@example.com | wc -l
```

### Monitor Performance
```bash
# Watch network activity
watch -n 1 'netstat -an | grep 3002'

# Monitor memory usage
watch -n 1 'ps aux | grep node'

# Check database size
ls -lh ~/.mcp-memory/*.db
```

### Cleanup After Testing
```bash
# Export contacts before cleanup
npm run cli -- contacts export -u user@example.com -o backup.vcf

# Clear test data (careful!)
# Use web interface to delete contacts individually

# Restart services
pm2 restart mcp-memory-web
```

---

## Troubleshooting

### Issue: Batch sync times out
**Solution:**
- Reduce batch size to 50
- Check network connection
- Look for Google API rate limits

### Issue: Progress not updating
**Solution:**
- Check browser console for errors
- Verify API responses include pagination fields
- Refresh page and try again

### Issue: Duplicates created
**Solution:**
- Enable LLM deduplication
- Check for matching logic issues
- Review entity metadata for UUID conflicts

### Issue: Cancellation doesn't work
**Solution:**
- Check `cancelRequested` flag is set
- Verify current batch completes first
- Look for errors in console

---

## Success Criteria

All tests must pass:
- ✅ Small lists (< 100): Complete in 1 batch
- ✅ Medium lists (200-500): Complete in multiple batches
- ✅ Large lists (1000+): Complete without timeout
- ✅ Cancellation: Works correctly, preserves partial results
- ✅ Progress: Updates accurately after each batch
- ✅ Errors: Handled gracefully with clear messages
- ✅ Performance: Each batch < 60 seconds
- ✅ No duplicates: Deduplication works correctly

---

**Testing Date:** 2025-10-16
**Status:** Ready for manual testing
**Next Steps:** Execute test plan and record results
