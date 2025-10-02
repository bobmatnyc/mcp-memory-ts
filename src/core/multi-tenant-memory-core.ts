/**
 * Multi-Tenant Memory Core
 * Enhanced memory core with complete tenant isolation and per-user operations
 */

import { MemoryCore } from './memory-core.js';
import { MemoryBuffer } from './buffer.js';
import { AsyncMemoryWriter } from './writer.js';
import { DatabaseConnection } from '../database/index.js';
import { MemoryType, EntityType, ImportanceLevel, MCPToolResultStatus } from '../types/enums.js';
import type { MCPToolResult, VectorSearchOptions } from '../types/base.js';

export interface UserBuffer {
  userId: string;
  maxSize: number;
  flushInterval: number;
  buffer: Array<Record<string, any>>;
  lastFlush: Date;
}

export interface UserQuota {
  maxMemories: number;
  maxEntities: number;
  maxInteractions: number;
  maxStorageBytes: number;
  dailyApiCalls: number;
}

export interface UserUsage {
  memoriesCount: number;
  entitiesCount: number;
  interactionsCount: number;
  storageBytes: number;
  dailyApiCalls: number;
  lastApiCall: Date;
}

export interface TenantStats {
  userId: string;
  usage: UserUsage;
  quota: UserQuota;
  isOverQuota: boolean;
  bufferStats?: any;
}

export class UserBufferManager {
  private buffers: Map<string, UserBuffer> = new Map();
  private locks: Map<string, Promise<void>> = new Map();

  async getBuffer(userId: string): Promise<UserBuffer> {
    if (!this.buffers.has(userId)) {
      this.buffers.set(userId, {
        userId,
        maxSize: 100,
        flushInterval: 60000, // 60 seconds
        buffer: [],
        lastFlush: new Date(),
      });
    }
    return this.buffers.get(userId)!;
  }

  async addToBuffer(userId: string, operation: Record<string, any>): Promise<boolean> {
    const buffer = await this.getBuffer(userId);
    buffer.buffer.push(operation);

    // Return true if buffer should be flushed
    return buffer.buffer.length >= buffer.maxSize;
  }

  async getAndClearBuffer(userId: string): Promise<Array<Record<string, any>>> {
    const buffer = await this.getBuffer(userId);
    const operations = [...buffer.buffer];
    buffer.buffer = [];
    buffer.lastFlush = new Date();
    return operations;
  }

  shouldFlush(userId: string): boolean {
    const buffer = this.buffers.get(userId);
    if (!buffer) return false;

    const timeSinceFlush = Date.now() - buffer.lastFlush.getTime();
    return timeSinceFlush >= buffer.flushInterval;
  }

  async removeBuffer(userId: string): Promise<void> {
    this.buffers.delete(userId);
    this.locks.delete(userId);
  }

  async flushAll(): Promise<Array<{ userId: string; operations: Array<Record<string, any>> }>> {
    const results: Array<{ userId: string; operations: Array<Record<string, any>> }> = [];

    for (const [userId, buffer] of this.buffers.entries()) {
      if (buffer.buffer.length > 0) {
        const operations = await this.getAndClearBuffer(userId);
        results.push({ userId, operations });
      }
    }

    return results;
  }
}

export class MultiTenantMemoryCore extends MemoryCore {
  private bufferManager: UserBufferManager;
  private memoryBuffer: MemoryBuffer;
  private memoryWriter: AsyncMemoryWriter;
  private userQuotas: Map<string, UserQuota> = new Map();
  private userUsage: Map<string, UserUsage> = new Map();
  private rateLimits: Map<string, { count: number; resetTime: number }> = new Map();

  // Default quotas
  private defaultQuota: UserQuota = {
    maxMemories: 10000,
    maxEntities: 1000,
    maxInteractions: 50000,
    maxStorageBytes: 100 * 1024 * 1024, // 100MB
    dailyApiCalls: 10000,
  };

  constructor(db: DatabaseConnection, openaiApiKey?: string) {
    super(db, openaiApiKey);
    this.bufferManager = new UserBufferManager();
    this.memoryBuffer = new MemoryBuffer();
    this.memoryWriter = new AsyncMemoryWriter(this.memoryBuffer, this);
  }

  /**
   * Initialize the multi-tenant memory core
   */
  override async initialize(): Promise<void> {
    await super.initialize();
    await this.memoryBuffer.restore();
    await this.memoryWriter.start();
    console.info('Multi-tenant memory core initialized');
  }

  /**
   * Close the multi-tenant memory core
   */
  override async close(): Promise<void> {
    await this.memoryWriter.stop();
    await this.memoryBuffer.close();
    await super.close();
    console.info('Multi-tenant memory core closed');
  }

  /**
   * Set quota for a user
   */
  async setUserQuota(userId: string, quota: Partial<UserQuota>): Promise<void> {
    const currentQuota = this.userQuotas.get(userId) || { ...this.defaultQuota };
    this.userQuotas.set(userId, { ...currentQuota, ...quota });
  }

  /**
   * Get quota for a user
   */
  async getUserQuota(userId: string): Promise<UserQuota> {
    return this.userQuotas.get(userId) || { ...this.defaultQuota };
  }

  /**
   * Check if user is within quota limits
   */
  async checkQuota(
    userId: string,
    operation: string
  ): Promise<{ allowed: boolean; reason?: string }> {
    const quota = await this.getUserQuota(userId);
    const usage = await this.getUserUsage(userId);

    // Check daily API calls
    if (usage.dailyApiCalls >= quota.dailyApiCalls) {
      return { allowed: false, reason: 'Daily API call limit exceeded' };
    }

    // Check specific operation limits
    switch (operation) {
      case 'add_memory':
        if (usage.memoriesCount >= quota.maxMemories) {
          return { allowed: false, reason: 'Memory limit exceeded' };
        }
        break;
      case 'create_entity':
        if (usage.entitiesCount >= quota.maxEntities) {
          return { allowed: false, reason: 'Entity limit exceeded' };
        }
        break;
      case 'add_interaction':
        if (usage.interactionsCount >= quota.maxInteractions) {
          return { allowed: false, reason: 'Interaction limit exceeded' };
        }
        break;
    }

    // Check storage limit
    if (usage.storageBytes >= quota.maxStorageBytes) {
      return { allowed: false, reason: 'Storage limit exceeded' };
    }

    return { allowed: true };
  }

  /**
   * Get current usage for a user
   */
  async getUserUsage(userId: string): Promise<UserUsage> {
    let usage = this.userUsage.get(userId);

    if (!usage) {
      // Calculate usage from database
      usage = await this.calculateUserUsage(userId);
      this.userUsage.set(userId, usage);
    }

    return usage;
  }

  private async calculateUserUsage(userId: string): Promise<UserUsage> {
    // Get counts from database
    const memoriesResult = await this.db.execute(
      'SELECT COUNT(*) as count, COALESCE(SUM(LENGTH(content)), 0) as bytes FROM memories WHERE user_id = ?',
      [userId]
    );

    const entitiesResult = await this.db.execute(
      'SELECT COUNT(*) as count FROM entities WHERE user_id = ?',
      [userId]
    );

    const interactionsResult = await this.db.execute(
      'SELECT COUNT(*) as count FROM interactions WHERE user_id = ?',
      [userId]
    );

    // Get daily API calls (reset at midnight)
    const today = new Date().toISOString().split('T')[0];
    const apiCallsResult = await this.db.execute(
      'SELECT COUNT(*) as count FROM interactions WHERE user_id = ? AND DATE(created_at) = ?',
      [userId, today]
    );

    const memoriesRow = memoriesResult.rows[0] as any;
    const entitiesRow = entitiesResult.rows[0] as any;
    const interactionsRow = interactionsResult.rows[0] as any;
    const apiCallsRow = apiCallsResult.rows[0] as any;

    return {
      memoriesCount: Number(memoriesRow?.count || 0),
      entitiesCount: Number(entitiesRow?.count || 0),
      interactionsCount: Number(interactionsRow?.count || 0),
      storageBytes: Number(memoriesRow?.bytes || 0),
      dailyApiCalls: Number(apiCallsRow?.count || 0),
      lastApiCall: new Date(),
    };
  }

  /**
   * Update usage after an operation
   */
  private async updateUsage(userId: string, operation: string, delta: number = 1): Promise<void> {
    const usage = await this.getUserUsage(userId);

    switch (operation) {
      case 'add_memory':
        usage.memoriesCount += delta;
        break;
      case 'create_entity':
        usage.entitiesCount += delta;
        break;
      case 'add_interaction':
        usage.interactionsCount += delta;
        break;
    }

    usage.dailyApiCalls += 1;
    usage.lastApiCall = new Date();

    this.userUsage.set(userId, usage);
  }

  /**
   * Add memory with quota checking and buffering
   */
  override async addMemory(
    title: string,
    content: string,
    memoryType: MemoryType = MemoryType.MEMORY,
    options: {
      userId?: string;
      importance?: ImportanceLevel;
      tags?: string[];
      entityIds?: number[];
      metadata?: Record<string, unknown>;
      generateEmbedding?: boolean;
      useBuffer?: boolean;
    } = {}
  ): Promise<MCPToolResult> {
    const userId = this.getUserId(options.userId);

    // Check quota
    const quotaCheck = await this.checkQuota(userId, 'add_memory');
    if (!quotaCheck.allowed) {
      return {
        status: MCPToolResultStatus.ERROR,
        message: 'Quota exceeded',
        error: quotaCheck.reason,
      };
    }

    // If buffering is enabled, add to buffer
    if (options.useBuffer !== false) {
      const memoryData = {
        title,
        content,
        memoryType,
        userId,
        importance: options.importance || ImportanceLevel.MEDIUM,
        tags: options.tags,
        entityIds: options.entityIds,
        generateEmbedding: options.generateEmbedding !== false,
      };

      try {
        const memoryId = await this.memoryBuffer.add(memoryData);
        await this.updateUsage(userId, 'add_memory');

        return {
          status: MCPToolResultStatus.SUCCESS,
          message: 'Memory queued for processing',
          data: { id: memoryId, buffered: true },
        };
      } catch (error) {
        return {
          status: MCPToolResultStatus.ERROR,
          message: 'Failed to queue memory',
          error: String(error),
        };
      }
    }

    // Direct write (bypass buffer)
    const result = await super.addMemory(title, content, memoryType, options);
    if (result.status === MCPToolResultStatus.SUCCESS) {
      await this.updateUsage(userId, 'add_memory');
    }

    return result;
  }

  /**
   * Get tenant statistics
   */
  async getTenantStats(userId: string): Promise<TenantStats> {
    const usage = await this.getUserUsage(userId);
    const quota = await this.getUserQuota(userId);
    const bufferStats = await this.memoryBuffer.getStatus();

    const isOverQuota =
      usage.memoriesCount >= quota.maxMemories ||
      usage.entitiesCount >= quota.maxEntities ||
      usage.interactionsCount >= quota.maxInteractions ||
      usage.storageBytes >= quota.maxStorageBytes ||
      usage.dailyApiCalls >= quota.dailyApiCalls;

    return {
      userId,
      usage,
      quota,
      isOverQuota,
      bufferStats,
    };
  }

  /**
   * Get buffer status for a user
   */
  async getBufferStatus(): Promise<any> {
    return await this.memoryBuffer.getStatus();
  }

  /**
   * Get writer statistics
   */
  async getWriterStats(): Promise<any> {
    return await this.memoryWriter.getStats();
  }
}
