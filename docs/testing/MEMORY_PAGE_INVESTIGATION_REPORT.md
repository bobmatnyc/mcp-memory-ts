# Memory Page Investigation Report

**Date**: 2025-10-18
**Investigator**: Research Agent
**Focus**: Memory page filtering and entity display capabilities

---

## Executive Summary

The memory page (`/web/app/memory/page.tsx`) currently **does NOT support week-based filtering** or query parameter reading. The web interface has a simplified database layer that lacks week_identifier filtering capabilities. To enable week-based filtering for Gmail extraction logs, we need to implement both frontend and backend changes.

**Key Findings:**
1. ❌ Memory page does NOT read query parameters (no `useSearchParams` usage)
2. ❌ No dedicated entities page exists
3. ❌ Database methods lack week_identifier filtering support
4. ✅ Infrastructure exists in documentation but not implemented
5. ✅ Similar filtering patterns exist in Google Calendar API (can be used as template)

---

## Detailed Analysis

### 1. Memory Page Component Analysis

**File**: `/web/app/memory/page.tsx`

#### Current State:
- **Query Parameters**: ❌ NOT IMPLEMENTED
  - Uses `useState` for local filtering only
  - No `useSearchParams` hook present
  - No URL query parameter reading

- **Filtering Capabilities**: ⚠️ LIMITED
  - Type filtering: `SYSTEM`, `LEARNED`, `MEMORY` (client-side only)
  - Importance filtering: 1-4 stars (client-side only)
  - Search functionality: Text search via API
  - **Week filtering**: ❌ NOT IMPLEMENTED

- **Current Fetch Pattern**:
  ```typescript
  const fetchMemories = async (query?: string) => {
    const url = query
      ? `/api/memories/search`
      : `/api/memories?limit=50`;
    // No support for additional filters
  };
  ```

#### What's Missing:
```typescript
// MISSING: Query parameter reading
import { useSearchParams } from 'next/navigation';

// MISSING: Week filter state
const [weekFilter, setWeekFilter] = useState<string | null>(null);

// MISSING: Source filter state
const [sourceFilter, setSourceFilter] = useState<string | null>(null);

// MISSING: URL parameter initialization
useEffect(() => {
  const week = searchParams.get('week');
  const source = searchParams.get('source');
  // Apply filters...
}, [searchParams]);
```

---

### 2. Entity Display Analysis

**Finding**: ❌ **No Dedicated Entities Page**

**Pages Found**:
- `/web/app/memory/page.tsx` - Memories only
- `/web/app/dashboard/page.tsx` - Statistics dashboard
- `/web/app/utilities/page.tsx` - Utility tools
- `/web/app/status/page.tsx` - System status
- `/web/app/settings/page.tsx` - Configuration
- `/web/app/sync/google/page.tsx` - Google sync
- `/web/app/sync/gmail/page.tsx` - Gmail sync

**Entity API Exists**: ✅ `/web/app/api/entities/route.ts`
- Supports GET for listing entities
- POST not fully implemented (returns 501)
- No week filtering support

**Entities Display Options**:
1. **Option A**: Create new `/web/app/entities/page.tsx`
2. **Option B**: Add entities section to memory page
3. **Option C**: Add entities tab to dashboard page

---

### 3. API Endpoint Analysis

#### Memory API (`/web/app/api/memories/route.ts`)

**Current Capabilities**:
- GET: List memories with limit parameter
- POST: Create new memory
- Text search via `/api/memories/search`

**Missing Capabilities**:
- ❌ Week identifier filtering
- ❌ Source filtering (e.g., `source=gmail`)
- ❌ Metadata-based filtering

**Current Implementation**:
```typescript
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const limit = parseInt(searchParams.get('limit') || '20');
  const query = searchParams.get('query') || '';

  const memories = await database.getMemories(userEmail, { limit, query });
  // No week filtering support
}
```

#### Entity API (`/web/app/api/entities/route.ts`)

**Current State**:
- Basic GET implementation
- No filtering parameters supported
- Returns all entities up to limit

---

### 4. Database Layer Analysis

**File**: `/web/lib/database.ts`

#### Current `getMemories` Method:
```typescript
async getMemories(email: string, options: { limit?: number; query?: string } = {}) {
  // Simple SELECT without metadata filtering
  const result = await this.client.execute({
    sql: `
      SELECT id, title, content, memory_type as memoryType,
             importance, tags, metadata, created_at, updated_at
      FROM memories
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `,
    args: [userId, limit],
  });
}
```

**Missing**:
- ❌ No week_identifier filtering in WHERE clause
- ❌ No source filtering
- ❌ No metadata JSON extraction

#### Current `getEntities` Method:
```typescript
async getEntities(email: string, options: { limit?: number } = {}) {
  // Simple SELECT without metadata filtering
  const result = await this.client.execute({
    sql: `SELECT id, name, entity_type, description, metadata
          FROM entities WHERE user_id = ? LIMIT ?`,
    args: [userId, limit],
  });
}
```

**Missing**: Same filtering limitations as memories

---

### 5. Successful Pattern Reference

**File**: `/web/app/api/google/calendar/events/route.ts`

This API demonstrates the **correct pattern** for query parameter handling:

```typescript
export async function GET(request: NextRequest) {
  // ✅ Read query parameters
  const searchParams = request.nextUrl.searchParams;
  const week = searchParams.get('week');

  // ✅ Validate required parameters
  if (!week) {
    return NextResponse.json(
      { error: 'Week parameter is required' },
      { status: 400 }
    );
  }

  // ✅ Use specialized database method
  const events = await calendarOps.getEventsForWeek(user.id, week);

  return NextResponse.json({ success: true, data: events });
}
```

**Key Takeaways**:
1. Use `request.nextUrl.searchParams` for query params
2. Validate required parameters
3. Create specialized database methods for filtering
4. Return structured responses

---

## Database Query Support Analysis

### Documentation vs. Implementation Gap

**Documentation Claims** (from `WEEK_IDENTIFIER_IMPLEMENTATION.md`):
```typescript
// Example query from documentation
const memories = await db.execute(
  `SELECT * FROM memories
   WHERE user_id = ?
   AND json_extract(metadata, '$.week_identifier') = ?`,
  [userId, '2025-42']
);
```

**Actual Implementation**: ❌ NOT IMPLEMENTED
- Web database layer (`/web/lib/database.ts`) doesn't use JSON extraction
- Core database layer (`/src/database/operations.ts`) doesn't support metadata filtering
- No specialized methods for week-based queries

### Required Database Changes

#### For Memories:
```sql
-- Add to getMemories method
SELECT * FROM memories
WHERE user_id = ?
AND json_extract(metadata, '$.week_identifier') = ?
AND json_extract(metadata, '$.source') = ?
ORDER BY created_at DESC
LIMIT ?
```

#### For Entities:
```sql
-- Add to getEntities method
SELECT * FROM entities
WHERE user_id = ?
AND json_extract(metadata, '$.week_identifier') = ?
ORDER BY created_at DESC
LIMIT ?
```

---

## Memory Management Assessment

### File Sizes and Reading Strategy

**Files Analyzed**:
1. `/web/app/memory/page.tsx` - 243 lines ✅ (Safe to read fully)
2. `/web/app/api/memories/route.ts` - 108 lines ✅ (Safe to read fully)
3. `/web/lib/database.ts` - 399 lines ✅ (Read fully)
4. `/src/database/operations.ts` - Large file ⚠️ (Sampled strategically)

**Memory Usage**:
- Used semantic search for initial discovery (mcp-vector-search)
- Read only essential sections of large files
- Total files read: 6 (all under 20KB)
- Strategy: ✅ Efficient and within memory limits

---

## Recommended Implementation Approach

### Phase 1: Database Layer Enhancement (Critical)

**File**: `/web/lib/database.ts`

```typescript
// Add filtering options to getMemories
async getMemories(
  email: string,
  options: {
    limit?: number;
    query?: string;
    week?: string;        // NEW
    source?: string;      // NEW
  } = {}
) {
  const userId = await this.ensureUser(email);
  const { limit = 20, query, week, source } = options;

  // Build WHERE conditions
  const conditions = ['user_id = ?'];
  const args: any[] = [userId];

  if (week) {
    conditions.push("json_extract(metadata, '$.week_identifier') = ?");
    args.push(week);
  }

  if (source) {
    conditions.push("json_extract(metadata, '$.source') = ?");
    args.push(source);
  }

  const result = await this.client.execute({
    sql: `
      SELECT id, title, content, memory_type as memoryType,
             importance, tags, metadata, created_at, updated_at
      FROM memories
      WHERE ${conditions.join(' AND ')}
      ORDER BY created_at DESC
      LIMIT ?
    `,
    args: [...args, limit],
  });

  // ... rest of mapping logic
}

// Add similar enhancement to getEntities
async getEntities(
  email: string,
  options: {
    limit?: number;
    week?: string;        // NEW
  } = {}
) {
  // Similar pattern...
}
```

**Effort**: 🟡 Medium (2-3 hours)

---

### Phase 2: API Layer Enhancement

**File**: `/web/app/api/memories/route.ts`

```typescript
export async function GET(request: NextRequest) {
  try {
    const userEmail = await getUserEmail();
    const searchParams = request.nextUrl.searchParams;

    // Extract query parameters
    const limit = parseInt(searchParams.get('limit') || '20');
    const query = searchParams.get('query') || '';
    const week = searchParams.get('week') || undefined;      // NEW
    const source = searchParams.get('source') || undefined;  // NEW

    const database = await getDatabase();

    // Pass filters to database layer
    const memories = await database.getMemories(userEmail, {
      limit,
      query,
      week,    // NEW
      source   // NEW
    });

    return NextResponse.json({
      success: true,
      data: memories,
    });
  } catch (error: any) {
    // ... error handling
  }
}
```

**Similar changes needed for**: `/web/app/api/entities/route.ts`

**Effort**: 🟢 Easy (1 hour)

---

### Phase 3: Frontend Component Enhancement

**File**: `/web/app/memory/page.tsx`

```typescript
'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';  // NEW

export default function MemoryPage() {
  const [memories, setMemories] = useState([]);
  const [loading, setLoading] = useState(true);
  const searchParams = useSearchParams();  // NEW

  // NEW: Read query parameters
  const weekParam = searchParams.get('week');
  const sourceParam = searchParams.get('source');

  const fetchMemories = async (query?: string) => {
    setLoading(true);
    setError(null);

    try {
      // Build URL with filters
      const params = new URLSearchParams();
      params.set('limit', '50');

      if (weekParam) params.set('week', weekParam);
      if (sourceParam) params.set('source', sourceParam);
      if (query) params.set('query', query);

      const url = query
        ? `/api/memories/search?${params.toString()}`
        : `/api/memories?${params.toString()}`;

      const response = await fetch(url);
      const data = await response.json();
      setMemories(data.data || []);
    } catch (err) {
      // ... error handling
    } finally {
      setLoading(false);
    }
  };

  // NEW: Refetch when query params change
  useEffect(() => {
    fetchMemories();
  }, [weekParam, sourceParam]);

  // NEW: Display active filters
  const hasFilters = weekParam || sourceParam;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ... existing header ... */}

      {/* NEW: Active filters display */}
      {hasFilters && (
        <div className="mb-4 flex gap-2">
          {weekParam && (
            <Badge variant="secondary">
              Week: {weekParam}
            </Badge>
          )}
          {sourceParam && (
            <Badge variant="secondary">
              Source: {sourceParam}
            </Badge>
          )}
        </div>
      )}

      {/* ... rest of component ... */}
    </div>
  );
}
```

**Effort**: 🟡 Medium (2-3 hours)

---

### Phase 4: Create Entities Page (Optional)

**File**: `/web/app/entities/page.tsx` (NEW)

```typescript
'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

export default function EntitiesPage() {
  const [entities, setEntities] = useState([]);
  const [loading, setLoading] = useState(true);
  const searchParams = useSearchParams();

  const weekParam = searchParams.get('week');

  // Similar pattern to memory page...

  return (
    <div className="min-h-screen bg-gray-50">
      <h1>Entities</h1>
      {/* Entity list with week filtering */}
    </div>
  );
}
```

**Effort**: 🟡 Medium (3-4 hours)

---

## Answers to Investigation Questions

### 1. Does memory page read query parameters?
**Answer**: ❌ **NO**

The memory page currently does NOT use `useSearchParams()` or read any URL query parameters. All filtering is done client-side using local state.

---

### 2. Where are entities displayed?
**Answer**: ❌ **NOWHERE (No dedicated page exists)**

**Current State**:
- No `/web/app/entities/page.tsx` exists
- Entities API exists but is unused in the frontend
- Entity statistics shown on dashboard, but not individual entities

**Recommendation**: Create dedicated entities page at `/web/app/entities/page.tsx`

---

### 3. What changes needed to filter by week?
**Answer**: **3-Layer Implementation Required**

**Layer 1 - Database** (Critical):
- Add `week` and `source` parameters to `getMemories()` method
- Add `week` parameter to `getEntities()` method
- Implement JSON extraction for `metadata.week_identifier`
- Implement JSON extraction for `metadata.source`

**Layer 2 - API** (Required):
- Update `/api/memories/route.ts` to read `week` and `source` query params
- Pass parameters to database layer
- Update `/api/entities/route.ts` similarly

**Layer 3 - Frontend** (Required):
- Add `useSearchParams()` to memory page
- Read `week` and `source` from URL
- Refetch data when parameters change
- Display active filters in UI

**Estimated Total Effort**: 🟡 6-8 hours

---

### 4. What changes needed to display entities?
**Answer**: **2 Options**

**Option A - Dedicated Page** (Recommended):
- Create `/web/app/entities/page.tsx`
- Similar structure to memory page
- Support week filtering
- Add navigation link in main menu
- **Effort**: 🟡 3-4 hours

**Option B - Embedded in Memory Page**:
- Add entities section below memories
- Share filtering logic
- Simpler but cluttered UI
- **Effort**: 🟢 2-3 hours

---

### 5. Recommended implementation approach?
**Answer**: **Phased Rollout**

**Priority Order**:

1. **Phase 1** (Critical): Database layer enhancement
   - Enables all downstream features
   - Required for both memories and entities filtering
   - **Time**: 2-3 hours

2. **Phase 2** (High): API layer enhancement
   - Exposes filtering to frontend
   - Simple pass-through logic
   - **Time**: 1 hour

3. **Phase 3** (High): Memory page enhancement
   - Immediate user-facing value
   - Enables Gmail extraction log viewing
   - **Time**: 2-3 hours

4. **Phase 4** (Medium): Entities page creation
   - Nice-to-have for entity management
   - Can be deferred if time-constrained
   - **Time**: 3-4 hours

**Total Estimated Time**: 8-11 hours for full implementation

**Minimum Viable Implementation** (Phases 1-3): 5-7 hours

---

## Additional Considerations

### URL Format Recommendations

```bash
# View memories from specific week
/memory?week=2025-42

# View memories from specific week and source
/memory?week=2025-42&source=gmail

# View entities from specific week
/entities?week=2025-42
```

### UI/UX Enhancements

1. **Filter Badges**: Show active filters prominently
2. **Clear Filters Button**: Easy way to reset
3. **Week Picker**: Dropdown to select week instead of manual typing
4. **Breadcrumbs**: Show navigation path when filtered
5. **Empty State**: Helpful message when no results match filters

### Testing Strategy

1. **Unit Tests**: Test database query building with various filter combinations
2. **Integration Tests**: Test API endpoints with query parameters
3. **E2E Tests**: Test complete user flow from URL to displayed results
4. **Edge Cases**: Empty results, invalid week format, missing metadata

---

## Files Requiring Changes

### Must Change:
1. ✏️ `/web/lib/database.ts` - Add filtering to getMemories/getEntities
2. ✏️ `/web/app/api/memories/route.ts` - Read and pass query params
3. ✏️ `/web/app/api/entities/route.ts` - Read and pass query params
4. ✏️ `/web/app/memory/page.tsx` - Add useSearchParams and filtering UI

### Optional (Recommended):
5. ➕ `/web/app/entities/page.tsx` - NEW file for entities display
6. ✏️ `/web/components/ui/filter-badge.tsx` - NEW reusable filter component
7. ✏️ `/web/components/ui/week-picker.tsx` - NEW week selection component

---

## Risk Assessment

### Low Risk:
- ✅ Database layer changes (non-breaking, additive)
- ✅ API layer changes (backward compatible with optional params)

### Medium Risk:
- ⚠️ Frontend changes may require Next.js client component handling
- ⚠️ URL parameter handling needs proper SSR/CSR coordination

### Mitigation Strategies:
1. Make all new parameters optional (backward compatible)
2. Test thoroughly with and without query parameters
3. Handle edge cases gracefully (invalid week format, etc.)
4. Add comprehensive error messages

---

## Performance Considerations

### Database Performance:
- **JSON Extraction**: SQLite's `json_extract()` is efficient but not indexed
- **Recommendation**: Consider adding computed columns if filtering becomes slow
- **Impact**: Minimal for <10,000 memories per user

### Frontend Performance:
- **Refetch Strategy**: Use SWR or React Query for caching
- **Optimization**: Debounce filter changes
- **Impact**: Minimal with current implementation

---

## Success Metrics

### Implementation Complete When:
- ✅ `/memory?week=2025-42` shows only memories from that week
- ✅ `/memory?week=2025-42&source=gmail` shows only Gmail memories from that week
- ✅ `/entities?week=2025-42` shows only entities from that week
- ✅ Active filters displayed clearly in UI
- ✅ No console errors or warnings
- ✅ All existing functionality still works

### Quality Gates:
- ✅ All unit tests passing
- ✅ API tests with various parameter combinations
- ✅ Manual testing of all filter combinations
- ✅ Performance testing with large datasets
- ✅ Documentation updated

---

## Conclusion

The memory page currently lacks week-based filtering capabilities and there is no dedicated entities page. To support Gmail extraction log viewing by week, we need to implement a three-layer solution:

1. **Database Layer**: Add metadata-based filtering using JSON extraction
2. **API Layer**: Accept and pass query parameters
3. **Frontend Layer**: Read URL parameters and display filtered results

The implementation is straightforward and follows existing patterns in the codebase (see Google Calendar API for reference). Estimated time for minimum viable implementation is **5-7 hours**.

**Next Steps**:
1. Prioritize database layer changes (enables all downstream features)
2. Implement API layer changes (simple pass-through)
3. Update memory page with query parameter support
4. Consider creating dedicated entities page (optional but recommended)

---

**Report Generated**: 2025-10-18
**Memory Usage**: Efficient (6 files read, strategic sampling used)
**Confidence Level**: High (based on comprehensive codebase analysis)
