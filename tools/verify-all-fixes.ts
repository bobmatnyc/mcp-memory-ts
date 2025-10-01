#!/usr/bin/env tsx
/**
 * Final verification that all fixes are working
 */

import { initDatabaseFromEnv } from './src/database/index.js';
import { MemoryCore } from './src/core/index.js';

async function verifyAllFixes() {
  console.log('🔍 Final Verification of All Fixes\n');

  const db = initDatabaseFromEnv();
  const memoryCore = new MemoryCore(db, process.env.OPENAI_API_KEY);
  await memoryCore.initialize();

  const userId = 'bob@matsuoka.com';

  // 1. Test Metadata Persistence
  console.log('1️⃣ METADATA PERSISTENCE TEST:');

  const testMem = await memoryCore.addMemory(
    'Metadata Persistence Test',
    'Testing if metadata updates persist',
    'semantic' as any,
    {
      userId,
      metadata: { version: '1.0', status: 'draft' },
      tags: ['test', 'metadata'],
      generateEmbedding: false,
    }
  );

  if (testMem.status === 'success' && testMem.data) {
    const memId = (testMem.data as any).id;

    // Update metadata and tags
    const updateResult = await memoryCore.updateMemory(
      memId,
      {
        metadata: { version: '2.0', status: 'published', author: 'test' },
        tags: ['updated', 'verified'],
      },
      { userId }
    );

    if (updateResult.status === 'success') {
      // Verify the update persisted
      const getResult = await memoryCore.getMemory(memId, { userId });

      if (getResult.status === 'success' && getResult.data) {
        const memory = getResult.data as any;

        // Check metadata
        const metadataOk =
          memory.metadata?.version === '2.0' &&
          memory.metadata?.status === 'published' &&
          memory.metadata?.author === 'test';

        // Check tags
        const tagsOk =
          Array.isArray(memory.tags) &&
          memory.tags.includes('updated') &&
          memory.tags.includes('verified');

        console.log(`   Metadata persistence: ${metadataOk ? '✅' : '❌'}`);
        console.log(`   Tags update: ${tagsOk ? '✅' : '❌'}`);

        if (!metadataOk) {
          console.log(`   Current metadata: ${JSON.stringify(memory.metadata)}`);
        }
        if (!tagsOk) {
          console.log(`   Current tags: ${JSON.stringify(memory.tags)}`);
        }
      }
    }

    await memoryCore.deleteMemory(memId, { userId });
  }

  // 2. Test Metadata Search
  console.log('\n2️⃣ METADATA SEARCH TEST:');

  // Create test memories with metadata
  const searchMem1 = await memoryCore.addMemory(
    'Alpha Project',
    'Project Alpha documentation',
    'semantic' as any,
    {
      userId,
      metadata: { project: 'alpha', priority: 'high' },
      generateEmbedding: false,
    }
  );

  const searchMem2 = await memoryCore.addMemory(
    'Beta Project',
    'Project Beta code',
    'semantic' as any,
    {
      userId,
      metadata: { project: 'beta', priority: 'low' },
      generateEmbedding: false,
    }
  );

  const memIds = [];
  if (searchMem1.status === 'success') memIds.push((searchMem1.data as any).id);
  if (searchMem2.status === 'success') memIds.push((searchMem2.data as any).id);

  // Search by metadata
  const searchByProject = await memoryCore.searchMemories('project:alpha', { userId });
  const searchByPriority = await memoryCore.searchMemories('priority:high', { userId });

  const projectSearchOk =
    searchByProject.status === 'success' &&
    (searchByProject.data as any[]).some(m => m.title === 'Alpha Project');

  const prioritySearchOk =
    searchByPriority.status === 'success' &&
    (searchByPriority.data as any[]).some(m => m.title === 'Alpha Project');

  console.log(`   Search by project:alpha: ${projectSearchOk ? '✅' : '❌'}`);
  console.log(`   Search by priority:high: ${prioritySearchOk ? '✅' : '❌'}`);

  // Clean up
  for (const id of memIds) {
    await memoryCore.deleteMemory(id, { userId });
  }

  // 3. Test Vector Embeddings
  console.log('\n3️⃣ VECTOR EMBEDDINGS TEST:');

  if (process.env.OPENAI_API_KEY) {
    const embedMem = await memoryCore.addMemory(
      'Embedding Test',
      'This memory should get an embedding',
      'semantic' as any,
      {
        userId,
        generateEmbedding: true,
      }
    );

    if (embedMem.status === 'success' && embedMem.data) {
      const embedId = (embedMem.data as any).id;

      // Check if embedding was created
      const embedCheck = await db.execute(
        `SELECT
          embedding IS NOT NULL as has_embedding,
          json_array_length(embedding) as dimensions
        FROM memories
        WHERE id = ?`,
        [embedId]
      );

      const row = embedCheck.rows[0] as any;
      const hasEmbedding = row?.has_embedding && row?.dimensions > 0;

      console.log(`   Embedding created: ${hasEmbedding ? '✅' : '❌'}`);
      if (hasEmbedding) {
        console.log(`   Dimensions: ${row.dimensions}`);
      }

      await memoryCore.deleteMemory(embedId, { userId });
    }
  } else {
    console.log('   ⚠️  No OpenAI API key - embeddings disabled');
  }

  // 4. Get overall statistics
  console.log('\n4️⃣ OVERALL STATISTICS:');

  const stats = await memoryCore.getStatistics(userId);
  if (stats.status === 'success' && stats.data) {
    const data = stats.data as any;
    console.log(`   Total memories: ${data.totalMemories}`);
    console.log(`   With embeddings: ${data.memoriesWithEmbeddings}`);
    console.log(`   Embedding coverage: ${
      data.totalMemories > 0
        ? ((data.memoriesWithEmbeddings / data.totalMemories) * 100).toFixed(1)
        : 0
    }%`);
  }

  console.log('\n✅ Verification complete!');

  await db.disconnect();
  process.exit(0);
}

verifyAllFixes().catch(console.error);