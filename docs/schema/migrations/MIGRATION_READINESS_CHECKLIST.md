# Migration Readiness Checklist

## Pre-Migration Verification

### ✅ Files Created/Modified
- [x] `scripts/migrate-entities-legacy-columns.ts` - Migration script
- [x] `scripts/check-contact-info-migration.ts` - Data analysis helper
- [x] `src/database/schema.ts` - Schema definition updated
- [x] `src/database/operations.ts` - Create operations updated
- [x] `src/database/compatibility.ts` - Read/write mapping enhanced
- [x] `package.json` - Migration scripts added
- [x] `LEGACY_COLUMNS_MIGRATION_SUMMARY.md` - Complete documentation
- [x] `MIGRATION_READINESS_CHECKLIST.md` - This checklist

### ✅ Code Quality Checks
- [x] TypeScript compilation: `npm run type-check` ✅ PASSED
- [x] Project build: `npm run build` ✅ PASSED
- [x] Dry-run test: `npm run migrate:legacy-columns:dry-run` ✅ PASSED

### ✅ Current Database State
```
Total entities: 2,403
Entities with contact_info: 2,326
  - With email: 1,603
  - With phone: 760
  - With address: 106
```

### ✅ Migration Plan Verified
```
Step 1: Add missing columns
  1. ALTER TABLE entities ADD COLUMN email TEXT
  2. ALTER TABLE entities ADD COLUMN phone TEXT
  3. ALTER TABLE entities ADD COLUMN address TEXT

Step 2: Migrate data from contact_info JSON to individual columns
  - Extract email from contact_info where present
  - Extract phone from contact_info where present
  - Extract address from contact_info where present

Step 3: Create composite index for contact searches
  - CREATE INDEX idx_entities_contact ON entities(email, phone)
```

## Migration Execution Steps

### Step 1: Final Pre-Migration Checks
```bash
# 1. Verify current state
npx tsx scripts/check-contact-info-migration.ts

# 2. Run dry-run one more time
npm run migrate:legacy-columns:dry-run

# 3. Ensure no active Google sync operations
# (Check for running processes)
```

### Step 2: Execute Migration
```bash
# Run the migration
npm run migrate:legacy-columns
```

**Expected Output:**
```
🔧 Entities Table - Legacy Columns Migration
════════════════════════════════════════════
Mode: ✍️  LIVE EXECUTION

📊 Checking current table structure...
Found 3 missing column(s):
  ❌ email
  ❌ phone
  ❌ address

🚀 Executing migrations...
Step 1: Adding missing columns
✅ Added column: email
✅ Added column: phone
✅ Added column: address

Step 2: Migrating data from contact_info JSON
✅ Migrated 1603 email values from contact_info
✅ Migrated 760 phone values from contact_info
✅ Migrated 106 address values from contact_info
✅ Total: Migrated 2469 field values from contact_info to legacy columns

Step 3: Creating indexes for performance
✅ Created/verified idx_entities_contact (email, phone)

🔍 Verifying migration...
✅ All columns verified successfully!
✅ Data migration verified successfully!
📊 Final column list: [... includes email, phone, address ...]
✨ Migration completed successfully!
```

### Step 3: Post-Migration Verification
```bash
# 1. Check data migration success
npx tsx scripts/check-contact-info-migration.ts

# 2. Verify schema structure
npx tsx -e "
import { createClient } from '@libsql/client';
import * as dotenv from 'dotenv';
dotenv.config();
const client = createClient({
  url: process.env.TURSO_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});
const result = await client.execute('PRAGMA table_info(entities)');
console.log('Columns:', result.rows.map(r => r.name).join(', '));
console.log('Has email:', result.rows.some(r => r.name === 'email'));
console.log('Has phone:', result.rows.some(r => r.name === 'phone'));
console.log('Has address:', result.rows.some(r => r.name === 'address'));
client.close();
"

# 3. Test Google Contacts sync
npm run cli google contacts-sync --user-email user@example.com --direction import

# 4. Verify entity creation still works
npm run test:entity-creation
```

## Success Criteria

### ✅ Migration Success Indicators
- [ ] All 3 columns added to entities table
- [ ] Data migrated from contact_info JSON
- [ ] Index created on (email, phone)
- [ ] No SQL errors during migration
- [ ] Verification step passes
- [ ] Google sync works without "no such column" errors

### ✅ Data Integrity Checks
- [ ] Total entity count unchanged (2,403)
- [ ] All entities with contact_info still have data
- [ ] No NULL values where data existed in JSON
- [ ] contact_info JSON still intact (backward compatibility)

### ✅ Functional Tests
- [ ] Google Contacts sync completes successfully
- [ ] Entity creation with email/phone/address works
- [ ] Entity queries by email/phone work
- [ ] Existing entities readable
- [ ] No TypeScript/runtime errors

## Rollback Plan (If Needed)

### Option 1: Code Rollback (Recommended)
```bash
# Revert code changes
git checkout HEAD^ -- src/database/schema.ts
git checkout HEAD^ -- src/database/operations.ts
git checkout HEAD^ -- src/database/compatibility.ts

# Rebuild
npm run build

# Restart services
pm2 restart all
```

### Option 2: Database Column Removal (Emergency Only)
```sql
-- WARNING: Only use if critical issue occurs
-- Data is preserved in contact_info JSON

-- SQLite doesn't support DROP COLUMN directly
-- Would require table recreation (complex)
-- Better to fix code issues instead
```

### Option 3: Database Restore (Last Resort)
```bash
# Contact Turso support to restore from backup
# Turso provides automatic backups
```

## Post-Migration Tasks

### Immediate (Day 1)
- [ ] Monitor error logs for any "no such column" errors
- [ ] Test Google Contacts sync multiple times
- [ ] Verify entity creation/update works
- [ ] Check database query performance

### Short-term (Week 1)
- [ ] Monitor Google sync success rate
- [ ] Collect performance metrics on contact queries
- [ ] Verify all integrations still work
- [ ] Update related documentation

### Long-term (Month 1)
- [ ] Evaluate query performance improvements
- [ ] Consider additional indexes if needed
- [ ] Plan for deprecating contact_info JSON (optional)
- [ ] Document lessons learned

## Known Issues & Mitigations

### Issue: Migration Takes Too Long
**Mitigation**:
- Migration processes 2,403 entities in batches
- Should complete in 2-5 minutes
- If timeout occurs, script can be re-run (idempotent)

### Issue: Partial Migration
**Mitigation**:
- Script is idempotent - safe to re-run
- Verification step detects incomplete migrations
- Data preserved in contact_info JSON

### Issue: Index Creation Fails
**Mitigation**:
- Index creation is non-critical
- Main columns still functional without index
- Can create index manually later:
  ```sql
  CREATE INDEX idx_entities_contact ON entities(email, phone);
  ```

## Support & Documentation

### Documentation
- [LEGACY_COLUMNS_MIGRATION_SUMMARY.md](./LEGACY_COLUMNS_MIGRATION_SUMMARY.md) - Complete migration guide
- [MIGRATION_READINESS_CHECKLIST.md](./MIGRATION_READINESS_CHECKLIST.md) - This checklist

### Commands Reference
```bash
# Analysis
npm run check-contact-info-migration
npm run migrate:legacy-columns:dry-run

# Execution
npm run migrate:legacy-columns

# Verification
npm run test:entity-creation
npm run cli google contacts-sync --user-email user@example.com

# Schema inspection
PRAGMA table_info(entities);
```

### Getting Help
1. Review migration logs
2. Check Turso database status
3. Verify environment variables
4. Review error messages carefully
5. File GitHub issue with logs if needed

---

## Final Sign-Off

**Migration Script**: ✅ Ready
**Documentation**: ✅ Complete
**Testing**: ✅ Verified
**Rollback Plan**: ✅ Documented
**Risk Assessment**: ✅ Low (backward compatible)

**Recommended Action**: ✅ **SAFE TO EXECUTE**

**Next Step**: Run `npm run migrate:legacy-columns`

---

**Prepared by**: Claude Code Engineer
**Date**: 2025-10-16
**Version**: 1.7.3-migration
