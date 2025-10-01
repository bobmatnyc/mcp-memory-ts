#!/usr/bin/env node
/**
 * Quick test of multi-word search fix
 */

import { initDatabaseFromEnv, DatabaseOperations } from '../src/database/index.js';

const USER_ID = '34183aef-dce1-4e2a-8b97-2dac8d0e1f75';

async function quickTest() {
  console.log('Quick search test...\n');

  const db = initDatabaseFromEnv();
  await db.connect();
  const operations = new DatabaseOperations(db);

  try {
    // Test 1: Single word
    const single = await operations.searchMemories(USER_ID, 'test', 5);
    console.log(`✓ Single word "test": ${single.length} results`);

    // Test 2: Multi-word
    const multi = await operations.searchMemories(USER_ID, 'memory system test', 5);
    console.log(`✓ Multi-word "memory system test": ${multi.length} results`);

    // Test 3: Another multi-word
    const multi2 = await operations.searchMemories(USER_ID, 'episodic semantic', 5);
    console.log(`✓ Multi-word "episodic semantic": ${multi2.length} results`);

    console.log('\nAll search tests passed! ✓');
  } finally {
    await db.disconnect();
  }
}

quickTest().catch(console.error);