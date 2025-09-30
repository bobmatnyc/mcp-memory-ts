#!/usr/bin/env tsx
/**
 * Test automatic embedding triggers
 */

import { initDatabaseFromEnv } from './src/database/index.js';
import { MemoryCore } from './src/core/index.js';

async function testEmbeddingTriggers() {
  console.log('🧪 Testing Automatic Embedding Triggers\n');

  // Initialize with OpenAI key from environment
  const db = initDatabaseFromEnv();
  const memoryCore = new MemoryCore(
    db,
    process.env.OPENAI_API_KEY,
    { autoUpdateEmbeddings: true }
  );

  await memoryCore.initialize();

  const userId = 'bob@matsuoka.com';

  console.log('API Key Status:', process.env.OPENAI_API_KEY ? '✅ Configured' : '❌ Missing');

  // Test 1: Create memory and check if embedding is generated
  console.log('\n1️⃣ TEST: Create memory with auto-embedding');

  const testMem = await memoryCore.addMemory(
    'AI Research Paper',
    'Deep learning with transformers for natural language processing',
    'semantic' as any,
    {
      userId,
      tags: ['ai', 'transformers', 'nlp'],
      metadata: { category: 'research' },
      generateEmbedding: false, // Deliberately set to false to test auto-update
    }
  );

  if (testMem.status === 'success' && testMem.data) {
    const memId = (testMem.data as any).id;
    console.log(`   Memory created: ${memId}`);

    // Wait for async embedding update
    console.log('   Waiting for automatic embedding generation...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Check if embedding was created
    const checkResult = await db.execute(
      `SELECT
        embedding IS NOT NULL as has_embedding,
        json_array_length(embedding) as dimensions
      FROM memories
      WHERE id = ?`,
      [memId]
    );

    const row = checkResult.rows[0] as any;
    if (row?.has_embedding && row?.dimensions > 0) {
      console.log(`   ✅ Embedding auto-generated: ${row.dimensions} dimensions`);
    } else {
      console.log('   ❌ Embedding not generated automatically');
    }

    // Test 2: Update memory and check if embedding is regenerated
    console.log('\n2️⃣ TEST: Update memory triggers embedding regeneration');

    const updateResult = await memoryCore.updateMemory(
      memId,
      {
        content: 'Advanced deep learning with transformers and attention mechanisms for NLP tasks',
        tags: ['ai', 'transformers', 'attention', 'deep-learning'],
      },
      { userId }
    );

    if (updateResult.status === 'success') {
      console.log('   Memory updated');

      // Wait for async embedding update
      console.log('   Waiting for embedding regeneration...');
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Get updated memory
      const updatedCheck = await db.execute(
        `SELECT
          embedding IS NOT NULL as has_embedding,
          json_array_length(embedding) as dimensions,
          updated_at
        FROM memories
        WHERE id = ?`,
        [memId]
      );

      const updatedRow = updatedCheck.rows[0] as any;
      console.log(`   ✅ Embedding status: ${updatedRow?.has_embedding ? 'Present' : 'Missing'}`);
      console.log(`   Last updated: ${updatedRow?.updated_at}`);
    }

    // Clean up
    await memoryCore.deleteMemory(memId, { userId });
  }

  // Test 3: Batch update of missing embeddings
  console.log('\n3️⃣ TEST: Manual batch update of missing embeddings');

  // Create memories without embeddings
  const mem1 = await memoryCore.addMemory(
    'Test Memory 1',
    'Content without embedding',
    'semantic' as any,
    { userId, generateEmbedding: false }
  );

  const mem2 = await memoryCore.addMemory(
    'Test Memory 2',
    'Another content without embedding',
    'semantic' as any,
    { userId, generateEmbedding: false }
  );

  const memIds = [];
  if (mem1.status === 'success') memIds.push((mem1.data as any).id);
  if (mem2.status === 'success') memIds.push((mem2.data as any).id);

  console.log(`   Created ${memIds.length} memories without embeddings`);

  // Trigger manual update
  const updateResult = await memoryCore.updateMissingEmbeddings();
  if (updateResult.status === 'success' && updateResult.data) {
    const stats = updateResult.data as any;
    console.log(`   ✅ Batch update completed: ${stats.updated} updated, ${stats.failed} failed`);
  } else {
    console.log(`   ❌ Batch update failed: ${updateResult.error}`);
  }

  // Clean up
  for (const id of memIds) {
    await memoryCore.deleteMemory(id, { userId });
  }

  // Test 4: Statistics
  console.log('\n4️⃣ EMBEDDING STATISTICS:');

  const stats = await memoryCore.getStatistics(userId);
  if (stats.status === 'success' && stats.data) {
    const data = stats.data as any;
    const percentage = data.totalMemories > 0
      ? ((data.memoriesWithEmbeddings / data.totalMemories) * 100).toFixed(1)
      : '0';

    console.log(`   Total memories: ${data.totalMemories}`);
    console.log(`   With embeddings: ${data.memoriesWithEmbeddings}`);
    console.log(`   Coverage: ${percentage}%`);
  }

  console.log('\n✅ Test complete!');

  await db.disconnect();
  process.exit(0);
}

testEmbeddingTriggers().catch(console.error);