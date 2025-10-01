# Semantic Search Investigation - Findings & Fixes

## Summary

**Investigation Result: ✅ Vector embeddings ARE being used correctly**

The MCP Memory TypeScript system implements semantic search properly using OpenAI embeddings and cosine similarity. The perceived issue was due to a high similarity threshold (0.7) that filtered out borderline semantic matches and silent fallback to text search that masked failures.

---

## What Was Investigated

1. **searchMemories method** in `/Users/masa/Projects/managed/mcp-memory-ts/src/core/memory-core.ts`
2. **vectorSearchMemories implementation** (lines 599-646)
3. **Cosine similarity calculation** in `/Users/masa/Projects/managed/mcp-memory-ts/src/utils/embeddings.ts`
4. **findMostSimilar algorithm** (lines 126-142)
5. **Database text search** in `/Users/masa/Projects/managed/mcp-memory-ts/src/database/operations.ts`

---

## Key Findings

### ✅ Semantic Search IS Working

**Evidence:**

1. **Query embeddings are generated** (line 264):
   ```typescript
   const queryEmbedding = await this.embeddings.generateEmbedding(query);
   ```

2. **Vector search happens FIRST** (line 266):
   ```typescript
   vectorResults = await this.vectorSearchMemories(userId, queryEmbedding, {
     threshold: options.threshold || 0.7,
     limit,
   });
   ```

3. **Cosine similarity is calculated correctly** (embeddings.ts, lines 71-121):
   ```typescript
   static cosineSimilarity(a: number[], b: number[]): number {
     let dotProduct = 0, normA = 0, normB = 0;
     for (let i = 0; i < a.length; i++) {
       dotProduct += a[i] * b[i];
       normA += a[i] * a[i];
       normB += b[i] * b[i];
     }
     return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
   }
   ```

4. **Results are sorted by similarity** (embeddings.ts, lines 137-138):
   ```typescript
   .sort((a, b) => b.similarity - a.similarity)
   ```

### ⚠️ Why It Appeared Broken

1. **High Threshold (0.7)**: Semantic matches scoring below 0.7 were filtered out
   - "artificial intelligence" vs "machine learning" might score 0.65
   - Result: No matches returned, falls back to text search

2. **Silent Fallback**: Vector search failures were not visible
   ```typescript
   try {
     vectorResults = await this.vectorSearchMemories(...);
   } catch (error) {
     console.error('Vector search failed, falling back to text search:', error);
     // Users see text results but don't know vector search failed
   }
   ```

3. **No Result Metadata**: Users couldn't see:
   - Whether results came from vector or text search
   - Similarity scores
   - Embedding coverage percentage

4. **Text Search Uses Keywords**: Database fallback uses SQL LIKE
   ```sql
   WHERE LOWER(title) LIKE LOWER(?) OR LOWER(content) LIKE LOWER(?)
   ```
   This is pure keyword matching, reinforcing the perception that semantic search wasn't working.

---

## Fixes Applied

### 1. Lower Default Threshold (0.7 → 0.6)

**File:** `src/core/memory-core.ts`, line 267

**Change:**
```typescript
// Before
threshold: options.threshold || 0.7

// After
threshold: options.threshold || 0.6  // Lower threshold for better semantic recall
```

**Rationale:** 0.6 provides better recall for semantic matches while maintaining reasonable precision.

**Impact:** More semantically related results will be returned.

### 2. Enhanced Search Result Messages

**File:** `src/core/memory-core.ts`, lines 313-325

**Before:**
```typescript
message: `Found ${allResults.length} memories`
```

**After:**
```typescript
let message = `Found ${allResults.length} memories`;
if (vectorSearchUsed && textSearchUsed) {
  message += ` (${vectorResults.length} via semantic search, ${textResults.length} via text search)`;
} else if (vectorSearchUsed) {
  message += ` (semantic search)`;
} else if (textSearchUsed) {
  message += ` (text search)`;
}

if (vectorSearchError) {
  message += ` [Vector search error: ${vectorSearchError}]`;
}
```

**Example Output:**
- `"Found 5 memories (3 via semantic search, 2 via text search)"`
- `"Found 8 memories (semantic search)"`
- `"Found 2 memories (text search) [Vector search error: OpenAI API limit exceeded]"`

**Impact:** Users can now see exactly how their results were obtained.

### 3. Vector Search Health Monitoring

**File:** `src/core/memory-core.ts`, lines 825-833

**Added to statistics endpoint:**
```typescript
vectorSearchHealth: {
  enabled: this.embeddings !== null && (this.embeddings as any).openai !== null,
  memoriesWithValidEmbeddings: memoriesWithEmbeddings.length,
  memoriesWithoutEmbeddings: memories.length - memoriesWithEmbeddings.length,
  coveragePercentage: embeddingCoverage,
  recommendation: embeddingCoverage < 90
    ? 'Consider running updateMissingEmbeddings() to improve semantic search coverage'
    : 'Vector search coverage is healthy',
}
```

**Example Output:**
```json
{
  "totalMemories": 50,
  "memoriesWithEmbeddings": 48,
  "embeddingCoverage": "96%",
  "vectorSearchHealth": {
    "enabled": true,
    "memoriesWithValidEmbeddings": 48,
    "memoriesWithoutEmbeddings": 2,
    "coveragePercentage": 96,
    "recommendation": "Vector search coverage is healthy"
  }
}
```

**Impact:** Users can monitor embedding coverage and diagnose issues.

### 4. Debug Logging

**File:** `src/core/memory-core.ts`, lines 273-275, 294-296

**Added:**
```typescript
if (process.env.MCP_DEBUG) {
  console.log(`[SearchMemories] Vector search returned ${vectorResults.length} results`);
  console.log(`[SearchMemories] Text search returned ${textResults.length} results`);
}
```

**Usage:**
```bash
export MCP_DEBUG=1
npm run mcp-server
```

**Impact:** Developers can troubleshoot search behavior in real-time.

---

## Verification

### Created Test Files

1. **Comprehensive Test Suite**
   - File: `/Users/masa/Projects/managed/mcp-memory-ts/tests/semantic-search-verification.test.ts`
   - Tests semantic matching, ranking, and non-keyword queries
   - Requires real OpenAI API key to run

2. **Manual Test Script**
   - File: `/Users/masa/Projects/managed/mcp-memory-ts/scripts/test-semantic-search.ts`
   - Interactive demonstration of semantic search
   - Creates test memories and shows search results

**Run Manual Test:**
```bash
export MCP_DEBUG=1
npx tsx scripts/test-semantic-search.ts
```

**Expected Output:**
```
🔬 Semantic Search Verification Script
============================================================
✓ Environment variables configured
✓ Database connected
✓ Memory core initialized
✓ Created test user

STEP 1: Creating test memories with embeddings
============================================================
✓ Created memory: "Machine Learning Research"
✓ Created memory: "Coffee Brewing Technique"

STEP 2: Verifying embeddings were generated
============================================================
✓ ML memory has embedding with 1536 dimensions
✓ Coffee memory has embedding with 1536 dimensions

TEST 1: Search for "artificial intelligence"
Expected: ML memory should rank first (semantic similarity)
============================================================
Status: success
Message: Found 2 memories (2 via semantic search)

Found 2 results:
1. Machine Learning Research ← ML (Expected)
   Content: Working on deep neural networks and artificial intelligence...
   Tags: ["ml","ai","deep-learning"]

2. Coffee Brewing Technique ← Coffee
   Content: Pour-over coffee method: Heat water to 200°F...
   Tags: ["coffee","brewing","recipe"]

✅ SUCCESS: Semantic search is working! ML memory ranked first.
```

### Documentation

Created comprehensive analysis:
- File: `/Users/masa/Projects/managed/mcp-memory-ts/docs/SEMANTIC-SEARCH-ANALYSIS.md`
- Detailed code analysis
- Mathematical verification of cosine similarity
- Recommendations for users and developers

---

## How to Use Enhanced Features

### 1. Monitor Vector Search Health

```typescript
const statsResult = await memoryCore.getStatistics(userId);

if (statsResult.status === 'success') {
  const health = statsResult.data.vectorSearchHealth;

  console.log(`Vector search enabled: ${health.enabled}`);
  console.log(`Embedding coverage: ${health.coveragePercentage}%`);
  console.log(`Recommendation: ${health.recommendation}`);
}
```

### 2. Adjust Search Threshold

```typescript
// More relaxed threshold for broader semantic matching
const results = await memoryCore.searchMemories('artificial intelligence', {
  threshold: 0.5,  // Lower = more results
  limit: 20
});

// Stricter threshold for precise matches
const results = await memoryCore.searchMemories('artificial intelligence', {
  threshold: 0.8,  // Higher = fewer, more precise results
  limit: 10
});
```

### 3. Enable Debug Logging

```bash
# In terminal
export MCP_DEBUG=1

# Or in .env file
MCP_DEBUG=1
```

### 4. Update Missing Embeddings

```typescript
// Check coverage
const stats = await memoryCore.getStatistics(userId);
console.log(`Coverage: ${stats.data.embeddingCoverage}`);

// Update if needed
if (stats.data.vectorSearchHealth.coveragePercentage < 90) {
  const updateResult = await memoryCore.updateMissingEmbeddings();
  console.log(updateResult.message);
}
```

---

## Recommendations

### For Users

1. **Check statistics regularly** to monitor embedding coverage
2. **Enable debug mode** if search results seem unexpected
3. **Adjust threshold** based on your needs (0.5-0.7 recommended)
4. **Run embedding updates** when adding many new memories

### For Developers

1. **Monitor vector search health** in production metrics
2. **Log search method usage** (semantic vs text search ratios)
3. **Consider A/B testing** different threshold values
4. **Add similarity scores** to UI for transparency

### Future Enhancements

1. **Hybrid scoring**: Combine semantic similarity with recency and importance
2. **Query expansion**: Use synonyms and related terms automatically
3. **Result explanations**: Show why each result matched
4. **Semantic clustering**: Group similar memories
5. **Caching**: Cache query embeddings for common searches

---

## Conclusion

**Vector embeddings are working as designed.** The investigation revealed:

✅ **Correct Implementation:**
- Embeddings generated with OpenAI
- Cosine similarity calculated properly
- Vector search happens before text search
- Results sorted by semantic similarity

⚠️ **Perceived Issues:**
- High threshold (0.7) filtered borderline matches
- Silent fallback masked failures
- No visibility into search method used

✅ **Fixes Applied:**
- Lower default threshold (0.6)
- Enhanced result messages
- Vector search health monitoring
- Debug logging

**Next Steps:**
1. Run `npx tsx scripts/test-semantic-search.ts` to see it in action
2. Review `/Users/masa/Projects/managed/mcp-memory-ts/docs/SEMANTIC-SEARCH-ANALYSIS.md` for details
3. Enable `MCP_DEBUG=1` in production to monitor behavior
4. Check statistics regularly to ensure healthy embedding coverage

---

## Files Modified

1. `/Users/masa/Projects/managed/mcp-memory-ts/src/core/memory-core.ts`
   - Lowered default threshold to 0.6
   - Enhanced search result messages
   - Added vector search health to statistics
   - Added debug logging

## Files Created

1. `/Users/masa/Projects/managed/mcp-memory-ts/tests/semantic-search-verification.test.ts`
   - Comprehensive test suite for semantic search

2. `/Users/masa/Projects/managed/mcp-memory-ts/scripts/test-semantic-search.ts`
   - Manual test script for demonstration

3. `/Users/masa/Projects/managed/mcp-memory-ts/docs/SEMANTIC-SEARCH-ANALYSIS.md`
   - Detailed technical analysis

4. `/Users/masa/Projects/managed/mcp-memory-ts/SEMANTIC-SEARCH-FINDINGS.md`
   - This summary document

---

**Investigation completed by Claude Code on 2025-10-01**
