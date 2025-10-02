/**
 * Async Memory Writer
 * Background worker for processing buffered memory writes with retry logic
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { MemoryBuffer, MemoryBufferItem, MemoryBufferStatus } from './buffer.js';
import { MemoryCore } from './memory-core.js';
import { MemoryType, ImportanceLevel, MCPToolResultStatus } from '../types/enums.js';

export class CircuitBreaker {
  private failureCount = 0;
  private lastFailureTime = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';

  constructor(
    private failureThreshold = 5,
    private recoveryTimeout = 60000 // 60 seconds
  ) {}

  recordSuccess(): void {
    if (this.state === 'half-open') {
      console.info('Circuit breaker closing after successful operation');
      this.state = 'closed';
      this.failureCount = 0;
    }
  }

  recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.failureThreshold) {
      if (this.state !== 'open') {
        console.error(`Circuit breaker opening after ${this.failureCount} failures`);
        this.state = 'open';
      }
    }
  }

  canProceed(): boolean {
    if (this.state === 'closed') {
      return true;
    }

    if (this.state === 'open') {
      // Check if recovery timeout has passed
      if (Date.now() - this.lastFailureTime > this.recoveryTimeout) {
        console.info('Circuit breaker entering half-open state');
        this.state = 'half-open';
        return true;
      }
      return false;
    }

    // half-open state
    return true;
  }

  getState(): string {
    return this.state;
  }

  getFailureCount(): number {
    return this.failureCount;
  }
}

export interface WriterStats {
  writesAttempted: number;
  writesSucceeded: number;
  writesFailed: number;
  writesRetried: number;
  lastSuccessTime: number;
  lastFailureTime: number;
  circuitBreakerState: string;
  circuitBreakerFailures: number;
}

export class AsyncMemoryWriter {
  private circuitBreaker: CircuitBreaker;
  private running = false;
  private pendingTask: Promise<void> | null = null;
  private retryTask: Promise<void> | null = null;
  private failureLogPath: string;

  private stats = {
    writesAttempted: 0,
    writesSucceeded: 0,
    writesFailed: 0,
    writesRetried: 0,
    lastSuccessTime: 0,
    lastFailureTime: 0,
  };

  constructor(
    private buffer: MemoryBuffer,
    private memoryCore: MemoryCore,
    private maxRetries = 3,
    private retryDelays = [1000, 5000, 30000], // milliseconds
    failureLogPath?: string
  ) {
    this.circuitBreaker = new CircuitBreaker();
    this.failureLogPath = failureLogPath || join(homedir(), '.mcp', 'failed_memories.jsonl');
    this.ensureFailureLogDir();
  }

  private async ensureFailureLogDir(): Promise<void> {
    const dir = this.failureLogPath.substring(0, this.failureLogPath.lastIndexOf('/'));
    try {
      await fs.mkdir(dir, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }
  }

  /**
   * Start background processing
   */
  async start(): Promise<void> {
    if (this.running) {
      console.warn('Writer already running');
      return;
    }

    this.running = true;

    // Start processing tasks
    this.pendingTask = this.processPendingLoop();
    this.retryTask = this.processRetryLoop();

    console.info('Async memory writer started');
  }

  /**
   * Stop background processing
   */
  async stop(): Promise<void> {
    this.running = false;

    // Wait for tasks to complete
    if (this.pendingTask) {
      await this.pendingTask;
    }
    if (this.retryTask) {
      await this.retryTask;
    }

    console.info('Async memory writer stopped');
  }

  private async processPendingLoop(): Promise<void> {
    while (this.running) {
      try {
        // Get next item from buffer
        const item = await this.buffer.getNextPending();
        if (!item) {
          await this.sleep(100); // Short sleep if no items
          continue;
        }

        // Check circuit breaker
        if (!this.circuitBreaker.canProceed()) {
          // Circuit is open, retry later
          await this.scheduleRetry(item, 30000);
          console.warn(`Circuit open, postponing write for ${item.id}`);
          continue;
        }

        // Attempt to write
        const success = await this.writeWithVerification(item);

        if (success) {
          await this.buffer.markCompleted(item.id);
          this.circuitBreaker.recordSuccess();
        } else {
          await this.handleWriteFailure(item);
          this.circuitBreaker.recordFailure();
        }
      } catch (error) {
        console.error('Error in pending loop:', error);
        await this.sleep(1000);
      }
    }
  }

  private async processRetryLoop(): Promise<void> {
    while (this.running) {
      try {
        // Check for items to retry
        const item = await this.buffer.getNextRetry();
        if (!item) {
          await this.sleep(1000); // Sleep if no retries
          continue;
        }

        // Check circuit breaker
        if (!this.circuitBreaker.canProceed()) {
          // Put back for later retry
          await this.scheduleRetry(item, 60000);
          continue;
        }

        // Attempt to write
        const success = await this.writeWithVerification(item);

        if (success) {
          await this.buffer.markCompleted(item.id);
          this.circuitBreaker.recordSuccess();
        } else {
          await this.handleWriteFailure(item);
          this.circuitBreaker.recordFailure();
        }
      } catch (error) {
        console.error('Error in retry loop:', error);
        await this.sleep(1000);
      }
    }
  }

  private async writeWithVerification(item: MemoryBufferItem): Promise<boolean> {
    this.stats.writesAttempted++;

    try {
      const memoryData = item.memoryData;

      // Write to database using memory core
      const result = await this.memoryCore.addMemory(
        memoryData.title || '',
        memoryData.content || '',
        memoryData.memoryType || MemoryType.MEMORY,
        {
          userId: memoryData.userId,
          importance: memoryData.importance || ImportanceLevel.MEDIUM,
          tags: memoryData.tags,
          entityIds: memoryData.entityIds,
          generateEmbedding: memoryData.generateEmbedding !== false,
        }
      );

      // Check result
      if (result.status === MCPToolResultStatus.SUCCESS) {
        this.stats.writesSucceeded++;
        this.stats.lastSuccessTime = Date.now();
        console.debug(`Memory ${item.id} written successfully`);
        return true;
      } else {
        // Write failed
        item.lastError = result.error || 'Unknown error';
        console.warn(`Memory ${item.id} write failed: ${item.lastError}`);
        return false;
      }
    } catch (error) {
      item.lastError = `Unexpected error: ${String(error)}`;
      console.error(`Unexpected error writing ${item.id}:`, error);
      return false;
    }
  }

  private async handleWriteFailure(item: MemoryBufferItem): Promise<void> {
    this.stats.writesFailed++;
    this.stats.lastFailureTime = Date.now();

    if (item.attempts >= this.maxRetries) {
      // Permanent failure
      await this.handlePermanentFailure(item);
    } else {
      // Schedule retry
      await this.scheduleRetry(item);
    }
  }

  private async scheduleRetry(item: MemoryBufferItem, delay?: number): Promise<void> {
    if (delay === undefined) {
      // Calculate delay based on attempts
      const delayIndex = Math.min(item.attempts, this.retryDelays.length - 1);
      delay = this.retryDelays[delayIndex];
    }

    await this.buffer.scheduleRetry(item, delay / 1000); // Convert to seconds
    this.stats.writesRetried++;

    console.info(
      `Scheduled retry for ${item.id} in ${delay}ms (attempt ${item.attempts + 1}/${this.maxRetries})`
    );
  }

  private async handlePermanentFailure(item: MemoryBufferItem): Promise<void> {
    await this.buffer.markFailed(item.id, item.lastError || 'Max retries exceeded');

    // Log to failure file for manual recovery
    try {
      const failureRecord = {
        timestamp: new Date().toISOString(),
        memoryId: item.id,
        memoryData: item.memoryData,
        attempts: item.attempts,
        lastError: item.lastError,
        queuedAt: item.timestamp,
      };

      await fs.appendFile(this.failureLogPath, JSON.stringify(failureRecord) + '\n');
      console.error(`Logged permanent failure for ${item.id} to ${this.failureLogPath}`);
    } catch (error) {
      console.error(`Failed to log permanent failure for ${item.id}:`, error);
    }
  }

  /**
   * Get writer statistics
   */
  async getStats(): Promise<WriterStats> {
    const bufferMetrics = await this.buffer.getMetrics();

    return {
      ...this.stats,
      circuitBreakerState: this.circuitBreaker.getState(),
      circuitBreakerFailures: this.circuitBreaker.getFailureCount(),
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
