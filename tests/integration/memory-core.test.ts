/**
 * Integration tests for MemoryCore
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DatabaseConnection } from '../../src/database/connection.js';
import { MemoryCore } from '../../src/core/memory-core.js';
import { MemoryType, EntityType, ImportanceLevel, MCPToolResultStatus } from '../../src/types/enums.js';

// Mock environment variables
vi.mock('dotenv', () => ({
  config: vi.fn(),
}));

// Mock database for testing
const mockDb = {
  connect: vi.fn(),
  disconnect: vi.fn(),
  execute: vi.fn(),
  transaction: vi.fn(),
  isConnected: vi.fn().mockReturnValue(true),
  getClient: vi.fn(),
} as unknown as DatabaseConnection;

// Mock OpenAI for embeddings
vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => ({
    embeddings: {
      create: vi.fn().mockResolvedValue({
        data: [{ embedding: [0.1, 0.2, 0.3] }],
      }),
    },
  })),
}));

describe('MemoryCore Integration', () => {
  let memoryCore: MemoryCore;

  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Mock database operations
    (mockDb.execute as any).mockImplementation((sql: string) => {
      if (sql.includes('SELECT version FROM schema_version')) {
        return { rows: [{ version: 1 }] };
      }
      if (sql.includes('INSERT INTO users')) {
        return { lastInsertRowid: 1 };
      }
      if (sql.includes('SELECT * FROM users WHERE email')) {
        return { 
          rows: [{ 
            id: 'test-user-id',
            email: 'test@example.com',
            name: 'Test User',
            is_active: 1,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }] 
        };
      }
      if (sql.includes('INSERT INTO memories')) {
        return { lastInsertRowid: 1 };
      }
      if (sql.includes('INSERT INTO entities')) {
        return { lastInsertRowid: 1 };
      }
      return { rows: [] };
    });

    memoryCore = new MemoryCore(mockDb, 'test-openai-key');
    
    // Set environment variable for default user
    process.env.DEFAULT_USER_EMAIL = 'test@example.com';
    
    await memoryCore.initialize();
  });

  afterEach(async () => {
    await memoryCore.close();
    delete process.env.DEFAULT_USER_EMAIL;
  });

  describe('Memory Operations', () => {
    it('should add memory successfully', async () => {
      const result = await memoryCore.addMemory(
        'Test Memory',
        'This is test content',
        MemoryType.PERSONAL,
        {
          importance: ImportanceLevel.HIGH,
          tags: ['test', 'memory'],
        }
      );

      expect(result.status).toBe(MCPToolResultStatus.SUCCESS);
      expect(result.message).toBe('Memory added successfully');
      expect(result.data).toHaveProperty('id');
      expect(result.data).toHaveProperty('title', 'Test Memory');
    });

    it('should search memories', async () => {
      // Mock search results
      (mockDb.execute as any).mockImplementation((sql: string) => {
        if (sql.includes('memories_fts')) {
          return {
            rows: [{
              id: 1,
              user_id: 'test-user-id',
              title: 'Test Memory',
              content: 'This is test content',
              memory_type: 'personal',
              importance: 3,
              tags: '["test", "memory"]',
              entity_ids: '[]',
              embedding: '[0.1, 0.2, 0.3]',
              metadata: '{}',
              is_archived: 0,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }]
          };
        }
        return { rows: [] };
      });

      const result = await memoryCore.searchMemories('test query', {
        limit: 5,
        threshold: 0.7,
      });

      expect(result.status).toBe(MCPToolResultStatus.SUCCESS);
      expect(result.data).toBeInstanceOf(Array);
    });

    it('should handle search errors gracefully', async () => {
      (mockDb.execute as any).mockRejectedValue(new Error('Database error'));

      const result = await memoryCore.searchMemories('test query');

      expect(result.status).toBe(MCPToolResultStatus.ERROR);
      expect(result.error).toContain('Database error');
    });
  });

  describe('Entity Operations', () => {
    it('should create entity successfully', async () => {
      const result = await memoryCore.createEntity(
        'John Doe',
        EntityType.PERSON,
        {
          description: 'Software engineer',
          company: 'Tech Corp',
          importance: ImportanceLevel.HIGH,
          tags: ['developer', 'typescript'],
        }
      );

      expect(result.status).toBe(MCPToolResultStatus.SUCCESS);
      expect(result.message).toBe('Entity created successfully');
      expect(result.data).toHaveProperty('id');
      expect(result.data).toHaveProperty('name', 'John Doe');
    });

    it('should search entities', async () => {
      // Mock search results
      (mockDb.execute as any).mockImplementation((sql: string) => {
        if (sql.includes('entities_fts')) {
          return {
            rows: [{
              id: 1,
              user_id: 'test-user-id',
              name: 'John Doe',
              entity_type: 'person',
              description: 'Software engineer',
              company: 'Tech Corp',
              importance: 3,
              tags: '["developer", "typescript"]',
              interaction_count: 0,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }]
          };
        }
        return { rows: [] };
      });

      const result = await memoryCore.searchEntities('John Doe', { limit: 5 });

      expect(result.status).toBe(MCPToolResultStatus.SUCCESS);
      expect(result.data).toBeInstanceOf(Array);
    });
  });

  describe('Unified Search', () => {
    it('should perform unified search across memories and entities', async () => {
      // Mock both memory and entity search results
      (mockDb.execute as any).mockImplementation((sql: string) => {
        if (sql.includes('memories_fts')) {
          return {
            rows: [{
              id: 1,
              title: 'Test Memory',
              content: 'Content about John',
              memory_type: 'personal',
              importance: 2,
              tags: '[]',
              entity_ids: '[]',
              embedding: '[0.1, 0.2, 0.3]',
              is_archived: 0,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }]
          };
        }
        if (sql.includes('entities_fts')) {
          return {
            rows: [{
              id: 1,
              name: 'John Doe',
              entity_type: 'person',
              description: 'Software engineer',
              importance: 2,
              tags: '[]',
              interaction_count: 0,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }]
          };
        }
        return { rows: [] };
      });

      const result = await memoryCore.unifiedSearch('John', {
        limit: 10,
        threshold: 0.7,
      });

      expect(result.status).toBe(MCPToolResultStatus.SUCCESS);
      expect(result.data).toBeInstanceOf(Array);
    });
  });

  describe('Statistics', () => {
    it('should get statistics successfully', async () => {
      // Mock statistics queries
      (mockDb.execute as any).mockImplementation((sql: string) => {
        if (sql.includes('SELECT * FROM memories WHERE user_id')) {
          return {
            rows: [
              { memory_type: 'personal', embedding: '[0.1, 0.2]' },
              { memory_type: 'professional', embedding: '[]' },
            ]
          };
        }
        if (sql.includes('SELECT * FROM entities WHERE user_id')) {
          return {
            rows: [
              { entity_type: 'person' },
              { entity_type: 'organization' },
            ]
          };
        }
        return { rows: [] };
      });

      const result = await memoryCore.getStatistics();

      expect(result.status).toBe(MCPToolResultStatus.SUCCESS);
      expect(result.data).toHaveProperty('totalMemories');
      expect(result.data).toHaveProperty('totalEntities');
      expect(result.data).toHaveProperty('memoriesByType');
      expect(result.data).toHaveProperty('entitiesByType');
      expect(result.data).toHaveProperty('memoriesWithEmbeddings');
    });
  });

  describe('User Management', () => {
    it('should create user successfully', async () => {
      const result = await memoryCore.createUser({
        email: 'newuser@example.com',
        name: 'New User',
        organization: 'Test Org',
      });

      expect(result.status).toBe(MCPToolResultStatus.SUCCESS);
      expect(result.message).toBe('User created successfully');
      expect(result.data).toHaveProperty('email', 'newuser@example.com');
    });

    it('should handle user creation errors', async () => {
      (mockDb.execute as any).mockRejectedValue(new Error('Duplicate email'));

      const result = await memoryCore.createUser({
        email: 'duplicate@example.com',
      });

      expect(result.status).toBe(MCPToolResultStatus.ERROR);
      expect(result.error).toContain('Duplicate email');
    });
  });

  describe('Error Handling', () => {
    it('should handle database connection errors', async () => {
      (mockDb.execute as any).mockRejectedValue(new Error('Connection failed'));

      const result = await memoryCore.addMemory('Test', 'Content');

      expect(result.status).toBe(MCPToolResultStatus.ERROR);
      expect(result.error).toContain('Connection failed');
    });

    it('should handle embedding generation errors', async () => {
      // Mock OpenAI to throw error
      const mockOpenAI = (memoryCore as any).embeddings.openai;
      mockOpenAI.embeddings.create.mockRejectedValue(new Error('API limit exceeded'));

      const result = await memoryCore.addMemory('Test', 'Content');

      // Should still succeed but without embedding
      expect(result.status).toBe(MCPToolResultStatus.SUCCESS);
    });
  });
});
