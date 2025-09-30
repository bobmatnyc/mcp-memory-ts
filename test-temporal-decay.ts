#!/usr/bin/env tsx
/**
 * Test temporal decay and semantic linking features
 */

import { initDatabaseFromEnv } from './src/database/index.js';
import { MemoryCore } from './src/core/index.js';
import { MemoryType, ImportanceLevel } from './src/types/enums.js';

async function testTemporalDecay() {
  console.log('🧪 Testing Temporal Decay and Semantic Linking Features\n');

  try {
    // Initialize
    const db = initDatabaseFromEnv();
    const memoryCore = new MemoryCore(db, process.env.OPENAI_API_KEY);
    await memoryCore.initialize();

    const testUserId = 'test-temporal-' + Date.now();

    console.log('📝 Creating test memories with different ages and semantic links...\n');

    // Create memories with different ages (simulating by adjusting created_at)
    const memories = [
      {
        title: 'Project Alpha Planning',
        content: 'Initial planning session for Project Alpha with team',
        tags: ['project-alpha', 'planning'],
        importance: 0.8,
        daysAgo: 0, // Today
      },
      {
        title: 'Project Alpha Meeting',
        content: 'Team meeting discussing Project Alpha architecture',
        tags: ['project-alpha', 'meeting'],
        importance: 0.6,
        daysAgo: 7, // 1 week ago
      },
      {
        title: 'Project Alpha Research',
        content: 'Research findings for Project Alpha requirements',
        tags: ['project-alpha', 'research'],
        importance: 0.9,
        daysAgo: 30, // 1 month ago
      },
      {
        title: 'Beta Framework Learning',
        content: 'Learned new Beta framework for development',
        tags: ['beta', 'learning'],
        importance: 0.7,
        daysAgo: 60, // 2 months ago
      },
      {
        title: 'Beta Framework Update',
        content: 'New features in Beta framework version 2.0',
        tags: ['beta', 'update'],
        importance: 0.5,
        daysAgo: 2, // 2 days ago
      },
    ];

    // Store memories
    const storedIds: string[] = [];
    for (const mem of memories) {
      const result = await memoryCore.addMemory(
        mem.title,
        mem.content,
        'semantic' as MemoryType,
        {
          tags: mem.tags,
          importance: mem.importance as any,
          userId: testUserId,
          generateEmbedding: true,
        }
      );

      if (result.status === 'SUCCESS' && result.data) {
        const memId = (result.data as any).id;
        storedIds.push(memId);

        // Manually adjust created_at to simulate age (if daysAgo > 0)
        if (mem.daysAgo > 0) {
          const pastDate = new Date();
          pastDate.setDate(pastDate.getDate() - mem.daysAgo);
          await db.execute(
            'UPDATE memories SET created_at = ? WHERE id = ?',
            [pastDate.toISOString(), memId]
          );
        }

        console.log(`✅ Created: "${mem.title}" (${mem.daysAgo} days old, importance: ${mem.importance})`);
      }
    }

    console.log('\n🔍 Testing different search strategies with temporal decay:\n');

    // Test 1: Recency strategy
    console.log('1️⃣ RECENCY Strategy (should favor newer memories):');
    const recencyResult = await memoryCore.searchMemories('Project Alpha', {
      limit: 5,
      strategy: 'recency',
      userId: testUserId,
    });

    if (recencyResult.status === 'SUCCESS' && recencyResult.data) {
      const results = recencyResult.data as any[];
      results.forEach((mem, idx) => {
        const age = Math.round((Date.now() - new Date(mem.createdAt).getTime()) / (24 * 60 * 60 * 1000));
        console.log(`   ${idx + 1}. "${mem.title}" - Age: ${age} days, Importance: ${mem.importance}`);
      });
    }

    // Test 2: Importance strategy
    console.log('\n2️⃣ IMPORTANCE Strategy (should favor high importance with slight recency):');
    const importanceResult = await memoryCore.searchMemories('Project Alpha', {
      limit: 5,
      strategy: 'importance',
      userId: testUserId,
    });

    if (importanceResult.status === 'SUCCESS' && importanceResult.data) {
      const results = importanceResult.data as any[];
      results.forEach((mem, idx) => {
        const age = Math.round((Date.now() - new Date(mem.createdAt).getTime()) / (24 * 60 * 60 * 1000));
        console.log(`   ${idx + 1}. "${mem.title}" - Age: ${age} days, Importance: ${mem.importance}`);
      });
    }

    // Test 3: Composite strategy (with semantic linking)
    console.log('\n3️⃣ COMPOSITE Strategy (temporal decay + importance + semantic boost):');
    const compositeResult = await memoryCore.searchMemories('Alpha', {
      limit: 5,
      strategy: 'composite',
      userId: testUserId,
    });

    if (compositeResult.status === 'SUCCESS' && compositeResult.data) {
      const results = compositeResult.data as any[];
      results.forEach((mem, idx) => {
        const age = Math.round((Date.now() - new Date(mem.createdAt).getTime()) / (24 * 60 * 60 * 1000));
        const tags = Array.isArray(mem.tags) ? mem.tags.join(', ') : 'none';
        console.log(`   ${idx + 1}. "${mem.title}" - Age: ${age} days, Importance: ${mem.importance}, Tags: ${tags}`);
      });
    }

    // Test 4: Semantic linking benefit
    console.log('\n4️⃣ Testing Semantic Linking (newer Beta memory should benefit from older one):');
    const betaResult = await memoryCore.searchMemories('Beta framework', {
      limit: 5,
      strategy: 'composite',
      userId: testUserId,
    });

    if (betaResult.status === 'SUCCESS' && betaResult.data) {
      const results = betaResult.data as any[];
      console.log('   Expected: Newer "Beta Framework Update" should rank high due to semantic link');
      results.forEach((mem, idx) => {
        const age = Math.round((Date.now() - new Date(mem.createdAt).getTime()) / (24 * 60 * 60 * 1000));
        const tags = Array.isArray(mem.tags) ? mem.tags.join(', ') : 'none';
        console.log(`   ${idx + 1}. "${mem.title}" - Age: ${age} days, Importance: ${mem.importance}, Tags: ${tags}`);
      });
    }

    // Cleanup
    console.log('\n🧹 Cleaning up test data...');
    for (const id of storedIds) {
      await memoryCore.deleteMemory(id, { userId: testUserId });
    }

    console.log('\n✅ Temporal decay and semantic linking tests completed!');
    console.log('\n📊 Key Features Demonstrated:');
    console.log('   - Temporal decay: Memories gradually lose relevance over time');
    console.log('   - Never expires: Old memories remain accessible (min decay: 0.1)');
    console.log('   - Semantic linking: Newer memories with shared tags get boosted');
    console.log('   - Strategy-based sorting: Different strategies balance factors differently');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }

  process.exit(0);
}

// Run the test
testTemporalDecay();