# Investigation Report: Missing `importance` Column in Entities Table

**Date**: October 16, 2025
**Issue**: Google Contacts sync failing with "no such column: importance" error (2800+ contacts affected)
**Status**: 🔴 **CRITICAL - Schema Mismatch**

---

## Executive Summary

The production database schema for the `entities` table is **missing the `importance` column**, while the application code expects it to exist. This is causing all entity creation operations (including Google Contacts sync) to fail.

**Root Cause**: Schema drift between code definition and deployed database
**Impact**: 2,800+ Google contacts failed to sync
**Fix Required**: Database migration to add missing column

---

## Findings

### 1. Schema Definition vs. Actual Database

#### What the Code Expects (src/database/schema.ts, line 43):
```sql
CREATE TABLE IF NOT EXISTS entities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT,
  name TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  person_type TEXT,
  description TEXT,
  company TEXT,
  title TEXT,
  contact_info TEXT,
  website TEXT,
  social_media TEXT,
  notes TEXT,
  importance INTEGER DEFAULT 2,  -- ✅ DEFINED IN CODE
  tags TEXT,
  relationships TEXT,
  last_interaction TEXT,
  interaction_count INTEGER DEFAULT 0,
  metadata TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
)
```

#### What Actually Exists in Production Database:
```
Columns: id, entity_type, name, description, tags, metadata,
         created_at, updated_at, active, person_type, first_name,
         last_name, company, title, contact_info, birthday, notes,
         macos_contact_id, project_info, client_id, team_member_ids,
         org_info, user_id
```

**Missing**: `importance`, `website`, `social_media`, `relationships`, `last_interaction`, `interaction_count`
**Extra**: `active`, `first_name`, `last_name`, `birthday`, `macos_contact_id`, `project_info`, `client_id`, `team_member_ids`, `org_info`

### 2. Schema Version Status

**Current Schema Version**: 1 (applied September 27, 2025)
**Schema Version in Code**: 1 (SCHEMA_VERSION constant)

The schema version number matches, but the actual table structure differs significantly.

### 3. Comparison: Memories vs. Entities Table

| Feature | Memories Table | Entities Table |
|---------|---------------|---------------|
| Has `importance` column | ✅ YES | ❌ NO |
| Expected in code | ✅ YES | ✅ YES |
| Schema version | 1 | 1 |

**Key Finding**: The `memories` table has the `importance` column and works correctly, while the `entities` table is missing it.

---

## Code References Using `importance`

### 1. Type Definition (src/types/base.ts, line 63):
```typescript
export interface Entity extends BaseEntity {
  // ... other fields
  importance: ImportanceLevel;  // Required field in TypeScript
  // ...
}
```

### 2. Entity Creation (src/database/operations.ts, line 114):
```typescript
async createEntity(entity: Omit<Entity, 'id'>): Promise<Entity> {
  const sql = `
    INSERT INTO entities (user_id, name, entity_type, person_type, description,
                         company, title, contact_info, notes, tags, metadata,
                         created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  // ⚠️ NOTE: SQL does NOT include importance column!
}
```

### 3. Model Factory (src/models/index.ts, line 35):
```typescript
export function createEntity(data: Partial<Entity>): Omit<Entity, 'id'> {
  return {
    // ...
    importance: data.importance || ImportanceLevel.MEDIUM,  // ✅ Always sets importance
    // ...
  };
}
```

### 4. Google Contacts Sync (src/services/google-contacts-sync.ts):
```typescript
const entityData = vcardToEntity(googleEntity, user.id);
const entity = createEntity(entityData);  // Sets importance
await this.db.createEntity(entity);  // ❌ FAILS: no such column
```

---

## Why This Happened

### Schema Evolution Timeline

1. **Initial Schema** (before September 27, 2025): Created with different structure
2. **Code Updated**: Added `importance` field to Entity interface and schema definition
3. **Schema Version**: Set to 1 in both code and database
4. **Migration Gap**: No migration script created to add `importance` to existing tables
5. **Result**: Code expects column that doesn't exist in production

### Schema Initialization Behavior

From `src/database/schema.ts` (line 203-213):
```typescript
export async function initializeSchema(db: DatabaseConnection): Promise<void> {
  const currentVersion = await getCurrentSchemaVersion(db);

  if (currentVersion >= SCHEMA_VERSION) {
    console.error(`Schema is up to date (version ${currentVersion})`);
    return;  // ❌ EXITS EARLY - doesn't verify actual structure
  }
  // ... create tables
}
```

**Problem**: The schema initialization only checks the version number, not the actual table structure. Since both are version 1, it assumes the schema is correct.

---

## Impact Analysis

### Affected Operations

1. **Google Contacts Sync** 🔴 CRITICAL
   - 2,800+ contacts failed to import
   - Error: "no such column: importance"
   - Completely blocking feature

2. **Entity Creation via MCP** 🟡 POTENTIAL
   - May fail when importance is explicitly set
   - Falls back to default in some code paths

3. **Entity Updates** 🟡 POTENTIAL
   - Updating importance field will fail
   - Other updates may succeed

4. **Web Interface** 🟡 POTENTIAL
   - Entity creation through web UI may fail
   - Depends on whether importance is included in requests

### Data Quality Impact

- **No data loss**: Existing entities are intact
- **Missing metadata**: No importance information for any entities
- **Search impact**: Importance-based sorting/filtering won't work
- **User experience**: Cannot prioritize important contacts

---

## Solution: Database Migration

### Required Changes

#### Step 1: Add Missing Columns to Entities Table
```sql
-- Add importance column (matches memories table)
ALTER TABLE entities
ADD COLUMN importance INTEGER DEFAULT 2;

-- Add other missing columns from schema definition
ALTER TABLE entities
ADD COLUMN website TEXT;

ALTER TABLE entities
ADD COLUMN social_media TEXT;

ALTER TABLE entities
ADD COLUMN relationships TEXT;

ALTER TABLE entities
ADD COLUMN last_interaction TEXT;

ALTER TABLE entities
ADD COLUMN interaction_count INTEGER DEFAULT 0;
```

#### Step 2: Create Index for Importance
```sql
-- Already defined in schema.ts but might not exist
CREATE INDEX IF NOT EXISTS idx_entities_user_importance
ON entities(user_id, importance DESC);
```

#### Step 3: Update Schema Version
```sql
-- Increment schema version to track this migration
INSERT OR REPLACE INTO schema_version (version, applied_at)
VALUES (2, datetime('now'));
```

### Implementation Plan

1. **Create Migration Script**: `scripts/migrate-add-entity-importance.ts`
2. **Add Dry-Run Mode**: Preview changes before applying
3. **Backup Strategy**: Recommend backup before migration
4. **Verification Script**: Confirm columns exist after migration
5. **Update SCHEMA_VERSION**: Change to 2 in `src/database/schema.ts`

---

## Additional Findings

### Other Schema Mismatches

The production database has columns NOT in the code schema:
- `active` (boolean)
- `first_name` (text)
- `last_name` (text)
- `birthday` (date)
- `macos_contact_id` (text)
- `project_info` (text)
- `client_id` (text)
- `team_member_ids` (text)
- `org_info` (text)

**Recommendation**: These columns should either be:
1. Added to the schema definition in `src/database/schema.ts`
2. Documented as legacy/deprecated columns
3. Removed if no longer needed (with migration to preserve data)

### Code Issue: INSERT Statement Missing `importance`

In `src/database/operations.ts` (line 114), the `createEntity` method's INSERT statement does NOT include the `importance` column, even though it's in the schema definition and TypeScript interface.

**Current Code**:
```typescript
const sql = `
  INSERT INTO entities (user_id, name, entity_type, person_type, description,
                       company, title, contact_info, notes, tags, metadata,
                       created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`;
```

**Should Be**:
```typescript
const sql = `
  INSERT INTO entities (user_id, name, entity_type, person_type, description,
                       company, title, contact_info, notes, importance, tags,
                       metadata, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`;
// And add importance to the values array
```

---

## Recommended Actions

### Immediate (Required to Fix Google Sync)

1. ✅ Create migration script with dry-run capability
2. ✅ Test migration on development/staging database
3. ✅ Back up production database
4. ✅ Run migration to add `importance` column
5. ✅ Update `createEntity` INSERT statement to include importance
6. ✅ Verify Google Contacts sync works
7. ✅ Update schema version to 2

### Short-term (Within 1 week)

1. 🔵 Add other missing columns (website, social_media, etc.)
2. 🔵 Document or remove extra columns (active, first_name, etc.)
3. 🔵 Create comprehensive schema verification script
4. 🔵 Add schema validation to CI/CD pipeline
5. 🔵 Update documentation with complete current schema

### Long-term (Future Releases)

1. 🟢 Implement proper migration system (like Prisma, TypeORM, etc.)
2. 🟢 Add schema validation on startup
3. 🟢 Create schema comparison tool (code vs. database)
4. 🟢 Establish migration workflow documentation
5. 🟢 Add pre-deployment schema checks

---

## Migration Script Template

```typescript
/**
 * Migration: Add importance and related columns to entities table
 * Version: 1 → 2
 * Date: 2025-10-16
 */

import { createClient } from '@libsql/client';
import * as dotenv from 'dotenv';

dotenv.config();

async function migrate(dryRun = false) {
  const client = createClient({
    url: process.env.TURSO_URL || '',
    authToken: process.env.TURSO_AUTH_TOKEN || ''
  });

  console.log(`🔄 Migration: Add entity importance column`);
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'EXECUTE'}`);

  try {
    // Check current schema
    const columns = await client.execute('PRAGMA table_info(entities)');
    const hasImportance = columns.rows.some((r: any) => r.name === 'importance');

    if (hasImportance) {
      console.log('✅ importance column already exists');
      return;
    }

    if (dryRun) {
      console.log('\n📋 Would execute:');
      console.log('  ALTER TABLE entities ADD COLUMN importance INTEGER DEFAULT 2;');
      console.log('  ALTER TABLE entities ADD COLUMN website TEXT;');
      console.log('  ALTER TABLE entities ADD COLUMN social_media TEXT;');
      console.log('  ALTER TABLE entities ADD COLUMN relationships TEXT;');
      console.log('  ALTER TABLE entities ADD COLUMN last_interaction TEXT;');
      console.log('  ALTER TABLE entities ADD COLUMN interaction_count INTEGER DEFAULT 0;');
      console.log('  CREATE INDEX idx_entities_user_importance ON entities(user_id, importance DESC);');
      console.log('  UPDATE schema_version SET version = 2;');
      return;
    }

    // Execute migration
    await client.execute('ALTER TABLE entities ADD COLUMN importance INTEGER DEFAULT 2');
    await client.execute('ALTER TABLE entities ADD COLUMN website TEXT');
    await client.execute('ALTER TABLE entities ADD COLUMN social_media TEXT');
    await client.execute('ALTER TABLE entities ADD COLUMN relationships TEXT');
    await client.execute('ALTER TABLE entities ADD COLUMN last_interaction TEXT');
    await client.execute('ALTER TABLE entities ADD COLUMN interaction_count INTEGER DEFAULT 0');
    await client.execute('CREATE INDEX IF NOT EXISTS idx_entities_user_importance ON entities(user_id, importance DESC)');
    await client.execute('INSERT OR REPLACE INTO schema_version (version, applied_at) VALUES (2, datetime("now"))');

    console.log('✅ Migration completed successfully');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

// Run with: npm run migrate:add-importance -- --dry-run
migrate(process.argv.includes('--dry-run'));
```

---

## Files Analyzed

- ✅ `src/database/schema.ts` - Schema definition (SCHEMA_VERSION = 1)
- ✅ `src/database/operations.ts` - Entity CRUD operations
- ✅ `src/types/base.ts` - Entity type definition
- ✅ `src/models/index.ts` - Entity factory function
- ✅ `src/services/google-contacts-sync.ts` - Sync implementation
- ✅ Production database schema via PRAGMA table_info

---

## Conclusion

The `importance` column is **defined in the code schema** but **missing from the production database**. This is a clear case of schema drift that requires a database migration to resolve.

The fix is straightforward:
1. Add the missing column via ALTER TABLE
2. Update the INSERT statement to include it
3. Increment schema version to track the change

**Priority**: 🔴 **CRITICAL** - This is blocking Google Contacts sync for 2,800+ contacts.

---

## JSON Memory Update

```json
{
  "remember": [
    "CRITICAL: Entities table missing importance column causing Google sync failures",
    "Schema drift: Code defines columns that don't exist in production database",
    "Need migration script to add importance, website, social_media, relationships, last_interaction, interaction_count",
    "src/database/operations.ts createEntity() INSERT statement also needs updating to include importance",
    "Schema version is 1 in both code and DB but structures differ - version check insufficient",
    "Memories table has importance column and works correctly - only entities table affected",
    "Must update SCHEMA_VERSION to 2 after migration",
    "Production DB has extra columns not in code: active, first_name, last_name, birthday, macos_contact_id, project_info, client_id, team_member_ids, org_info"
  ]
}
```
