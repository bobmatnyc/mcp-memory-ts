# 🚀 Entities Migration - Quick Reference Card

**Status**: ✅ MIGRATION COMPLETE
**Date**: October 16, 2025

---

## One-Line Summary
Fixed missing database columns and UUID generation bug that blocked 2,800+ Google Contacts from syncing.

---

## Quick Commands

### Run Migration
```bash
npm run migrate:entities
```

### Test Fix
```bash
npm run test:entity-creation
```

### Retry Google Sync
```bash
cd /Users/masa/Projects/mcp-memory-ts
mcp-memory google contacts-sync --user-email your@email.com --direction import
```

---

## What Changed

### Database
- ✅ Added 6 missing columns to `entities` table
- ✅ Schema version: 1 → 2

### Code
- ✅ Fixed `createEntity()` to generate UUID (was broken)
- ✅ Updated INSERT to include new columns

---

## Verification

### Check Migration Applied
```bash
# Should show version = 2
npx tsx -e "
import { createClient } from '@libsql/client';
import dotenv from 'dotenv';
dotenv.config();
const c = createClient({url:process.env.TURSO_URL,authToken:process.env.TURSO_AUTH_TOKEN});
const r = await c.execute('SELECT version FROM schema_version ORDER BY version DESC LIMIT 1');
console.log('Version:', r.rows[0].version);
c.close();
"
```

### Check Code Rebuilt
```bash
# Should show line with uuidv4
grep -n "const entityId = uuidv4" dist/database/operations.js
```

### Run Test
```bash
# Should show "All tests PASSED!"
npm run test:entity-creation
```

---

## Files to Review

1. **Migration Script**: `scripts/migrate-entities-schema.ts`
2. **Fixed Code**: `src/database/operations.ts` (lines 107-161)
3. **Full Report**: `ENTITIES_SCHEMA_FIX_REPORT.md`
4. **Summary**: `MIGRATION_COMPLETE_SUMMARY.md`

---

## Common Issues

| Problem | Solution |
|---------|----------|
| "no such column: importance" | Run `npm run migrate:entities` |
| Entities with NULL IDs | Run `npm run fix-null-ids:entities` |
| Still failing after migration | Rebuild: `npm run build` |
| Web server not picking up changes | Restart: `pm2 restart mcp-memory-web` |

---

## Rollback (If Needed)

```bash
# Revert code changes
git checkout HEAD~1 src/database/operations.ts src/database/schema.ts
npm run build

# Update schema version
npx tsx -e "
import { createClient } from '@libsql/client';
import dotenv from 'dotenv';
dotenv.config();
const c = createClient({url:process.env.TURSO_URL,authToken:process.env.TURSO_AUTH_TOKEN});
await c.execute('UPDATE schema_version SET version = 1 WHERE version = 2');
c.close();
"
```

**Note**: Columns cannot be removed from Turso/LibSQL, but they'll be ignored if you rollback the code.

---

## Success Criteria

- [ ] Migration ran successfully (`npm run migrate:entities`)
- [ ] Code rebuilt (`npm run build`)
- [ ] Tests pass (`npm run test:entity-creation`)
- [ ] Google Contacts sync works
- [ ] No NULL ID entities in production

---

**Need Help?** Check [MIGRATION_COMPLETE_SUMMARY.md](./MIGRATION_COMPLETE_SUMMARY.md) for full details.
