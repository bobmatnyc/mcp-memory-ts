/**
 * Schema Compatibility Layer
 * Provides seamless interoperability between TypeScript and Python schemas
 */

import { createHash, randomBytes } from 'crypto';
import type { Memory, Entity, User } from '../types/base.js';

/**
 * Field mapping configuration
 */
interface FieldMapping {
  typescript: string;
  python: string;
  transform?: (value: any) => any;
}

/**
 * Schema compatibility manager
 */
export class SchemaCompatibility {
  /**
   * Memory field mappings between TypeScript and Python
   */
  private static memoryFieldMappings: FieldMapping[] = [
    { typescript: 'title', python: 'description' },
    { typescript: 'content', python: 'details' },
    { typescript: 'memoryType', python: 'memory_type' },
    { typescript: 'isArchived', python: 'archived' },
    { typescript: 'entityIds', python: 'entity_ids', transform: v => JSON.stringify(v) },
    { typescript: 'createdAt', python: 'created_at' },
    { typescript: 'updatedAt', python: 'updated_at' },
  ];

  /**
   * Entity field mappings
   */
  private static entityFieldMappings: FieldMapping[] = [
    { typescript: 'entityType', python: 'entity_type' },
    { typescript: 'personType', python: 'person_type' },
    { typescript: 'firstName', python: 'first_name' },
    { typescript: 'lastName', python: 'last_name' },
    { typescript: 'contactInfo', python: 'contact_info' },
    { typescript: 'socialMedia', python: 'social_media' },
    { typescript: 'lastInteraction', python: 'last_interaction' },
    { typescript: 'interactionCount', python: 'interaction_count' },
    { typescript: 'createdAt', python: 'created_at' },
    { typescript: 'updatedAt', python: 'updated_at' },
  ];

  /**
   * Map memory fields for database compatibility
   */
  static mapMemoryForDatabase(memory: Partial<Memory>): Record<string, any> {
    const mapped: Record<string, any> = { ...memory };

    // Ensure both TypeScript and Python fields are present
    if (memory.title !== undefined) {
      mapped.description = memory.title;
    }
    if (memory.content !== undefined) {
      mapped.details = memory.content;
    }

    // Preserve memory type with proper field name
    if (memory.memoryType !== undefined) {
      mapped.memory_type = memory.memoryType;
    }

    // Generate UUID if not present (for Python compatibility)
    if (!mapped.uuid && !mapped.id) {
      mapped.uuid = this.generateUUID();
    }

    // Convert arrays to JSON strings for storage
    if (mapped.tags && Array.isArray(mapped.tags)) {
      mapped.tags = JSON.stringify(mapped.tags);
    }
    if (mapped.entityIds && Array.isArray(mapped.entityIds)) {
      mapped.entity_ids = JSON.stringify(mapped.entityIds);
    }
    if (mapped.embedding && Array.isArray(mapped.embedding)) {
      mapped.embedding = JSON.stringify(mapped.embedding);
    }
    if (mapped.metadata && typeof mapped.metadata === 'object') {
      mapped.metadata = JSON.stringify(mapped.metadata);
    }

    // Ensure active field for Python
    if (mapped.isArchived !== undefined) {
      mapped.active = !mapped.isArchived;
    } else if (mapped.active === undefined) {
      mapped.active = true;
    }

    return mapped;
  }

  /**
   * Map memory fields from database to TypeScript model
   */
  static mapMemoryFromDatabase(row: Record<string, any>): Memory {
    // Debug logging for critical fields
    const debugEnabled = process.env.MCP_DEBUG === '1';
    if (debugEnabled) {
      console.error('[DEBUG] mapMemoryFromDatabase input:', {
        id: row.id,
        memory_type: row.memory_type,
        importance: row.importance,
        metadata: row.metadata,
        created_at: row.created_at,
      });
    }

    const memory: any = {
      id: String(row.id), // ✅ Convert to string for consistency
      userId: row.user_id,
      // Use TypeScript fields, fallback to Python fields
      title: row.title || row.description || '',
      content: row.content || row.details || '',
      // CRITICAL: Do not use fallback values - preserve exact database values
      memoryType: row.memory_type || row.memoryType,
      importance: row.importance,
      isArchived: row.is_archived === 1 || row.is_archived === true || false,
      createdAt: row.created_at || row.createdAt,
      updatedAt: row.updated_at || row.updatedAt,
    };

    // Parse JSON fields
    if (row.tags) {
      try {
        memory.tags = typeof row.tags === 'string' ? JSON.parse(row.tags) : row.tags;
      } catch {
        memory.tags = [];
      }
    }

    if (row.entity_ids || row.entityIds) {
      try {
        const ids = row.entity_ids || row.entityIds;
        memory.entityIds = typeof ids === 'string' ? JSON.parse(ids) : ids;
      } catch {
        memory.entityIds = [];
      }
    }

    if (row.embedding) {
      try {
        const parsed =
          typeof row.embedding === 'string' ? JSON.parse(row.embedding) : row.embedding;
        // Ensure embedding is a proper array, not an empty array or null
        memory.embedding = Array.isArray(parsed) && parsed.length > 0 ? parsed : null;
      } catch {
        memory.embedding = null;
      }
    } else {
      memory.embedding = null;
    }

    if (row.metadata) {
      try {
        const parsed = typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata;
        memory.metadata = parsed || {};
      } catch {
        memory.metadata = {};
      }
    } else {
      memory.metadata = {};
    }

    return memory as Memory;
  }

  /**
   * Map entity fields for database compatibility
   */
  static mapEntityForDatabase(entity: Partial<Entity>): Record<string, any> {
    const mapped: Record<string, any> = { ...entity };

    // Convert camelCase to snake_case for Python compatibility
    if (entity.entityType !== undefined) {
      mapped.entity_type = entity.entityType;
    }
    if (entity.personType !== undefined) {
      mapped.person_type = entity.personType;
    }

    // Handle contact information
    if (entity.email || entity.phone || entity.address) {
      mapped.contact_info = JSON.stringify({
        email: entity.email,
        phone: entity.phone,
        address: entity.address,
      });
    }

    // Convert arrays/objects to JSON strings
    if (mapped.tags && Array.isArray(mapped.tags)) {
      mapped.tags = JSON.stringify(mapped.tags);
    }
    if (mapped.relationships) {
      mapped.relationships =
        typeof mapped.relationships === 'string'
          ? mapped.relationships
          : JSON.stringify(mapped.relationships);
    }
    if (mapped.metadata && typeof mapped.metadata === 'object') {
      mapped.metadata = JSON.stringify(mapped.metadata);
    }

    // Ensure active field
    if (mapped.active === undefined) {
      mapped.active = true;
    }

    return mapped;
  }

  /**
   * Map entity fields from database to TypeScript model
   */
  static mapEntityFromDatabase(row: Record<string, any>): Entity {
    const entity: any = {
      id: String(row.id), // ✅ Convert to string for consistency
      userId: row.user_id,
      name: row.name || '',
      entityType: row.entity_type || row.entityType || 'person',
      personType: row.person_type || row.personType,
      description: row.description,
      company: row.company,
      title: row.title,
      notes: row.notes,
      // Default values for fields not in database
      website: null,
      socialMedia: null,
      importance: 2, // Default importance level
      lastInteraction: null,
      interactionCount: 0,
      relationships: null,
      createdAt: row.created_at || row.createdAt,
      updatedAt: row.updated_at || row.updatedAt,
    };

    // Parse contact info (contains email, phone, address)
    if (row.contact_info) {
      try {
        const contact =
          typeof row.contact_info === 'string' ? JSON.parse(row.contact_info) : row.contact_info;
        entity.email = contact.email || null;
        entity.phone = contact.phone || null;
        entity.address = contact.address || null;
      } catch {
        entity.email = null;
        entity.phone = null;
        entity.address = null;
      }
    } else {
      entity.email = null;
      entity.phone = null;
      entity.address = null;
    }

    // Parse JSON fields
    if (row.tags) {
      try {
        entity.tags = typeof row.tags === 'string' ? JSON.parse(row.tags) : row.tags;
      } catch {
        entity.tags = [];
      }
    } else {
      entity.tags = [];
    }

    if (row.metadata) {
      try {
        entity.metadata =
          typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata;
      } catch {
        entity.metadata = {};
      }
    } else {
      entity.metadata = {};
    }

    return entity as Entity;
  }

  /**
   * Generate UUID v4 for Python compatibility
   */
  static generateUUID(): string {
    const bytes = randomBytes(16);
    // Set version (4) and variant bits
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;

    const hex = bytes.toString('hex');
    return [
      hex.substring(0, 8),
      hex.substring(8, 12),
      hex.substring(12, 16),
      hex.substring(16, 20),
      hex.substring(20, 32),
    ].join('-');
  }

  /**
   * Convert Python snake_case to TypeScript camelCase
   */
  static snakeToCamel(str: string): string {
    return str.replace(/_([a-z])/g, g => g[1].toUpperCase());
  }

  /**
   * Convert TypeScript camelCase to Python snake_case
   */
  static camelToSnake(str: string): string {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }

  /**
   * Transform API response for Python compatibility
   */
  static transformForPythonAPI(data: any): any {
    if (Array.isArray(data)) {
      return data.map(item => this.transformForPythonAPI(item));
    }

    if (data === null || typeof data !== 'object') {
      return data;
    }

    const transformed: Record<string, any> = {};

    for (const [key, value] of Object.entries(data)) {
      const snakeKey = this.camelToSnake(key);

      // Special handling for specific fields
      if (key === 'title' && data.description === undefined) {
        transformed.description = value;
      } else if (key === 'content' && data.details === undefined) {
        transformed.details = value;
      }

      // Recursively transform nested objects
      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        transformed[snakeKey] = this.transformForPythonAPI(value);
      } else if (Array.isArray(value)) {
        transformed[snakeKey] = value.map(item =>
          typeof item === 'object' ? this.transformForPythonAPI(item) : item
        );
      } else {
        transformed[snakeKey] = value;
      }
    }

    return transformed;
  }

  /**
   * Transform API request from Python format
   */
  static transformFromPythonAPI(data: any): any {
    if (Array.isArray(data)) {
      return data.map(item => this.transformFromPythonAPI(item));
    }

    if (data === null || typeof data !== 'object') {
      return data;
    }

    const transformed: Record<string, any> = {};

    for (const [key, value] of Object.entries(data)) {
      const camelKey = this.snakeToCamel(key);

      // Special handling for specific fields
      if (key === 'description' && data.title === undefined) {
        transformed.title = value;
      } else if (key === 'details' && data.content === undefined) {
        transformed.content = value;
      }

      // Recursively transform nested objects
      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        transformed[camelKey] = this.transformFromPythonAPI(value);
      } else if (Array.isArray(value)) {
        transformed[camelKey] = value.map(item =>
          typeof item === 'object' ? this.transformFromPythonAPI(item) : item
        );
      } else {
        transformed[camelKey] = value;
      }
    }

    return transformed;
  }
}

/**
 * API Key security utilities
 */
export class ApiKeySecurity {
  /**
   * Hash an API key using SHA-256
   */
  static hashApiKey(apiKey: string): string {
    return createHash('sha256').update(apiKey).digest('hex');
  }

  /**
   * Verify an API key against a hash
   */
  static verifyApiKey(apiKey: string, hash: string): boolean {
    // Handle both hashed and unhashed keys for migration period
    if (hash.length === 64) {
      // Already hashed - compare hashes
      return this.hashApiKey(apiKey) === hash;
    } else {
      // Legacy plaintext comparison (should be migrated)
      console.warn('WARNING: Plaintext API key detected. Please migrate to hashed storage.');
      return apiKey === hash;
    }
  }

  /**
   * Generate a new secure API key
   */
  static generateApiKey(): string {
    const prefix = 'mcp';
    const randomPart = randomBytes(32).toString('hex');
    return `${prefix}_${randomPart}`;
  }

  /**
   * Check if an API key needs hashing
   */
  static needsHashing(storedKey: string | null): boolean {
    if (!storedKey) return false;
    // SHA-256 hashes are always 64 characters
    return storedKey.length !== 64;
  }

  /**
   * Migrate a plaintext key to hashed format
   */
  static migrateKey(plaintextKey: string): {
    original: string;
    hashed: string;
    migrated: boolean;
  } {
    return {
      original: plaintextKey,
      hashed: this.hashApiKey(plaintextKey),
      migrated: true,
    };
  }
}

/**
 * Database compatibility utilities
 */
export class DatabaseCompatibility {
  /**
   * Check if database has required compatibility columns
   */
  static async checkCompatibility(db: any): Promise<{
    compatible: boolean;
    missingColumns: string[];
    suggestions: string[];
  }> {
    const requiredColumns = {
      memories: ['title', 'content', 'description', 'details', 'uuid', 'active'],
      entities: ['first_name', 'last_name', 'contact_info', 'active'],
    };

    const missingColumns: string[] = [];
    const suggestions: string[] = [];

    for (const [table, columns] of Object.entries(requiredColumns)) {
      try {
        const result = await db.execute(`
          SELECT name FROM pragma_table_info('${table}')
        `);

        const existingColumns = new Set(result.rows.map((r: any) => r.name));

        for (const column of columns) {
          if (!existingColumns.has(column)) {
            missingColumns.push(`${table}.${column}`);
            suggestions.push(`ALTER TABLE ${table} ADD COLUMN ${column} TEXT;`);
          }
        }
      } catch (error) {
        console.error(`Error checking table ${table}:`, error);
      }
    }

    return {
      compatible: missingColumns.length === 0,
      missingColumns,
      suggestions,
    };
  }

  /**
   * Apply compatibility fixes
   */
  static async applyCompatibilityFixes(db: any): Promise<void> {
    const compatibility = await this.checkCompatibility(db);

    if (compatibility.compatible) {
      console.log('Database is already compatible');
      return;
    }

    console.log('Applying compatibility fixes...');
    for (const suggestion of compatibility.suggestions) {
      try {
        await db.execute(suggestion);
        console.log(`Applied: ${suggestion}`);
      } catch (error) {
        console.error(`Failed to apply: ${suggestion}`, error);
      }
    }
  }
}
