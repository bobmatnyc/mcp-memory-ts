# Week Identifier Metadata Implementation

## Summary
Added `week_identifier` to memory and entity metadata during Gmail extraction to enable filtering by extraction week.

## Changes Made

### 1. TypeScript Type Definitions (`src/types/base.ts`)
Added Gmail-specific metadata interfaces:
```typescript
export interface GmailMemoryMetadata extends Record<string, unknown> {
  source: 'gmail';
  week_identifier?: string; // YYYY-WW format
  email_id?: string;
  email_date?: string;
  email_from?: string;
  email_subject?: string;
}

export interface GmailEntityMetadata extends Record<string, unknown> {
  source: 'gmail';
  week_identifier?: string; // YYYY-WW format
  first_mentioned?: string;
  email_id?: string;
}
```

### 2. Gmail Extractor Types (`src/services/gmail-extractor.ts`)
Updated `ExtractedMemory` and `ExtractedEntity` interfaces to include `week_identifier` in metadata:
```typescript
metadata?: {
  source: 'gmail';
  week_identifier?: string; // YYYY-WW format
  // ... other fields
}
```

### 3. Gmail Extraction Service (`src/services/gmail-extraction-service.ts`)

#### Modified `saveExtractions` method:
- Added `weekIdentifier?: string` parameter
- Metadata is now merged with week_identifier for both entities and memories:

**Entities:**
```typescript
const metadata = {
  ...entityData.metadata,
  source: 'gmail',
  ...(weekIdentifier && { week_identifier: weekIdentifier }),
};
```

**Memories:**
```typescript
const metadata = {
  ...memoryData.metadata,
  source: 'gmail',
  ...(weekIdentifier && { week_identifier: weekIdentifier }),
};
```

#### Updated `extractWeek` method:
- Now passes `weekIdentifier` to `saveExtractions` call

## Metadata Format

When memories and entities are created during Gmail extraction, their metadata will include:

**Memory metadata example:**
```json
{
  "source": "gmail",
  "week_identifier": "2025-42",
  "email_id": "msg_123",
  "email_date": "2025-10-18T10:00:00Z",
  "email_from": "sender@example.com"
}
```

**Entity metadata example:**
```json
{
  "source": "gmail",
  "week_identifier": "2025-42",
  "first_mentioned": "2025-10-18T10:00:00Z",
  "email_id": "msg_123"
}
```

## Backward Compatibility

✅ **Fully backward compatible**:
- `week_identifier` is optional (uses `?:` in TypeScript)
- Only added when `weekIdentifier` parameter is provided
- Existing extractions without `week_identifier` continue to work
- Database schema doesn't need changes (metadata is JSON field)

## Usage

### Filter memories by week (example query):
```sql
SELECT * FROM memories 
WHERE user_id = ? 
AND json_extract(metadata, '$.week_identifier') = '2025-42'
```

### Filter entities by week (example query):
```sql
SELECT * FROM entities 
WHERE user_id = ? 
AND json_extract(metadata, '$.week_identifier') = '2025-42'
```

### TypeScript usage:
```typescript
// Search memories from a specific week
const memories = await db.execute(
  `SELECT * FROM memories 
   WHERE user_id = ? 
   AND json_extract(metadata, '$.week_identifier') = ?`,
  [userId, '2025-42']
);

// Filter in application code
const weekMemories = allMemories.filter(
  m => (m.metadata as GmailMemoryMetadata)?.week_identifier === '2025-42'
);
```

## Testing

Verified:
- ✅ TypeScript compilation succeeds (`npm run type-check`)
- ✅ Build completes without errors (`npm run build`)
- ✅ All type definitions are properly exported and accessible

## Next Steps

To utilize this feature in the web interface:
1. Add week filter UI component
2. Create API endpoint to filter by week
3. Update frontend queries to include week_identifier filter
4. Add week-based grouping/display in dashboard

## Files Modified

1. `/src/types/base.ts` - Added Gmail metadata type definitions
2. `/src/services/gmail-extractor.ts` - Updated ExtractedMemory and ExtractedEntity interfaces
3. `/src/services/gmail-extraction-service.ts` - Added week_identifier to metadata during save

**Net LOC Impact**: +48 lines (type definitions and metadata handling)
**Reuse Score**: 100% (leverages existing metadata infrastructure)
**Simplification**: Minimal code addition, maximum value through metadata extension

---

**Implementation Date**: 2025-10-18
**Version**: 1.7.2+
**Status**: ✅ Complete and verified
