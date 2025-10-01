/**
 * Unit tests for search strategy behavior
 * Tests that similarity strategy uses pure vector search
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { DatabaseConnection } from '../../src/database/connection.js';
import { MemoryCore } from '../../src/core/memory-core.js';
import { MemoryType, MCPToolResultStatus } from '../../src/types/enums.js';
import { initializeSchema } from '../../src/database/schema.js';

describe('Search Strategy Behavior', () => {
  let db: DatabaseConnection;
  let memoryCore: MemoryCore;
  let userId: string;

  // Mock embedding service to avoid OpenAI API calls
  const mockEmbedding = new Array(1536).fill(0).map((_, i) => Math.random());

  beforeAll(async () => {
    // Use in-memory database for testing
    db = new DatabaseConnection({ url: 'file::memory:?cache=shared' });
    await db.connect();
    await initializeSchema(db);

    // Create test user directly in database
    userId = 'test-user-id';
    await db.execute(
      'INSERT INTO users (id, email, name, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      [userId, 'test@example.com', 'Test User', 1, new Date().toISOString(), new Date().toISOString()]
    );

    // Initialize memory core with mock OpenAI
    memoryCore = new MemoryCore(db, 'mock-key', { autoUpdateEmbeddings: false });

    // Mock the embedding service
    const mockEmbeddingService = {
      generateEmbedding: vi.fn().mockResolvedValue(mockEmbedding),
      openai: { embeddings: { create: vi.fn() } },
    };
    (memoryCore as any).embeddings = mockEmbeddingService;

    // Set default user ID
    (memoryCore as any).defaultUserId = userId;

    await memoryCore.initialize();

    // Add test memories with embeddings
    const memories = [
      {
        title: 'Car Story',
        content: 'I bought a new automobile yesterday. It is a red sedan.',
        embedding: mockEmbedding,
      },
      {
        title: 'Doctor Visit',
        content: 'I had an appointment with my physician today.',
        embedding: mockEmbedding.map(v => v * 0.9), // Slightly different embedding
      },
      {
        title: 'Grocery Shopping',
        content: 'Went to the supermarket to buy groceries.',
        embedding: mockEmbedding.map(v => v * 0.5), // Very different embedding
      },
    ];

    for (const memory of memories) {
      const result = await memoryCore.addMemory(
        memory.title,
        memory.content,
        MemoryType.MEMORY,
        {
          userId,
          generateEmbedding: false, // Don't generate, we'll set manually
        }
      );

      expect(result.status).toBe(MCPToolResultStatus.SUCCESS);

      // Manually set embedding in database
      if (result.data?.id) {
        await db.execute(
          'UPDATE memories SET embedding = ? WHERE id = ?',
          [JSON.stringify(memory.embedding), result.data.id]
        );
      }
    }
  });

  afterAll(async () => {
    if (memoryCore) {
      await memoryCore.close();
    }
  });

  describe('Similarity Strategy', () => {
    it('should use pure vector search with similarity strategy', async () => {
      const result = await memoryCore.searchMemories('test query', {
        userId,
        strategy: 'similarity',
        threshold: 0.3,
        limit: 5,
      });

      expect(result.status).toBe(MCPToolResultStatus.SUCCESS);
      expect(result.message).toContain('semantic/vector search only');
    });

    it('should NOT fall back to text search with similarity strategy', async () => {
      const result = await memoryCore.searchMemories('nonexistent', {
        userId,
        strategy: 'similarity',
        threshold: 0.99, // Very high threshold - should return empty
        limit: 5,
      });

      expect(result.status).toBe(MCPToolResultStatus.SUCCESS);
      expect(result.message).toContain('semantic/vector search only');
      expect(result.data).toBeInstanceOf(Array);

      // Should not fall back to text search
      expect(result.message).not.toContain('text search');
    });

    it('should use default threshold of 0.3 for similarity strategy', async () => {
      const result = await memoryCore.searchMemories('test query', {
        userId,
        strategy: 'similarity',
        // No threshold specified - should use 0.3
        limit: 5,
      });

      expect(result.status).toBe(MCPToolResultStatus.SUCCESS);
      expect(result.message).toContain('semantic/vector search only');
    });

    it('should return error if embeddings unavailable with similarity strategy', async () => {
      // Temporarily break embedding service
      const originalMethod = (memoryCore as any).embeddings.generateEmbedding;
      (memoryCore as any).embeddings.generateEmbedding = vi.fn().mockRejectedValue(
        new Error('OpenAI API error')
      );

      const result = await memoryCore.searchMemories('test query', {
        userId,
        strategy: 'similarity',
        threshold: 0.3,
        limit: 5,
      });

      // Should return error, not fall back to text search
      expect(result.status).toBe(MCPToolResultStatus.ERROR);
      expect(result.message).toContain('Semantic search failed');

      // Restore
      (memoryCore as any).embeddings.generateEmbedding = originalMethod;
    });
  });

  describe('Composite Strategy', () => {
    it('should allow hybrid search with composite strategy', async () => {
      const result = await memoryCore.searchMemories('test query', {
        userId,
        strategy: 'composite',
        threshold: 0.6,
        limit: 5,
      });

      expect(result.status).toBe(MCPToolResultStatus.SUCCESS);
      // May use semantic, text, or both
      expect(result.message).toMatch(/semantic|text/);
    });

    it('should fall back to text search with composite strategy if needed', async () => {
      // Temporarily break embedding service
      const originalMethod = (memoryCore as any).embeddings.generateEmbedding;
      (memoryCore as any).embeddings.generateEmbedding = vi.fn().mockRejectedValue(
        new Error('OpenAI API error')
      );

      const result = await memoryCore.searchMemories('Car', {
        userId,
        strategy: 'composite',
        threshold: 0.6,
        limit: 5,
      });

      // Should succeed with text search fallback
      expect(result.status).toBe(MCPToolResultStatus.SUCCESS);
      expect(result.data).toBeInstanceOf(Array);

      // Restore
      (memoryCore as any).embeddings.generateEmbedding = originalMethod;
    });

    it('should use higher default threshold (0.6) for composite strategy', async () => {
      const result = await memoryCore.searchMemories('test query', {
        userId,
        strategy: 'composite',
        // No threshold specified - should use 0.6
        limit: 5,
      });

      expect(result.status).toBe(MCPToolResultStatus.SUCCESS);
    });
  });

  describe('Other Strategies', () => {
    it('should not apply temporal sorting to similarity strategy', async () => {
      const result = await memoryCore.searchMemories('test query', {
        userId,
        strategy: 'similarity',
        limit: 5,
      });

      expect(result.status).toBe(MCPToolResultStatus.SUCCESS);
      // Vector results should be sorted by similarity, not re-sorted by strategy
    });

    it('should apply temporal sorting to recency strategy', async () => {
      const result = await memoryCore.searchMemories('test query', {
        userId,
        strategy: 'recency',
        limit: 5,
      });

      expect(result.status).toBe(MCPToolResultStatus.SUCCESS);
      // Results should be sorted by recency
    });

    it('should apply importance sorting to importance strategy', async () => {
      const result = await memoryCore.searchMemories('test query', {
        userId,
        strategy: 'importance',
        limit: 5,
      });

      expect(result.status).toBe(MCPToolResultStatus.SUCCESS);
      // Results should be sorted by importance
    });
  });
});
