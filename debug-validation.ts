#!/usr/bin/env tsx

import { initDatabaseFromEnv } from './src/database/index.js';
import { MemoryCore } from './src/core/index.js';

async function debug() {
  const db = initDatabaseFromEnv();
  const memoryCore = new MemoryCore(db, undefined);
  await memoryCore.initialize();

  console.log('Testing importance validation...');

  // Test 1: Valid importance
  const result1 = await memoryCore.addMemory(
    'Test',
    'Content',
    'semantic' as any,
    {
      importance: 0.7,
      userId: 'bob@matsuoka.com',
      generateEmbedding: false,
    }
  );

  console.log('Valid (0.7):', result1);

  // Test 2: Invalid high
  const result2 = await memoryCore.addMemory(
    'Test',
    'Content',
    'semantic' as any,
    {
      importance: 1.5,
      userId: 'bob@matsuoka.com',
      generateEmbedding: false,
    }
  );

  console.log('Invalid (1.5):', result2);

  process.exit(0);
}

debug().catch(console.error);