# Database Migration System

This directory contains the database migration system for MCP Memory TypeScript.

## Overview

The migration system provides:
- ✅ **Version Control**: Track schema changes over time
- ✅ **Rollback Support**: Revert changes if needed
- ✅ **Verification**: Validate migrations succeeded
- ✅ **Transaction Safety**: Each migration runs in a transaction
- ✅ **Dry-Run Mode**: Preview changes before applying
- ✅ **Checksum Integrity**: Detect if migrations were modified

## File Structure

```
src/database/migrations/
├── README.md                    # This file
├── migration-base.ts            # Base migration class and interfaces
├── index.ts                     # Migration runner and registry
├── 001_initial_schema.ts        # Migration: Initial schema (v1.3.0)
├── 002_add_missing_indices.ts   # Migration: Performance indices
└── [future migrations]          # Add new migrations here
```

## Quick Start

### Check Migration Status
```bash
npm run migrate:status
```

### Apply All Pending Migrations
```bash
# Preview changes first
npm run migrate:up -- --dry-run

# Apply migrations
npm run migrate:up
```

### Rollback Last Migration
```bash
npm run migrate:down
```

### Verify All Migrations
```bash
npm run migrate:verify
```

## Creating New Migrations

### 1. Generate Migration File
```bash
npm run migrate:create add_user_preferences
```

This creates:
- `src/database/migrations/003_add_user_preferences.ts`
- Template with up(), down(), and verify() methods

### 2. Implement Migration

Edit the generated file:

```typescript
export class Migration003AddUserPreferences extends Migration {
  readonly version = 3;
  readonly name = '003_add_user_preferences';
  readonly description = 'Add user_preferences table';

  async up(db: DatabaseConnection): Promise<void> {
    await this.executeSql(
      db,
      `CREATE TABLE user_preferences (
        user_id TEXT PRIMARY KEY,
        theme TEXT DEFAULT 'light',
        language TEXT DEFAULT 'en',
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )`,
      '✓ Created user_preferences table'
    );
  }

  async down(db: DatabaseConnection): Promise<void> {
    await this.executeSql(
      db,
      'DROP TABLE IF EXISTS user_preferences',
      '✓ Dropped user_preferences table'
    );
  }

  async verify(db: DatabaseConnection): Promise<VerificationResult> {
    const exists = await this.tableExists(db, 'user_preferences');
    return {
      passed: exists,
      message: exists ? 'Table created successfully' : 'Table does not exist',
    };
  }
}
```

### 3. Register Migration

Add to `src/database/migrations/index.ts`:

```typescript
import { Migration003AddUserPreferences } from './003_add_user_preferences.js';

const MIGRATIONS: Migration[] = [
  new Migration001InitialSchema(),
  new Migration002AddMissingIndices(),
  new Migration003AddUserPreferences(), // ← Add here
];
```

### 4. Test and Apply

```bash
# Test with dry-run
npm run migrate:up -- --dry-run

# Apply migration
npm run migrate:up

# Verify it worked
npm run migrate:verify
```

## CLI Commands

### Status
```bash
npm run migrate:status
# Shows: current version, applied migrations, pending migrations
```

### Apply Migrations
```bash
# Apply all pending migrations
npm run migrate:up

# Preview without applying
npm run migrate:up -- --dry-run
```

### Rollback Migrations
```bash
# Rollback last migration
npm run migrate:down

# Rollback last 3 migrations
npm run migrate:down 3
```

### Migrate to Specific Version
```bash
# Migrate to version 5 (up or down as needed)
npm run migrate:to 5

# Preview changes
npm run migrate:to 5 -- --dry-run
```

### Verify Migrations
```bash
# Verify all applied migrations
npm run migrate:verify
```

### Create New Migration
```bash
npm run migrate:create migration_name
```

## Migration Best Practices

### 1. Always Test First
```bash
# Always dry-run before applying
npm run migrate:up -- --dry-run
```

### 2. Implement Rollback
Every migration MUST implement `down()` for rollback:
```typescript
async down(db: DatabaseConnection): Promise<void> {
  // Undo everything from up()
}
```

### 3. Add Verification
Verify migration succeeded in `verify()`:
```typescript
async verify(db: DatabaseConnection): Promise<VerificationResult> {
  const exists = await this.tableExists(db, 'new_table');
  return {
    passed: exists,
    message: exists ? 'Success' : 'Failed',
  };
}
```

### 4. Use Helper Methods
The base class provides useful helpers:
- `await this.tableExists(db, 'table_name')`
- `await this.indexExists(db, 'idx_name')`
- `await this.columnExists(db, 'table_name', 'column_name')`
- `await this.getRowCount(db, 'table_name')`
- `await this.executeSql(db, sql, description)`

### 5. Keep Migrations Small
- One logical change per migration
- Easier to rollback if needed
- Clearer history

### 6. Never Modify Applied Migrations
- Applied migrations are immutable
- Create new migration to fix issues
- Checksum detects modifications

### 7. Backup Before Major Changes
```bash
# Turso backup
turso db shell <database-name> ".backup backup.db"
```

## Migration Tracking

Migrations are tracked in the `schema_migrations` table:

```sql
CREATE TABLE schema_migrations (
  version INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  applied_at TEXT NOT NULL,
  applied_by TEXT,
  duration_ms INTEGER,
  checksum TEXT,
  status TEXT NOT NULL  -- 'applied', 'rolled_back', 'failed'
);
```

## Error Handling

### Migration Failed
If a migration fails:
1. The transaction is rolled back automatically
2. No changes are applied to the database
3. The failure is recorded in `schema_migrations`
4. Check error message for details

### Fix Failed Migration
```bash
# 1. Fix the issue in migration file
# 2. Try again
npm run migrate:up
```

### Rollback if Needed
```bash
# Rollback failed migration
npm run migrate:down

# Fix and reapply
npm run migrate:up
```

## Common Migration Patterns

### Add Table
```typescript
async up(db: DatabaseConnection): Promise<void> {
  await this.executeSql(
    db,
    `CREATE TABLE new_table (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      data TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`
  );
}
```

### Add Column
```typescript
async up(db: DatabaseConnection): Promise<void> {
  await this.executeSql(
    db,
    'ALTER TABLE users ADD COLUMN preferences TEXT'
  );
}
```

### Add Index
```typescript
async up(db: DatabaseConnection): Promise<void> {
  await this.executeSql(
    db,
    'CREATE INDEX idx_users_created ON users(created_at DESC)'
  );
}
```

### Add Multiple Changes
```typescript
async up(db: DatabaseConnection): Promise<void> {
  const statements = [
    'ALTER TABLE users ADD COLUMN theme TEXT',
    'CREATE INDEX idx_users_theme ON users(theme)',
    'UPDATE users SET theme = "light" WHERE theme IS NULL',
  ];

  await this.executeSql(db, statements);
}
```

## Testing Migrations

### Local Testing
```bash
# 1. Use test database
export TURSO_URL="libsql://test-db.turso.io"
export TURSO_AUTH_TOKEN="test-token"

# 2. Apply migration
npm run migrate:up

# 3. Verify
npm run migrate:verify

# 4. Test rollback
npm run migrate:down
npm run migrate:verify
```

### Integration Tests
Add migration tests to `tests/integration/`:
```typescript
describe('Migration 003', () => {
  it('should create user_preferences table', async () => {
    // Test migration
  });

  it('should rollback correctly', async () => {
    // Test rollback
  });
});
```

## Production Deployment

### Pre-Deployment Checklist
- [ ] All migrations tested locally
- [ ] Dry-run executed successfully
- [ ] Rollback tested
- [ ] Verification tests pass
- [ ] Database backup created
- [ ] Downtime requirements reviewed

### Deployment Process
```bash
# 1. Backup production database
turso db shell prod-db ".backup prod-backup-$(date +%Y%m%d).db"

# 2. Check current status
npm run migrate:status

# 3. Dry-run migrations
npm run migrate:up -- --dry-run

# 4. Apply migrations
npm run migrate:up

# 5. Verify success
npm run migrate:verify

# 6. Monitor application
# Check logs, test functionality
```

### Rollback in Production
```bash
# If issues detected
npm run migrate:down

# Or restore from backup
turso db shell prod-db ".restore prod-backup-YYYYMMDD.db"
```

## Troubleshooting

### "Migration already applied"
Check status:
```bash
npm run migrate:status
```

### "Migration failed"
1. Check error message
2. Fix issue in migration file
3. Try again: `npm run migrate:up`

### "Verification failed"
1. Run verify: `npm run migrate:verify`
2. Check specific failure message
3. Fix and reapply

### Reset Migration State (DANGER)
```bash
# Delete migration records (for development only)
# This does NOT undo schema changes!
DELETE FROM schema_migrations WHERE version = X;
```

## Support

For issues or questions:
1. Check this README
2. Review migration code in `src/database/migrations/`
3. Check project CLAUDE.md for project-specific guidance
4. Review logs with `MCP_DEBUG=1`

---

**Last Updated**: 2025-10-06
**Version**: 2 (with performance indices)
