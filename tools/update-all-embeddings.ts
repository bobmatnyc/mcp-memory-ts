#!/usr/bin/env tsx
/**
 * Update all embeddings using the MCP memory service
 * This script ensures OPENAI_API_KEY is loaded from .env.local
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { existsSync } from 'fs';
import { initDatabaseFromEnv } from '../src/database/index.js';
import { MemoryCore } from '../src/core/index.js';

// Load environment variables from .env.local if it exists, otherwise fall back to .env
const envLocalPath = resolve(process.cwd(), '.env.local');
const envPath = resolve(process.cwd(), '.env');

if (existsSync(envLocalPath)) {
  console.log('Loading environment from .env.local');
  config({ path: envLocalPath });
} else if (existsSync(envPath)) {
  console.log('Loading environment from .env');
  config({ path: envPath });
}

async function updateAllEmbeddings() {
  console.log('Starting embedding update process...\n');

  // Verify OpenAI API key is loaded
  if (!process.env.OPENAI_API_KEY) {
    console.error('❌ OPENAI_API_KEY not found in environment');
    console.error('Make sure .env.local or .env contains OPENAI_API_KEY');
    process.exit(1);
  }

  console.log('✅ OpenAI API key found');

  try {
    // Initialize database and memory core
    const db = initDatabaseFromEnv();
    const memoryCore = new MemoryCore(db, process.env.OPENAI_API_KEY);
    await memoryCore.initialize();

    console.log('✅ Memory core initialized\n');

    // Get current statistics
    const statsResult = await memoryCore.getStatistics();
    if (statsResult.status === 'success' && statsResult.data) {
      const stats = statsResult.data as any;
      console.log(`📊 Current Statistics:`);
      console.log(`   Total memories: ${stats.totalMemories}`);
      console.log(`   With embeddings: ${stats.memoriesWithEmbeddings}`);
      console.log(`   Without embeddings: ${stats.totalMemories - stats.memoriesWithEmbeddings}\n`);
    }

    // Update missing embeddings
    console.log('🔄 Updating embeddings...');
    const result = await memoryCore.updateMissingEmbeddings();

    if (result.status === 'success' && result.data) {
      const updateStats = result.data as any;
      console.log('\n✅ Embedding update completed!');
      console.log(`   Updated: ${updateStats.updated}`);
      console.log(`   Failed: ${updateStats.failed}`);
      console.log(`   Total processed: ${updateStats.updated + updateStats.failed}`);

      // Get final statistics
      const finalStatsResult = await memoryCore.getStatistics();
      if (finalStatsResult.status === 'success' && finalStatsResult.data) {
        const finalStats = finalStatsResult.data as any;
        const coverage = Math.round(((finalStats.memoriesWithEmbeddings || 0) / Math.max(finalStats.totalMemories, 1)) * 100);
        console.log(`\n📊 Final Statistics:`);
        console.log(`   Total memories: ${finalStats.totalMemories}`);
        console.log(`   With embeddings: ${finalStats.memoriesWithEmbeddings}`);
        console.log(`   Coverage: ${coverage}%`);
      }
    } else {
      console.error(`\n❌ Failed to update embeddings: ${result.error || result.message}`);
      process.exit(1);
    }

  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
}

// Run the update
updateAllEmbeddings();
