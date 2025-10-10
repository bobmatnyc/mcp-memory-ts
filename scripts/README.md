# MCP Memory TypeScript - Scripts Directory

This directory contains database migration, maintenance, and utility scripts for the MCP Memory TypeScript project.

## NULL ID Recovery Scripts

### Quick Start

**1. Check for NULL IDs:**
```bash
npm run check-null-ids
```

**2. Run recovery (if needed):**
```bash
npm run recover-null-ids
```

**3. Verify success:**
```bash
npm run check-null-ids
# Expected: 0 NULL IDs
```

### Files

- **`advanced-null-id-recovery.ts`**: Advanced recovery script for NULL IDs using delete-and-reinsert strategy
- **`check-null-ids.ts`**: Quick checker to verify NULL ID status in database
- **`fix-null-ids.ts`**: Original NULL ID fix script (use `recover-null-ids` for remaining issues)
- **`NULL_ID_RECOVERY_GUIDE.md`**: Comprehensive user guide for NULL ID recovery
- **`NULL_ID_RECOVERY_SUMMARY.md`**: Technical implementation details and design decisions

## Schema Migration Scripts

### Usage

**Dry run (recommended first):**
```bash
npm run migrate:schema:dry-run
```

**Run migration:**
```bash
npm run migrate:schema
```

**Verify schema:**
```bash
npm run verify:schema
```

**View statistics:**
```bash
npm run migrate:schema:stats
```

**Rollback (if needed):**
```bash
npm run migrate:schema:rollback
```

### Files

- **`migrate-schema-optimization.ts`**: Main schema migration script with multi-phase optimization
- **`verify-schema-optimization.ts`**: Schema verification and health check tool
- **`test-migration-fixes.ts`**: Test suite for migration validation

## Google Integration Scripts

### Usage

**Dry run:**
```bash
npm run migrate:google:dry-run
```

**Execute migration:**
```bash
npm run migrate:google
```

### Files

- **`migrate-google-integrations.ts`**: Google Calendar and Contacts integration migration
- **`migrate-gmail-extraction-log.ts`**: Gmail extraction log table creation

## Other Utility Scripts

- **`backfill-embeddings.ts`**: Generate embeddings for records missing them
- **`migrate-create.ts`**: Create new migration files
- **`migrate.ts`**: General migration runner with up/down/status commands
- **`pre-deploy-test.ts`**: Pre-deployment regression test suite

## Common Tasks

### Database Health Check
```bash
npm run check-null-ids
npm run verify:schema
```

### Pre-Deployment
```bash
npm run pre-deploy
# Runs: build + test:regression
```

### Migration Workflow
```bash
# 1. Test migration
npm run migrate:schema:dry-run

# 2. Review plan and create backup
turso db shell <database-name> ".backup backup.db"

# 3. Execute migration
npm run migrate:schema

# 4. Verify
npm run verify:schema

# 5. Check for issues
npm run check-null-ids
```

## Script Categories

### Data Integrity
- `check-null-ids.ts` - NULL ID detection
- `fix-null-ids.ts` - Basic NULL ID fix
- `advanced-null-id-recovery.ts` - Advanced NULL ID recovery
- `backfill-embeddings.ts` - Embedding generation

### Schema Management
- `migrate-schema-optimization.ts` - Schema migrations
- `verify-schema-optimization.ts` - Schema verification
- `test-migration-fixes.ts` - Migration tests
- `migrate.ts` - General migration tool
- `migrate-create.ts` - Migration file generator

### Feature Migrations
- `migrate-google-integrations.ts` - Google sync features
- `migrate-gmail-extraction-log.ts` - Gmail integration

### Testing & Deployment
- `pre-deploy-test.ts` - Regression tests
- Test scripts in `tests/` directory

## Safety Guidelines

### Always Backup First
```bash
# Turso backup
turso db shell <database-name> ".backup backups/pre-migration-$(date +%Y%m%d).db"

# Or use built-in backup features in scripts
npm run migrate:schema:dry-run  # Shows backup recommendations
```

### Test Before Execute
1. Run dry-run mode when available
2. Review migration plan
3. Check for warnings
4. Verify backup exists
5. Execute migration
6. Verify results

### Recovery Options
- All migration scripts create automatic backups
- Rollback commands available where applicable
- Manual restore from backup as last resort

## Documentation

### Migration Guides
- `/docs/guides/MIGRATION_QUICK_START.md` - Quick migration guide
- `/docs/schema/SCHEMA_OPTIMIZATION_GUIDE.md` - Schema optimization details
- `/docs/schema/DATABASE_SCHEMA_ANALYSIS.md` - Schema analysis

### Feature Guides
- `/docs/guides/GOOGLE_SETUP_GUIDE.md` - Google integration setup
- `/docs/guides/GOOGLE_MIGRATION_GUIDE.md` - Google feature migration
- `NULL_ID_RECOVERY_GUIDE.md` - This directory, NULL ID recovery

### Testing
- `/docs/testing/VERIFICATION-CHECKLIST.md` - Pre-deployment checklist
- `/docs/testing/MIGRATION_TEST_REPORT.md` - Migration test results
- `/docs/testing/QA_TEST_REPORT.md` - QA test reports

## Need Help?

1. **Check documentation**: Review guides in `/docs/guides/`
2. **Run dry-run**: Test migrations before execution
3. **Verify environment**: `npm run verify:env`
4. **Check database**: `npm run check-null-ids`
5. **Review logs**: Check script output for specific errors

## Contributing

When adding new scripts:

1. Add to `package.json` scripts section
2. Include comprehensive error handling
3. Add backup/rollback capability where applicable
4. Create dry-run mode for destructive operations
5. Document in this README
6. Add to appropriate category above

## Version History

- **v1.6.0**: Added advanced NULL ID recovery scripts
- **v1.5.0**: Enhanced schema migration tools
- **v1.4.0**: Added Google integration migrations
- **v1.3.0**: Schema optimization migrations
- **v1.2.0**: Initial migration framework

---

Last updated: 2025-10-09
