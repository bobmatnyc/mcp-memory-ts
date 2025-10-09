/**
 * Memory Buffer System
 * Provides fast, non-blocking memory writes with eventual consistency
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { v4 as uuidv4 } from 'uuid';

export enum MemoryBufferStatus {
  PENDING = 'pending',
  WRITING = 'writing',
  RETRYING = 'retrying',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export interface MemoryBufferItem {
  id: string;
  memoryData: Record<string, any>;
  status: MemoryBufferStatus;
  timestamp: number;
  attempts: number;
  lastError?: string;
  completedAt?: number;
}

export interface BufferMetrics {
  queued: number;
  completed: number;
  failed: number;
  retries: number;
  successRate: number;
  queueDepth: number;
  retryQueueDepth: number;
  avgWriteTime: number;
  lastWriteTime: number;
  cacheSize: number;
}

export interface BufferStatus {
  pendingCount: number;
  retryCount: number;
  processingCount: number;
  completedCount: number;
  failedCount: number;
  totalInCache: number;
}

export class MemoryBuffer {
  private persistPath: string;
  private maxSize: number;
  private pendingQueue: MemoryBufferItem[] = [];
  private retryQueue: Array<{ retryTime: number; item: MemoryBufferItem }> = [];
  private itemsCache: Map<string, MemoryBufferItem> = new Map();
  private completedItems: MemoryBufferItem[] = [];
  private failedItems: MemoryBufferItem[] = [];
  private persistLock = false;
  private lastPersist = 0;
  private persistInterval = 5000; // 5 seconds

  private metrics = {
    queued: 0,
    completed: 0,
    failed: 0,
    retries: 0,
    queueDepth: 0,
    lastWriteTime: 0,
    totalWriteTime: 0,
  };

  constructor(persistPath?: string, maxSize = 10000) {
    this.persistPath = persistPath || join(homedir(), '.mcp', 'memory_buffer.json');
    this.maxSize = maxSize;
    this.ensurePersistDir();
  }

  private async ensurePersistDir(): Promise<void> {
    const dir = this.persistPath.substring(0, this.persistPath.lastIndexOf('/'));
    try {
      await fs.mkdir(dir, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }
  }

  /**
   * Add memory to buffer for async write
   */
  async add(memoryData: Record<string, any>): Promise<string> {
    const memoryId = uuidv4();

    const item: MemoryBufferItem = {
      id: memoryId,
      memoryData,
      status: MemoryBufferStatus.PENDING,
      timestamp: Date.now(),
      attempts: 0,
    };

    // Check if queue is full
    if (this.pendingQueue.length >= this.maxSize) {
      throw new Error(`Buffer full (${this.maxSize}), cannot add more items`);
    }

    // Add to queue and cache
    this.pendingQueue.push(item);
    this.itemsCache.set(memoryId, item);

    // Update metrics
    this.metrics.queued++;
    this.metrics.queueDepth = this.pendingQueue.length;

    // Persist if needed (non-blocking)
    this.persistIfNeeded();

    console.debug(`Buffered memory ${memoryId}, queue depth: ${this.pendingQueue.length}`);

    return memoryId;
  }

  /**
   * Get next item to write
   */
  async getNextPending(): Promise<MemoryBufferItem | null> {
    const item = this.pendingQueue.shift();
    if (item) {
      item.status = MemoryBufferStatus.WRITING;
      this.metrics.queueDepth = this.pendingQueue.length;
      return item;
    }
    return null;
  }

  /**
   * Get next item to retry if due
   */
  async getNextRetry(): Promise<MemoryBufferItem | null> {
    const now = Date.now();
    const dueIndex = this.retryQueue.findIndex(entry => entry.retryTime <= now);

    if (dueIndex >= 0) {
      const entry = this.retryQueue.splice(dueIndex, 1)[0];
      entry.item.status = MemoryBufferStatus.RETRYING;
      return entry.item;
    }

    return null;
  }

  /**
   * Mark item as successfully written
   */
  async markCompleted(itemOrId: MemoryBufferItem | string): Promise<void> {
    const memoryId = typeof itemOrId === 'string' ? itemOrId : itemOrId.id;
    const item = this.itemsCache.get(memoryId);

    if (item) {
      item.status = MemoryBufferStatus.COMPLETED;
      item.completedAt = Date.now();

      // Move to completed buffer (keep last 100)
      this.completedItems.push(item);
      if (this.completedItems.length > 100) {
        this.completedItems.shift();
      }

      // Update metrics
      this.metrics.completed++;
      const writeTime = item.completedAt - item.timestamp;
      this.metrics.totalWriteTime += writeTime;
      this.metrics.lastWriteTime = writeTime;

      console.info(
        `Memory ${memoryId} written successfully after ${item.attempts} attempts, ${writeTime}ms`
      );

      // Schedule cleanup
      setTimeout(() => this.cleanupItem(memoryId), 60000);
    }
  }

  /**
   * Mark item as permanently failed
   */
  async markFailed(memoryId: string, error: string): Promise<void> {
    const item = this.itemsCache.get(memoryId);

    if (item) {
      item.status = MemoryBufferStatus.FAILED;
      item.lastError = error;
      item.completedAt = Date.now();

      // Move to failed buffer (keep last 50)
      this.failedItems.push(item);
      if (this.failedItems.length > 50) {
        this.failedItems.shift();
      }

      // Update metrics
      this.metrics.failed++;

      console.error(
        `Memory ${memoryId} permanently failed after ${item.attempts} attempts: ${error}`
      );

      // Schedule cleanup
      setTimeout(() => this.cleanupItem(memoryId), 300000);
    }
  }

  /**
   * Schedule item for retry
   */
  async scheduleRetry(item: MemoryBufferItem, delay: number): Promise<void> {
    item.attempts++;
    item.status = MemoryBufferStatus.RETRYING;
    const retryTime = Date.now() + delay * 1000;

    this.retryQueue.push({ retryTime, item });
    this.retryQueue.sort((a, b) => a.retryTime - b.retryTime);

    this.metrics.retries++;

    console.debug(`Scheduled retry for ${item.id} in ${delay}s (attempt ${item.attempts})`);
  }

  /**
   * Get overall buffer status
   */
  async getStatus(): Promise<BufferStatus> {
    const pendingCount = this.pendingQueue.length;
    const retryCount = this.retryQueue.length;

    // Count processing items
    let processingCount = 0;
    for (const item of this.itemsCache.values()) {
      if (item.status === MemoryBufferStatus.WRITING) {
        processingCount++;
      }
    }

    return {
      pendingCount,
      retryCount,
      processingCount,
      completedCount: this.completedItems.length,
      failedCount: this.failedItems.length,
      totalInCache: this.itemsCache.size,
    };
  }

  /**
   * Get status of a specific buffered memory
   */
  async getItemStatus(memoryId: string): Promise<Record<string, any>> {
    const item = this.itemsCache.get(memoryId);

    if (!item) {
      // Check completed items
      const completed = this.completedItems.find(i => i.id === memoryId);
      if (completed) {
        return {
          status: completed.status,
          completedAt: completed.completedAt,
          attempts: completed.attempts,
        };
      }

      // Check failed items
      const failed = this.failedItems.find(i => i.id === memoryId);
      if (failed) {
        return {
          status: failed.status,
          error: failed.lastError,
          attempts: failed.attempts,
        };
      }

      return { status: 'unknown' };
    }

    return {
      status: item.status,
      attempts: item.attempts,
      queuedAt: item.timestamp,
      error: item.lastError,
      lastError: item.lastError,
      completedAt: item.completedAt,
    };
  }

  /**
   * Get buffer metrics
   */
  async getMetrics(): Promise<BufferMetrics> {
    const totalWrites = Math.max(this.metrics.completed + this.metrics.failed, 1);

    return {
      queued: this.metrics.queued,
      completed: this.metrics.completed,
      failed: this.metrics.failed,
      retries: this.metrics.retries,
      successRate: this.metrics.completed / totalWrites,
      queueDepth: this.metrics.queueDepth,
      retryQueueDepth: this.retryQueue.length,
      avgWriteTime: this.metrics.totalWriteTime / Math.max(this.metrics.completed, 1),
      lastWriteTime: this.metrics.lastWriteTime,
      cacheSize: this.itemsCache.size,
    };
  }

  private cleanupItem(memoryId: string): void {
    this.itemsCache.delete(memoryId);
    console.debug(`Cleaned up cache entry for ${memoryId}`);
  }

  private async persistIfNeeded(): Promise<void> {
    if (Date.now() - this.lastPersist > this.persistInterval) {
      await this.persist();
    }
  }

  /**
   * Persist buffer state to disk
   */
  async persist(): Promise<void> {
    if (this.persistLock) return;

    this.persistLock = true;
    try {
      const state = {
        version: '1.0',
        timestamp: Date.now(),
        metrics: this.metrics,
        pending: this.pendingQueue.map(item => this.itemToDict(item)),
        retry: this.retryQueue.map(entry => ({
          retryTime: entry.retryTime,
          item: this.itemToDict(entry.item),
        })),
        cache: Object.fromEntries(
          Array.from(this.itemsCache.entries()).map(([id, item]) => [id, this.itemToDict(item)])
        ),
      };

      // Write to temp file then rename (atomic)
      const tempFile = this.persistPath + '.tmp';
      await fs.writeFile(tempFile, JSON.stringify(state, null, 2));
      await fs.rename(tempFile, this.persistPath);

      this.lastPersist = Date.now();

      console.debug(
        `Persisted buffer: ${state.pending.length} pending, ${state.retry.length} retry`
      );
    } catch (error) {
      console.error('Failed to persist buffer:', error);
    } finally {
      this.persistLock = false;
    }
  }

  /**
   * Restore buffer from disk
   */
  async restore(): Promise<number> {
    try {
      const content = await fs.readFile(this.persistPath, 'utf-8');
      const state = JSON.parse(content);
      let restoredCount = 0;

      // Restore metrics
      Object.assign(this.metrics, state.metrics || {});

      // Restore pending items
      for (const itemData of state.pending || []) {
        const item = this.itemFromDict(itemData);
        this.pendingQueue.push(item);
        this.itemsCache.set(item.id, item);
        restoredCount++;
      }

      // Restore retry items
      for (const retryData of state.retry || []) {
        const item = this.itemFromDict(retryData.item);
        this.retryQueue.push({ retryTime: retryData.retryTime, item });
        this.itemsCache.set(item.id, item);
        restoredCount++;
      }

      // Restore cache items not in queues
      for (const [memoryId, itemData] of Object.entries(state.cache || {})) {
        if (!this.itemsCache.has(memoryId)) {
          const item = this.itemFromDict(itemData as any);
          this.itemsCache.set(memoryId, item);
        }
      }

      console.info(`Restored ${restoredCount} items from persistence`);
      return restoredCount;
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        console.debug('No persistence file found');
        return 0;
      }

      console.error('Failed to restore buffer:', error);
      // Rename corrupted file
      try {
        const backupPath = this.persistPath + '.corrupted';
        await fs.rename(this.persistPath, backupPath);
        console.info(`Moved corrupted persistence file to ${backupPath}`);
      } catch (renameError) {
        console.error('Failed to rename corrupted file:', renameError);
      }
      return 0;
    }
  }

  /**
   * Close buffer and persist final state
   */
  async close(): Promise<void> {
    await this.persist();
    console.info('Buffer closed and persisted');
  }

  private itemToDict(item: MemoryBufferItem): Record<string, any> {
    return {
      id: item.id,
      memoryData: item.memoryData,
      status: item.status,
      timestamp: item.timestamp,
      attempts: item.attempts,
      lastError: item.lastError,
      completedAt: item.completedAt,
    };
  }

  private itemFromDict(data: Record<string, any>): MemoryBufferItem {
    return {
      id: data.id,
      memoryData: data.memoryData,
      status: data.status as MemoryBufferStatus,
      timestamp: data.timestamp,
      attempts: data.attempts,
      lastError: data.lastError,
      completedAt: data.completedAt,
    };
  }
}
