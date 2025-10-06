/**
 * Database operations for CRUD functionality
 */

import type { DatabaseConnection } from './connection.js';
import type { User, Entity, Memory, Interaction } from '../types/base.js';
import { sanitizeTags, parseMetadata, stringifyMetadata } from '../models/index.js';
import { SchemaCompatibility, ApiKeySecurity } from './compatibility.js';

export class DatabaseOperations {
  constructor(private db: DatabaseConnection) {}

  // User operations
  async createUser(user: User): Promise<User> {
    // Use the actual database columns including api_key_hash
    const sql = `
      INSERT INTO users (id, email, name, organization, api_key_hash, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    await this.db.execute(sql, [
      user.id,
      user.email,
      user.name || null,
      user.organization || null,
      user.apiKey ? ApiKeySecurity.hashApiKey(user.apiKey) : null, // Hash API key if provided
      user.isActive !== undefined ? (user.isActive ? 1 : 0) : 1,
      user.createdAt || new Date().toISOString(),
      user.updatedAt || new Date().toISOString(),
    ]);

    return user;
  }

  async getUserById(id: string): Promise<User | null> {
    const result = await this.db.execute('SELECT * FROM users WHERE id = ?', [id]);
    return result.rows.length > 0 ? this.mapRowToUser(result.rows[0] as any) : null;
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const result = await this.db.execute('SELECT * FROM users WHERE email = ?', [email]);
    return result.rows.length > 0 ? this.mapRowToUser(result.rows[0] as any) : null;
  }

  async getUserByApiKey(apiKey: string): Promise<User | null> {
    // Hash the API key for comparison
    const hashedKey = ApiKeySecurity.hashApiKey(apiKey);

    // Query using api_key_hash column (the actual column in the database)
    const result = await this.db.execute('SELECT * FROM users WHERE api_key_hash = ?', [hashedKey]);

    return result.rows.length > 0 ? this.mapRowToUser(result.rows[0] as any) : null;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | null> {
    const fields: string[] = [];
    const values: any[] = [];

    for (const [key, value] of Object.entries(updates)) {
      if (key === 'id' || value === undefined) continue;

      const dbKey =
        key === 'isActive'
          ? 'is_active'
          : key === 'apiKey'
            ? 'api_key_hash' // Use api_key_hash for new schema
            : key === 'oauthProvider'
              ? 'oauth_provider'
              : key === 'oauthId'
                ? 'oauth_id'
                : key === 'createdAt'
                  ? 'created_at'
                  : key === 'updatedAt'
                    ? 'updated_at'
                    : key;

      fields.push(`${dbKey} = ?`);

      if (key === 'metadata') {
        values.push(stringifyMetadata(value as Record<string, unknown>));
      } else if (key === 'isActive') {
        values.push(value ? 1 : 0);
      } else if (key === 'apiKey') {
        // Hash API key before storing
        values.push(ApiKeySecurity.hashApiKey(value as string));
      } else {
        values.push(value);
      }
    }

    if (fields.length === 0) return this.getUserById(id);

    fields.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(id);

    await this.db.execute(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values);

    return this.getUserById(id);
  }

  async deleteUser(id: string): Promise<boolean> {
    const result = await this.db.execute('DELETE FROM users WHERE id = ?', [id]);
    return (result as any).changes > 0;
  }

  // Entity operations
  async createEntity(entity: Omit<Entity, 'id'>): Promise<Entity> {
    // Use compatibility layer to map entity fields
    const mappedEntity = SchemaCompatibility.mapEntityForDatabase(entity);

    // Let database auto-generate ID (entities table uses INTEGER PRIMARY KEY AUTOINCREMENT)
    const sql = `
      INSERT INTO entities (user_id, name, entity_type, person_type, description,
                           company, title, email, phone, address, notes, tags, metadata,
                           created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const result = await this.db.execute(sql, [
      mappedEntity.user_id || mappedEntity.userId || null,
      mappedEntity.name,
      mappedEntity.entity_type || mappedEntity.entityType,
      mappedEntity.person_type || mappedEntity.personType || null,
      mappedEntity.description || null,
      mappedEntity.company || null,
      mappedEntity.title || null,
      mappedEntity.email || null,
      mappedEntity.phone || null,
      mappedEntity.address || null,
      mappedEntity.notes || null,
      typeof mappedEntity.tags === 'string'
        ? mappedEntity.tags
        : JSON.stringify(sanitizeTags(mappedEntity.tags)),
      typeof mappedEntity.metadata === 'string'
        ? mappedEntity.metadata
        : stringifyMetadata(mappedEntity.metadata),
      mappedEntity.created_at || mappedEntity.createdAt || new Date().toISOString(),
      mappedEntity.updated_at || mappedEntity.updatedAt || new Date().toISOString(),
    ]);

    return { ...entity, id: result.lastInsertRowid };
  }

  async getEntityById(id: number | string, userId: string): Promise<Entity | null> {
    const result = await this.db.execute('SELECT * FROM entities WHERE id = ? AND user_id = ?', [
      id,
      userId,
    ]);
    return result.rows.length > 0 ? this.mapRowToEntity(result.rows[0] as any) : null;
  }

  async getEntitiesByUserId(userId: string, limit = 100): Promise<Entity[]> {
    const result = await this.db.execute(
      'SELECT * FROM entities WHERE user_id = ? ORDER BY created_at DESC LIMIT ?',
      [userId, limit]
    );
    return result.rows.map(row => this.mapRowToEntity(row as any));
  }

  async searchEntities(userId: string, query: string, limit = 10): Promise<Entity[]> {
    const result = await this.db.execute(
      `
      SELECT e.* FROM entities e
      JOIN entities_fts fts ON e.id = fts.rowid
      WHERE e.user_id = ? AND entities_fts MATCH ?
      ORDER BY rank LIMIT ?
    `,
      [userId, query, limit]
    );

    return result.rows.map(row => this.mapRowToEntity(row as any));
  }

  async updateEntity(id: string, updates: Partial<Entity>, userId: string): Promise<Entity | null> {
    const mappedUpdates = SchemaCompatibility.mapEntityForDatabase(updates as any);
    const fields: string[] = [];
    const values: any[] = [];

    for (const [key, value] of Object.entries(mappedUpdates)) {
      if (key === 'id' || key === 'user_id' || value === undefined) continue;

      // Convert camelCase to snake_case if needed
      const dbKey = key.includes('_') ? key : key.replace(/([A-Z])/g, '_$1').toLowerCase();
      fields.push(`${dbKey} = ?`);

      if (key === 'tags') {
        values.push(typeof value === 'string' ? value : JSON.stringify(sanitizeTags(value)));
      } else if (key === 'metadata') {
        values.push(typeof value === 'string' ? value : stringifyMetadata(value));
      } else if (key === 'contact_info' && typeof value === 'object') {
        values.push(JSON.stringify(value));
      } else if (typeof value === 'boolean') {
        values.push(value ? 1 : 0);
      } else {
        values.push(value);
      }
    }

    // Always update the updated_at timestamp
    fields.push('updated_at = ?');
    values.push(new Date().toISOString());

    if (fields.length === 1) {
      // Only updated_at changed, nothing to update
      return this.getEntityById(id, userId);
    }

    values.push(id, userId);
    const sql = `UPDATE entities SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`;

    await this.db.execute(sql, values);
    return this.getEntityById(id, userId);
  }

  // Memory operations
  async createMemory(memory: Omit<Memory, 'id'>): Promise<Memory> {
    // Use compatibility layer to map memory fields
    const mappedMemory = SchemaCompatibility.mapMemoryForDatabase(memory);

    // Let database auto-generate ID (memories table uses INTEGER PRIMARY KEY AUTOINCREMENT)
    const sql = `
      INSERT INTO memories (user_id, title, content, memory_type, importance,
                           tags, entity_ids, embedding, metadata, is_archived,
                           created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const result = await this.db.execute(sql, [
      mappedMemory.user_id || mappedMemory.userId || null,
      mappedMemory.title,
      mappedMemory.content,
      mappedMemory.memory_type || mappedMemory.memoryType,
      mappedMemory.importance,
      typeof mappedMemory.tags === 'string'
        ? mappedMemory.tags
        : JSON.stringify(sanitizeTags(mappedMemory.tags)),
      typeof mappedMemory.entity_ids === 'string'
        ? mappedMemory.entity_ids
        : JSON.stringify(mappedMemory.entity_ids || mappedMemory.entityIds || []),
      typeof mappedMemory.embedding === 'string'
        ? mappedMemory.embedding
        : JSON.stringify(mappedMemory.embedding || []),
      typeof mappedMemory.metadata === 'string'
        ? mappedMemory.metadata
        : stringifyMetadata(mappedMemory.metadata),
      mappedMemory.is_archived !== undefined
        ? mappedMemory.is_archived
        : mappedMemory.isArchived
          ? 1
          : 0,
      mappedMemory.created_at || mappedMemory.createdAt || new Date().toISOString(),
      mappedMemory.updated_at || mappedMemory.updatedAt || new Date().toISOString(),
    ]);

    return { ...memory, id: result.lastInsertRowid };
  }

  async getMemoryById(id: number | string, userId: string): Promise<Memory | null> {
    const result = await this.db.execute('SELECT * FROM memories WHERE id = ? AND user_id = ?', [
      id,
      userId,
    ]);
    return result.rows.length > 0 ? this.mapRowToMemory(result.rows[0] as any) : null;
  }

  async getMemoriesByUserId(userId: string, limit = 100): Promise<Memory[]> {
    const result = await this.db.execute(
      'SELECT * FROM memories WHERE user_id = ? AND is_archived = 0 ORDER BY created_at DESC LIMIT ?',
      [userId, limit]
    );
    return result.rows.map(row => this.mapRowToMemory(row as any));
  }

  async searchMemories(userId: string, query: string, limit = 10): Promise<Memory[]> {
    try {
      // Tokenize query into words for multi-word search
      const words = query
        .trim()
        .split(/\s+/)
        .filter(w => w.length > 0);

      if (words.length === 0) {
        return [];
      }

      // For single word, search in title, content, AND metadata
      if (words.length === 1) {
        const result = await this.db.execute(
          `
          SELECT * FROM memories
          WHERE user_id = ? AND is_archived = 0
          AND (
            LOWER(title) LIKE LOWER(?) OR
            LOWER(content) LIKE LOWER(?) OR
            (metadata IS NOT NULL AND json_valid(metadata) AND EXISTS (
              SELECT 1 FROM json_each(metadata)
              WHERE LOWER(json_each.value) LIKE LOWER(?)
            ))
          )
          ORDER BY updated_at DESC
          LIMIT ?
        `,
          [userId, `%${words[0]}%`, `%${words[0]}%`, `%${words[0]}%`, limit]
        );

        return result.rows.map(row => this.mapRowToMemory(row as any));
      }

      // For multiple words, use OR logic to find memories containing ANY of the words
      // Search across title, content, AND metadata
      const conditions = words
        .map(
          () => `(
        LOWER(title) LIKE LOWER(?) OR
        LOWER(content) LIKE LOWER(?) OR
        (metadata IS NOT NULL AND json_valid(metadata) AND EXISTS (
          SELECT 1 FROM json_each(metadata)
          WHERE LOWER(json_each.value) LIKE LOWER(?)
        ))
      )`
        )
        .join(' OR ');
      const params = words.flatMap(w => [`%${w}%`, `%${w}%`, `%${w}%`]);

      const result = await this.db.execute(
        `
        SELECT * FROM memories
        WHERE user_id = ? AND is_archived = 0
        AND (${conditions})
        ORDER BY updated_at DESC
        LIMIT ?
      `,
        [userId, ...params, limit]
      );

      return result.rows.map(row => this.mapRowToMemory(row as any));
    } catch (error) {
      console.error('Search memories error:', error);
      // Return empty array on error rather than throwing
      return [];
    }
  }

  // Helper methods to map database rows to objects
  private mapRowToUser(row: any): User {
    return {
      id: row.id,
      email: row.email,
      name: row.name,
      organization: row.organization,
      apiKey: row.api_key_hash, // Use the actual column name from database
      oauthProvider: row.oauth_provider,
      oauthId: row.oauth_id,
      isActive: row.is_active !== undefined ? Boolean(row.is_active) : true,
      metadata: parseMetadata(row.metadata),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapRowToEntity(row: any): Entity {
    // Use compatibility layer for proper field mapping
    return SchemaCompatibility.mapEntityFromDatabase(row);
  }

  private mapRowToMemory(row: any): Memory {
    // Use compatibility layer for proper field mapping
    return SchemaCompatibility.mapMemoryFromDatabase(row);
  }
}
