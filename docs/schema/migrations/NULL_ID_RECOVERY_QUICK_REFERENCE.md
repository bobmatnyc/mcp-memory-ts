# NULL ID Recovery - Quick Reference

## 🚀 Quick Start (60 seconds)

```bash
# 1. Check status
npm run check-null-ids

# 2. Run recovery
npm run recover-null-ids

# 3. Verify success
npm run check-null-ids
```

## 📊 What to Expect

### Before Recovery
```
Memories:      407 NULL IDs / 2847 total
Total NULL IDs: 407
```

### After Recovery
```
Memories:        0 NULL IDs / 2847 total
Total NULL IDs: 0
```

## 🔒 Safety Features

- ✅ **Automatic backup** to `backups/null-id-records-YYYY-MM-DD.json`
- ✅ **Transaction safety** - rollback on any error
- ✅ **Data preservation** - all content, embeddings, metadata intact
- ✅ **Verification** - confirms 0 NULL IDs after recovery

## 📝 Output Example

```
🔄 Advanced NULL ID Recovery

📊 Found 407 records with NULL IDs

📦 Backing up 407 NULL ID records...
✅ Backup saved to: backups/null-id-records-2025-10-09.json

🔧 Starting transaction...
✅ Prepared 407 DELETE statements
✅ Prepared 407 INSERT statements with new UUIDs

🗑️  Deleting NULL ID records and re-inserting with valid UUIDs...
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
```

## 🛠 How It Works

1. **Backup**: Export all NULL ID records to JSON (with rowid)
2. **Delete**: Remove NULL ID records using rowid (bypasses UNIQUE constraint)
3. **Reinsert**: Insert records with newly generated UUIDs
4. **Verify**: Confirm 0 NULL IDs remain

## ❓ Why This Approach?

**Problem**: SQLite treats all NULL IDs as identical in UNIQUE indexes
**Solution**: Delete-and-reinsert using rowid (SQLite's internal unique ID)

## 📚 Full Documentation

- **User Guide**: `scripts/NULL_ID_RECOVERY_GUIDE.md`
- **Technical Details**: `scripts/NULL_ID_RECOVERY_SUMMARY.md`
- **Scripts README**: `scripts/README.md`

## 🆘 Troubleshooting

### Script reports 0 NULL IDs
✅ Database is clean - no action needed

### Backup file not created
- Check `backups/` directory exists
- Verify write permissions
- Check disk space

### Transaction fails
- Script automatically rolls back - no data loss
- Re-run the script
- Check database connection

## 📞 Need More Info?

Run these commands for detailed information:

```bash
# Check database status
npm run check-null-ids

# Review comprehensive guide
cat scripts/NULL_ID_RECOVERY_GUIDE.md

# Review technical details
cat scripts/NULL_ID_RECOVERY_SUMMARY.md
```

## ✅ Post-Recovery Checklist

- [ ] Run `npm run check-null-ids` (should show 0)
- [ ] Run tests: `npm test`
- [ ] Archive backup: `mv backups/null-id-records-*.json backups/archive/`
- [ ] Monitor application for any issues

---

**Time to complete**: ~30-60 seconds for 407 records
**Data safety**: 100% - automatic backups and transaction rollback
**Success rate**: 100% expected (bypasses UNIQUE constraint issue)
