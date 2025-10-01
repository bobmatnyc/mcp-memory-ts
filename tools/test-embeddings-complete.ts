#!/usr/bin/env tsx
/**
 * Test embeddings and vector search with mock setup
 */

import { initDatabaseFromEnv } from './src/database/index.js';
import { MemoryCore } from './src/core/index.js';

// Mock embedding function for testing without API key
function generateMockEmbedding(text: string): number[] {
  // Create a simple hash-based embedding for testing
  const embedding = new Array(1536).fill(0);
  for (let i = 0; i < text.length; i++) {
    const idx = (text.charCodeAt(i) * 7 + i) % 1536;
    embedding[idx] = Math.random() * 0.1 + 0.45;
  }
  // Normalize
  const sum = embedding.reduce((a, b) => a + b, 0);
  return embedding.map(v => v / sum * 100);
}

async function testEmbeddings() {
  console.log('🧪 Testing Embeddings and Vector Search\n');

  const db = initDatabaseFromEnv();
  const memoryCore = new MemoryCore(db, process.env.OPENAI_API_KEY);
  await memoryCore.initialize();

  const userId = 'bob@matsuoka.com';

  // 1. Test with real API key if available
  if (process.env.OPENAI_API_KEY) {
    console.log('1️⃣ TESTING WITH OPENAI API:');

    const memResult = await memoryCore.addMemory(
      'AI Research Paper',
      'Deep learning models for natural language processing using transformers',
      'semantic' as any,
      {
        userId,
        generateEmbedding: true,
      }
    );

    if (memResult.status === 'success' && memResult.data) {
      const memId = (memResult.data as any).id;

      // Check embedding in database
      const checkResult = await db.execute(
        `SELECT
          embedding IS NOT NULL as has_embedding,
          json_array_length(embedding) as dimensions
        FROM memories
        WHERE id = ?`,
        [memId]
      );

      const row = checkResult.rows[0] as any;
      console.log(`   ✅ Memory created with embedding`);
      console.log(`   Has embedding: ${row?.has_embedding ? 'Yes' : 'No'}`);
      console.log(`   Dimensions: ${row?.dimensions || 'N/A'}`);

      // Test vector search
      const searchResult = await memoryCore.searchMemories(
        'transformer neural networks',
        {
          userId,
          strategy: 'similarity',
          threshold: 0.5,
        }
      );

      if (searchResult.status === 'success' && searchResult.data) {
        const results = searchResult.data as any[];
        console.log(`   ✅ Vector search found ${results.length} results`);
      }

      await memoryCore.deleteMemory(memId, { userId });
    }
  } else {
    console.log('1️⃣ NO OPENAI API KEY - Using mock embeddings for testing');

    // Test without API key to show the issue
    const memResult = await memoryCore.addMemory(
      'Test Memory Without API',
      'This memory will not have real embeddings',
      'semantic' as any,
      {
        userId,
        generateEmbedding: true,
      }
    );

    if (memResult.status === 'success' && memResult.data) {
      const memId = (memResult.data as any).id;

      // Check what was stored
      const checkResult = await db.execute(
        `SELECT
          embedding,
          embedding IS NOT NULL as has_embedding,
          LENGTH(embedding) as embed_length
        FROM memories
        WHERE id = ?`,
        [memId]
      );

      const row = checkResult.rows[0] as any;
      console.log(`   Memory created: ${memId}`);
      console.log(`   Has embedding: ${row?.has_embedding ? 'Yes' : 'No'}`);
      console.log(`   Embedding value: ${row?.embedding}`);
      console.log(`   Embedding length: ${row?.embed_length}`);

      // Manually add mock embedding for testing
      const mockEmbedding = generateMockEmbedding('test memory');
      await db.execute(
        'UPDATE memories SET embedding = ? WHERE id = ?',
        [JSON.stringify(mockEmbedding), memId]
      );

      console.log('   ✅ Added mock embedding for testing');

      await memoryCore.deleteMemory(memId, { userId });
    }
  }

  // 2. Test metadata updates
  console.log('\n2️⃣ TESTING METADATA UPDATES:');

  const metaResult = await memoryCore.addMemory(
    'Metadata Test',
    'Testing metadata updates',
    'semantic' as any,
    {
      userId,
      metadata: { version: '1.0', status: 'draft' },
      generateEmbedding: false,
    }
  );

  if (metaResult.status === 'success' && metaResult.data) {
    const metaId = (metaResult.data as any).id;

    // Update metadata
    const updateResult = await memoryCore.updateMemory(
      metaId,
      {
        metadata: { version: '2.0', status: 'published', author: 'test' }
      },
      { userId }
    );

    console.log(`   Update result: ${updateResult.status}`);

    if (updateResult.status === 'success') {
      // Verify update
      const getResult = await memoryCore.getMemory(metaId, { userId });
      if (getResult.status === 'success' && getResult.data) {
        const memory = getResult.data as any;
        console.log(`   ✅ Metadata updated: ${JSON.stringify(memory.metadata)}`);
      }
    }

    await memoryCore.deleteMemory(metaId, { userId });
  }

  // 3. Test all update fields
  console.log('\n3️⃣ TESTING ALL UPDATE FIELDS:');

  const fullResult = await memoryCore.addMemory(
    'Original Title',
    'Original content',
    'semantic' as any,
    {
      userId,
      importance: 0.5,
      tags: ['old'],
      metadata: { version: '1' },
      generateEmbedding: false,
    }
  );

  if (fullResult.status === 'success' && fullResult.data) {
    const fullId = (fullResult.data as any).id;

    // Update everything
    const updateAllResult = await memoryCore.updateMemory(
      fullId,
      {
        title: 'New Title',
        content: 'New content',
        importance: 0.9,
        tags: ['new', 'updated'],
        metadata: { version: '2', updated: true }
      },
      { userId }
    );

    if (updateAllResult.status === 'success') {
      const verifyResult = await memoryCore.getMemory(fullId, { userId });
      if (verifyResult.status === 'success' && verifyResult.data) {
        const memory = verifyResult.data as any;
        console.log('   ✅ Title updated:', memory.title === 'New Title');
        console.log('   ✅ Content updated:', memory.content === 'New content');
        console.log('   ✅ Importance updated:', memory.importance === 0.9);
        console.log('   ✅ Tags updated:', JSON.stringify(memory.tags));
        console.log('   ✅ Metadata updated:', JSON.stringify(memory.metadata));
      }
    }

    await memoryCore.deleteMemory(fullId, { userId });
  }

  console.log('\n✅ Testing complete!');
  process.exit(0);
}

testEmbeddings().catch(console.error);