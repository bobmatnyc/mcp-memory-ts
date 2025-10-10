# Fix NULL IDs Script

## Overview

This script fixes memories table records with NULL IDs by assigning valid UUIDs. This is a common issue with LibSQL/Turso databases where certain queries can result in NULL ID values.

## Problem

When selecting only the ID column from the memories table in LibSQL/Turso, the driver may return NULL for all rows even when IDs exist. This quirk can lead to actual NULL IDs being stored in the database.

## Solution

The `fix-null-ids.ts` script:
1. Identifies all memories with NULL IDs
2. Generates unique UUIDs for each record
3. Updates records in safe batches (50 at a time)
4. Verifies all NULLs are fixed
5. Reports comprehensive statistics

## Usage

### Dry Run (Preview Changes)

```bash
npm run fix-null-ids -- --dry-run
```

This shows what would be done without making any changes to the database.

### Execute Fix

```bash
npm run fix-null-ids
```

This actually updates the database with new UUIDs.

## Features

### Safety Features
- **Dry-run mode**: Preview all changes before applying
- **Duplicate prevention**: Checks existing IDs to avoid conflicts
- **Batch processing**: Updates 50 records at a time to avoid overwhelming the database
- **Automatic verification**: Counts NULL IDs before and after fix
- **Rate limiting**: Small delays between batches to avoid rate limits

### Output Format

```
═══════════════════════════════════════════════════════
🔍 MCP Memory - NULL ID Fix Script
═══════════════════════════════════════════════════════

🔍 Checking for NULL IDs...
Found 728 memories with NULL IDs

📋 Loading existing IDs to prevent duplicates...
✅ Loaded 1234 existing IDs

📦 Backup Recommendation:
   Run: turso db shell <database-name> ".backup backup-2025-10-09T19-37-00.db"
   Timestamp: 2025-10-09T19-37-00

🔧 Fixing NULL IDs in batches of 50...
Batch 1/15: Processing...
Batch 1/15: Updated 50 records
Batch 2/15: Processing...
Batch 2/15: Updated 50 records
...
Batch 15/15: Processing...
Batch 15/15: Updated 28 records

🔍 Verifying fix...

═══════════════════════════════════════════════════════
📊 Fix Summary
═══════════════════════════════════════════════════════
Total NULL IDs found:           728
Successfully updated:           728
Failed:                         0
Remaining NULLs:                0
═══════════════════════════════════════════════════════

✅ Fix complete! All NULL IDs have been resolved.
```

## Technical Details

### UUID Generation
- Uses `crypto.randomUUID()` for cryptographically secure UUIDs
- Checks against existing IDs to prevent duplicates
- Maintains a Set of existing IDs for fast lookup

### Batch Processing
- Processes 50 records per batch (configurable via BATCH_SIZE constant)
- Uses `LIMIT` to fetch batches in order by created_at
- 100ms delay between batches to avoid rate limiting

### Database Queries

**Count NULL IDs:**
```sql
SELECT COUNT(*) as count FROM memories WHERE id IS NULL
```

**Fetch batch with NULL IDs:**
```sql
SELECT user_id, title, content, memory_type, created_at, updated_at
FROM memories
WHERE id IS NULL
ORDER BY created_at DESC
LIMIT 50
```

**Update with unique WHERE conditions:**
```sql
UPDATE memories
SET id = ?
WHERE id IS NULL
  AND user_id = ?
  AND title = ?
  AND created_at = ?
```

### LibSQL/Turso Quirks Handled
- Cannot select only ID column (returns NULL for all rows)
- Must use additional columns (user_id, title, created_at) to identify records
- No LIMIT support in UPDATE statements
- Uses combination of WHERE conditions for unique identification

## Error Handling

- Each record update is wrapped in try/catch
- Failed updates are counted separately
- Errors are logged with context
- Script continues processing remaining records on individual failures

## Integration

The script is integrated into the MCP Memory project:

**package.json:**
```json
{
  "scripts": {
    "fix-null-ids": "tsx scripts/fix-null-ids.ts"
  }
}
```

**CLAUDE.md:** Documented in:
- NULL ID Fix Workflow section
- Essential Commands quick reference
- Database Problems troubleshooting section

## Recommendations

1. **Always run dry-run first** to preview changes
2. **Create database backup** before executing fix
3. **Monitor the output** for any failed updates
4. **Verify the fix** by checking the final NULL count
5. **Report issues** if NULL IDs persist after fix

## When to Use

Run this script when:
- Database queries return unexpected NULL ID values
- Entity or memory lookups fail with NULL ID errors
- Schema migrations reveal NULL ID records
- Regular database maintenance identifies NULL IDs

## Related Documentation

- [CLAUDE.md](../CLAUDE.md) - Main agent instructions
- [CLI-GUIDE.md](../docs/guides/CLI-GUIDE.md) - CLI documentation
- [MIGRATION_QUICK_START.md](../docs/guides/MIGRATION_QUICK_START.md) - Migration guide
