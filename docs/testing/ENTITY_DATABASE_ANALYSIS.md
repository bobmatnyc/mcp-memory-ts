# Entity Database Analysis Report

**Date**: 2025-10-14
**Context**: Post-memory cleanup analysis (875 → 159 memories)
**Database**: mcp-memory-ts production database

---

## Executive Summary

The entity database contains **3,657 entities** but has significant quality and association issues:

### Key Findings

1. **MCP Stats Showing "0 Entities" is CORRECT** ✅
   - The default user (`test@example.com`) has 0 entities assigned
   - All 3,657 entities belong to other users (primarily `bob@matsuoka.com`)
   - MCP tools correctly filter by user_id based on DEFAULT_USER_EMAIL

2. **Critical Security Issue** 🔴
   - 256 entities (7%) have NULL user_id
   - Multi-tenant security violation (v1.2.1 patches were for this!)
   - These entities are not accessible to any user

3. **Entity-Memory Dissociation** ⚠️
   - 0 entities are linked to any memories
   - 155 memories have entity_ids but pointing to non-existent entities
   - Entities are completely orphaned from memory system

4. **Data Quality Issues**
   - 146 duplicate names
   - 1,122 person entities lack contact info entirely
   - 170 person entities have contact_info but no email/phone
   - 3,282 entities have no description or notes

---

## Detailed Analysis

### 1. Entity Counts by Type

```
Total Entities: 3,657

By Type:
  - person:       3,579 (97.9%)
  - project:         54 (1.5%)
  - organization:    19 (0.5%)
  - other:            4 (0.1%)
  - concept:          1 (0.0%)
```

### 2. Entity Distribution by User

```
User                                              Entities
─────────────────────────────────────────────────────────────
bob@matsuoka.com (34183aef-dce1-4e2a-8b97...)     3,382
NULL (security issue)                               256
system-internal                                      12
test@example.com (default user)                       0
Other test users                                      7
```

**Root Cause of "0 Entities" in MCP Stats:**
- DEFAULT_USER_EMAIL is set to `test@example.com`
- This user has 37 memories but 0 entities
- All entities belong to `bob@matsuoka.com` (3,382 entities)

### 3. Contact Information Status

```
Total Entities:           3,657
With contact_info JSON:   2,457 (67.2%)
  - With emails:          1,711 (46.8%)
  - With phones:            837 (22.9%)
With companies:           1,425 (39.0%)
```

**Issues:**
- 1,200 entities (32.8%) have NO contact_info field at all
- 1,122 person entities completely lack contact info
- 170 person entities have contact_info but it's empty/incomplete

### 4. Entity-Memory Associations

```
Metric                                    Count
─────────────────────────────────────────────────────────
Total Entities                            3,657
Entities linked to memories                   0
Orphaned entities                         3,657

Total Memories                              159
Memories with entity_ids                    155
Memories without entity_ids                   4
```

**Critical Finding:**
- **NONE** of the 3,657 entities are referenced by any memories
- 155 memories have entity_ids but they reference entities that don't exist
- Complete disconnect between entities and memories
- Entities are effectively isolated data with no associations

### 5. Quality Issues by Severity

```
Severity    Count   Issue Types
─────────────────────────────────────────────────────────────
Critical      256   - null_user_id (security violation)

Warning     1,292   - person_no_contact (1,122)
                    - person_no_email_phone (170)

Info        3,282   - no_description (all entities)
```

### 6. Duplicate Detection

```
Duplicate Names: 146 groups

Top Duplicates:
  - "test entity":                 9 entities
  - "jordan morgan":               4 entities
  - "lukman ramsey":               3 entities
  - "josh knowles":                3 entities
  - "david goodman":               3 entities
  - "integration test entity":     3 entities
  - "test user":                   3 entities
```

**Analysis:**
- Most duplicates are test data pollution
- Some legitimate duplicates (e.g., common names without distinguishing info)
- No duplicate detection by email (0 email duplicates found)

### 7. Data Patterns

**Creation Timeline:**
```
Date           Entities Created
─────────────────────────────────────
2025-10-03          2
2025-10-02      3,380 (BULK IMPORT!)
2025-09-29          4
2025-09-26          1
Earlier dates      various
```

**Observation:**
- Massive bulk import on 2025-10-02 (3,380 entities)
- This was likely a contacts sync from macOS Contacts
- All assigned to bob@matsuoka.com

**Importance Distribution:**
```
ALL 3,657 entities have undefined/default importance level
```

---

## Root Cause Analysis

### Why MCP Stats Shows "0 Entities"

The MCP stats tool is **working correctly**:

1. DEFAULT_USER_EMAIL environment variable is set to `test@example.com`
2. MCP tools filter by user_id for the email: `756e8675-9783-42ad-a859-cd51f331e46c`
3. This user has 0 entities assigned
4. Stats correctly reports 0 entities

**Actual Issue:**
- The wrong user email is configured as default
- Should be `bob@matsuoka.com` who owns 3,382 entities
- Or entities should be reassigned to the default user

### Why Entities Are Orphaned from Memories

1. **Memory Cleanup Impact:**
   - 716 memories were deleted (875 → 159)
   - These likely had valid entity_ids
   - Deletion broke entity-memory associations

2. **Current State:**
   - 155 memories have entity_ids but reference non-existent entities
   - 0 memories reference any of the 3,657 actual entities
   - Suggests entity IDs changed or entities were recreated

3. **Schema Mismatch:**
   - Code schema (schema.ts) expects columns: email, phone, etc.
   - Actual schema has: contact_info (JSON field)
   - Indicates migration happened but code wasn't updated

---

## Comparison: Memories vs Entities

```
Metric                    Memories    Entities
────────────────────────────────────────────────
Total Count                    159       3,657
Belong to test@example.com      37           0
Belong to bob@matsuoka.com       ?       3,382
NULL user_id                     0         256
Quality Issues                LOW        HIGH
Test Data Pollution         CLEANED      HEAVY
Linked Together                  155→0 (broken)
```

**Key Insight:**
Memories were cleaned up successfully, but entities were not.
The entity database has the opposite problem - too many entities with no connections.

---

## Recommendations

### 🔴 CRITICAL (Security & Configuration)

1. **Fix NULL user_id Entities (256 entities)**
   ```sql
   -- Option A: Assign to bob@matsuoka.com (likely owner)
   UPDATE entities
   SET user_id = '34183aef-dce1-4e2a-8b97-2dac8d0e1f75'
   WHERE user_id IS NULL;

   -- Option B: Delete orphaned entities
   DELETE FROM entities WHERE user_id IS NULL;
   ```

2. **Update DEFAULT_USER_EMAIL Configuration**
   ```bash
   # Change from test@example.com to bob@matsuoka.com
   DEFAULT_USER_EMAIL=bob@matsuoka.com
   ```
   This will make MCP stats show 3,382 entities correctly.

3. **Update Code Schema Definition**
   - Update `src/database/schema.ts` to match actual schema
   - Add `contact_info` JSON field
   - Remove separate email, phone, etc. columns that don't exist
   - This is causing bugs in entity operations

### ⚠️ HIGH PRIORITY (Data Quality)

4. **Clean Up Test Data Pollution**
   ```sql
   -- Remove test entities
   DELETE FROM entities
   WHERE user_id LIKE 'test-%'
      OR name LIKE '%test%'
      OR name = 'integration test entity';
   ```
   Estimated: 20-30 entities

5. **Merge Duplicate Entities**
   - 146 duplicate name groups to review
   - Prioritize duplicates with 3+ entities
   - Use LLM deduplication (already implemented for contacts sync)
   - Focus on: "jordan morgan", "lukman ramsey", etc.

6. **Fix Entity-Memory Associations**
   - 155 memories have invalid entity_ids
   - Options:
     a. Clear entity_ids from these memories (orphan them)
     b. Attempt to re-link based on name/email matching
     c. Manually review and re-assign

   ```sql
   -- Option A: Clear invalid entity_ids
   UPDATE memories
   SET entity_ids = NULL
   WHERE entity_ids IS NOT NULL
     AND entity_ids != ''
     AND entity_ids != '[]';
   ```

### ⚪ MEDIUM PRIORITY (Enhancements)

7. **Improve Contact Information**
   - 1,122 person entities lack any contact info
   - Review if these are from contacts sync or manual entry
   - Consider archiving entities with no contact info and no associations

8. **Add Entity Descriptions**
   - 3,282 entities have no description or notes
   - Auto-generate from available fields
   - Use LLM to create meaningful descriptions

9. **Set Importance Levels**
   - All entities have undefined importance
   - Implement scoring algorithm based on:
     - Interaction frequency
     - Number of memory associations
     - Contact completeness

### 🔄 ONGOING (Maintenance)

10. **Implement Entity Cleanup Workflow**
    - Similar to memory cleanup we just did
    - Periodic review of orphaned entities
    - Automatic archival of stale entities (no interactions > 1 year)

11. **Add Entity-Memory Validation**
    - Foreign key checks on entity_ids
    - Automatic cleanup of invalid references
    - Prevent orphaned associations

12. **Schema Synchronization**
    - Keep schema.ts in sync with actual database
    - Add migration tracking and validation
    - Test schema changes in staging first

---

## Proposed Entity Cleanup Script

Similar to the memory cleanup, here's a proposed entity cleanup workflow:

```typescript
interface EntityCleanupCandidate {
  id: string;
  name: string;
  reason: string;
  recommended_action: 'delete' | 'archive' | 'merge' | 'fix';
}

Cleanup Criteria:
1. NULL user_id → DELETE (security issue)
2. Test data (user_id LIKE 'test-%') → DELETE
3. Duplicate names → MERGE (use LLM deduplication)
4. No contact info + no associations → ARCHIVE
5. Invalid data (empty name, etc.) → FIX or DELETE
```

**Estimated Cleanup Impact:**
- DELETE: ~256-300 entities (NULL user_id + test data)
- MERGE: ~146 entities (duplicates) → ~100 entities
- ARCHIVE: ~500-800 entities (no contact info, no associations)
- **Final Count: ~2,500-2,700 entities** (down from 3,657)

---

## Action Items Summary

### Immediate Actions (Do First)

1. ✅ Update DEFAULT_USER_EMAIL to `bob@matsuoka.com`
2. ✅ Fix 256 entities with NULL user_id
3. ✅ Update schema.ts to match actual database schema

### Short-term (This Week)

4. ⚠️ Clean up test data entities
5. ⚠️ Fix 155 memories with invalid entity_ids
6. ⚠️ Run duplicate detection and merge obvious duplicates

### Medium-term (This Month)

7. 📊 Implement entity cleanup workflow
8. 📊 Add importance scoring
9. 📊 Improve contact information coverage
10. 📊 Add entity-memory validation

---

## Technical Notes

### Schema Mismatch Issue

**Code Definition** (src/database/schema.ts):
```sql
CREATE TABLE entities (
  email TEXT,
  phone TEXT,
  address TEXT,
  website TEXT,
  ...
)
```

**Actual Database Schema:**
```sql
CREATE TABLE entities (
  contact_info TEXT,  -- JSON field
  ...
  -- NO separate email, phone, etc. columns
)
```

**Impact:**
- Any code trying to query `email` or `phone` directly will fail
- Need to JSON parse contact_info field
- Explains why first analysis script failed

### Contact Info Structure

```json
{
  "email": "example@example.com",
  "phone": "+1234567890",
  "address": "123 Main St",
  "linkedin": "https://linkedin.com/in/...",
  "github": "https://github.com/...",
  "website": "https://example.com"
}
```

---

## Files Generated

1. `entity-analysis-report-v2.json` - Full analysis data
2. `scripts/analyze-entities-v2.ts` - Analysis script
3. `scripts/investigate-mcp-stats.ts` - MCP stats investigation
4. `scripts/check-entity-schema.ts` - Schema verification
5. `ENTITY_DATABASE_ANALYSIS.md` - This report

---

## Conclusion

The entity database is **functional but needs significant cleanup**:

1. **MCP Stats "0 entities" is correct** - wrong default user configured
2. **256 entities are security risks** - NULL user_id must be fixed
3. **Entities are isolated** - no connections to memories
4. **Schema is out of sync** - code doesn't match database
5. **Cleanup needed** - similar to what we did for memories

**Next Steps:**
1. Fix configuration (DEFAULT_USER_EMAIL)
2. Fix security issues (NULL user_id)
3. Update code (schema.ts)
4. Plan entity cleanup workflow
5. Re-establish entity-memory associations

**Comparison to Memory Cleanup:**
- Memories: Cleaned 875 → 159 (82% reduction) ✅
- Entities: Need to clean 3,657 → ~2,500 (32% reduction) 🔄

The entity database requires similar attention to what we successfully did for memories.
