/**
 * Database operations for CRUD functionality
 */

import type { DatabaseConnection } from './connection.js';
import type { User, Entity, Memory, Interaction } from '../types/base.js';
import { sanitizeTags, parseMetadata, stringifyMetadata } from '../models/index.js';

export class DatabaseOperations {
  constructor(private db: DatabaseConnection) {}

  // User operations
  async createUser(user: User): Promise<User> {
    const sql = `
      INSERT INTO users (id, email, name, organization, api_key, oauth_provider, oauth_id, 
                        is_active, metadata, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    await this.db.execute(sql, [
      user.id,
      user.email,
      user.name || null,
      user.organization || null,
      user.apiKey || null,
      user.oauthProvider || null,
      user.oauthId || null,
      user.isActive ? 1 : 0,
      stringifyMetadata(user.metadata),
      user.createdAt,
      user.updatedAt,
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
    const result = await this.db.execute('SELECT * FROM users WHERE api_key = ?', [apiKey]);
    return result.rows.length > 0 ? this.mapRowToUser(result.rows[0] as any) : null;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | null> {
    const fields: string[] = [];
    const values: any[] = [];

    for (const [key, value] of Object.entries(updates)) {
      if (key === 'id' || value === undefined) continue;
      
      const dbKey = key === 'isActive' ? 'is_active' : 
                   key === 'apiKey' ? 'api_key' :
                   key === 'oauthProvider' ? 'oauth_provider' :
                   key === 'oauthId' ? 'oauth_id' :
                   key === 'createdAt' ? 'created_at' :
                   key === 'updatedAt' ? 'updated_at' : key;
      
      fields.push(`${dbKey} = ?`);
      
      if (key === 'metadata') {
        values.push(stringifyMetadata(value as Record<string, unknown>));
      } else if (key === 'isActive') {
        values.push(value ? 1 : 0);
      } else {
        values.push(value);
      }
    }

    if (fields.length === 0) return this.getUserById(id);

    fields.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(id);

    await this.db.execute(
      `UPDATE users SET ${fields.join(', ')} WHERE id = ?`,
      values
    );

    return this.getUserById(id);
  }

  async deleteUser(id: string): Promise<boolean> {
    const result = await this.db.execute('DELETE FROM users WHERE id = ?', [id]);
    return (result as any).changes > 0;
  }

  // Entity operations
  async createEntity(entity: Omit<Entity, 'id'>): Promise<Entity> {
    const sql = `
      INSERT INTO entities (user_id, name, entity_type, person_type, description, company, 
                           title, email, phone, address, website, social_media, notes, 
                           importance, tags, relationships, last_interaction, interaction_count,
                           metadata, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const result = await this.db.execute(sql, [
      entity.userId || null,
      entity.name,
      entity.entityType,
      entity.personType || null,
      entity.description || null,
      entity.company || null,
      entity.title || null,
      entity.email || null,
      entity.phone || null,
      entity.address || null,
      entity.website || null,
      entity.socialMedia || null,
      entity.notes || null,
      entity.importance,
      JSON.stringify(sanitizeTags(entity.tags)),
      entity.relationships || null,
      entity.lastInteraction || null,
      entity.interactionCount,
      stringifyMetadata(entity.metadata),
      entity.createdAt,
      entity.updatedAt,
    ]);

    return { ...entity, id: (result as any).lastInsertRowid };
  }

  async getEntityById(id: number | string): Promise<Entity | null> {
    const result = await this.db.execute('SELECT * FROM entities WHERE id = ?', [id]);
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
    const result = await this.db.execute(`
      SELECT e.* FROM entities e
      JOIN entities_fts fts ON e.id = fts.rowid
      WHERE e.user_id = ? AND entities_fts MATCH ?
      ORDER BY rank LIMIT ?
    `, [userId, query, limit]);
    
    return result.rows.map(row => this.mapRowToEntity(row as any));
  }

  // Memory operations
  async createMemory(memory: Omit<Memory, 'id'>): Promise<Memory> {
    const sql = `
      INSERT INTO memories (user_id, title, content, memory_type, importance, tags, 
                           entity_ids, embedding, metadata, is_archived, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const result = await this.db.execute(sql, [
      memory.userId || null,
      memory.title,
      memory.content,
      memory.memoryType,
      memory.importance,
      JSON.stringify(sanitizeTags(memory.tags)),
      JSON.stringify(memory.entityIds || []),
      JSON.stringify(memory.embedding || []),
      stringifyMetadata(memory.metadata),
      memory.isArchived ? 1 : 0,
      memory.createdAt,
      memory.updatedAt,
    ]);

    return { ...memory, id: (result as any).lastInsertRowid };
  }

  async getMemoryById(id: number | string): Promise<Memory | null> {
    const result = await this.db.execute('SELECT * FROM memories WHERE id = ?', [id]);
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
    const result = await this.db.execute(`
      SELECT m.* FROM memories m
      JOIN memories_fts fts ON m.id = fts.rowid
      WHERE m.user_id = ? AND m.is_archived = 0 AND memories_fts MATCH ?
      ORDER BY rank LIMIT ?
    `, [userId, query, limit]);
    
    return result.rows.map(row => this.mapRowToMemory(row as any));
  }

  // Helper methods to map database rows to objects
  private mapRowToUser(row: any): User {
    return {
      id: row.id,
      email: row.email,
      name: row.name,
      organization: row.organization,
      apiKey: row.api_key,
      oauthProvider: row.oauth_provider,
      oauthId: row.oauth_id,
      isActive: Boolean(row.is_active),
      metadata: parseMetadata(row.metadata),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapRowToEntity(row: any): Entity {
    return {
      id: row.id,
      userId: row.user_id,
      name: row.name,
      entityType: row.entity_type,
      personType: row.person_type,
      description: row.description,
      company: row.company,
      title: row.title,
      email: row.email,
      phone: row.phone,
      address: row.address,
      website: row.website,
      socialMedia: row.social_media,
      notes: row.notes,
      importance: row.importance,
      tags: JSON.parse(row.tags || '[]'),
      relationships: row.relationships,
      lastInteraction: row.last_interaction,
      interactionCount: row.interaction_count,
      metadata: parseMetadata(row.metadata),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapRowToMemory(row: any): Memory {
    return {
      id: row.id,
      userId: row.user_id,
      title: row.title,
      content: row.content,
      memoryType: row.memory_type,
      importance: row.importance,
      tags: JSON.parse(row.tags || '[]'),
      entityIds: JSON.parse(row.entity_ids || '[]'),
      embedding: JSON.parse(row.embedding || '[]'),
      metadata: parseMetadata(row.metadata),
      isArchived: Boolean(row.is_archived),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
