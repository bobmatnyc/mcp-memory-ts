#!/usr/bin/env tsx
/**
 * Manual test script to verify semantic search is working
 *
 * This script demonstrates that vector embeddings are being used for semantic search
 * by creating test memories and showing search results with similarity information.
 *
 * Usage:
 *   npx tsx scripts/test-semantic-search.ts
 *
 * Requirements:
 *   - TURSO_URL and TURSO_AUTH_TOKEN must be set
 *   - OPENAI_API_KEY must be set (real key, not test-key)
 *   - MCP_DEBUG=1 for detailed logging
 */

import 'dotenv/config';
import { DatabaseConnection } from '../src/database/connection.js';
import { MemoryCore } from '../src/core/memory-core.js';
import { MemoryType, MCPToolResultStatus } from '../src/types/enums.js';
import { createUser } from '../src/models/index.js';

async function main() {
  console.log('\n🔬 Semantic Search Verification Script\n');
  console.log('=' .repeat(60));

  // Check environment
  if (!process.env.TURSO_URL || !process.env.TURSO_AUTH_TOKEN) {
    console.error('❌ Error: TURSO_URL and TURSO_AUTH_TOKEN must be set');
    process.exit(1);
  }

  if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'test-key') {
    console.error('❌ Error: Real OPENAI_API_KEY must be set');
    process.exit(1);
  }

  console.log('✓ Environment variables configured');

  // Initialize
  const db = new DatabaseConnection({
    url: process.env.TURSO_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  await db.connect();
  console.log('✓ Database connected');

  const memoryCore = new MemoryCore(db, process.env.OPENAI_API_KEY, {
    autoUpdateEmbeddings: false,
  });

  await memoryCore.initialize();
  console.log('✓ Memory core initialized');

  // Create test user
  const testEmail = `semantic-test-${Date.now()}@example.com`;
  const user = createUser({
    email: testEmail,
    name: 'Semantic Test User',
    isActive: true,
  });

  const dbOps = (memoryCore as any).dbOps;
  await dbOps.createUser(user);
  console.log(`✓ Created test user: ${testEmail}`);

  const userId = user.id;

  try {
    console.log('\n' + '='.repeat(60));
    console.log('STEP 1: Creating test memories with embeddings');
    console.log('='.repeat(60) + '\n');

    // Memory 1: Machine Learning
    const mlResult = await memoryCore.addMemory(
      'Machine Learning Research',
      'Working on deep neural networks and artificial intelligence algorithms. The model uses gradient descent and backpropagation for training. Implementing transformer architecture for NLP tasks.',
      MemoryType.MEMORY,
      {
        userId,
        importance: 0.8,
        tags: ['ml', 'ai', 'deep-learning'],
        generateEmbedding: true,
      }
    );

    if (mlResult.status !== MCPToolResultStatus.SUCCESS) {
      throw new Error(`Failed to create ML memory: ${mlResult.error}`);
    }
    console.log(`✓ Created memory: "${mlResult.data?.title}"`);
    console.log(`  ID: ${mlResult.data?.id}`);

    // Memory 2: Coffee
    const coffeeResult = await memoryCore.addMemory(
      'Coffee Brewing Technique',
      'Pour-over coffee method: Heat water to 200°F, grind beans to medium-fine. Pour in circular motion for even extraction. Brew time should be 3-4 minutes.',
      MemoryType.MEMORY,
      {
        userId,
        importance: 0.7,
        tags: ['coffee', 'brewing', 'recipe'],
        generateEmbedding: true,
      }
    );

    if (coffeeResult.status !== MCPToolResultStatus.SUCCESS) {
      throw new Error(`Failed to create coffee memory: ${coffeeResult.error}`);
    }
    console.log(`✓ Created memory: "${coffeeResult.data?.title}"`);
    console.log(`  ID: ${coffeeResult.data?.id}`);

    // Memory 3: Cooking
    const cookingResult = await memoryCore.addMemory(
      'Italian Pasta Recipe',
      'Classic carbonara: Cook pasta al dente. Mix eggs with parmesan and pecorino cheese. Combine with crispy pancetta. No cream needed for authentic Roman style.',
      MemoryType.MEMORY,
      {
        userId,
        importance: 0.6,
        tags: ['cooking', 'italian', 'recipe'],
        generateEmbedding: true,
      }
    );

    if (cookingResult.status !== MCPToolResultStatus.SUCCESS) {
      throw new Error(`Failed to create cooking memory: ${cookingResult.error}`);
    }
    console.log(`✓ Created memory: "${cookingResult.data?.title}"`);
    console.log(`  ID: ${cookingResult.data?.id}`);

    // Wait for embeddings to be stored
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Verify embeddings
    console.log('\n' + '='.repeat(60));
    console.log('STEP 2: Verifying embeddings were generated');
    console.log('='.repeat(60) + '\n');

    const mlMemory = await dbOps.getMemoryById(mlResult.data?.id, userId);
    const coffeeMemory = await dbOps.getMemoryById(coffeeResult.data?.id, userId);
    const cookingMemory = await dbOps.getMemoryById(cookingResult.data?.id, userId);

    console.log(`ML Memory embedding: ${mlMemory?.embedding ? `✓ (${mlMemory.embedding.length} dimensions)` : '❌ Missing'}`);
    console.log(`Coffee Memory embedding: ${coffeeMemory?.embedding ? `✓ (${coffeeMemory.embedding.length} dimensions)` : '❌ Missing'}`);
    console.log(`Cooking Memory embedding: ${cookingMemory?.embedding ? `✓ (${cookingMemory.embedding.length} dimensions)` : '❌ Missing'}`);

    // Test 1: Semantic search for AI-related query
    console.log('\n' + '='.repeat(60));
    console.log('TEST 1: Search for "artificial intelligence"');
    console.log('Expected: ML memory should rank first (semantic similarity)');
    console.log('='.repeat(60) + '\n');

    const aiSearchResult = await memoryCore.searchMemories(
      'artificial intelligence',
      {
        userId,
        limit: 10,
        threshold: 0.5, // Lower threshold to see more results
      }
    );

    console.log(`Status: ${aiSearchResult.status}`);
    console.log(`Message: ${aiSearchResult.message}\n`);

    if (aiSearchResult.status === MCPToolResultStatus.SUCCESS) {
      const results = aiSearchResult.data as any[];
      console.log(`Found ${results.length} results:\n`);

      results.forEach((result, idx) => {
        const isML = result.id === mlResult.data?.id;
        const isCoffee = result.id === coffeeResult.data?.id;
        const isCooking = result.id === cookingResult.data?.id;

        console.log(`${idx + 1}. ${result.title} ${isML ? '← ML (Expected)' : isCoffee ? '← Coffee' : isCooking ? '← Cooking' : ''}`);
        console.log(`   Content: ${result.content.substring(0, 80)}...`);
        console.log(`   Tags: ${JSON.stringify(result.tags)}\n`);
      });

      // Verify ML is first
      if (results.length > 0 && results[0].id === mlResult.data?.id) {
        console.log('✅ SUCCESS: Semantic search is working! ML memory ranked first.');
      } else if (results.length === 0) {
        console.log('❌ FAILED: No results returned. Vector search may not be working.');
      } else {
        console.log('⚠️  WARNING: ML memory not ranked first. Check semantic similarity threshold.');
      }
    } else {
      console.error(`❌ Search failed: ${aiSearchResult.error}`);
    }

    // Test 2: Search with non-existent keyword
    console.log('\n' + '='.repeat(60));
    console.log('TEST 2: Search for "neural computing" (not exact match)');
    console.log('Expected: Should still find ML memory via semantic similarity');
    console.log('='.repeat(60) + '\n');

    const neuralSearchResult = await memoryCore.searchMemories(
      'neural computing',
      {
        userId,
        limit: 10,
        threshold: 0.4,
      }
    );

    console.log(`Status: ${neuralSearchResult.status}`);
    console.log(`Message: ${neuralSearchResult.message}\n`);

    if (neuralSearchResult.status === MCPToolResultStatus.SUCCESS) {
      const results = neuralSearchResult.data as any[];
      console.log(`Found ${results.length} results:\n`);

      results.forEach((result, idx) => {
        const isML = result.id === mlResult.data?.id;
        console.log(`${idx + 1}. ${result.title} ${isML ? '← ML (Expected)' : ''}`);
      });

      const foundML = results.some(r => r.id === mlResult.data?.id);
      if (foundML) {
        console.log('\n✅ SUCCESS: Found ML memory via semantic similarity (no exact keyword match needed)');
      } else {
        console.log('\n⚠️  WARNING: ML memory not found. This suggests pure keyword search, not semantic.');
      }
    }

    // Test 3: Statistics
    console.log('\n' + '='.repeat(60));
    console.log('TEST 3: Check vector search health statistics');
    console.log('='.repeat(60) + '\n');

    const statsResult = await memoryCore.getStatistics(userId);

    if (statsResult.status === MCPToolResultStatus.SUCCESS) {
      const stats = statsResult.data as any;
      console.log('Statistics:');
      console.log(`  Total memories: ${stats.totalMemories}`);
      console.log(`  Memories with embeddings: ${stats.memoriesWithEmbeddings}`);
      console.log(`  Embedding coverage: ${stats.embeddingCoverage}`);
      console.log('\nVector Search Health:');
      console.log(`  Enabled: ${stats.vectorSearchHealth.enabled ? '✓' : '❌'}`);
      console.log(`  Valid embeddings: ${stats.vectorSearchHealth.memoriesWithValidEmbeddings}`);
      console.log(`  Missing embeddings: ${stats.vectorSearchHealth.memoriesWithoutEmbeddings}`);
      console.log(`  Coverage: ${stats.vectorSearchHealth.coveragePercentage}%`);
      console.log(`  Recommendation: ${stats.vectorSearchHealth.recommendation}`);
    }

    console.log('\n' + '='.repeat(60));
    console.log('✓ All tests completed');
    console.log('='.repeat(60) + '\n');

  } finally {
    // Cleanup
    console.log('\nCleaning up test data...');
    await db.execute('DELETE FROM memories WHERE user_id = ?', [userId]);
    await db.execute('DELETE FROM users WHERE id = ?', [userId]);
    console.log('✓ Cleanup complete');

    await memoryCore.close();
  }
}

main().catch(error => {
  console.error('\n❌ Error:', error);
  process.exit(1);
});
