# Database Schema Migrations Index

This directory contains all documentation related to database schema migrations, data migrations, and schema fixes.

## Overview

The MCP Memory project uses LibSQL/Turso as its database backend. This directory tracks all schema changes, migration procedures, and data integrity fixes.

## Migration Documentation

### Schema Migrations
- [LEGACY_COLUMNS_MIGRATION_SUMMARY.md](./LEGACY_COLUMNS_MIGRATION_SUMMARY.md) - Legacy columns cleanup migration
- [ENTITIES_SCHEMA_FIX_REPORT.md](./ENTITIES_SCHEMA_FIX_REPORT.md) - Entity schema fix report
- [MIGRATION_COMPLETE_SUMMARY.md](./MIGRATION_COMPLETE_SUMMARY.md) - Migration completion summary

### User ID Migrations
- [USER_ID_MIGRATION_REPORT.md](./USER_ID_MIGRATION_REPORT.md) - User ID format migration report
- See also: [CLERK_USER_ID_MIGRATION_REPORT.md](../../security/CLERK_USER_ID_MIGRATION_REPORT.md) - Clerk user ID migration

### NULL ID Recovery
- [NULL_ID_RECOVERY_QUICK_REFERENCE.md](./NULL_ID_RECOVERY_QUICK_REFERENCE.md) - Quick reference for fixing NULL IDs

## Migration Guides

### Quick References
- [MIGRATION_QUICK_REFERENCE.md](./MIGRATION_QUICK_REFERENCE.md) - Quick reference for common migrations
- [MIGRATION_READINESS_CHECKLIST.md](./MIGRATION_READINESS_CHECKLIST.md) - Pre-migration checklist

### Comprehensive Guides
- [SCHEMA_OPTIMIZATION_GUIDE.md](../SCHEMA_OPTIMIZATION_GUIDE.md) - Schema optimization strategies
- [DATABASE_SCHEMA_ANALYSIS.md](../DATABASE_SCHEMA_ANALYSIS.md) - Schema analysis and design

## Running Migrations

### Schema Migration Commands

```bash
# Test migration with dry run (ALWAYS run this first)
npm run migrate:schema:dry-run

# Execute migration (creates automatic backups)
npm run migrate:schema

# Verify schema after migration
npm run verify:schema

# Check migration statistics
npm run migrate:schema:stats

# Rollback to backup if needed
npm run migrate:schema:rollback
```

### NULL ID Fix

LibSQL/Turso has a quirk where some records may have NULL IDs. Use this workflow to fix:

```bash
# Preview changes without applying
npm run fix-null-ids -- --dry-run

# Execute the fix (assigns UUIDs to NULL IDs)
npm run fix-null-ids

# Verification is automatic
```

## Migration Scripts Location

Database migration scripts are located in `/scripts/`:

### Schema Migrations
- `migrate-schema-optimization.ts` - Main schema migration tool
- `verify-schema-optimization.ts` - Schema verification
- `migrate-entities-schema.ts` - Entity schema migration
- `migrate-entities-legacy-columns.ts` - Legacy column cleanup

### User ID Migrations
- `migrate-user-id.ts` - User ID format migration
- `migrate-user-id-safe.ts` - Safe user ID migration
- `migrate-user-id-format.ts` - User ID format normalization
- `rollback-user-id-migration.ts` - Rollback user ID changes

### NULL ID Fixes
- `fix-null-ids-entities.ts` - Fix NULL IDs in entities table
- `fix-null-ids-v2.ts` - Fix NULL IDs in memories table
- `check-null-ids-comprehensive.ts` - Comprehensive NULL ID check

### Verification & Analysis
- `verify-after-migration.ts` - Post-migration verification
- `verify-before-migration.ts` - Pre-migration verification
- `check-entity-schema.ts` - Entity schema verification
- `check-memories-schema.ts` - Memories schema verification
- `analyze-entities.ts` - Entity analysis
- `analyze-entities-v2.ts` - Enhanced entity analysis

## Schema Versions

### Current Schema (v1.3.0+)

**Memories Table**
```sql
CREATE TABLE memories (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  content TEXT NOT NULL,
  type TEXT NOT NULL,
  importance TEXT NOT NULL,
  embedding TEXT,
  metadata TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_memories_user_id ON memories(user_id);
CREATE INDEX idx_memories_type ON memories(type);
CREATE INDEX idx_memories_created_at ON memories(created_at);
```

**Entities Table**
```sql
CREATE TABLE entities (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  metadata TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_entities_user_id ON entities(user_id);
CREATE INDEX idx_entities_type ON entities(type);
CREATE INDEX idx_entities_name ON entities(name);
```

**Google OAuth Tokens Table**
```sql
CREATE TABLE google_oauth_tokens (
  user_email TEXT PRIMARY KEY,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_expiry INTEGER NOT NULL,
  scopes TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
```

## Migration Best Practices

### Pre-Migration
1. **Always run dry-run first**: `npm run migrate:schema:dry-run`
2. **Review migration plan**: Check what will be changed
3. **Backup verification**: Ensure backup recommendations are followed
4. **Test on staging**: Never run migrations directly on production

### During Migration
1. **Monitor progress**: Watch for errors or warnings
2. **Check logs**: Review migration logs for issues
3. **Verify at checkpoints**: Ensure each step completes successfully

### Post-Migration
1. **Run verification**: `npm run verify:schema`
2. **Check data integrity**: Verify critical data is intact
3. **Test functionality**: Run full test suite
4. **Monitor performance**: Check query performance after schema changes

## Common Migration Issues

### NULL ID Issues
**Problem**: LibSQL/Turso sometimes creates records with NULL IDs

**Solution**:
```bash
# Fix with automated script
npm run fix-null-ids -- --dry-run  # Preview
npm run fix-null-ids               # Execute
```

### User ID Format Inconsistencies
**Problem**: Mixed user ID formats (user_xxx vs clerk_xxx)

**Solution**:
```bash
# Normalize user ID format
npm run migrate:user-id-safe
```

### Legacy Column Cleanup
**Problem**: Old unused columns causing bloat

**Solution**:
```bash
# Remove legacy columns
npm run migrate:schema  # Includes legacy column cleanup
```

## Rollback Procedures

### Automatic Rollback
```bash
# Rollback to most recent backup
npm run migrate:schema:rollback
```

### Manual Rollback
1. Identify backup timestamp
2. Restore from Turso dashboard
3. Verify data integrity
4. Run verification scripts

## Testing Migrations

### Pre-Deployment Testing
```bash
# Full pre-deployment test suite
npm run pre-deploy

# Migration-specific tests
npm run test:migration
```

### Verification Scripts
```bash
# Comprehensive verification
npm run verify:schema
npm run verify:after-migration

# Specific checks
npm run check:entity-schema
npm run check:null-ids
```

## Migration History

### v1.7.0 (Oct 2025)
- Added Google OAuth tokens table
- Added Gmail extraction logs table
- Enhanced entity metadata schema

### v1.6.0 (Oct 2025)
- Optimized indexes for performance
- Added user isolation constraints
- Fixed NULL ID issues

### v1.5.0 (Oct 2025)
- User ID format normalization
- Legacy column cleanup
- Entity schema optimization

### v1.3.0 (Oct 2025)
- Major schema optimization
- Index improvements
- Contact info migration

## Related Documentation

- [Schema Optimization Guide](../SCHEMA_OPTIMIZATION_GUIDE.md)
- [Database Schema Analysis](../DATABASE_SCHEMA_ANALYSIS.md)
- [Testing Documentation](../../testing/INDEX.md)
- [Deployment Guide](../../deployment/INDEX.md)

## Emergency Contacts

For critical migration issues:
1. Check #development channel for known issues
2. Review recent migration reports in this directory
3. Contact database administrator
4. Refer to Turso support documentation

---

**Last Updated**: 2025-10-20
**Current Schema Version**: v1.7.0
**Database**: LibSQL/Turso
**Migration Tool**: Custom TypeScript scripts
