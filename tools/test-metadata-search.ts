#!/usr/bin/env tsx
/**
 * Test script to verify metadata search functionality
 */

import { initDatabaseFromEnv } from './src/database/index.js';
import { MemoryCore } from './src/core/memory-core.js';
import { MemoryType } from './src/types/enums.js';

const USER_ID = 'test-user-metadata-search';
const TEST_MEMORIES = [
  {
    title: 'Project Alpha Documentation',
    content: 'This is the main documentation for our alpha project.',
    metadata: {
      teamId: 'TEAM_ALPHA',
      owner: 'john.doe@example.com',
      priority: 'P0',
      department: 'Engineering'
    }
  },
  {
    title: 'Team Beta Meeting Notes',
    content: 'Notes from the quarterly planning meeting.',
    metadata: {
      teamId: 'TEAM_BETA',
      owner: 'jane.smith@example.com',
      priority: 'P1',
      department: 'Product'
    }
  },
  {
    title: 'Infrastructure Update',
    content: 'Updates to our cloud infrastructure.',
    metadata: {
      teamId: 'TEAM_GAMMA',
      owner: 'bob.wilson@example.com',
      priority: 'P2',
      department: 'DevOps'
    }
  },
];

async function main() {
  console.log('🧪 Testing Metadata Search Functionality\n');

  const db = initDatabaseFromEnv();
  const memoryCore = new MemoryCore(db, process.env.OPENAI_API_KEY, { autoUpdateEmbeddings: false });

  try {
    await memoryCore.initialize();
    console.log('✅ Database connection initialized\n');

    // Clean up any existing test memories
    console.log('🧹 Cleaning up existing test data...');
    const existingMemories = await db.execute(
      'SELECT id FROM memories WHERE user_id = ?',
      [USER_ID]
    );
    for (const row of existingMemories.rows) {
      await db.execute('DELETE FROM memories WHERE id = ?', [(row as any).id]);
    }
    console.log(`   Deleted ${existingMemories.rows.length} existing memories\n`);

    // Create test memories with metadata
    console.log('📝 Creating test memories with metadata...');
    const createdIds: string[] = [];

    for (const memory of TEST_MEMORIES) {
      const result = await memoryCore.addMemory(
        memory.title,
        memory.content,
        MemoryType.MEMORY,
        {
          userId: USER_ID,
          metadata: memory.metadata,
          generateEmbedding: false, // Skip embeddings for faster testing
        }
      );

      if (result.status === 'success' && result.data) {
        const id = (result.data as any).id;
        createdIds.push(id);
        console.log(`   ✅ Created: ${memory.title}`);
        console.log(`      Metadata: ${JSON.stringify(memory.metadata)}`);
      } else {
        console.error(`   ❌ Failed to create: ${memory.title}`);
        console.error(`      Error: ${result.error}`);
      }
    }
    console.log('');

    // Test Cases
    const testCases = [
      {
        name: 'Search for TEAM_ALPHA',
        query: 'TEAM_ALPHA',
        expectedTitle: 'Project Alpha Documentation',
        expectedField: 'teamId'
      },
      {
        name: 'Search for john.doe@example.com',
        query: 'john.doe@example.com',
        expectedTitle: 'Project Alpha Documentation',
        expectedField: 'owner'
      },
      {
        name: 'Search for P0 priority',
        query: 'P0',
        expectedTitle: 'Project Alpha Documentation',
        expectedField: 'priority'
      },
      {
        name: 'Search for Engineering department',
        query: 'Engineering',
        expectedTitle: 'Project Alpha Documentation',
        expectedField: 'department'
      },
      {
        name: 'Search for TEAM_BETA',
        query: 'TEAM_BETA',
        expectedTitle: 'Team Beta Meeting Notes',
        expectedField: 'teamId'
      },
      {
        name: 'Search for jane.smith@example.com',
        query: 'jane.smith@example.com',
        expectedTitle: 'Team Beta Meeting Notes',
        expectedField: 'owner'
      },
      {
        name: 'Search for DevOps',
        query: 'DevOps',
        expectedTitle: 'Infrastructure Update',
        expectedField: 'department'
      },
    ];

    console.log('🔍 Running metadata search tests...\n');
    let passed = 0;
    let failed = 0;

    for (const test of testCases) {
      console.log(`Test: ${test.name}`);
      console.log(`   Query: "${test.query}"`);

      const searchResult = await memoryCore.searchMemories(test.query, {
        userId: USER_ID,
        limit: 10,
      });

      if (searchResult.status === 'success' && searchResult.data) {
        const results = searchResult.data as any[];
        const found = results.find(r => r.title === test.expectedTitle);

        if (found) {
          console.log(`   ✅ PASS - Found "${test.expectedTitle}"`);
          console.log(`      Message: ${searchResult.message}`);
          console.log(`      Metadata: ${JSON.stringify(found.metadata)}`);
          passed++;
        } else {
          console.log(`   ❌ FAIL - Expected "${test.expectedTitle}" but got:`);
          results.forEach(r => console.log(`      - ${r.title}`));
          failed++;
        }
      } else {
        console.log(`   ❌ FAIL - Search returned error: ${searchResult.error}`);
        failed++;
      }
      console.log('');
    }

    // Test special syntax still works (field:value)
    console.log('🔍 Testing special metadata syntax...\n');

    const specialSyntaxTests = [
      {
        name: 'Search with teamId:TEAM_ALPHA syntax',
        query: 'teamId:TEAM_ALPHA',
        expectedTitle: 'Project Alpha Documentation'
      },
      {
        name: 'Search with metadata.priority:P0 syntax',
        query: 'metadata.priority:P0',
        expectedTitle: 'Project Alpha Documentation'
      },
    ];

    for (const test of specialSyntaxTests) {
      console.log(`Test: ${test.name}`);
      console.log(`   Query: "${test.query}"`);

      const searchResult = await memoryCore.searchMemories(test.query, {
        userId: USER_ID,
        limit: 10,
      });

      if (searchResult.status === 'success' && searchResult.data) {
        const results = searchResult.data as any[];
        const found = results.find(r => r.title === test.expectedTitle);

        if (found) {
          console.log(`   ✅ PASS - Found "${test.expectedTitle}"`);
          console.log(`      Message: ${searchResult.message}`);
          passed++;
        } else {
          console.log(`   ❌ FAIL - Expected "${test.expectedTitle}" but got:`);
          results.forEach(r => console.log(`      - ${r.title}`));
          failed++;
        }
      } else {
        console.log(`   ❌ FAIL - Search returned error: ${searchResult.error}`);
        failed++;
      }
      console.log('');
    }

    // Summary
    console.log('═══════════════════════════════════════════════════════');
    console.log(`📊 Test Summary:`);
    console.log(`   ✅ Passed: ${passed}/${passed + failed}`);
    console.log(`   ❌ Failed: ${failed}/${passed + failed}`);

    if (failed === 0) {
      console.log('\n🎉 All metadata search tests PASSED!');
    } else {
      console.log('\n⚠️  Some tests FAILED. Please review the results above.');
    }
    console.log('═══════════════════════════════════════════════════════');

    // Cleanup
    console.log('\n🧹 Cleaning up test data...');
    for (const id of createdIds) {
      await db.execute('DELETE FROM memories WHERE id = ?', [id]);
    }
    console.log('   ✅ Cleanup complete');

  } catch (error) {
    console.error('\n❌ Test failed with error:', error);
    process.exit(1);
  } finally {
    await memoryCore.close();
  }
}

main().catch(console.error);
