#!/usr/bin/env tsx
/**
 * Diagnose why semantic search isn't working
 */

import { initDatabaseFromEnv } from './src/database/index.js';
import { MemoryCore } from './src/core/index.js';
import { EmbeddingService } from './src/utils/embeddings.js';

async function diagnoseSemanticSearch() {
  console.log('🔍 Diagnosing Semantic Search Issues\n');

  const db = initDatabaseFromEnv();
  const apiKey = process.env.OPENAI_API_KEY;
  const memoryCore = new MemoryCore(db, apiKey);
  const embeddingService = new EmbeddingService(apiKey);

  await memoryCore.initialize();

  const userId = 'bob@matsuoka.com';

  // 1. Check embedding statistics
  console.log('1️⃣ EMBEDDING STATISTICS:');
  const statsResult = await db.execute(`
    SELECT
      COUNT(*) as total,
      COUNT(CASE WHEN embedding IS NOT NULL THEN 1 END) as with_any_embedding,
      COUNT(CASE WHEN embedding IS NOT NULL AND json_array_length(embedding) > 0 THEN 1 END) as with_valid_embedding,
      COUNT(CASE WHEN embedding = '[]' THEN 1 END) as with_empty_embedding
    FROM memories
    WHERE user_id = ?
  `, [userId]);

  const stats = statsResult.rows[0] as any;
  console.log(`   Total memories: ${stats.total}`);
  console.log(`   With embeddings: ${stats.with_valid_embedding} (${((stats.with_valid_embedding / stats.total) * 100).toFixed(1)}%)`);
  console.log(`   Empty embeddings: ${stats.with_empty_embedding}`);

  // 2. Create test memories with embeddings
  console.log('\n2️⃣ CREATING TEST MEMORIES:');

  const testMemories = [
    { title: 'Machine Learning Basics', content: 'Neural networks, deep learning, and artificial intelligence fundamentals' },
    { title: 'Coffee Brewing Guide', content: 'How to make the perfect espresso with proper grinding and extraction' },
    { title: 'AI and Deep Learning', content: 'Advanced neural network architectures and transformer models' },
  ];

  const createdIds = [];
  for (const mem of testMemories) {
    const result = await memoryCore.addMemory(
      mem.title,
      mem.content,
      'semantic' as any,
      {
        userId,
        generateEmbedding: true,
      }
    );

    if (result.status === 'success' && result.data) {
      const id = (result.data as any).id;
      createdIds.push(id);
      console.log(`   ✅ Created: ${mem.title}`);
    }
  }

  // Wait for embeddings
  await new Promise(resolve => setTimeout(resolve, 2000));

  // 3. Test semantic search
  console.log('\n3️⃣ TESTING SEMANTIC SEARCH:');

  const queries = [
    'artificial intelligence and machine learning',
    'neural networks',
    'coffee espresso',
    'transformer models'
  ];

  for (const query of queries) {
    console.log(`\n   Query: "${query}"`);

    // Try different strategies
    const strategies = ['similarity', 'composite'];

    for (const strategy of strategies) {
      const searchResult = await memoryCore.searchMemories(query, {
        userId,
        strategy: strategy as any,
        limit: 3,
        threshold: 0.3,
      });

      if (searchResult.status === 'success' && searchResult.data) {
        const results = searchResult.data as any[];
        console.log(`   Strategy ${strategy}: Found ${results.length} results`);
        results.forEach((r, i) => {
          console.log(`     ${i + 1}. ${r.title}`);
        });
      } else {
        console.log(`   Strategy ${strategy}: Failed - ${searchResult.error}`);
      }
    }
  }

  // 4. Check if embeddings are being used
  console.log('\n4️⃣ CHECKING EMBEDDING USAGE:');

  // Generate embedding for test query
  const testQuery = 'artificial intelligence';
  const queryEmbedding = await embeddingService.generateEmbedding(testQuery);
  console.log(`   Query embedding generated: ${queryEmbedding.length} dimensions`);

  // Get a memory with embedding
  const memWithEmbedding = await db.execute(`
    SELECT id, title, embedding
    FROM memories
    WHERE user_id = ?
      AND embedding IS NOT NULL
      AND json_array_length(embedding) > 0
    LIMIT 1
  `, [userId]);

  if (memWithEmbedding.rows.length > 0) {
    const row = memWithEmbedding.rows[0] as any;
    const memEmbedding = JSON.parse(row.embedding);

    // Calculate cosine similarity manually
    const similarity = EmbeddingService.cosineSimilarity(queryEmbedding, memEmbedding);
    console.log(`   Manual similarity calculation: ${similarity.toFixed(4)}`);
    console.log(`   Memory: ${row.title}`);
  }

  // 5. Check metadata search
  console.log('\n5️⃣ TESTING METADATA SEARCH:');

  // Create memory with metadata
  const metaResult = await memoryCore.addMemory(
    'Test Metadata Memory',
    'Testing metadata search functionality',
    'semantic' as any,
    {
      userId,
      metadata: {
        projectId: 'alpha',
        userId: 'user789',
        category: 'test',
        priority: 'high'
      },
      generateEmbedding: false,
    }
  );

  if (metaResult.status === 'success' && metaResult.data) {
    createdIds.push((metaResult.data as any).id);

    // Test different metadata queries
    const metaQueries = [
      'metadata.projectId:alpha',
      'metadata.userId:user789',
      'projectId:alpha',
      'userId:user789',
      'category:test',
      'metadata.category:test',
    ];

    for (const query of metaQueries) {
      const result = await memoryCore.searchMemories(query, { userId });
      const found = result.status === 'success' && (result.data as any[]).length > 0;
      console.log(`   ${query}: ${found ? '✅ Found' : '❌ Not found'}`);
    }
  }

  // Clean up
  console.log('\n🧹 Cleaning up test data...');
  for (const id of createdIds) {
    await memoryCore.deleteMemory(id, { userId });
  }

  console.log('\n✅ Diagnosis complete!');
  await db.disconnect();
  process.exit(0);
}

diagnoseSemanticSearch().catch(console.error);