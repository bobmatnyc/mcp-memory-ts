/**
 * Simplified database client for web application
 * This avoids importing from parent directory and handles database operations directly
 */

import { createClient, Client } from '@libsql/client';

export interface DatabaseConfig {
  url: string;
  authToken: string;
}

export class Database {
  private client: Client;

  constructor(config: DatabaseConfig) {
    this.client = createClient({
      url: config.url,
      authToken: config.authToken,
    });
  }

  /**
   * Ensure user exists in database
   */
  async ensureUser(email: string, name?: string, clerkUserId?: string): Promise<string> {
    // Check if user exists
    const existingUser = await this.client.execute({
      sql: 'SELECT id FROM users WHERE email = ?',
      args: [email],
    });

    if (existingUser.rows.length > 0) {
      return existingUser.rows[0].id as string;
    }

    // Create new user with Clerk ID if provided, otherwise use UUID
    const userId = clerkUserId || crypto.randomUUID();

    const result = await this.client.execute({
      sql: 'INSERT INTO users (id, email, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
      args: [
        userId,  // Use Clerk ID instead of always generating UUID
        email,
        name || email.split('@')[0],
        new Date().toISOString(),
        new Date().toISOString(),
      ],
    });

    return userId;
  }

  /**
   * Get statistics for a user
   */
  async getStatistics(email: string) {
    const userId = await this.ensureUser(email);

    // Get total memories
    const memoriesResult = await this.client.execute({
      sql: 'SELECT COUNT(*) as count FROM memories WHERE user_id = ?',
      args: [userId],
    });
    const totalMemories = Number(memoriesResult.rows[0].count);

    // Get memories by type
    const memoriesByTypeResult = await this.client.execute({
      sql: 'SELECT memory_type, COUNT(*) as count FROM memories WHERE user_id = ? GROUP BY memory_type',
      args: [userId],
    });
    const memoriesByType: Record<string, number> = {};
    memoriesByTypeResult.rows.forEach((row) => {
      memoriesByType[row.memory_type as string] = Number(row.count);
    });

    // Get total entities
    const entitiesResult = await this.client.execute({
      sql: 'SELECT COUNT(*) as count FROM entities WHERE user_id = ?',
      args: [userId],
    });
    const totalEntities = Number(entitiesResult.rows[0].count);

    // Get entities by type
    const entitiesByTypeResult = await this.client.execute({
      sql: 'SELECT entity_type, COUNT(*) as count FROM entities WHERE user_id = ? GROUP BY entity_type',
      args: [userId],
    });
    const entitiesByType: Record<string, number> = {};
    entitiesByTypeResult.rows.forEach((row) => {
      entitiesByType[row.entity_type as string] = Number(row.count);
    });

    // Get total interactions
    const interactionsResult = await this.client.execute({
      sql: 'SELECT COUNT(*) as count FROM interactions WHERE user_id = ?',
      args: [userId],
    });
    const totalInteractions = Number(interactionsResult.rows[0].count);

    // Get embedding coverage
    const memoriesWithEmbeddingsResult = await this.client.execute({
      sql: 'SELECT COUNT(*) as count FROM memories WHERE user_id = ? AND embedding IS NOT NULL AND embedding != \'\'',
      args: [userId],
    });
    const memoriesWithEmbeddings = Number(memoriesWithEmbeddingsResult.rows[0].count);
    const embeddingCoverage = totalMemories > 0
      ? `${Math.round((memoriesWithEmbeddings / totalMemories) * 100)}%`
      : '0%';

    // Vector search health
    const vectorSearchHealth = {
      enabled: true,
      memoriesWithValidEmbeddings: memoriesWithEmbeddings,
      memoriesWithoutEmbeddings: totalMemories - memoriesWithEmbeddings,
      coveragePercentage: totalMemories > 0
        ? Math.round((memoriesWithEmbeddings / totalMemories) * 100)
        : 0,
      recommendation: memoriesWithEmbeddings < totalMemories
        ? `${totalMemories - memoriesWithEmbeddings} memories need embeddings for semantic search`
        : 'All memories have embeddings',
    };

    return {
      totalMemories,
      memoriesByType,
      totalEntities,
      entitiesByType,
      totalInteractions,
      embeddingCoverage,
      vectorSearchHealth,
    };
  }

  /**
   * Search or list memories
   */
  async getMemories(email: string, options: { limit?: number; query?: string } = {}) {
    const userId = await this.ensureUser(email);
    const limit = options.limit || 20;

    // For now, just get recent memories (we'll add search later)
    const result = await this.client.execute({
      sql: `
        SELECT
          id, title, content, memory_type as memoryType,
          importance, tags, metadata, created_at as createdAt, updated_at as updatedAt
        FROM memories
        WHERE user_id = ?
        ORDER BY created_at DESC
        LIMIT ?
      `,
      args: [userId, limit],
    });

    return result.rows.map((row) => ({
      id: row.id,
      title: row.title,
      content: row.content,
      memoryType: row.memoryType,
      importance: Number(row.importance),
      tags: row.tags ? JSON.parse(row.tags as string) : [],
      metadata: row.metadata ? JSON.parse(row.metadata as string) : {},
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));
  }

  /**
   * Get a single memory by ID
   */
  async getMemory(email: string, memoryId: string) {
    const userId = await this.ensureUser(email);

    const result = await this.client.execute({
      sql: `
        SELECT
          id, title, content, memory_type as memoryType,
          importance, tags, metadata, created_at as createdAt, updated_at as updatedAt
        FROM memories
        WHERE user_id = ? AND id = ?
      `,
      args: [userId, memoryId],
    });

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      title: row.title,
      content: row.content,
      memoryType: row.memoryType,
      importance: Number(row.importance),
      tags: row.tags ? JSON.parse(row.tags as string) : [],
      metadata: row.metadata ? JSON.parse(row.metadata as string) : {},
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  /**
   * Create a new memory
   */
  async createMemory(
    email: string,
    data: {
      title: string;
      content: string;
      memoryType?: string;
      importance?: number;
      tags?: string[];
      metadata?: Record<string, any>;
    }
  ) {
    const userId = await this.ensureUser(email);
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    await this.client.execute({
      sql: `
        INSERT INTO memories
        (id, user_id, title, content, memory_type, importance, tags, metadata, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      args: [
        id,
        userId,
        data.title,
        data.content,
        data.memoryType || 'MEMORY',
        data.importance || 0.5,
        JSON.stringify(data.tags || []),
        JSON.stringify(data.metadata || {}),
        now,
        now,
      ],
    });

    return { id };
  }

  /**
   * Update a memory
   */
  async updateMemory(
    email: string,
    memoryId: string,
    data: {
      title?: string;
      content?: string;
      memoryType?: string;
      importance?: number;
      tags?: string[];
      metadata?: Record<string, any>;
    }
  ) {
    const userId = await this.ensureUser(email);

    // Build update query dynamically
    const updates: string[] = [];
    const args: any[] = [];

    if (data.title !== undefined) {
      updates.push('title = ?');
      args.push(data.title);
    }
    if (data.content !== undefined) {
      updates.push('content = ?');
      args.push(data.content);
    }
    if (data.memoryType !== undefined) {
      updates.push('memory_type = ?');
      args.push(data.memoryType);
    }
    if (data.importance !== undefined) {
      updates.push('importance = ?');
      args.push(data.importance);
    }
    if (data.tags !== undefined) {
      updates.push('tags = ?');
      args.push(JSON.stringify(data.tags));
    }
    if (data.metadata !== undefined) {
      updates.push('metadata = ?');
      args.push(JSON.stringify(data.metadata));
    }

    updates.push('updated_at = ?');
    args.push(new Date().toISOString());

    args.push(userId, memoryId);

    await this.client.execute({
      sql: `UPDATE memories SET ${updates.join(', ')} WHERE user_id = ? AND id = ?`,
      args,
    });

    return { success: true };
  }

  /**
   * Delete a memory
   */
  async deleteMemory(email: string, memoryId: string) {
    const userId = await this.ensureUser(email);

    await this.client.execute({
      sql: 'DELETE FROM memories WHERE user_id = ? AND id = ?',
      args: [userId, memoryId],
    });

    return { success: true };
  }

  /**
   * Get all entities
   */
  async getEntities(email: string, options: { limit?: number } = {}) {
    const userId = await this.ensureUser(email);
    const limit = options.limit || 50;

    const result = await this.client.execute({
      sql: `
        SELECT
          id, name, entity_type as entityType, description,
          metadata, created_at as createdAt, updated_at as updatedAt
        FROM entities
        WHERE user_id = ?
        ORDER BY created_at DESC
        LIMIT ?
      `,
      args: [userId, limit],
    });

    return result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      entityType: row.entityType,
      description: row.description,
      metadata: row.metadata ? JSON.parse(row.metadata as string) : {},
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));
  }

  /**
   * Close the database connection
   */
  close() {
    this.client.close();
  }

  /**
   * Get raw client for advanced operations
   */
  getClient(): Client {
    return this.client;
  }
}

/**
 * Create database connection with environment variables
 */
export async function createDatabaseConnection(): Promise<Database> {
  const url = process.env.TURSO_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (!url || !authToken) {
    throw new Error('Missing TURSO_URL or TURSO_AUTH_TOKEN environment variables');
  }

  return new Database({ url, authToken });
}

/**
 * Get DatabaseOperations instance for Google integration and advanced operations
 * This uses the parent project's DatabaseOperations class for full compatibility
 */
export async function getDatabaseOperations() {
  const url = process.env.TURSO_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (!url || !authToken) {
    throw new Error('Missing TURSO_URL or TURSO_AUTH_TOKEN environment variables');
  }

  // Import from parent project for full compatibility
  const { DatabaseConnection } = await import('../../src/database/connection.js');
  const { DatabaseOperations } = await import('../../src/database/operations.js');

  const connection = new DatabaseConnection({ url, authToken });
  await connection.connect();

  return new DatabaseOperations(connection);
}
