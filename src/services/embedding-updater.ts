/**
 * Automatic embedding update service
 * Regenerates embeddings when memories are created or updated
 */

import { DatabaseConnection } from '../database/index.js';
import { EmbeddingService } from '../utils/embeddings.js';

export interface EmbeddingUpdateOptions {
  batchSize?: number;
  retryAttempts?: number;
  retryDelay?: number;
}

export class EmbeddingUpdater {
  private db: DatabaseConnection;
  private embeddings: EmbeddingService;
  private isProcessing = false;
  private queue: Set<string> = new Set();
  private batchSize: number;
  private retryAttempts: number;
  private retryDelay: number;

  constructor(db: DatabaseConnection, openaiApiKey?: string, options: EmbeddingUpdateOptions = {}) {
    this.db = db;
    this.embeddings = new EmbeddingService(openaiApiKey);
    this.batchSize = options.batchSize || 10;
    this.retryAttempts = options.retryAttempts || 3;
    this.retryDelay = options.retryDelay || 1000;
  }

  /**
   * Queue a memory for embedding update
   */
  queueMemoryUpdate(memoryId: string): void {
    this.queue.add(memoryId);

    // Process queue if not already processing
    if (!this.isProcessing) {
      this.processQueue().catch(error => {
        console.error('[EmbeddingUpdater] Queue processing error:', error);
      });
    }
  }

  /**
   * Queue multiple memories for embedding update
   */
  queueMultipleUpdates(memoryIds: string[]): void {
    memoryIds.forEach(id => this.queue.add(id));

    if (!this.isProcessing) {
      this.processQueue().catch(error => {
        console.error('[EmbeddingUpdater] Queue processing error:', error);
      });
    }
  }

  /**
   * Process the queue of memories needing embedding updates
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.queue.size === 0) {
      return;
    }

    this.isProcessing = true;

    try {
      while (this.queue.size > 0) {
        // Get batch of memory IDs
        const batch = Array.from(this.queue).slice(0, this.batchSize);

        // Process batch
        await this.processBatch(batch);

        // Remove processed IDs from queue
        batch.forEach(id => this.queue.delete(id));

        // Rate limiting
        if (this.queue.size > 0) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Process a batch of memories
   */
  private async processBatch(memoryIds: string[]): Promise<void> {
    // Fetch memories from database
    const placeholders = memoryIds.map(() => '?').join(',');
    const result = await this.db.execute(
      `SELECT id, title, content, memory_type, tags
       FROM memories
       WHERE id IN (${placeholders})`,
      memoryIds
    );

    const memories = result.rows as any[];

    // Generate embeddings for each memory
    for (const memory of memories) {
      await this.updateMemoryEmbedding(memory);
    }
  }

  /**
   * Update embedding for a single memory
   */
  private async updateMemoryEmbedding(memory: any): Promise<void> {
    let attempts = 0;

    while (attempts < this.retryAttempts) {
      try {
        // Create embedding text
        const embeddingText = this.createEmbeddingText(memory);

        // Generate embedding
        const embedding = await this.embeddings.generateEmbedding(embeddingText);

        if (embedding && embedding.length > 0) {
          // Update memory with new embedding
          await this.db.execute(
            'UPDATE memories SET embedding = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [JSON.stringify(embedding), memory.id]
          );

          if (process.env.MCP_DEBUG) {
            console.error(`[EmbeddingUpdater] Updated embedding for memory ${memory.id}`);
          }

          return; // Success
        } else {
          console.warn(`[EmbeddingUpdater] No embedding generated for memory ${memory.id}`);
          return; // Skip if no API key
        }
      } catch (error) {
        attempts++;

        if (attempts >= this.retryAttempts) {
          console.error(
            `[EmbeddingUpdater] Failed to update embedding for memory ${memory.id} after ${attempts} attempts:`,
            error
          );
          return;
        }

        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, this.retryDelay * attempts));
      }
    }
  }

  /**
   * Create embedding text from memory data
   */
  private createEmbeddingText(memory: any): string {
    const parts = [memory.title, memory.content, memory.memory_type];

    // Add tags if present
    if (memory.tags) {
      try {
        const tags = typeof memory.tags === 'string' ? JSON.parse(memory.tags) : memory.tags;

        if (Array.isArray(tags) && tags.length > 0) {
          parts.push(`Tags: ${tags.join(', ')}`);
        }
      } catch {
        // Ignore parsing errors
      }
    }

    return parts.filter(Boolean).join(' ');
  }

  /**
   * Update all memories without embeddings
   */
  async updateAllMissingEmbeddings(): Promise<{ updated: number; failed: number }> {
    const result = await this.db.execute(`
      SELECT id
      FROM memories
      WHERE embedding IS NULL
         OR embedding = '[]'
         OR json_array_length(embedding) = 0
      ORDER BY created_at DESC
    `);

    const memoryIds = (result.rows as any[]).map(row => row.id);

    if (memoryIds.length === 0) {
      return { updated: 0, failed: 0 };
    }

    console.error(`[EmbeddingUpdater] Found ${memoryIds.length} memories without embeddings`);

    let updated = 0;
    let failed = 0;

    // Process in batches
    for (let i = 0; i < memoryIds.length; i += this.batchSize) {
      const batch = memoryIds.slice(i, i + this.batchSize);

      try {
        await this.processBatch(batch);
        updated += batch.length;
      } catch (error) {
        console.error(`[EmbeddingUpdater] Batch processing error:`, error);
        failed += batch.length;
      }

      // Rate limiting between batches
      if (i + this.batchSize < memoryIds.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    return { updated, failed };
  }

  /**
   * Monitor and update embeddings periodically
   */
  async startMonitoring(intervalMs: number = 60000): Promise<void> {
    console.error(`[EmbeddingUpdater] Starting monitoring with ${intervalMs}ms interval`);

    // Initial update
    await this.updateAllMissingEmbeddings();

    // Set up periodic updates
    setInterval(async () => {
      try {
        const stats = await this.updateAllMissingEmbeddings();
        if (stats.updated > 0) {
          console.error(`[EmbeddingUpdater] Updated ${stats.updated} embeddings`);
        }
      } catch (error) {
        console.error('[EmbeddingUpdater] Monitoring error:', error);
      }
    }, intervalMs);
  }
}

/**
 * Create and configure an embedding updater instance
 */
export function createEmbeddingUpdater(
  db: DatabaseConnection,
  openaiApiKey?: string,
  options?: EmbeddingUpdateOptions
): EmbeddingUpdater {
  const apiKey = openaiApiKey || process.env.OPENAI_API_KEY;
  return new EmbeddingUpdater(db, apiKey, options);
}
