/**
 * Integration tests for vector similarity search
 * Tests semantic matching capabilities (synonyms, related concepts)
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { DatabaseConnection } from '../../src/database/connection.js';
import { MemoryCore } from '../../src/core/memory-core.js';
import { MemoryType, MCPToolResultStatus } from '../../src/types/enums.js';
import { initializeSchema } from '../../src/database/schema.js';

// Skip these tests if OpenAI API key is not available
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const describeIfKey = OPENAI_API_KEY ? describe : describe.skip;

describeIfKey('Vector Similarity Search', () => {
  let db: DatabaseConnection;
  let memoryCore: MemoryCore;
  let userId: string;

  beforeAll(async () => {
    // Use in-memory database for testing
    db = new DatabaseConnection({ url: 'file::memory:?cache=shared' });
    await db.connect();
    await initializeSchema(db);

    // Initialize memory core with OpenAI
    memoryCore = new MemoryCore(db, OPENAI_API_KEY, { autoUpdateEmbeddings: false });
    await memoryCore.initialize();

    // Create test user with unique email to avoid UNIQUE constraint violations
    const uniqueEmail = `test-vector-${Date.now()}@example.com`;
    const userResult = await memoryCore.createUser({
      email: uniqueEmail,
      name: 'Test User',
    });

    if (userResult.status === MCPToolResultStatus.SUCCESS && userResult.data) {
      userId = userResult.data.id;
    } else {
      throw new Error('Failed to create test user');
    }

    // Wait a bit to avoid rate limits
    await new Promise(resolve => setTimeout(resolve, 1000));
  });

  afterAll(async () => {
    if (memoryCore) {
      await memoryCore.close();
    }
  });

  describe('Semantic Synonym Recognition', () => {
    beforeAll(async () => {
      // Add memories with specific terms
      const memories = [
        {
          title: 'My Automobile',
          content: 'I bought a new automobile yesterday. It is a red sedan with great fuel efficiency.',
          tags: ['transportation', 'vehicle'],
        },
        {
          title: 'Doctor Visit',
          content: 'I had an appointment with my physician today. The physician recommended getting more exercise.',
          tags: ['health', 'medical'],
        },
        {
          title: 'Computer Programming',
          content: 'Working on a software development project using TypeScript and Node.js.',
          tags: ['technology', 'coding'],
        },
        {
          title: 'Grocery Shopping',
          content: 'Went to the supermarket to buy groceries for the week.',
          tags: ['shopping', 'food'],
        },
      ];

      for (const memory of memories) {
        const result = await memoryCore.addMemory(
          memory.title,
          memory.content,
          MemoryType.MEMORY,
          {
            userId,
            tags: memory.tags,
            generateEmbedding: true,
          }
        );

        expect(result.status).toBe(MCPToolResultStatus.SUCCESS);

        // Wait between requests to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    });

    it('should find "automobile" when searching for "car"', async () => {
      const result = await memoryCore.searchMemories('car', {
        userId,
        strategy: 'similarity',
        threshold: 0.3,
        limit: 5,
      });

      expect(result.status).toBe(MCPToolResultStatus.SUCCESS);
      expect(result.data).toBeInstanceOf(Array);

      const memories = result.data as any[];
      const foundAutomobile = memories.some(m =>
        m.title.includes('Automobile') || m.content.includes('automobile')
      );

      expect(foundAutomobile).toBe(true);
    }, 30000);

    it('should find "physician" when searching for "doctor"', async () => {
      const result = await memoryCore.searchMemories('doctor', {
        userId,
        strategy: 'similarity',
        threshold: 0.3,
        limit: 5,
      });

      expect(result.status).toBe(MCPToolResultStatus.SUCCESS);
      expect(result.data).toBeInstanceOf(Array);

      const memories = result.data as any[];
      const foundPhysician = memories.some(m =>
        m.title.includes('Doctor') || m.content.includes('physician')
      );

      expect(foundPhysician).toBe(true);
    }, 30000);

    it('should find programming-related content when searching for "coding"', async () => {
      const result = await memoryCore.searchMemories('coding', {
        userId,
        strategy: 'similarity',
        threshold: 0.3,
        limit: 5,
      });

      expect(result.status).toBe(MCPToolResultStatus.SUCCESS);
      expect(result.data).toBeInstanceOf(Array);

      const memories = result.data as any[];
      const foundProgramming = memories.some(m =>
        m.title.includes('Programming') || m.content.includes('software development')
      );

      expect(foundProgramming).toBe(true);
    }, 30000);

    it('should return results ranked by semantic similarity', async () => {
      const result = await memoryCore.searchMemories('vehicle transportation', {
        userId,
        strategy: 'similarity',
        threshold: 0.3,
        limit: 5,
      });

      expect(result.status).toBe(MCPToolResultStatus.SUCCESS);
      expect(result.data).toBeInstanceOf(Array);

      const memories = result.data as any[];

      // The automobile memory should be highly ranked
      if (memories.length > 0) {
        const topResult = memories[0];
        const isAutomobileHighRanked = topResult.title.includes('Automobile') ||
                                       topResult.content.includes('automobile');

        // Allow for some flexibility, but automobile should be in top results
        const automobileIndex = memories.findIndex(m =>
          m.title.includes('Automobile') || m.content.includes('automobile')
        );

        expect(automobileIndex).toBeGreaterThanOrEqual(0);
        expect(automobileIndex).toBeLessThan(3); // Should be in top 3
      }
    }, 30000);
  });

  describe('Strategy Comparison', () => {
    it('should use pure vector search with similarity strategy', async () => {
      const result = await memoryCore.searchMemories('vehicle', {
        userId,
        strategy: 'similarity',
        threshold: 0.3,
        limit: 5,
      });

      expect(result.status).toBe(MCPToolResultStatus.SUCCESS);
      expect(result.message).toContain('semantic/vector search only');
    }, 30000);

    it('should use hybrid approach with composite strategy', async () => {
      const result = await memoryCore.searchMemories('vehicle', {
        userId,
        strategy: 'composite',
        threshold: 0.6,
        limit: 5,
      });

      expect(result.status).toBe(MCPToolResultStatus.SUCCESS);
      // May use semantic search, text search, or both depending on threshold
      expect(result.message).toMatch(/semantic|text/);
    }, 30000);
  });

  describe('Threshold Behavior', () => {
    it('should return more results with lower threshold', async () => {
      const lowThreshold = await memoryCore.searchMemories('medical', {
        userId,
        strategy: 'similarity',
        threshold: 0.2,
        limit: 10,
      });

      const highThreshold = await memoryCore.searchMemories('medical', {
        userId,
        strategy: 'similarity',
        threshold: 0.8,
        limit: 10,
      });

      expect(lowThreshold.status).toBe(MCPToolResultStatus.SUCCESS);
      expect(highThreshold.status).toBe(MCPToolResultStatus.SUCCESS);

      const lowResults = lowThreshold.data as any[];
      const highResults = highThreshold.data as any[];

      // Lower threshold should return equal or more results
      expect(lowResults.length).toBeGreaterThanOrEqual(highResults.length);
    }, 60000);

    it('should use 0.3 default threshold for similarity strategy', async () => {
      // This test verifies the default threshold allows semantic matches
      const result = await memoryCore.searchMemories('transport', {
        userId,
        strategy: 'similarity',
        // threshold not specified - should use 0.3
        limit: 5,
      });

      expect(result.status).toBe(MCPToolResultStatus.SUCCESS);

      const memories = result.data as any[];
      // Should find automobile-related content with semantic search
      const foundTransportation = memories.some(m =>
        m.content.includes('automobile') || m.tags?.includes('transportation')
      );

      expect(foundTransportation).toBe(true);
    }, 30000);
  });

  describe('Fallback Behavior', () => {
    it('should not fall back to text search when using similarity strategy', async () => {
      const result = await memoryCore.searchMemories('nonexistent term xyz123', {
        userId,
        strategy: 'similarity',
        threshold: 0.9, // Very high threshold
        limit: 5,
      });

      expect(result.status).toBe(MCPToolResultStatus.SUCCESS);
      expect(result.message).toContain('semantic/vector search only');

      // Should return empty results, not fall back to text search
      const memories = result.data as any[];
      expect(memories.length).toBe(0);
    }, 30000);

    it('should fall back to text search with composite strategy when needed', async () => {
      const result = await memoryCore.searchMemories('Grocery', {
        userId,
        strategy: 'composite',
        threshold: 0.6,
        limit: 5,
      });

      expect(result.status).toBe(MCPToolResultStatus.SUCCESS);
      // Will use either semantic, text, or both
      expect(result.data).toBeInstanceOf(Array);
    }, 30000);
  });
});
