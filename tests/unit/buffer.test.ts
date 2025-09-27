/**
 * Tests for Memory Buffer System
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { MemoryBuffer, MemoryBufferStatus } from '../../src/core/buffer.js';

describe('MemoryBuffer', () => {
  let buffer: MemoryBuffer;
  let tempDir: string;
  let persistPath: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(join(tmpdir(), 'mcp-memory-test-'));
    persistPath = join(tempDir, 'test-buffer.json');
    buffer = new MemoryBuffer(persistPath, 100);
  });

  afterEach(async () => {
    await buffer.close();
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Basic Operations', () => {
    it('should add memory to buffer', async () => {
      const memoryData = {
        title: 'Test Memory',
        content: 'This is a test memory',
        userId: 'test-user',
      };

      const memoryId = await buffer.add(memoryData);
      
      expect(memoryId).toBeDefined();
      expect(typeof memoryId).toBe('string');

      const status = await buffer.getStatus();
      expect(status.pendingCount).toBe(1);
      expect(status.totalInCache).toBe(1);
    });

    it('should get next pending item', async () => {
      const memoryData = {
        title: 'Test Memory',
        content: 'This is a test memory',
        userId: 'test-user',
      };

      await buffer.add(memoryData);
      
      const item = await buffer.getNextPending();
      expect(item).toBeDefined();
      expect(item?.memoryData.title).toBe('Test Memory');
      expect(item?.status).toBe(MemoryBufferStatus.WRITING);
    });

    it('should mark item as completed', async () => {
      const memoryData = {
        title: 'Test Memory',
        content: 'This is a test memory',
        userId: 'test-user',
      };

      const memoryId = await buffer.add(memoryData);
      const item = await buffer.getNextPending();
      
      if (item) {
        await buffer.markCompleted(item.id);
        
        const itemStatus = await buffer.getItemStatus(item.id);
        expect(itemStatus.status).toBe(MemoryBufferStatus.COMPLETED);
        expect(itemStatus.completedAt).toBeDefined();
      }
    });

    it('should mark item as failed', async () => {
      const memoryData = {
        title: 'Test Memory',
        content: 'This is a test memory',
        userId: 'test-user',
      };

      const memoryId = await buffer.add(memoryData);
      const error = 'Test error message';
      
      await buffer.markFailed(memoryId, error);
      
      const itemStatus = await buffer.getItemStatus(memoryId);
      expect(itemStatus.status).toBe(MemoryBufferStatus.FAILED);
      expect(itemStatus.error).toBe(error);
    });

    it('should schedule retry', async () => {
      const memoryData = {
        title: 'Test Memory',
        content: 'This is a test memory',
        userId: 'test-user',
      };

      await buffer.add(memoryData);
      const item = await buffer.getNextPending();
      
      if (item) {
        await buffer.scheduleRetry(item, 1); // 1 second delay
        
        expect(item.status).toBe(MemoryBufferStatus.RETRYING);
        expect(item.attempts).toBe(1);
        
        const status = await buffer.getStatus();
        expect(status.retryCount).toBe(1);
      }
    });
  });

  describe('Retry Logic', () => {
    it('should return retry item when due', async () => {
      const memoryData = {
        title: 'Test Memory',
        content: 'This is a test memory',
        userId: 'test-user',
      };

      await buffer.add(memoryData);
      const item = await buffer.getNextPending();
      
      if (item) {
        // Schedule retry with very short delay
        await buffer.scheduleRetry(item, 0.001); // 1ms delay
        
        // Wait a bit for the retry time to pass
        await new Promise(resolve => setTimeout(resolve, 10));
        
        const retryItem = await buffer.getNextRetry();
        expect(retryItem).toBeDefined();
        expect(retryItem?.id).toBe(item.id);
        expect(retryItem?.status).toBe(MemoryBufferStatus.RETRYING);
      }
    });

    it('should not return retry item when not due', async () => {
      const memoryData = {
        title: 'Test Memory',
        content: 'This is a test memory',
        userId: 'test-user',
      };

      await buffer.add(memoryData);
      const item = await buffer.getNextPending();
      
      if (item) {
        // Schedule retry with long delay
        await buffer.scheduleRetry(item, 60); // 60 seconds delay
        
        const retryItem = await buffer.getNextRetry();
        expect(retryItem).toBeNull();
      }
    });
  });

  describe('Metrics and Status', () => {
    it('should provide accurate metrics', async () => {
      const memoryData = {
        title: 'Test Memory',
        content: 'This is a test memory',
        userId: 'test-user',
      };

      // Add some items
      await buffer.add(memoryData);
      await buffer.add({ ...memoryData, title: 'Test Memory 2' });
      
      const metrics = await buffer.getMetrics();
      expect(metrics.queued).toBe(2);
      expect(metrics.queueDepth).toBe(2);
      expect(metrics.cacheSize).toBe(2);
      
      // Process one item
      const item = await buffer.getNextPending();
      if (item) {
        await buffer.markCompleted(item.id);
      }
      
      const updatedMetrics = await buffer.getMetrics();
      expect(updatedMetrics.completed).toBe(1);
      expect(updatedMetrics.queueDepth).toBe(1);
    });

    it('should provide buffer status', async () => {
      const memoryData = {
        title: 'Test Memory',
        content: 'This is a test memory',
        userId: 'test-user',
      };

      await buffer.add(memoryData);
      await buffer.add({ ...memoryData, title: 'Test Memory 2' });
      
      const status = await buffer.getStatus();
      expect(status.pendingCount).toBe(2);
      expect(status.retryCount).toBe(0);
      expect(status.processingCount).toBe(0);
      expect(status.completedCount).toBe(0);
      expect(status.failedCount).toBe(0);
      expect(status.totalInCache).toBe(2);
    });
  });

  describe('Persistence', () => {
    it('should persist and restore buffer state', async () => {
      const memoryData = {
        title: 'Test Memory',
        content: 'This is a test memory',
        userId: 'test-user',
      };

      // Add items to buffer
      const memoryId1 = await buffer.add(memoryData);
      const memoryId2 = await buffer.add({ ...memoryData, title: 'Test Memory 2' });
      
      // Persist the buffer
      await buffer.persist();
      
      // Create new buffer and restore
      const newBuffer = new MemoryBuffer(persistPath, 100);
      const restoredCount = await newBuffer.restore();
      
      expect(restoredCount).toBe(2);
      
      const status = await newBuffer.getStatus();
      expect(status.pendingCount).toBe(2);
      expect(status.totalInCache).toBe(2);
      
      await newBuffer.close();
    });

    it('should handle missing persistence file gracefully', async () => {
      const nonExistentPath = join(tempDir, 'non-existent.json');
      const newBuffer = new MemoryBuffer(nonExistentPath, 100);
      
      const restoredCount = await newBuffer.restore();
      expect(restoredCount).toBe(0);
      
      await newBuffer.close();
    });
  });

  describe('Error Handling', () => {
    it('should handle buffer overflow', async () => {
      const smallBuffer = new MemoryBuffer(persistPath, 2); // Very small buffer
      
      const memoryData = {
        title: 'Test Memory',
        content: 'This is a test memory',
        userId: 'test-user',
      };

      // Fill the buffer
      await smallBuffer.add(memoryData);
      await smallBuffer.add({ ...memoryData, title: 'Test Memory 2' });
      
      // This should throw an error
      await expect(smallBuffer.add({ ...memoryData, title: 'Test Memory 3' }))
        .rejects.toThrow('Buffer full');
      
      await smallBuffer.close();
    });

    it('should handle item status for unknown items', async () => {
      const status = await buffer.getItemStatus('unknown-id');
      expect(status.status).toBe('unknown');
    });
  });
});
