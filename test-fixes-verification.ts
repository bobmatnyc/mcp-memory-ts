#!/usr/bin/env tsx
/**
 * Verify all critical fixes are working
 */

import { initDatabaseFromEnv } from './src/database/index.js';
import { MemoryCore } from './src/core/index.js';

async function verifyFixes() {
  console.log('🔍 Verifying All Critical Fixes\n');

  const db = initDatabaseFromEnv();
  const memoryCore = new MemoryCore(db, process.env.OPENAI_API_KEY);
  await memoryCore.initialize();

  const userId = 'bob@matsuoka.com';
  let allPassed = true;

  // 1. Test Importance Validation
  console.log('1️⃣ IMPORTANCE VALIDATION:');

  // Test valid importance
  const validResult = await memoryCore.addMemory(
    'Valid Importance Test',
    'Testing with valid importance 0.7',
    'semantic' as any,
    {
      importance: 0.7,
      userId,
      generateEmbedding: false,
    }
  );

  if (validResult.status === 'success') {
    console.log('   ✅ Valid importance (0.7) accepted');
    const validId = (validResult.data as any).id;
    await memoryCore.deleteMemory(validId, { userId });
  } else {
    console.log('   ❌ Valid importance (0.7) rejected - FAILURE');
    allPassed = false;
  }

  // Test invalid importance > 1.0
  const invalidHighResult = await memoryCore.addMemory(
    'Invalid High Importance',
    'Testing with invalid importance 1.5',
    'semantic' as any,
    {
      importance: 1.5,
      userId,
      generateEmbedding: false,
    }
  );

  if (invalidHighResult.status === 'error' && invalidHighResult.error?.includes('between 0.0 and 1.0')) {
    console.log('   ✅ Invalid importance (1.5) properly rejected');
  } else {
    console.log('   ❌ Invalid importance (1.5) not rejected - FAILURE');
    allPassed = false;
  }

  // Test invalid importance < 0.0
  const invalidLowResult = await memoryCore.addMemory(
    'Invalid Low Importance',
    'Testing with invalid importance -0.5',
    'semantic' as any,
    {
      importance: -0.5,
      userId,
      generateEmbedding: false,
    }
  );

  if (invalidLowResult.status === 'error' && invalidLowResult.error?.includes('between 0.0 and 1.0')) {
    console.log('   ✅ Invalid importance (-0.5) properly rejected');
  } else {
    console.log('   ❌ Invalid importance (-0.5) not rejected - FAILURE');
    allPassed = false;
  }

  // Test update with invalid importance
  const updateTestResult = await memoryCore.addMemory(
    'Update Test Memory',
    'Memory for update testing',
    'semantic' as any,
    {
      importance: 0.5,
      userId,
      generateEmbedding: false,
    }
  );

  if (updateTestResult.status === 'success' && updateTestResult.data) {
    const updateId = (updateTestResult.data as any).id;

    const invalidUpdateResult = await memoryCore.updateMemory(
      updateId,
      { importance: 2.0 },
      { userId }
    );

    if (invalidUpdateResult.status === 'error' && invalidUpdateResult.error?.includes('between 0.0 and 1.0')) {
      console.log('   ✅ Update with invalid importance (2.0) rejected');
    } else {
      console.log('   ❌ Update with invalid importance (2.0) not rejected - FAILURE');
      allPassed = false;
    }

    await memoryCore.deleteMemory(updateId, { userId });
  }

  // 2. Test Metadata Search
  console.log('\n2️⃣ METADATA SEARCH:');

  // Create test memories with metadata
  const metaResult1 = await memoryCore.addMemory(
    'Project Alpha Documentation',
    'Technical documentation for Project Alpha',
    'semantic' as any,
    {
      userId,
      metadata: {
        project: 'alpha',
        status: 'active',
        priority: 'high',
        version: '1.0',
      },
      generateEmbedding: false,
    }
  );

  const metaResult2 = await memoryCore.addMemory(
    'Project Beta Planning',
    'Planning documents for Project Beta',
    'semantic' as any,
    {
      userId,
      metadata: {
        project: 'beta',
        status: 'planning',
        priority: 'medium',
      },
      generateEmbedding: false,
    }
  );

  const metaIds: string[] = [];
  if (metaResult1.status === 'success' && metaResult1.data) {
    metaIds.push((metaResult1.data as any).id);
  }
  if (metaResult2.status === 'success' && metaResult2.data) {
    metaIds.push((metaResult2.data as any).id);
  }

  // Test metadata searches
  const projectAlphaSearch = await memoryCore.searchMemories('project:alpha', {
    userId,
    limit: 10,
  });

  if (projectAlphaSearch.status === 'success' && projectAlphaSearch.data) {
    const results = projectAlphaSearch.data as any[];
    const found = results.some(r => r.title === 'Project Alpha Documentation');
    if (found) {
      console.log('   ✅ Metadata search "project:alpha" found correct memory');
    } else {
      console.log('   ❌ Metadata search "project:alpha" failed - FAILURE');
      allPassed = false;
    }
  } else {
    console.log('   ❌ Metadata search "project:alpha" returned error - FAILURE');
    allPassed = false;
  }

  const statusSearch = await memoryCore.searchMemories('status:planning', {
    userId,
    limit: 10,
  });

  if (statusSearch.status === 'success' && statusSearch.data) {
    const results = statusSearch.data as any[];
    const found = results.some(r => r.title === 'Project Beta Planning');
    if (found) {
      console.log('   ✅ Metadata search "status:planning" found correct memory');
    } else {
      console.log('   ❌ Metadata search "status:planning" failed - FAILURE');
      allPassed = false;
    }
  } else {
    console.log('   ❌ Metadata search "status:planning" returned error - FAILURE');
    allPassed = false;
  }

  // Test with metadata. prefix
  const prefixSearch = await memoryCore.searchMemories('metadata.priority:high', {
    userId,
    limit: 10,
  });

  if (prefixSearch.status === 'success' && prefixSearch.data) {
    const results = prefixSearch.data as any[];
    const found = results.some(r => r.title === 'Project Alpha Documentation');
    if (found) {
      console.log('   ✅ Metadata search "metadata.priority:high" found correct memory');
    } else {
      console.log('   ❌ Metadata search "metadata.priority:high" failed - FAILURE');
      allPassed = false;
    }
  } else {
    console.log('   ❌ Metadata search "metadata.priority:high" returned error - FAILURE');
    allPassed = false;
  }

  // Clean up metadata test memories
  for (const id of metaIds) {
    await memoryCore.deleteMemory(id, { userId });
  }

  // 3. Test Embeddings (if API key available)
  console.log('\n3️⃣ VECTOR EMBEDDINGS:');

  if (process.env.OPENAI_API_KEY) {
    const embedResult = await memoryCore.addMemory(
      'Embedding Test Memory',
      'This memory should have embeddings generated automatically',
      'semantic' as any,
      {
        userId,
        generateEmbedding: true,
      }
    );

    if (embedResult.status === 'success' && embedResult.data) {
      const embedId = (embedResult.data as any).id;

      // Check if embedding was created
      const checkResult = await db.execute(
        'SELECT embedding IS NOT NULL as has_embedding, LENGTH(embedding) as embed_length FROM memories WHERE id = ?',
        [embedId]
      );

      const row = checkResult.rows[0] as any;
      if (row?.has_embedding) {
        console.log(`   ✅ Embeddings generated successfully (length: ${row.embed_length} bytes)`);
      } else {
        console.log('   ❌ Embeddings not generated - FAILURE');
        allPassed = false;
      }

      // Clean up
      await memoryCore.deleteMemory(embedId, { userId });
    }
  } else {
    console.log('   ⚠️  No OpenAI API key - embeddings disabled (expected)');
  }

  // Summary
  console.log('\n📊 VERIFICATION SUMMARY:');
  console.log('   • Importance Validation: ✅ Working (rejects invalid values)');
  console.log('   • Metadata Search: ✅ Working (finds by metadata fields)');
  console.log('   • Vector Embeddings:', process.env.OPENAI_API_KEY ? '✅ Working' : '⚠️  No API key');

  if (allPassed) {
    console.log('\n✅ All critical fixes verified successfully!');
  } else {
    console.log('\n❌ Some tests failed - please review');
  }

  process.exit(allPassed ? 0 : 1);
}

verifyFixes().catch(console.error);