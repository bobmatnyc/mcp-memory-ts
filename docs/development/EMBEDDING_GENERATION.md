# Embedding Generation System

## Overview

The MCP Memory TypeScript project uses OpenAI's `text-embedding-3-small` model to generate 1536-dimensional vector embeddings for semantic search capabilities. This document explains how embeddings are generated, stored, and maintained.

## Current Status

✅ **Embedding generation is working correctly**
- All new memories automatically receive embeddings
- Current coverage: 99-100% (as of 2025-10-01)
- Automatic retry system for failed generations
- Monitoring and health check tools available

## How It Works

### 1. Automatic Embedding Generation

When a new memory is created via `addMemory()`, the system:

1. **Generates embedding text** from memory content:
   - Title
   - Content
   - Memory type
   - Tags (if present)

2. **Calls OpenAI API** to generate 1536-dimensional embedding vector

3. **Stores embedding** in database alongside memory data

4. **Queues for retry** if generation fails (with EmbeddingUpdater service)

### 2. Code Flow

```typescript
// src/core/memory-core.ts - addMemory()
if (options.generateEmbedding !== false) {  // Default: true
  const embeddingText = EmbeddingService.createMemoryEmbeddingText({
    title, content, tags, memoryType
  });

  const embedding = await this.embeddings.generateEmbedding(embeddingText);

  if (embedding && embedding.length > 0) {
    // Store with memory
  } else {
    // Queue for retry via EmbeddingUpdater
  }
}
```

### 3. Embedding Update Service

The `EmbeddingUpdater` service provides automatic retry and backfill capabilities:

- **Automatic queueing**: Failed embeddings are automatically queued for retry
- **Batch processing**: Processes multiple embeddings efficiently
- **Rate limiting**: Respects OpenAI API rate limits
- **Monitoring**: Optional periodic check for missing embeddings

```typescript
// Automatic retry when embedding fails
if (this.embeddingUpdater && (!embedding || embedding.length === 0)) {
  this.embeddingUpdater.queueMemoryUpdate(savedMemory.id);
}
```

### 4. Content Updates

When memory content changes, embeddings are automatically regenerated:

```typescript
// src/core/memory-core.ts - updateMemory()
if (this.embeddingUpdater && (updates.content || updates.title || updates.tags)) {
  this.embeddingUpdater.queueMemoryUpdate(memoryId);
}
```

## Configuration

### Required Environment Variables

```bash
# OpenAI API Key (required for embeddings)
OPENAI_API_KEY=sk-proj-...

# Optional: Enable embedding monitor
ENABLE_EMBEDDING_MONITOR=true
EMBEDDING_MONITOR_INTERVAL=60000  # Check every 60 seconds
```

### Disabling Auto-Update

```typescript
const memoryCore = new MemoryCore(db, openaiApiKey, {
  autoUpdateEmbeddings: false  // Disable automatic embedding updates
});
```

## MCP Tools

### 1. Store Memory (with embeddings)

```json
{
  "name": "store_memory",
  "arguments": {
    "content": "Important information",
    "type": "semantic",
    "importance": 0.8
  }
}
```

**Response includes embedding status:**
```
✅ Memory stored successfully ✅ with embedding!
```

### 2. Get Memory Stats

```json
{
  "name": "get_memory_stats"
}
```

**Response shows embedding coverage:**
```
📊 Memory Statistics:
• Total Memories: 153
• Vector Embeddings: ✅ 153/153 (100%)
```

### 3. Update Missing Embeddings (NEW)

Manually trigger embedding generation for all memories without embeddings:

```json
{
  "name": "update_missing_embeddings"
}
```

**Response:**
```
✅ Embedding update completed!
• Updated: 5
• Failed: 0
• Total processed: 5
```

## Diagnostics & Testing

### Run Diagnostic Script

Check embedding status for all memories:

```bash
npx tsx tools/diagnose-embeddings.ts
```

**Output:**
```
🔍 Diagnosing embedding generation...

📊 Total memories: 153
✅ Memories with embeddings: 153
❌ Memories without embeddings: 0

📝 Recent memories (last 10):
✅ 1. [2025-10-01T13:48:14.613Z] Memory
   Embedding: HAS_EMBEDDING (1536d)
...

🔑 OpenAI API Key: ✅ Present
📈 Embedding coverage: 100%
```

### Run Embedding Generation Test

Test new memory creation with embeddings:

```bash
npx tsx tools/test-embedding-generation.ts
```

**Output:**
```
🧪 Testing embedding generation for new memories...

Test 1: Creating memory with embedding generation (default)...
[EmbeddingService] ✅ Successfully generated embedding with 1536 dimensions
✅ Memory created with embedding

Test 2: Creating memory WITHOUT embedding generation...
✅ Memory created without embedding (as expected)

📊 Overall Statistics:
   Coverage: 99%
✅ Embedding coverage is excellent!
```

## Logging & Monitoring

### Console Logging

The system provides detailed console logging for embedding operations:

```
[EmbeddingService] 🔄 Generating embedding for text (147 chars)...
[EmbeddingService] ✅ Successfully generated embedding with 1536 dimensions
[MemoryCore] ✅ Generated embedding with 1536 dimensions for memory "Title"
```

### Error Messages

When embeddings fail:

```
[EmbeddingService] ❌ Failed to generate embedding: <error>
[EmbeddingService] 🔑 API Key issue - check OPENAI_API_KEY environment variable
[MemoryCore] 🔄 Queuing memory <id> for embedding update (no embedding)
```

### Warning Messages

```
[MemoryCore] ⚠️ Memory <id> saved without embedding and no updater available
[EmbeddingService] ⚠️ Empty embedding returned - will queue for retry
```

## Troubleshooting

### Issue: New memories don't have embeddings

**Check:**
1. OpenAI API key is set: `echo $OPENAI_API_KEY`
2. API key is valid (not expired)
3. Check logs for error messages
4. Run diagnostic: `npx tsx tools/diagnose-embeddings.ts`

**Fix:**
```bash
# Regenerate missing embeddings
npx tsx tools/regenerate-embeddings.ts

# Or via MCP tool
{
  "name": "update_missing_embeddings"
}
```

### Issue: Low embedding coverage (<90%)

**Diagnosis:**
```bash
npx tsx tools/diagnose-embeddings.ts
```

**Fix:**
1. Check OpenAI API key validity
2. Run embedding update:
   ```bash
   npx tsx tools/regenerate-embeddings.ts
   ```
3. Monitor logs for rate limiting or API errors

### Issue: Embedding generation is slow

**Causes:**
- OpenAI API rate limits
- Network latency
- Large batch processing

**Solutions:**
1. Adjust batch size in EmbeddingUpdater
2. Increase retry delay
3. Enable monitoring with longer intervals

## Performance Considerations

### OpenAI API Limits

- **Rate limits**: 3,000 RPM, 1,000,000 TPM (tokens per minute)
- **Costs**: ~$0.02 per 1M tokens
- **Batch processing**: Uses batches of 10 by default

### Optimization Tips

1. **Batch operations**: Use `generateEmbeddingsBatch()` for multiple memories
2. **Cache embeddings**: Embeddings are stored permanently in database
3. **Rate limiting**: Built-in delays between API calls
4. **Retry logic**: Automatic retries with exponential backoff

## Architecture

```
┌─────────────────────────────────────────────────┐
│              Memory Creation Flow               │
└─────────────────────────────────────────────────┘

User creates memory
       ↓
┌──────────────────┐
│  memory-core.ts  │ → Create embedding text
│   addMemory()    │ → Call EmbeddingService
└──────────────────┘
       ↓
┌──────────────────┐
│ embeddings.ts    │ → Call OpenAI API
│ generateEmbed()  │ → Validate response (1536d)
└──────────────────┘
       ↓
Success? ──Yes──→ Store in database
       │
       No
       ↓
┌──────────────────┐
│embedding-updater │ → Queue for retry
│  queueUpdate()   │ → Background processing
└──────────────────┘
```

## Future Improvements

1. **Custom embedding models**: Support for alternative models
2. **Embedding caching**: In-memory cache for frequently accessed embeddings
3. **Advanced search**: Hybrid search combining vector + text
4. **Embedding analytics**: Track embedding quality and performance
5. **Batch optimization**: Smarter batching strategies

## References

- OpenAI Embeddings API: https://platform.openai.com/docs/guides/embeddings
- Model: `text-embedding-3-small` (1536 dimensions)
- Similarity metric: Cosine similarity
- Storage: JSON array in LibSQL/Turso database
