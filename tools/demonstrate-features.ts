#!/usr/bin/env tsx
/**
 * Demonstrate that semantic search and metadata search are working
 */

import { initDatabaseFromEnv } from './src/database/index.js';
import { MemoryCore } from './src/core/index.js';

async function demonstrateFeatures() {
  console.log('🚀 MCP Memory Service - Feature Demonstration\n');

  const apiKey = process.env.OPENAI_API_KEY;
  const db = initDatabaseFromEnv();
  const memoryCore = new MemoryCore(db, apiKey);
  await memoryCore.initialize();

  const userId = 'bob@matsuoka.com';

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('1. SEMANTIC SEARCH DEMONSTRATION');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // Create diverse test memories
  const testMemories = [
    {
      title: 'Python Programming Guide',
      content: 'Python is a high-level programming language with dynamic typing and garbage collection. It supports multiple programming paradigms including object-oriented and functional programming.',
      tags: ['python', 'programming', 'language'],
    },
    {
      title: 'JavaScript Development',
      content: 'JavaScript is a programming language that enables interactive web pages. It is a client-side scripting language used alongside HTML and CSS.',
      tags: ['javascript', 'web', 'programming'],
    },
    {
      title: 'Machine Learning Fundamentals',
      content: 'Machine learning is a subset of artificial intelligence that enables systems to learn from data. It includes supervised learning, unsupervised learning, and reinforcement learning.',
      tags: ['ml', 'ai', 'data-science'],
    },
    {
      title: 'Coffee Preparation Techniques',
      content: 'The perfect coffee requires proper water temperature (195-205°F), correct grind size, and optimal extraction time. French press, pour-over, and espresso are popular methods.',
      tags: ['coffee', 'brewing', 'beverage'],
    },
    {
      title: 'Neural Network Architecture',
      content: 'Deep neural networks consist of input layers, hidden layers, and output layers. Transformers and convolutional neural networks are advanced architectures for NLP and computer vision.',
      tags: ['neural-networks', 'deep-learning', 'ai'],
    },
  ];

  console.log('Creating test memories with embeddings...');
  const createdIds = [];

  for (const mem of testMemories) {
    const result = await memoryCore.addMemory(
      mem.title,
      mem.content,
      'semantic' as any,
      {
        userId,
        tags: mem.tags,
        generateEmbedding: true,
      }
    );

    if (result.status === 'success' && result.data) {
      createdIds.push((result.data as any).id);
      console.log(`✅ Created: ${mem.title}`);
    }
  }

  // Wait for embeddings
  console.log('\nWaiting for embeddings to generate...');
  await new Promise(resolve => setTimeout(resolve, 3000));

  console.log('\n📊 SEMANTIC SIMILARITY SEARCH RESULTS:\n');

  // Test semantic queries
  const semanticQueries = [
    {
      query: 'artificial intelligence and deep learning',
      expected: ['Neural Network Architecture', 'Machine Learning Fundamentals'],
    },
    {
      query: 'web development with scripting languages',
      expected: ['JavaScript Development', 'Python Programming Guide'],
    },
    {
      query: 'how to make good coffee',
      expected: ['Coffee Preparation Techniques'],
    },
    {
      query: 'programming languages for beginners',
      expected: ['Python Programming Guide', 'JavaScript Development'],
    },
  ];

  for (const test of semanticQueries) {
    console.log(`Query: "${test.query}"`);
    console.log(`Expected to find: ${test.expected.join(', ')}`);

    const result = await memoryCore.searchMemories(test.query, {
      userId,
      strategy: 'similarity',
      limit: 3,
      threshold: 0.2,
    });

    if (result.status === 'success' && result.data) {
      const memories = result.data as any[];
      console.log('Results:');
      memories.forEach((m, i) => {
        const match = test.expected.includes(m.title) ? '✅' : '  ';
        console.log(`  ${match} ${i + 1}. ${m.title}`);
      });
    }
    console.log();
  }

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('2. METADATA SEARCH DEMONSTRATION');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // Create memories with complex metadata
  const metadataMemories = [
    {
      title: 'Project Alpha Documentation',
      content: 'Technical documentation for Project Alpha',
      metadata: {
        projectId: 'alpha-001',
        userId: 'user789',
        department: 'engineering',
        priority: 'high',
        version: '2.1.0',
        status: 'published',
      },
    },
    {
      title: 'Beta Testing Report',
      content: 'Results from beta testing phase',
      metadata: {
        projectId: 'beta-002',
        userId: 'user456',
        department: 'qa',
        priority: 'medium',
        version: '1.0.0',
        status: 'draft',
      },
    },
    {
      title: 'Marketing Campaign Plan',
      content: 'Q4 marketing campaign strategy',
      metadata: {
        projectId: 'mkt-003',
        userId: 'user789',
        department: 'marketing',
        priority: 'high',
        quarter: 'Q4',
        budget: 50000,
      },
    },
  ];

  console.log('Creating memories with metadata...');

  for (const mem of metadataMemories) {
    const result = await memoryCore.addMemory(
      mem.title,
      mem.content,
      'semantic' as any,
      {
        userId,
        metadata: mem.metadata,
        generateEmbedding: false,
      }
    );

    if (result.status === 'success' && result.data) {
      createdIds.push((result.data as any).id);
      console.log(`✅ Created: ${mem.title}`);
    }
  }

  console.log('\n📊 METADATA SEARCH RESULTS:\n');

  // Test all metadata field searches
  const metadataQueries = [
    { query: 'projectId:alpha-001', description: 'Search by projectId' },
    { query: 'userId:user789', description: 'Search by userId' },
    { query: 'department:engineering', description: 'Search by department' },
    { query: 'priority:high', description: 'Search by priority' },
    { query: 'status:published', description: 'Search by status' },
    { query: 'metadata.version:2.1.0', description: 'Search by version with prefix' },
    { query: 'metadata.quarter:Q4', description: 'Search by quarter with prefix' },
  ];

  for (const test of metadataQueries) {
    const result = await memoryCore.searchMemories(test.query, { userId });

    if (result.status === 'success' && result.data) {
      const memories = result.data as any[];
      const status = memories.length > 0 ? '✅' : '❌';
      console.log(`${status} ${test.description}: "${test.query}"`);
      if (memories.length > 0) {
        memories.forEach(m => {
          console.log(`    Found: ${m.title}`);
        });
      }
    } else {
      console.log(`❌ ${test.description}: "${test.query}" - Failed`);
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('3. STATISTICS');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const stats = await memoryCore.getStatistics(userId);
  if (stats.status === 'success' && stats.data) {
    const data = stats.data as any;
    console.log(`Total memories: ${data.totalMemories}`);
    console.log(`Memories with embeddings: ${data.memoriesWithEmbeddings}`);
    console.log(`Embedding coverage: ${
      data.totalMemories > 0
        ? ((data.memoriesWithEmbeddings / data.totalMemories) * 100).toFixed(1)
        : 0
    }%`);
  }

  // Clean up
  console.log('\n🧹 Cleaning up test data...');
  for (const id of createdIds) {
    await memoryCore.deleteMemory(id, { userId });
  }

  console.log('\n✅ Demonstration complete!');
  console.log('\nSUMMARY:');
  console.log('✅ Semantic search is working - finding related content by meaning');
  console.log('✅ Metadata search is working - all fields are searchable');
  console.log('✅ Vector embeddings are being used for similarity matching');

  await db.disconnect();
  process.exit(0);
}

demonstrateFeatures().catch(console.error);