/**
 * User Isolation Security Tests
 * Testing CVE-INTERNAL-2025-001 through CVE-INTERNAL-2025-004 fixes
 *
 * These tests verify that multi-tenant data separation is properly enforced
 * across all MCP tool handlers and core operations.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MemoryCore } from '../../src/core/memory-core.js';
import { DatabaseConnection } from '../../src/database/connection.js';
import { MemoryType, ImportanceLevel, MCPToolResultStatus } from '../../src/types/enums.js';
import { v4 as uuidv4 } from 'uuid';
import { tmpdir } from 'os';
import { join } from 'path';
import { rm } from 'fs/promises';

describe('User Isolation Security Tests', () => {
  let db: DatabaseConnection;
  let memoryCore: MemoryCore;
  let testDir: string;

  // Test users
  const userA = {
    id: uuidv4(),
    email: 'userA@security-test.example.com',
    name: 'User A',
  };

  const userB = {
    id: uuidv4(),
    email: 'userB@security-test.example.com',
    name: 'User B',
  };

  beforeEach(async () => {
    // Create isolated test database
    testDir = join(tmpdir(), `mcp-security-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    const dbPath = join(testDir, 'test.db');

    db = new DatabaseConnection(`file:${dbPath}`);
    memoryCore = new MemoryCore(db, 'test-key', { autoUpdateEmbeddings: false });

    await memoryCore.initialize();

    // Create test users
    await db.execute(
      'INSERT INTO users (id, email, name, created_at) VALUES (?, ?, ?, ?)',
      [userA.id, userA.email, userA.name, new Date().toISOString()]
    );

    await db.execute(
      'INSERT INTO users (id, email, name, created_at) VALUES (?, ?, ?, ?)',
      [userB.id, userB.email, userB.name, new Date().toISOString()]
    );
  });

  afterEach(async () => {
    if (db) {
      await db.close();
    }
    if (testDir) {
      try {
        await rm(testDir, { recursive: true, force: true });
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  });

  describe('CVE-INTERNAL-2025-001: recall_memories User Isolation', () => {
    it('should only return memories for the requesting user', async () => {
      // Create memories for User A
      const memoryA1 = await memoryCore.addMemory(
        "User A's secret information",
        MemoryType.PERSONAL,
        { userId: userA.id, importance: ImportanceLevel.HIGH }
      );

      const memoryA2 = await memoryCore.addMemory(
        "User A's personal note",
        MemoryType.PERSONAL,
        { userId: userA.id, importance: ImportanceLevel.MEDIUM }
      );

      // Create memories for User B
      const memoryB1 = await memoryCore.addMemory(
        "User B's confidential data",
        MemoryType.PROFESSIONAL,
        { userId: userB.id, importance: ImportanceLevel.HIGH }
      );

      const memoryB2 = await memoryCore.addMemory(
        "User B's work notes",
        MemoryType.PROFESSIONAL,
        { userId: userB.id, importance: ImportanceLevel.MEDIUM }
      );

      // Search as User A
      const resultsA = await memoryCore.searchMemories('secret', {
        userId: userA.id,
        limit: 10,
        threshold: 0.1,
      });

      // Search as User B
      const resultsB = await memoryCore.searchMemories('confidential', {
        userId: userB.id,
        limit: 10,
        threshold: 0.1,
      });

      // Verify User A only sees their memories
      expect(resultsA.status).toBe(MCPToolResultStatus.SUCCESS);
      const memoriesA = resultsA.data as any[];

      // All returned memories must belong to User A
      for (const memory of memoriesA) {
        expect(memory.userId).toBe(userA.id);
        expect(memory.content).not.toContain('User B');
      }

      // Verify User B only sees their memories
      expect(resultsB.status).toBe(MCPToolResultStatus.SUCCESS);
      const memoriesB = resultsB.data as any[];

      // All returned memories must belong to User B
      for (const memory of memoriesB) {
        expect(memory.userId).toBe(userB.id);
        expect(memory.content).not.toContain('User A');
      }

      // Verify no cross-contamination
      expect(memoriesA.length).toBeGreaterThan(0);
      expect(memoriesB.length).toBeGreaterThan(0);

      const userAIds = memoriesA.map((m: any) => m.id);
      const userBIds = memoriesB.map((m: any) => m.id);

      // No overlap between user memories
      const overlap = userAIds.filter((id: string) => userBIds.includes(id));
      expect(overlap.length).toBe(0);
    });

    it('should not expose test data with {"test": true} metadata to production users', async () => {
      // Create test memory (simulating E2E test data)
      await memoryCore.addMemory(
        'E2E test memory - should be isolated',
        MemoryType.SYSTEM,
        {
          userId: userA.id,
          metadata: { test: true, testRun: 'e2e-12345' }
        }
      );

      // Create production memory
      await memoryCore.addMemory(
        'Production memory for User B',
        MemoryType.PERSONAL,
        {
          userId: userB.id,
          metadata: { production: true }
        }
      );

      // User B searches (production user)
      const resultsB = await memoryCore.searchMemories('memory', {
        userId: userB.id,
        limit: 10,
        threshold: 0.1,
      });

      const memoriesB = resultsB.data as any[];

      // User B should NOT see test data from User A
      for (const memory of memoriesB) {
        expect(memory.metadata?.test).not.toBe(true);
        expect(memory.content).not.toContain('E2E test');
      }
    });
  });

  describe('CVE-INTERNAL-2025-002: get_memory_stats User Isolation', () => {
    it('should return statistics only for the requesting user', async () => {
      // User A creates 10 memories
      for (let i = 0; i < 10; i++) {
        await memoryCore.addMemory(
          `User A memory ${i}`,
          MemoryType.PERSONAL,
          { userId: userA.id }
        );
      }

      // User B creates 20 memories
      for (let i = 0; i < 20; i++) {
        await memoryCore.addMemory(
          `User B memory ${i}`,
          MemoryType.PROFESSIONAL,
          { userId: userB.id }
        );
      }

      // Get stats for User A
      const statsA = await memoryCore.getStatistics(userA.id);
      expect(statsA.status).toBe(MCPToolResultStatus.SUCCESS);
      const dataA = statsA.data as any;

      // User A should see exactly 10 memories
      expect(dataA.totalMemories).toBe(10);
      expect(dataA.memoriesByType.personal).toBe(10);
      expect(dataA.memoriesByType.professional).toBeUndefined();

      // Get stats for User B
      const statsB = await memoryCore.getStatistics(userB.id);
      expect(statsB.status).toBe(MCPToolResultStatus.SUCCESS);
      const dataB = statsB.data as any;

      // User B should see exactly 20 memories
      expect(dataB.totalMemories).toBe(20);
      expect(dataB.memoriesByType.professional).toBe(20);
      expect(dataB.memoriesByType.personal).toBeUndefined();

      // Verify no combined/global stats leakage
      expect(dataA.totalMemories + dataB.totalMemories).toBe(30); // Total is 30
      expect(dataA.totalMemories).not.toBe(30); // User A doesn't see global total
      expect(dataB.totalMemories).not.toBe(30); // User B doesn't see global total
    });

    it('should count entities per user correctly', async () => {
      // User A creates 5 entities
      for (let i = 0; i < 5; i++) {
        await memoryCore.createEntity({
          name: `Person A${i}`,
          entityType: 'person',
          userId: userA.id,
        });
      }

      // User B creates 10 entities
      for (let i = 0; i < 10; i++) {
        await memoryCore.createEntity({
          name: `Person B${i}`,
          entityType: 'person',
          userId: userB.id,
        });
      }

      // Get stats for User A
      const statsA = await memoryCore.getStatistics(userA.id);
      const dataA = statsA.data as any;
      expect(dataA.totalEntities).toBe(5);

      // Get stats for User B
      const statsB = await memoryCore.getStatistics(userB.id);
      const dataB = statsB.data as any;
      expect(dataB.totalEntities).toBe(10);

      // No cross-user entity counts
      expect(dataA.totalEntities).not.toBe(15);
      expect(dataB.totalEntities).not.toBe(15);
    });
  });

  describe('CVE-INTERNAL-2025-003: update_missing_embeddings User Isolation', () => {
    it('should only update embeddings for the specified user', async () => {
      // User A creates 5 memories without embeddings (by inserting directly)
      const userAMemoryIds: string[] = [];
      for (let i = 0; i < 5; i++) {
        const id = uuidv4();
        userAMemoryIds.push(id);
        await db.execute(
          `INSERT INTO memories (id, user_id, content, memory_type, importance, embedding, created_at)
           VALUES (?, ?, ?, ?, ?, NULL, ?)`,
          [id, userA.id, `User A no-embed ${i}`, 'personal', 0.5, new Date().toISOString()]
        );
      }

      // User B creates 5 memories without embeddings
      const userBMemoryIds: string[] = [];
      for (let i = 0; i < 5; i++) {
        const id = uuidv4();
        userBMemoryIds.push(id);
        await db.execute(
          `INSERT INTO memories (id, user_id, content, memory_type, importance, embedding, created_at)
           VALUES (?, ?, ?, ?, ?, NULL, ?)`,
          [id, userB.id, `User B no-embed ${i}`, 'professional', 0.5, new Date().toISOString()]
        );
      }

      // Verify both users have 5 memories without embeddings
      const checkA = await db.execute(
        'SELECT COUNT(*) as count FROM memories WHERE user_id = ? AND (embedding IS NULL OR embedding = "[]")',
        [userA.id]
      );
      expect((checkA.rows[0] as any).count).toBe(5);

      const checkB = await db.execute(
        'SELECT COUNT(*) as count FROM memories WHERE user_id = ? AND (embedding IS NULL OR embedding = "[]")',
        [userB.id]
      );
      expect((checkB.rows[0] as any).count).toBe(5);

      // Update embeddings for User A ONLY
      const updateResult = await memoryCore.updateMissingEmbeddings(userA.id);

      expect(updateResult.status).toBe(MCPToolResultStatus.SUCCESS);
      const updateStats = updateResult.data as any;

      // Should have processed exactly 5 memories (User A's memories only)
      const totalProcessed = updateStats.updated + updateStats.failed;
      expect(totalProcessed).toBe(5);

      // Verify User B's memories still have no embeddings
      const checkBAfter = await db.execute(
        'SELECT COUNT(*) as count FROM memories WHERE user_id = ? AND (embedding IS NULL OR embedding = "[]")',
        [userB.id]
      );
      expect((checkBAfter.rows[0] as any).count).toBe(5); // Still 5 without embeddings

      // Verify User A's memories were processed
      const checkAAfter = await db.execute(
        'SELECT COUNT(*) as count FROM memories WHERE user_id = ? AND (embedding IS NULL OR embedding = "[]")',
        [userA.id]
      );
      // Should be 0 if all succeeded, or less than 5 if some succeeded
      expect((checkAAfter.rows[0] as any).count).toBeLessThan(5);
    });

    it('should not process global embeddings without user context', async () => {
      // Create memories for both users without embeddings
      for (let i = 0; i < 3; i++) {
        await db.execute(
          `INSERT INTO memories (id, user_id, content, memory_type, importance, embedding, created_at)
           VALUES (?, ?, ?, ?, ?, NULL, ?)`,
          [uuidv4(), userA.id, `User A ${i}`, 'personal', 0.5, new Date().toISOString()]
        );

        await db.execute(
          `INSERT INTO memories (id, user_id, content, memory_type, importance, embedding, created_at)
           VALUES (?, ?, ?, ?, ?, NULL, ?)`,
          [uuidv4(), userB.id, `User B ${i}`, 'professional', 0.5, new Date().toISOString()]
        );
      }

      // Update for User A only
      const result = await memoryCore.updateMissingEmbeddings(userA.id);
      const stats = result.data as any;

      // Should process exactly 3 memories (not 6)
      expect(stats.updated + stats.failed).toBe(3);
    });
  });

  describe('CVE-INTERNAL-2025-004: store_memory User Attribution', () => {
    it('should correctly attribute memories to the creating user', async () => {
      // User A creates memory
      const resultA = await memoryCore.addMemory(
        "User A's exclusive content",
        MemoryType.PERSONAL,
        { userId: userA.id }
      );

      // User B creates memory
      const resultB = await memoryCore.addMemory(
        "User B's exclusive content",
        MemoryType.PROFESSIONAL,
        { userId: userB.id }
      );

      expect(resultA.status).toBe(MCPToolResultStatus.SUCCESS);
      expect(resultB.status).toBe(MCPToolResultStatus.SUCCESS);

      const memoryAData = resultA.data as any;
      const memoryBData = resultB.data as any;

      // Verify database attribution
      const dbMemoryA = await db.execute(
        'SELECT * FROM memories WHERE id = ?',
        [memoryAData.id]
      );
      expect((dbMemoryA.rows[0] as any).user_id).toBe(userA.id);

      const dbMemoryB = await db.execute(
        'SELECT * FROM memories WHERE id = ?',
        [memoryBData.id]
      );
      expect((dbMemoryB.rows[0] as any).user_id).toBe(userB.id);
    });

    it('should prevent cross-user visibility after memory creation', async () => {
      // User A creates memory
      const resultA = await memoryCore.addMemory(
        "User A's secret data",
        MemoryType.PERSONAL,
        { userId: userA.id }
      );

      const memoryAData = resultA.data as any;

      // User B attempts to retrieve User A's memory
      const getResult = await memoryCore.getMemory(memoryAData.id, { userId: userB.id });

      // Should fail or return error (memory doesn't exist for User B)
      if (getResult.status === MCPToolResultStatus.SUCCESS) {
        // If it succeeds (bad!), the data should be null/undefined
        expect(getResult.data).toBeNull();
      } else {
        // Should return error
        expect(getResult.status).toBe(MCPToolResultStatus.ERROR);
      }
    });
  });

  describe('Cross-Cutting Security Tests', () => {
    it('should maintain user isolation across all operations', async () => {
      // Complex workflow: Both users create memories, entities, and interact

      // User A creates data
      const memA = await memoryCore.addMemory(
        'User A workflow',
        MemoryType.PERSONAL,
        { userId: userA.id }
      );

      const entA = await memoryCore.createEntity({
        name: 'User A Entity',
        entityType: 'person',
        userId: userA.id,
      });

      // User B creates data
      const memB = await memoryCore.addMemory(
        'User B workflow',
        MemoryType.PROFESSIONAL,
        { userId: userB.id }
      );

      const entB = await memoryCore.createEntity({
        name: 'User B Entity',
        entityType: 'organization',
        userId: userB.id,
      });

      // Verify User A's stats only show User A's data
      const statsA = await memoryCore.getStatistics(userA.id);
      const dataA = statsA.data as any;
      expect(dataA.totalMemories).toBe(1);
      expect(dataA.totalEntities).toBe(1);

      // Verify User B's stats only show User B's data
      const statsB = await memoryCore.getStatistics(userB.id);
      const dataB = statsB.data as any;
      expect(dataB.totalMemories).toBe(1);
      expect(dataB.totalEntities).toBe(1);

      // Verify User A searches don't return User B's data
      const searchA = await memoryCore.searchMemories('workflow', {
        userId: userA.id,
        limit: 10,
      });
      const resultsA = searchA.data as any[];

      for (const result of resultsA) {
        expect(result.userId).toBe(userA.id);
        expect(result.content).not.toContain('User B');
      }

      // Verify User B searches don't return User A's data
      const searchB = await memoryCore.searchMemories('workflow', {
        userId: userB.id,
        limit: 10,
      });
      const resultsB = searchB.data as any[];

      for (const result of resultsB) {
        expect(result.userId).toBe(userB.id);
        expect(result.content).not.toContain('User A');
      }
    });

    it('should prevent SQL injection through userId parameter', async () => {
      // Create memory for User A
      await memoryCore.addMemory(
        'Sensitive data',
        MemoryType.PERSONAL,
        { userId: userA.id }
      );

      // Attempt SQL injection through userId
      const maliciousUserId = `${userA.id}' OR '1'='1`;

      // This should not return data or should fail gracefully
      const result = await memoryCore.searchMemories('sensitive', {
        userId: maliciousUserId,
        limit: 10,
      });

      // Should either error or return empty (not all memories)
      if (result.status === MCPToolResultStatus.SUCCESS) {
        const data = result.data as any[];
        // Should be empty (no matching user with SQL injection string)
        expect(data.length).toBe(0);
      } else {
        expect(result.status).toBe(MCPToolResultStatus.ERROR);
      }
    });

    it('should handle shared DEFAULT_USER_EMAIL scenario safely', async () => {
      // Simulate scenario where DEFAULT_USER_EMAIL is shared
      const sharedEmail = 'shared@company.com';
      const sharedUserId = uuidv4();

      await db.execute(
        'INSERT INTO users (id, email, name, created_at) VALUES (?, ?, ?, ?)',
        [sharedUserId, sharedEmail, 'Shared User', new Date().toISOString()]
      );

      // Two different "users" both use shared email
      const user1Result = await memoryCore.addMemory(
        'User 1 data',
        MemoryType.PERSONAL,
        { userId: sharedUserId }
      );

      const user2Result = await memoryCore.addMemory(
        'User 2 data',
        MemoryType.PERSONAL,
        { userId: sharedUserId }
      );

      // Both succeed
      expect(user1Result.status).toBe(MCPToolResultStatus.SUCCESS);
      expect(user2Result.status).toBe(MCPToolResultStatus.SUCCESS);

      // But when searching with shared user, BOTH memories are visible
      const searchResult = await memoryCore.searchMemories('data', {
        userId: sharedUserId,
        limit: 10,
      });

      const memories = searchResult.data as any[];
      // This is expected behavior (not a bug) - shared userId sees all shared data
      expect(memories.length).toBe(2);

      // Document this as a configuration issue, not a code issue
      console.warn('[SECURITY WARNING] Shared DEFAULT_USER_EMAIL detected - all users share the same data');
    });
  });

  describe('Edge Cases and Boundary Conditions', () => {
    it('should handle empty search results without user leakage', async () => {
      // User A creates memory
      await memoryCore.addMemory(
        'Specific content for User A',
        MemoryType.PERSONAL,
        { userId: userA.id }
      );

      // User B searches for non-existent content
      const result = await memoryCore.searchMemories('nonexistent query', {
        userId: userB.id,
        limit: 10,
      });

      expect(result.status).toBe(MCPToolResultStatus.SUCCESS);
      const memories = result.data as any[];
      expect(memories.length).toBe(0); // Empty result, no leakage
    });

    it('should handle concurrent operations from different users', async () => {
      // Simulate concurrent memory creation
      const promises = [
        memoryCore.addMemory('User A concurrent 1', MemoryType.PERSONAL, { userId: userA.id }),
        memoryCore.addMemory('User B concurrent 1', MemoryType.PROFESSIONAL, { userId: userB.id }),
        memoryCore.addMemory('User A concurrent 2', MemoryType.PERSONAL, { userId: userA.id }),
        memoryCore.addMemory('User B concurrent 2', MemoryType.PROFESSIONAL, { userId: userB.id }),
      ];

      const results = await Promise.all(promises);

      // All should succeed
      results.forEach(result => {
        expect(result.status).toBe(MCPToolResultStatus.SUCCESS);
      });

      // Verify correct attribution
      const statsA = await memoryCore.getStatistics(userA.id);
      const statsB = await memoryCore.getStatistics(userB.id);

      expect((statsA.data as any).totalMemories).toBe(2);
      expect((statsB.data as any).totalMemories).toBe(2);
    });

    it('should handle user deletion gracefully', async () => {
      // User A creates memory
      await memoryCore.addMemory(
        'User A data',
        MemoryType.PERSONAL,
        { userId: userA.id }
      );

      // Delete User A
      await db.execute('DELETE FROM users WHERE id = ?', [userA.id]);

      // Attempt to search as deleted user
      const result = await memoryCore.searchMemories('data', {
        userId: userA.id,
        limit: 10,
      });

      // Should handle gracefully (either error or empty)
      if (result.status === MCPToolResultStatus.SUCCESS) {
        const memories = result.data as any[];
        // Memories might still exist (cascade delete not implemented)
        // But user operations should be safe
        expect(Array.isArray(memories)).toBe(true);
      }
    });
  });
});
