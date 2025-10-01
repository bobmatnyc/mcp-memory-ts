#!/usr/bin/env tsx
/**
 * Comprehensive diagnostic for all reported issues
 */

import { initDatabaseFromEnv } from './src/database/index.js';
import { MemoryCore } from './src/core/index.js';

async function diagnoseAllIssues() {
  console.log('🔍 Comprehensive Issue Diagnosis\n');

  const db = initDatabaseFromEnv();
  const memoryCore = new MemoryCore(db, process.env.OPENAI_API_KEY);
  await memoryCore.initialize();

  const userId = 'bob@matsuoka.com';

  // 1. Test Metadata Field Updates
  console.log('1️⃣ METADATA FIELD UPDATES:');

  // Create a memory with initial metadata
  const createResult = await memoryCore.addMemory(
    'Metadata Update Test',
    'Testing metadata field updates',
    'semantic' as any,
    {
      userId,
      metadata: {
        project: 'alpha',
        status: 'active',
        version: '1.0'
      },
      generateEmbedding: false,
    }
  );

  if (createResult.status === 'success' && createResult.data) {
    const memId = (createResult.data as any).id;
    console.log(`   ✅ Created memory with metadata: ${memId}`);

    // Try to update metadata
    const updateResult = await memoryCore.updateMemory(
      memId,
      {
        metadata: {
          project: 'alpha',
          status: 'completed',  // Changed
          version: '1.1',       // Changed
          newField: 'test'      // Added
        }
      } as any,
      { userId }
    );

    console.log(`   Update result: ${updateResult.status}`);
    if (updateResult.status === 'error') {
      console.log(`   ❌ Metadata update not supported: ${updateResult.error}`);
    }

    // Check what fields can be updated
    const getResult = await memoryCore.getMemory(memId, { userId });
    if (getResult.status === 'success' && getResult.data) {
      const memory = getResult.data as any;
      console.log('   Current metadata:', JSON.stringify(memory.metadata));
    }

    // Clean up
    await memoryCore.deleteMemory(memId, { userId });
  }

  // 2. Test Metadata-Based Search
  console.log('\n2️⃣ METADATA-BASED SEARCH:');

  // Create test memories
  const mem1 = await memoryCore.addMemory(
    'Project Alpha Doc',
    'Documentation for Alpha',
    'semantic' as any,
    {
      userId,
      metadata: { project: 'alpha', type: 'doc' },
      generateEmbedding: false,
    }
  );

  const mem2 = await memoryCore.addMemory(
    'Project Beta Doc',
    'Documentation for Beta',
    'semantic' as any,
    {
      userId,
      metadata: { project: 'beta', type: 'doc' },
      generateEmbedding: false,
    }
  );

  const memIds = [];
  if (mem1.status === 'success') memIds.push((mem1.data as any).id);
  if (mem2.status === 'success') memIds.push((mem2.data as any).id);

  // Test metadata search
  const searchTests = [
    'project:alpha',
    'type:doc',
    'metadata.project:beta'
  ];

  for (const query of searchTests) {
    const searchResult = await memoryCore.searchMemories(query, { userId });
    console.log(`   Query "${query}": ${searchResult.status}`);
    if (searchResult.status === 'success' && searchResult.data) {
      const results = searchResult.data as any[];
      console.log(`     Found ${results.length} results`);
      if (results.length > 0) {
        console.log(`     First result: ${results[0].title}`);
      }
    } else if (searchResult.status === 'error') {
      console.log(`     Error: ${searchResult.error}`);
    }
  }

  // Clean up
  for (const id of memIds) {
    await memoryCore.deleteMemory(id, { userId });
  }

  // 3. Test Semantic Similarity Search
  console.log('\n3️⃣ SEMANTIC SIMILARITY SEARCH:');

  // Create memories for similarity search
  const sim1 = await memoryCore.addMemory(
    'Machine Learning Basics',
    'Introduction to neural networks and deep learning concepts',
    'semantic' as any,
    {
      userId,
      generateEmbedding: true,  // Request embedding
    }
  );

  const sim2 = await memoryCore.addMemory(
    'AI and Neural Networks',
    'Deep learning with neural network architectures',
    'semantic' as any,
    {
      userId,
      generateEmbedding: true,  // Request embedding
    }
  );

  const sim3 = await memoryCore.addMemory(
    'Coffee Brewing Guide',
    'How to make the perfect cup of coffee',
    'semantic' as any,
    {
      userId,
      generateEmbedding: true,  // Request embedding
    }
  );

  const simIds = [];
  if (sim1.status === 'success') simIds.push((sim1.data as any).id);
  if (sim2.status === 'success') simIds.push((sim2.data as any).id);
  if (sim3.status === 'success') simIds.push((sim3.data as any).id);

  // Search for similar content
  const similaritySearch = await memoryCore.searchMemories(
    'artificial intelligence and machine learning',
    {
      userId,
      strategy: 'similarity',
      threshold: 0.5,
    }
  );

  console.log(`   Similarity search status: ${similaritySearch.status}`);
  if (similaritySearch.status === 'success' && similaritySearch.data) {
    const results = similaritySearch.data as any[];
    console.log(`   Found ${results.length} similar memories`);
    results.forEach((r, i) => {
      console.log(`     ${i + 1}. ${r.title}`);
    });
  }

  // Clean up
  for (const id of simIds) {
    await memoryCore.deleteMemory(id, { userId });
  }

  // 4. Test Vector Embedding Generation
  console.log('\n4️⃣ VECTOR EMBEDDING GENERATION:');
  console.log(`   OpenAI API Key: ${process.env.OPENAI_API_KEY ? '✅ Present' : '❌ Missing'}`);

  if (process.env.OPENAI_API_KEY) {
    const embedTest = await memoryCore.addMemory(
      'Embedding Test Memory',
      'This should generate an embedding vector',
      'semantic' as any,
      {
        userId,
        generateEmbedding: true,
      }
    );

    if (embedTest.status === 'success' && embedTest.data) {
      const embedId = (embedTest.data as any).id;

      // Check database directly for embedding
      const embedCheck = await db.execute(
        `SELECT
          id,
          embedding IS NOT NULL as has_embedding,
          LENGTH(embedding) as embed_length,
          json_array_length(embedding) as array_length
        FROM memories
        WHERE id = ?`,
        [embedId]
      );

      const row = embedCheck.rows[0] as any;
      console.log(`   Memory created: ${embedId}`);
      console.log(`   Has embedding: ${row?.has_embedding ? '✅' : '❌'}`);
      if (row?.has_embedding) {
        console.log(`   Embedding size: ${row.embed_length} bytes`);
        console.log(`   Vector dimensions: ${row.array_length || 'N/A'}`);
      }

      // Test if vector search works
      const vectorSearch = await memoryCore.searchMemories(
        'test embedding',
        { userId, strategy: 'similarity' }
      );
      console.log(`   Vector search works: ${vectorSearch.status === 'success' ? '✅' : '❌'}`);

      // Clean up
      await memoryCore.deleteMemory(embedId, { userId });
    }
  } else {
    console.log('   ⚠️  Cannot test - no API key configured');
  }

  // 5. Check updateMemory method signature
  console.log('\n5️⃣ UPDATE METHOD CAPABILITIES:');
  console.log('   Checking updateMemory method...');

  // Check the actual method implementation
  const testMem = await memoryCore.addMemory(
    'Update Test',
    'Testing update capabilities',
    'semantic' as any,
    { userId, generateEmbedding: false }
  );

  if (testMem.status === 'success' && testMem.data) {
    const testId = (testMem.data as any).id;

    // Test what can be updated
    const updates = [
      { field: 'title', value: 'New Title' },
      { field: 'content', value: 'New Content' },
      { field: 'importance', value: 0.9 },
      { field: 'tags', value: ['test', 'update'] },
      { field: 'metadata', value: { key: 'value' } }
    ];

    for (const update of updates) {
      const updateObj = { [update.field]: update.value };
      const result = await memoryCore.updateMemory(testId, updateObj as any, { userId });
      console.log(`   Update ${update.field}: ${result.status === 'success' ? '✅ Supported' : '❌ Not supported'}`);
    }

    await memoryCore.deleteMemory(testId, { userId });
  }

  console.log('\n📊 DIAGNOSIS SUMMARY:');
  console.log('   Issues found that need fixing:');
  console.log('   - Metadata field updates not in updateMemory signature');
  console.log('   - Metadata search may have SQL syntax issues');
  console.log('   - Vector embeddings depend on OpenAI API key');
  console.log('   - Similarity search requires valid embeddings');

  process.exit(0);
}

diagnoseAllIssues().catch(console.error);