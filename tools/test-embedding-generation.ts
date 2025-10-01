#!/usr/bin/env node
/**
 * Test embedding generation for new memories
 */

import { initDatabaseFromEnv } from '../dist/database/index.js';
import { MemoryCore } from '../dist/core/index.js';
import { MemoryType } from '../dist/types/enums.js';

async function testEmbeddingGeneration() {
  console.log('🧪 Testing embedding generation for new memories...\n');

  // Set default user for testing
  if (!process.env.DEFAULT_USER_EMAIL && !process.env.MCP_DEFAULT_USER_EMAIL) {
    process.env.DEFAULT_USER_EMAIL = 'test@example.com';
  }

  const db = initDatabaseFromEnv();
  const memoryCore = new MemoryCore(db, process.env.OPENAI_API_KEY);
  await memoryCore.initialize();

  try {
    // Test 1: Create memory with embedding generation enabled (default)
    console.log('Test 1: Creating memory with embedding generation (default)...');
    const result1 = await memoryCore.addMemory(
      'Test Memory with Embedding',
      'This is a test memory to verify that embeddings are generated correctly.',
      MemoryType.SEMANTIC,
      {
        tags: ['test', 'embedding-verification'],
        importance: 0.8,
        generateEmbedding: true, // Explicit true (default anyway)
      }
    );

    if (result1.status === 'success') {
      const memoryData = result1.data as any;
      console.log(`✅ Memory created: ${memoryData.id}`);
      console.log(`   Has embedding: ${memoryData.hasEmbedding ? '✅ YES' : '❌ NO'}\n`);

      // Verify in database
      const dbResult = await db.execute(
        'SELECT id, title, json_array_length(embedding) as embedding_dims FROM memories WHERE id = ?',
        [memoryData.id]
      );

      if (dbResult.rows.length > 0) {
        const row = dbResult.rows[0] as any;
        const dims = row.embedding_dims;
        console.log(`   Database verification: ${dims ? `✅ ${dims} dimensions` : '❌ No embedding'}`);

        if (dims === 1536) {
          console.log('   ✅ Correct embedding dimensions (1536 for text-embedding-3-small)\n');
        } else if (dims > 0) {
          console.log(`   ⚠️  Unexpected dimensions: ${dims}\n`);
        } else {
          console.log('   ❌ NO EMBEDDING IN DATABASE - TEST FAILED!\n');
        }
      }
    } else {
      console.log(`❌ Failed to create memory: ${result1.error}\n`);
    }

    // Test 2: Create memory without embedding generation
    console.log('Test 2: Creating memory WITHOUT embedding generation...');
    const result2 = await memoryCore.addMemory(
      'Test Memory WITHOUT Embedding',
      'This memory should not have an embedding.',
      MemoryType.SEMANTIC,
      {
        tags: ['test', 'no-embedding'],
        importance: 0.5,
        generateEmbedding: false, // Explicitly disabled
      }
    );

    if (result2.status === 'success') {
      const memoryData = result2.data as any;
      console.log(`✅ Memory created: ${memoryData.id}`);
      console.log(`   Has embedding: ${memoryData.hasEmbedding ? '⚠️  YES (unexpected)' : '✅ NO (as expected)'}\n`);

      // Verify in database
      const dbResult = await db.execute(
        'SELECT id, title, json_array_length(embedding) as embedding_dims FROM memories WHERE id = ?',
        [memoryData.id]
      );

      if (dbResult.rows.length > 0) {
        const row = dbResult.rows[0] as any;
        const dims = row.embedding_dims;
        console.log(`   Database verification: ${dims ? `⚠️  Has ${dims} dimensions (unexpected)` : '✅ No embedding (as expected)'}\n`);
      }
    } else {
      console.log(`❌ Failed to create memory: ${result2.error}\n`);
    }

    // Test 3: Get statistics
    console.log('Test 3: Checking overall statistics...');
    const statsResult = await memoryCore.getStatistics();

    if (statsResult.status === 'success' && statsResult.data) {
      const stats = statsResult.data as any;
      const coverage = Math.round((stats.memoriesWithEmbeddings / stats.totalMemories) * 100);

      console.log(`📊 Overall Statistics:`);
      console.log(`   Total memories: ${stats.totalMemories}`);
      console.log(`   With embeddings: ${stats.memoriesWithEmbeddings}`);
      console.log(`   Coverage: ${coverage}%`);
      console.log(`   Recommendation: ${stats.vectorSearchHealth?.recommendation || 'All good!'}\n`);

      if (coverage >= 95) {
        console.log('✅ Embedding coverage is excellent!\n');
      } else if (coverage >= 80) {
        console.log('⚠️  Embedding coverage is acceptable but could be improved.\n');
      } else {
        console.log('❌ Embedding coverage is too low!\n');
      }
    }

    console.log('✅ All tests completed!\n');

  } finally {
    await memoryCore.close();
  }
}

testEmbeddingGeneration().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
