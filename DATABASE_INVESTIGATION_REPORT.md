# MCP Memory Database Investigation Report

**Date:** October 7, 2025
**Database:** `libsql://ai-memory-bobmatnyc.aws-us-east-1.turso.io`
**Target User:** `bob@matsuoka.com` (ID: `34183aef-dce1-4e2a-8b97-2dac8d0e1f75`)

## Executive Summary

The database investigation revealed several critical data integrity issues that need immediate attention:

1. **✅ User Found:** `bob@matsuoka.com` exists with 15 memories and 3,382 entities
2. **⚠️ Orphaned Records:** 21 memories with NULL user_id + 48 with invalid user_id
3. **⚠️ Duplicate Records:** 53 sets of duplicate memories (including bob@matsuoka.com)
4. **⚠️ Schema Issues:** Some memories have NULL IDs despite being in the database
5. **⚠️ Test Data Pollution:** Significant amount of test data in production database

---

## 1. Database Overview

### Users Statistics
- **Total Users:** 11
- **Active Users:** 11
- **User with Most Memories:** `test@example.com` (1,141 memories)
- **Target User Memories:** `bob@matsuoka.com` (15 memories)

### Data Distribution
| User Email | Total Memories | Active | Archived |
|------------|---------------|--------|----------|
| test@example.com | 1,141 | 1,141 | 0 |
| bob@matsuoka.com | 15 | 15 | 0 |
| Others (9 users) | 0 | 0 | 0 |

---

## 2. Critical Issues Found

### 2.1 Orphaned Memories (69 total)

#### NULL User ID (21 memories)
These memories have no user association at all:

```
Examples:
- ID: f61ca0ff-2898-41f5-8282-da43f141b94e | "Failover Test Memory"
- ID: 995ebc29-fa23-484f-ab42-2d6340e3d574 | "Core Principle" (EVA-related)
- ID: 3d4f3259-1b5d-41cd-b01a-f27edd7ade24 | "Recent Interaction"
```

**Impact:** These memories cannot be retrieved by any user and are inaccessible via normal query paths.

#### Invalid User ID (48 memories)
These memories reference user_id = "system-internal" which doesn't exist in the users table:

```
Examples:
- ID: f7539908-13b4-4795-91ca-ffb8dda937bd | "Test Memory with Context Type"
- ID: 4ca8930c-9db5-4f79-8e66-9448cf3e7105 | Chat memory
- ID: 2ee8621c-4398-4684-a379-fdb7c1b25ac3 | "Test Memory"
```

**Impact:** Foreign key constraint should prevent this, indicating either:
1. Historical migration issues
2. Missing foreign key constraints
3. Test data from previous schema versions

### 2.2 Duplicate Memories (53 sets)

**bob@matsuoka.com has 4 duplicate sets:**

1. **Multi Word Search Test** (3 duplicates)
   - IDs: a2aa8750..., 32ef26d8..., 133bbf24...
   - All have same title and content

2. **Test Episodic Memory** (3 duplicates)
   - IDs: ce7dddd2..., a00bf0bb..., 3dc3a9aa...

3. **Test Semantic Memory** (3 duplicates)
   - IDs: f00c8ee1..., 11f58909..., 06231c10...

4. **Test Invalid Importance** (4 duplicates)
   - Testing importance validation

**Impact:**
- Duplicate memories waste storage
- Can confuse semantic search results
- Indicates missing duplicate prevention logic

### 2.3 NULL ID Issues

Some memories show `ID: null` in the output despite being in the database:

```
Memories with NULL IDs:
1. [semantic] Memory | ID: null | Created: 2025-10-08T04:36:02.395Z
   Content: EWTN (Eternal Word Television Network) Project...

2. [semantic] Memory | ID: null | Created: 2025-10-06T20:06:19.268Z
   Content: Test memory stored on October 6, 2025...
```

**Impact:** These records may have auto-generated integer IDs that aren't being properly converted to strings.

---

## 3. bob@matsuoka.com User Analysis

### User Profile
- **ID:** 34183aef-dce1-4e2a-8b97-2dac8d0e1f75
- **Email:** bob@matsuoka.com
- **Name:** Bob Matsuoka
- **Status:** Active
- **Created:** 2025-09-20T14:49:44.797Z

### Memory Distribution
- **Total Memories:** 15
- **Active:** 15
- **Archived:** 0

**Memory Types:**
- Semantic: 4 (including 2 with NULL IDs)
- Episodic: 6
- MEMORY: 3
- Fact: 1

### Entity Distribution
- **Total Entities:** 3,382 (!)
- **Entity Type:** All "person" type
- **Source:** Appears to be imported from contacts (macOS Contacts sync)

**Notable Issues:**
- Extremely high entity count suggests bulk import
- Many entities have minimal information (just names)
- Contact sync may have created duplicates

---

## 4. Schema Analysis

### Tables Structure

#### Users Table
```sql
Columns: id, email, name, organization, api_key_hash, oauth_provider,
         oauth_id, is_active, metadata, created_at, updated_at
```

#### Memories Table
```sql
Columns: id, user_id, title, content, memory_type, importance, tags,
         entity_ids, embedding, metadata, is_archived, created_at, updated_at
```

#### Entities Table
```sql
Columns: id, entity_type, name, description, tags, metadata, created_at,
         updated_at, active, person_type, first_name, last_name, company,
         title, contact_info, birthday, notes, macos_contact_id, project_info,
         client_id, team_member_ids, org_info, user_id
```

**Note:** Entities table has 23 columns (schema version mismatch with documentation?)

---

## 5. Recommended Actions

### Immediate Actions (Critical)

1. **Fix Orphaned Memories**
   ```sql
   -- Option 1: Delete NULL user_id memories (if they're test data)
   DELETE FROM memories WHERE user_id IS NULL;

   -- Option 2: Assign to a default user
   UPDATE memories SET user_id = 'bob-user-id' WHERE user_id IS NULL;
   ```

2. **Handle Invalid User IDs**
   ```sql
   -- Delete memories with invalid user_id
   DELETE FROM memories
   WHERE user_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM users WHERE users.id = memories.user_id);
   ```

3. **Fix NULL ID Issue**
   - Investigate why some memories show ID as null
   - Verify ID generation and conversion logic in `DatabaseOperations.createMemory()`

### Short-term Actions

4. **Remove Duplicate Memories**
   ```sql
   -- Keep only the oldest duplicate for each user/title/content combination
   DELETE FROM memories
   WHERE id NOT IN (
     SELECT MIN(id)
     FROM memories
     GROUP BY user_id, title, content
   );
   ```

5. **Add Foreign Key Constraints** (if missing)
   ```sql
   -- Ensure referential integrity
   CREATE INDEX IF NOT EXISTS idx_memories_user_id ON memories(user_id);
   -- Note: Turso/LibSQL foreign key enforcement may need verification
   ```

6. **Clean Test Data**
   ```sql
   -- Remove test user memories
   DELETE FROM memories WHERE user_id = '4f77b0a5-6b14-4b07-a04e-b0fe53ba10b5';
   DELETE FROM users WHERE email = 'test@example.com';
   ```

### Long-term Improvements

7. **Add Duplicate Prevention**
   - Implement unique constraint or check before insert
   - Add duplicate detection in `MemoryCore.storeMemory()`

8. **Improve Entity Management**
   - Add deduplication logic for contact imports
   - Implement merge strategy for similar entities
   - Add pagination for large entity lists

9. **Schema Validation**
   - Verify all foreign key constraints are active
   - Add NOT NULL constraints where appropriate
   - Implement data validation at application layer

10. **Monitoring & Alerts**
    - Add health check for orphaned records
    - Monitor duplicate creation rates
    - Alert on schema drift

---

## 6. Investigation Tools Created

Three new tools have been created in `/tools/` directory:

### 1. `investigate-memory-users.ts`
Comprehensive database investigation tool:
```bash
# Run full investigation
npx tsx tools/investigate-memory-users.ts

# Investigate specific user
npx tsx tools/investigate-memory-users.ts --user bob@matsuoka.com
```

**Features:**
- Lists all users and their memory counts
- Identifies orphaned memories (NULL and invalid user_id)
- Detects duplicate memories
- Shows detailed user information
- Provides database statistics

### 2. `query-db.ts`
Simple SQL query runner:
```bash
# Run custom queries
npx tsx tools/query-db.ts "SELECT * FROM users"
npx tsx tools/query-db.ts "SELECT * FROM memories WHERE user_id = ?" user-id

# Common queries
npx tsx tools/query-db.ts "SELECT user_id, COUNT(*) FROM memories GROUP BY user_id"
```

**Features:**
- Execute any SQL query
- Support for parameterized queries
- Formatted table output
- Error handling

### 3. Existing Tools
- `check-users.ts` - Check user table
- `debug-database.ts` - Debug database schema and data
- `check-schema.ts` - Verify schema structure

---

## 7. Database Connection Information

### Connection Details
```bash
# Environment Variables
TURSO_URL=libsql://ai-memory-bobmatnyc.aws-us-east-1.turso.io
TURSO_AUTH_TOKEN=<token-in-.env>

# Using TypeScript/Node
import { createClient } from '@libsql/client';

const db = createClient({
  url: process.env.TURSO_URL,
  authToken: process.env.TURSO_AUTH_TOKEN
});

# Using CLI tools
npx tsx tools/query-db.ts "YOUR_QUERY"
```

### Quick Queries

```bash
# List all users
npx tsx tools/query-db.ts "SELECT id, email, name FROM users"

# Count memories per user
npx tsx tools/query-db.ts "SELECT user_id, COUNT(*) as count FROM memories GROUP BY user_id"

# Find bob's memories
npx tsx tools/query-db.ts "SELECT id, title, memory_type FROM memories WHERE user_id = ?" 34183aef-dce1-4e2a-8b97-2dac8d0e1f75

# Check for orphaned memories
npx tsx tools/query-db.ts "SELECT COUNT(*) FROM memories WHERE user_id IS NULL"

# Find duplicates
npx tsx tools/query-db.ts "SELECT user_id, title, COUNT(*) FROM memories GROUP BY user_id, title, content HAVING COUNT(*) > 1"
```

---

## 8. Conclusion

The database investigation for `bob@matsuoka.com` revealed that:

**✅ Good News:**
- User exists and is properly configured
- 15 memories are associated with the user
- 3,382 entities (contacts) are linked to the user
- User isolation is working for this user

**⚠️ Issues Requiring Attention:**
- Orphaned memories (69 total) need cleanup
- Duplicate memories should be deduplicated
- NULL ID issue needs investigation
- Test data cleanup recommended
- Entity count is very high (may need deduplication)

**📊 Database Health:**
- Generally functional but has data quality issues
- Foreign key constraints may not be properly enforced
- Missing duplicate prevention logic
- Test data mixed with production data

**Next Steps:**
1. Use the SQL queries in Section 5 to clean up orphaned and duplicate data
2. Investigate NULL ID issue in recent memories
3. Implement duplicate prevention in application code
4. Add entity deduplication for contact imports
5. Separate test and production environments

---

## Appendix: Full Investigation Output

For complete investigation output, run:
```bash
npx tsx tools/investigate-memory-users.ts --user bob@matsuoka.com > investigation-full.log
```

---

**Report Generated:** October 7, 2025
**Tools Location:** `/Users/masa/Projects/managed/mcp-memory-ts/tools/`
**Database:** Turso/LibSQL (Production)
