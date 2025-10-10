# NULL ID Recovery Guide

## Problem Description

After previous migration attempts, **407 memory records remain with NULL IDs** that cause UNIQUE constraint violations when attempting to update them.

### Root Cause
SQLite's UNIQUE index on the `id` column treats **all NULL values as identical**. This means:
- The first NULL ID record can be inserted
- All subsequent NULL ID records violate the UNIQUE constraint
- Standard UPDATE operations fail because they can't distinguish between NULL records

### Previous Attempts
- Initial migration script (`fix-null-ids.ts`) successfully fixed **307 records**
- Remaining **407 records** couldn't be updated due to UNIQUE constraint errors
- These records are "stuck" because SQLite sees them all as duplicates

## Solution: Advanced Recovery Script

The `advanced-null-id-recovery.ts` script solves this by using a **delete-and-reinsert strategy**:

1. **Backup**: Export all NULL ID records to JSON (with rowid for unique identification)
2. **Delete**: Remove all NULL ID records using rowid (bypasses UNIQUE constraint)
3. **Reinsert**: Insert records with newly generated UUIDs
4. **Verify**: Confirm no NULL IDs remain

### Why This Works
- **rowid** is SQLite's internal unique identifier for each row
- Deleting by rowid avoids the NULL ID UNIQUE constraint issue
- Reinserting with proper UUIDs creates clean, valid records
- All operations are wrapped in a transaction for safety

## Usage

### Prerequisites
```bash
# Ensure environment is configured
source .env

# Verify you have the required environment variables
echo $TURSO_URL
echo $TURSO_AUTH_TOKEN
```

### Running the Recovery

**Important**: The script automatically creates backups, but you may want to create an additional database backup first:

```bash
# Optional: Create manual database backup (Turso)
turso db shell <your-database-name> ".backup backups/pre-recovery-$(date +%Y%m%d).db"
```

**Run the recovery script**:
```bash
npm run recover-null-ids
```

### Expected Output

```
🔄 Advanced NULL ID Recovery

📊 Found 407 records with NULL IDs

📦 Backing up 407 NULL ID records...
✅ Backup saved to: backups/null-id-records-2025-10-09.json

🔧 Starting transaction...
✅ Prepared 407 DELETE statements
✅ Prepared 407 INSERT statements with new UUIDs

🗑️  Deleting NULL ID records and re-inserting with valid UUIDs...
   Progress: 50/814 statements (6%)
   Progress: 100/814 statements (12%)
   Progress: 150/814 statements (18%)
   ...
   Progress: 814/814 statements (100%)
✅ Transaction committed successfully

🔍 Verifying recovery...
✅ 0 NULL IDs remaining
✅ Total memories in database: 2847

============================================================
📊 Recovery Summary
============================================================
Records with NULL IDs found:    407
Records backed up:              407
Records deleted:                407
Records re-inserted:            407
New UUIDs assigned:             407
Remaining NULL IDs:             0
Total records in database:      2847

Backup file: backups/null-id-records-2025-10-09.json
============================================================

✅ Recovery completed successfully!
💡 Keep the backup file in case you need to reference original data
```

## Safety Features

### 1. Automatic Backup
- All NULL ID records are exported to JSON **before any deletions**
- Backup includes original rowid for reference
- Stored in `backups/null-id-records-YYYY-MM-DD.json`

### 2. Transaction Safety
- All operations are batched for atomicity
- If any operation fails, no changes are committed
- Database remains in original state on error

### 3. Verification
- Automatically verifies 0 NULL IDs remain after recovery
- Confirms total record count is preserved
- Throws error if verification fails

### 4. Rollback Capability
If you need to rollback (extremely unlikely):
1. The backup file contains all original data with rowids
2. You can manually delete the new records and restore from backup
3. Contact support if needed

## Backup File Format

The backup JSON contains:
```json
{
  "timestamp": "2025-10-09T12:34:56.789Z",
  "totalRecords": 407,
  "records": [
    {
      "rowid": 12345,
      "original_rowid": 12345,
      "id": null,
      "user_id": "user@example.com",
      "title": "Example Memory",
      "content": "...",
      "memory_type": "MEMORY",
      "importance": "MEDIUM",
      "tags": "tag1,tag2",
      "entity_ids": "1,2,3",
      "embedding": "[0.1, 0.2, ...]",
      "metadata": "{}",
      "is_archived": 0,
      "created_at": "2025-10-08T10:00:00.000Z",
      "updated_at": "2025-10-08T10:00:00.000Z"
    }
    // ... 406 more records
  ]
}
```

## Technical Details

### How the Script Works

#### Step 1: Count and Identify
```sql
SELECT COUNT(*) FROM memories WHERE id IS NULL
```

#### Step 2: Backup with rowid
```sql
SELECT rowid, * FROM memories WHERE id IS NULL ORDER BY rowid
```

#### Step 3: Delete by rowid (avoids UNIQUE constraint)
```sql
DELETE FROM memories WHERE rowid = ?
-- Executed 407 times, one per record
```

#### Step 4: Reinsert with UUIDs
```sql
INSERT INTO memories (id, user_id, title, content, ...)
VALUES (?, ?, ?, ?, ...)
-- Executed 407 times with new UUIDs
```

#### Step 5: Verify
```sql
SELECT COUNT(*) FROM memories WHERE id IS NULL
-- Expected: 0
```

### Batch Processing
- Operations are executed in batches of 50 statements
- Prevents timeout on large datasets
- Shows progress during execution

### Error Handling
- Database connection errors: Fails before any operations
- Backup file errors: Fails before deletions
- Transaction errors: No changes committed
- Verification errors: Alerts but data is already recovered

## Troubleshooting

### Issue: Script reports 0 NULL IDs
**Cause**: The records may have already been fixed
**Solution**: Run verification to confirm database is clean

### Issue: Backup file not created
**Cause**: Permissions issue or disk space
**Solution**: Check `backups/` directory exists and has write permissions

### Issue: Transaction fails mid-execution
**Cause**: Database connection issue or constraint violation
**Solution**: Script automatically rolls back - no data loss. Re-run the script.

### Issue: Verification fails (NULL IDs still exist)
**Cause**: Extremely rare - possible database inconsistency
**Solution**:
1. Check backup file was created
2. Review error messages
3. Contact support with error details

## Post-Recovery

After successful recovery:

1. **Verify NULL IDs**: Run a quick check
   ```bash
   # Should return 0
   npm run verify:schema
   ```

2. **Test Application**: Ensure memories are accessible
   ```bash
   npm run test
   ```

3. **Archive Backup**: Move backup file to safe location
   ```bash
   mkdir -p backups/archive
   mv backups/null-id-records-*.json backups/archive/
   ```

4. **Monitor**: Watch for any issues with memory operations

## Prevention

To prevent NULL IDs in the future:

1. **Use Migration Scripts**: Always use provided migration tools
2. **Validate Before Insert**: Ensure IDs are generated before database insert
3. **Schema Constraints**: Keep UNIQUE constraint on id column
4. **Regular Checks**: Periodically verify no NULL IDs exist

## Support

If you encounter issues:

1. Check this guide thoroughly
2. Review the backup file to ensure data is safe
3. Check database logs for specific errors
4. Contact support with:
   - Error messages
   - Backup file location
   - Number of records affected

## Related Documentation

- [Database Schema Guide](../docs/schema/DATABASE_SCHEMA_ANALYSIS.md)
- [Migration Quick Start](../docs/guides/MIGRATION_QUICK_START.md)
- [Schema Optimization Guide](../docs/schema/SCHEMA_OPTIMIZATION_GUIDE.md)
