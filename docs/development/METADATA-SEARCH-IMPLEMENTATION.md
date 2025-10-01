# Metadata Search Implementation

## Summary

Successfully implemented metadata search functionality that allows searching for memories by their metadata field values without requiring special syntax.

## Problem Solved

Previously, metadata values (like `teamId`, `owner`, `priority`, etc.) were stored in the database but **NOT searchable** through regular text search. Only the title and content fields were searchable.

### Before
```typescript
// ❌ Searching for "TEAM_ALPHA" returned NO results
// even if memories had metadata.teamId = "TEAM_ALPHA"
const result = await searchMemories('TEAM_ALPHA'); // No results
```

### After
```typescript
// ✅ Now finds memories with "TEAM_ALPHA" in metadata
const result = await searchMemories('TEAM_ALPHA'); // Returns matching memories

// ✅ Also works with emails, priorities, etc.
const result = await searchMemories('john.doe@example.com'); // Works!
const result = await searchMemories('P0'); // Works!
```

## Implementation Details

### File Modified: `src/database/operations.ts`

Updated the `searchMemories()` method to search within JSON metadata using SQLite's `json_each()` function.

#### Single Word Search
```sql
SELECT * FROM memories
WHERE user_id = ? AND is_archived = 0
AND (
  LOWER(title) LIKE LOWER(?) OR
  LOWER(content) LIKE LOWER(?) OR
  (metadata IS NOT NULL AND json_valid(metadata) AND EXISTS (
    SELECT 1 FROM json_each(metadata)
    WHERE LOWER(json_each.value) LIKE LOWER(?)
  ))
)
ORDER BY updated_at DESC
LIMIT ?
```

#### Multi-Word Search
For searches with multiple words (e.g., "engineering team"), the query searches each word across all three fields (title, content, metadata) using OR logic:

```sql
SELECT * FROM memories
WHERE user_id = ? AND is_archived = 0
AND (
  (LOWER(title) LIKE LOWER(?) OR LOWER(content) LIKE LOWER(?) OR EXISTS(...)) OR
  (LOWER(title) LIKE LOWER(?) OR LOWER(content) LIKE LOWER(?) OR EXISTS(...))
)
```

### How It Works

1. **json_valid() Check**: Validates that metadata is valid JSON before processing
2. **NULL Safety**: Ensures metadata is not NULL before calling json_each()
3. **json_each() Function**: LibSQL/SQLite's JSON function that extracts all values from a JSON object
4. **Subquery with EXISTS**: Checks if any metadata value matches the search term
5. **Case-Insensitive**: Uses LOWER() for case-insensitive matching
6. **Wildcard Search**: Uses `%term%` for partial matching

### Maintains Existing Features

✅ **Special Syntax Still Works**: The existing `field:value` and `metadata.field:value` syntax continues to work for precise field searches:
```typescript
// Precise field search
await searchMemories('teamId:TEAM_ALPHA');
await searchMemories('metadata.priority:P0');
```

✅ **Vector/Semantic Search**: Metadata search works alongside semantic search in composite mode

✅ **Performance**: Uses efficient SQL EXISTS subquery to check metadata

## Test Results

All 9 test cases passed:

### General Metadata Search (NEW)
1. ✅ Search for "TEAM_ALPHA" → finds memory with metadata.teamId
2. ✅ Search for "john.doe@example.com" → finds memory with metadata.owner
3. ✅ Search for "P0" → finds memory with metadata.priority
4. ✅ Search for "Engineering" → finds memory with metadata.department
5. ✅ Search for "TEAM_BETA" → finds correct memory
6. ✅ Search for "jane.smith@example.com" → finds correct memory
7. ✅ Search for "DevOps" → finds correct memory

### Special Syntax (EXISTING)
8. ✅ Search "teamId:TEAM_ALPHA" → precise field search
9. ✅ Search "metadata.priority:P0" → precise field search

## Usage Examples

### Storing Memories with Metadata
```typescript
await memoryCore.addMemory(
  'Project Alpha Documentation',
  'Main project documentation',
  MemoryType.MEMORY,
  {
    userId,
    metadata: {
      teamId: 'TEAM_ALPHA',
      owner: 'john.doe@example.com',
      priority: 'P0',
      department: 'Engineering'
    }
  }
);
```

### Searching by Metadata Values
```typescript
// Search by team ID
const teamResults = await memoryCore.searchMemories('TEAM_ALPHA', { userId });

// Search by owner email
const ownerResults = await memoryCore.searchMemories('john.doe@example.com', { userId });

// Search by priority
const priorityResults = await memoryCore.searchMemories('P0', { userId });

// All return memories with matching metadata!
```

## Performance Considerations

1. **JSON Processing**: LibSQL efficiently handles JSON operations with `json_each()`
2. **Index Support**: Consider adding index on metadata column for large datasets
3. **Wildcard Performance**: LIKE with leading wildcard (`%term%`) scans all values
4. **Acceptable for Typical Use**: Works well for thousands of memories per user

## Future Enhancements

Potential optimizations:
- [ ] Add JSON column indexing for better performance
- [ ] Support nested JSON path searches (e.g., `metadata.team.name`)
- [ ] Add metadata-specific search operators
- [ ] Implement metadata value autocomplete

## Integration Points

This enhancement affects:
- ✅ `DatabaseOperations.searchMemories()` - Core SQL search
- ✅ `MemoryCore.searchMemories()` - High-level API (no changes needed)
- ✅ MCP Server - Automatically benefits from enhanced search
- ✅ REST API - Automatically benefits from enhanced search

## Testing

Run the test suite:
```bash
./test-metadata-search.ts
```

Expected output:
```
🎉 All metadata search tests PASSED!
📊 Test Summary:
   ✅ Passed: 9/9
   ❌ Failed: 0/9
```

## Compatibility

- ✅ **Backward Compatible**: No breaking changes
- ✅ **Database Schema**: No schema changes required
- ✅ **Existing Code**: All existing functionality preserved
- ✅ **MCP Protocol**: Fully compatible with MCP tool interface

---

**Implementation Date**: October 1, 2025
**Status**: ✅ Complete and Tested
**LOC Impact**: +21 lines modified, -8 lines removed = **Net +13 lines**
