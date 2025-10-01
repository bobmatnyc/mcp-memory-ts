/**
 * Semantic Search Verification Test
 *
 * This test verifies that vector embeddings are actually being used for semantic search,
 * not just keyword matching. It creates memories with specific content and verifies
 * that semantic similarity works correctly.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { DatabaseConnection } from '../src/database/connection.js';
import { MemoryCore } from '../src/core/memory-core.js';
import { MemoryType, MCPToolResultStatus } from '../src/types/enums.js';
import { createUser } from '../src/models/index.js';

describe('Semantic Search Verification', () => {
  let db: DatabaseConnection;
  let memoryCore: MemoryCore;
  let testUserId: string;

  beforeAll(async () => {
    // Check for required environment variables
    if (!process.env.TURSO_URL || !process.env.TURSO_AUTH_TOKEN) {
      throw new Error('TURSO_URL and TURSO_AUTH_TOKEN must be set for this test');
    }

    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'test-key') {
      throw new Error('Real OPENAI_API_KEY must be set for semantic search verification');
    }

    // Initialize database connection
    db = new DatabaseConnection({
      url: process.env.TURSO_URL,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });

    await db.connect();

    // Initialize MemoryCore with real OpenAI API key
    memoryCore = new MemoryCore(db, process.env.OPENAI_API_KEY, {
      autoUpdateEmbeddings: false, // Disable auto-update for controlled testing
    });

    await memoryCore.initialize();

    // Create a test user
    const user = createUser({
      email: `semantic-test-${Date.now()}@example.com`,
      name: 'Semantic Test User',
      isActive: true,
    });

    const dbOps = (memoryCore as any).dbOps;
    await dbOps.createUser(user);
    testUserId = user.id;
  });

  afterAll(async () => {
    // Clean up: delete test user and their memories
    if (db && testUserId) {
      try {
        await db.execute('DELETE FROM memories WHERE user_id = ?', [testUserId]);
        await db.execute('DELETE FROM users WHERE id = ?', [testUserId]);
      } catch (error) {
        console.error('Cleanup error:', error);
      }
    }

    if (memoryCore) {
      await memoryCore.close();
    }
  });

  it('should use semantic search, not just keyword matching', async () => {
    console.log('\n=== SEMANTIC SEARCH VERIFICATION TEST ===\n');

    // Step 1: Create two semantically distinct memories
    console.log('Step 1: Creating test memories...');

    const mlMemoryResult = await memoryCore.addMemory(
      'Machine Learning Project',
      'Working on a neural network that uses deep learning algorithms to classify images. The model uses convolutional layers and backpropagation for training.',
      MemoryType.MEMORY,
      {
        userId: testUserId,
        importance: 0.8,
        tags: ['ml', 'ai', 'neural-networks'],
        generateEmbedding: true,
      }
    );

    expect(mlMemoryResult.status).toBe(MCPToolResultStatus.SUCCESS);
    console.log('✓ Created ML memory:', mlMemoryResult.data?.id);

    const coffeeMemoryResult = await memoryCore.addMemory(
      'Coffee Brewing Guide',
      'The perfect pour-over coffee requires water at 195-205°F. Grind beans to medium-fine consistency. Pour slowly in circular motions for optimal extraction.',
      MemoryType.MEMORY,
      {
        userId: testUserId,
        importance: 0.7,
        tags: ['coffee', 'brewing', 'recipe'],
        generateEmbedding: true,
      }
    );

    expect(coffeeMemoryResult.status).toBe(MCPToolResultStatus.SUCCESS);
    console.log('✓ Created coffee memory:', coffeeMemoryResult.data?.id);

    // Wait a moment to ensure embeddings are stored
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Step 2: Verify embeddings were generated
    console.log('\nStep 2: Verifying embeddings were generated...');

    const mlMemory = await (memoryCore as any).dbOps.getMemoryById(mlMemoryResult.data?.id);
    const coffeeMemory = await (memoryCore as any).dbOps.getMemoryById(coffeeMemoryResult.data?.id);

    expect(mlMemory?.embedding).toBeDefined();
    expect(Array.isArray(mlMemory?.embedding)).toBe(true);
    expect(mlMemory?.embedding?.length).toBeGreaterThan(0);
    console.log(`✓ ML memory has embedding with ${mlMemory?.embedding?.length} dimensions`);

    expect(coffeeMemory?.embedding).toBeDefined();
    expect(Array.isArray(coffeeMemory?.embedding)).toBe(true);
    expect(coffeeMemory?.embedding?.length).toBeGreaterThan(0);
    console.log(`✓ Coffee memory has embedding with ${coffeeMemory?.embedding?.length} dimensions`);

    // Step 3: Test semantic search with "artificial intelligence"
    console.log('\nStep 3: Testing semantic search for "artificial intelligence"...');
    console.log('Expected: Should find ML memory (semantically similar)');
    console.log('Should NOT find coffee memory (not related)');

    const searchResult = await memoryCore.searchMemories(
      'artificial intelligence',
      {
        userId: testUserId,
        limit: 10,
        threshold: 0.3, // Use lower threshold to ensure we get results
      }
    );

    expect(searchResult.status).toBe(MCPToolResultStatus.SUCCESS);
    const results = searchResult.data as any[];

    console.log(`\nSearch Results (found ${results.length}):`);
    results.forEach((result, idx) => {
      console.log(`${idx + 1}. ${result.title}`);
      console.log(`   Content preview: ${result.content.substring(0, 60)}...`);
      console.log(`   Tags: ${JSON.stringify(result.tags)}`);
    });

    // Step 4: Verify semantic matching worked
    console.log('\nStep 4: Verifying semantic search results...');

    if (results.length === 0) {
      console.error('❌ FAILED: No results found. Vector search may not be working!');
      expect(results.length).toBeGreaterThan(0);
    } else {
      // The first result should be the ML memory (semantically similar to "artificial intelligence")
      const firstResult = results[0];
      console.log(`First result: "${firstResult.title}"`);

      if (firstResult.id === mlMemoryResult.data?.id) {
        console.log('✓ SUCCESS: Semantic search is working! Found ML memory for "artificial intelligence" query.');
      } else if (firstResult.id === coffeeMemoryResult.data?.id) {
        console.error('❌ FAILED: Vector search not working - found coffee memory first!');
        console.error('This indicates keyword search or random ordering, not semantic similarity.');
        expect(firstResult.id).toBe(mlMemoryResult.data?.id);
      } else {
        console.warn('⚠ UNEXPECTED: Found a different memory. May be from previous test runs.');
      }

      // Verify ML memory is in results
      const foundML = results.some(r => r.id === mlMemoryResult.data?.id);
      expect(foundML).toBe(true);
      console.log('✓ ML memory is in search results');
    }

    // Step 5: Test with exact keyword that doesn't exist
    console.log('\nStep 5: Testing with non-existent keyword "quantum computing"...');
    console.log('Expected: Should still find ML memory via semantic similarity');

    const quantumSearchResult = await memoryCore.searchMemories(
      'quantum computing',
      {
        userId: testUserId,
        limit: 10,
        threshold: 0.3,
      }
    );

    expect(quantumSearchResult.status).toBe(MCPToolResultStatus.SUCCESS);
    const quantumResults = quantumSearchResult.data as any[];

    console.log(`\nSearch Results (found ${quantumResults.length}):`);
    quantumResults.forEach((result, idx) => {
      console.log(`${idx + 1}. ${result.title}`);
    });

    if (quantumResults.length > 0) {
      const foundMLViaSemantics = quantumResults.some(r => r.id === mlMemoryResult.data?.id);
      if (foundMLViaSemantics) {
        console.log('✓ SUCCESS: Found ML memory via semantic similarity (no exact keyword match needed)');
      } else {
        console.log('⚠ ML memory not found - threshold may be too high or semantic similarity too low');
      }
    }

    console.log('\n=== TEST COMPLETE ===\n');
  });

  it('should rank results by semantic similarity', async () => {
    console.log('\n=== SEMANTIC RANKING VERIFICATION TEST ===\n');

    // Create memories with varying semantic similarity to "machine learning"
    console.log('Creating memories with different semantic similarities...');

    const memory1 = await memoryCore.addMemory(
      'Deep Learning Research',
      'Conducting research on transformer models and attention mechanisms in neural networks.',
      MemoryType.MEMORY,
      {
        userId: testUserId,
        importance: 0.5,
        generateEmbedding: true,
      }
    );

    const memory2 = await memoryCore.addMemory(
      'Gardening Tips',
      'Plant tomatoes in spring after last frost. Water regularly and provide full sun exposure.',
      MemoryType.MEMORY,
      {
        userId: testUserId,
        importance: 0.5,
        generateEmbedding: true,
      }
    );

    const memory3 = await memoryCore.addMemory(
      'Data Science Workflow',
      'Building predictive models using statistical analysis and machine learning techniques.',
      MemoryType.MEMORY,
      {
        userId: testUserId,
        importance: 0.5,
        generateEmbedding: true,
      }
    );

    await new Promise(resolve => setTimeout(resolve, 1000));

    console.log('Searching for "machine learning algorithms"...');

    const searchResult = await memoryCore.searchMemories(
      'machine learning algorithms',
      {
        userId: testUserId,
        limit: 10,
        threshold: 0.2,
      }
    );

    expect(searchResult.status).toBe(MCPToolResultStatus.SUCCESS);
    const results = searchResult.data as any[];

    console.log(`\nFound ${results.length} results:`);
    results.forEach((result, idx) => {
      console.log(`${idx + 1}. ${result.title}`);
    });

    // Verify that AI/ML-related memories rank higher than gardening
    const gardeningIndex = results.findIndex(r => r.id === memory2.data?.id);
    const deepLearningIndex = results.findIndex(r => r.id === memory1.data?.id);
    const dataScienceIndex = results.findIndex(r => r.id === memory3.data?.id);

    console.log(`\nRanking check:`);
    console.log(`- Deep Learning: position ${deepLearningIndex + 1}`);
    console.log(`- Data Science: position ${dataScienceIndex + 1}`);
    console.log(`- Gardening: position ${gardeningIndex + 1}`);

    if (deepLearningIndex >= 0 && gardeningIndex >= 0) {
      expect(deepLearningIndex).toBeLessThan(gardeningIndex);
      console.log('✓ Deep Learning ranked higher than Gardening (semantic similarity working)');
    }

    if (dataScienceIndex >= 0 && gardeningIndex >= 0) {
      expect(dataScienceIndex).toBeLessThan(gardeningIndex);
      console.log('✓ Data Science ranked higher than Gardening (semantic similarity working)');
    }

    console.log('\n=== RANKING TEST COMPLETE ===\n');
  });
});
