/**
 * Core memory service with vector search capabilities
 */

import { v4 as uuidv4 } from 'uuid';
import { DatabaseConnection, DatabaseOperations, initializeSchema } from '../database/index.js';
import { SchemaCompatibility } from '../database/compatibility.js';
import { EmbeddingService } from '../utils/embeddings.js';
import type {
  User,
  Entity,
  Memory,
  Interaction,
  SearchResult,
  VectorSearchOptions,
  MCPToolResult,
} from '../types/base.js';
import {
  createUser,
  createEntity,
  createMemory,
  createInteraction,
  hashApiKey,
} from '../models/index.js';
import { MCPToolResultStatus, MemoryType, EntityType, ImportanceLevel } from '../types/enums.js';

export class MemoryCore {
  protected db: DatabaseConnection;
  protected dbOps: DatabaseOperations;
  protected embeddings: EmbeddingService;
  protected defaultUserId: string | null = null;

  constructor(db: DatabaseConnection, openaiApiKey?: string) {
    this.db = db;
    this.dbOps = new DatabaseOperations(db);
    this.embeddings = new EmbeddingService(openaiApiKey);
  }

  /**
   * Initialize the memory core
   */
  async initialize(): Promise<void> {
    await this.db.connect();
    // Skip schema initialization for existing database
    // await initializeSchema(this.db);
    
    // Set up default user if specified in environment
    const defaultEmail = process.env.DEFAULT_USER_EMAIL || process.env.MCP_DEFAULT_USER_EMAIL;
    if (defaultEmail) {
      await this.ensureDefaultUser(defaultEmail);
    }
  }

  /**
   * Ensure default user exists
   */
  private async ensureDefaultUser(email: string): Promise<void> {
    let user = await this.dbOps.getUserByEmail(email);
    
    if (!user) {
      user = createUser({
        email,
        name: 'Default User',
        isActive: true,
      });
      await this.dbOps.createUser(user);
    }
    
    this.defaultUserId = user.id;
  }

  /**
   * Get user ID (default or provided)
   */
  protected getUserId(userId?: string): string {
    if (userId) return userId;
    if (this.defaultUserId) return this.defaultUserId;
    throw new Error('No user ID provided and no default user configured');
  }

  // User management
  async createUser(userData: Partial<User>): Promise<MCPToolResult> {
    try {
      if (userData.apiKey) {
        userData.apiKey = await hashApiKey(userData.apiKey);
      }
      
      const user = createUser(userData);
      await this.dbOps.createUser(user);
      
      return {
        status: MCPToolResultStatus.SUCCESS,
        message: 'User created successfully',
        data: { id: user.id, email: user.email },
      };
    } catch (error) {
      return {
        status: MCPToolResultStatus.ERROR,
        message: 'Failed to create user',
        error: String(error),
      };
    }
  }

  async getUserByApiKey(apiKey: string): Promise<User | null> {
    const hashedKey = await hashApiKey(apiKey);
    return this.dbOps.getUserByApiKey(hashedKey);
  }

  // Memory operations
  async addMemory(
    title: string,
    content: string,
    memoryType: MemoryType | string = MemoryType.MEMORY,
    options: {
      userId?: string;
      importance?: ImportanceLevel | number;
      tags?: string[];
      entityIds?: number[];
      generateEmbedding?: boolean;
    } = {}
  ): Promise<MCPToolResult> {
    try {
      const userId = this.getUserId(options.userId);

      // Generate embedding if requested
      let embedding: number[] | undefined;
      if (options.generateEmbedding !== false) {
        const embeddingText = EmbeddingService.createMemoryEmbeddingText({
          title,
          content,
          tags: options.tags,
          memoryType: memoryType as any,
        });
        embedding = await this.embeddings.generateEmbedding(embeddingText);
      }

      const memory = createMemory({
        userId,
        title,
        content,
        memoryType: memoryType as any,
        importance: options.importance !== undefined ? options.importance as any : 0.5,
        tags: options.tags,
        entityIds: options.entityIds,
        embedding,
      });

      const savedMemory = await this.dbOps.createMemory(memory);

      return {
        status: MCPToolResultStatus.SUCCESS,
        message: 'Memory added successfully',
        data: { id: savedMemory.id, title: savedMemory.title },
      };
    } catch (error) {
      return {
        status: MCPToolResultStatus.ERROR,
        message: 'Failed to add memory',
        error: String(error),
      };
    }
  }

  async searchMemories(
    query: string,
    options: VectorSearchOptions & { userId?: string } = {}
  ): Promise<MCPToolResult> {
    try {
      const userId = this.getUserId(options.userId);
      const limit = options.limit || 10;

      // First try vector search if we have embeddings
      let vectorResults: Memory[] = [];
      if (query.trim()) {
        try {
          const queryEmbedding = await this.embeddings.generateEmbedding(query);
          vectorResults = await this.vectorSearchMemories(userId, queryEmbedding, {
            threshold: options.threshold || 0.7,
            limit,
            memoryTypes: options.memoryTypes,
          });
        } catch (error) {
          console.error('Vector search failed, falling back to text search:', error);
        }
      }

      // If vector search didn't return enough results, supplement with text search
      let textResults: Memory[] = [];
      if (vectorResults.length < limit) {
        textResults = await this.dbOps.searchMemories(
          userId,
          query,
          limit - vectorResults.length
        );
      }

      // Combine and deduplicate results
      const allResults = [...vectorResults];
      const existingIds = new Set(vectorResults.map(m => m.id));
      
      for (const result of textResults) {
        if (!existingIds.has(result.id)) {
          allResults.push(result);
        }
      }

      return {
        status: MCPToolResultStatus.SUCCESS,
        message: `Found ${allResults.length} memories`,
        data: allResults.slice(0, limit),
      };
    } catch (error) {
      return {
        status: MCPToolResultStatus.ERROR,
        message: 'Failed to search memories',
        error: String(error),
      };
    }
  }

  async getMemory(
    memoryId: string,
    options: { userId?: string } = {}
  ): Promise<MCPToolResult> {
    try {
      const userId = this.getUserId(options.userId);

      const result = await this.db.execute(
        'SELECT * FROM memories WHERE id = ? AND user_id = ?',
        [memoryId, userId]
      );

      if (result.rows.length === 0) {
        return {
          status: MCPToolResultStatus.ERROR,
          message: 'Memory not found',
          error: `No memory found with ID ${memoryId}`,
        };
      }

      // Transform snake_case database fields to camelCase
      const transformedMemory = SchemaCompatibility.mapMemoryFromDatabase(result.rows[0] as any);

      return {
        status: MCPToolResultStatus.SUCCESS,
        message: 'Memory retrieved successfully',
        data: transformedMemory,
      };
    } catch (error) {
      return {
        status: MCPToolResultStatus.ERROR,
        message: 'Failed to retrieve memory',
        error: String(error),
      };
    }
  }

  async updateMemory(
    memoryId: string,
    updates: {
      title?: string;
      content?: string;
      importance?: ImportanceLevel | number;
      tags?: string[];
    },
    options: { userId?: string } = {}
  ): Promise<MCPToolResult> {
    try {
      const userId = this.getUserId(options.userId);

      // First check if memory exists and belongs to user
      const existingResult = await this.getMemory(memoryId, { userId });
      if (existingResult.status !== MCPToolResultStatus.SUCCESS) {
        return existingResult;
      }

      const updateFields: string[] = [];
      const updateValues: any[] = [];

      if (updates.title !== undefined) {
        updateFields.push('title = ?');
        updateValues.push(updates.title);
      }

      if (updates.content !== undefined) {
        updateFields.push('content = ?');
        updateValues.push(updates.content);
      }

      if (updates.importance !== undefined) {
        updateFields.push('importance = ?');
        updateValues.push(updates.importance);
      }

      if (updates.tags !== undefined) {
        updateFields.push('tags = ?');
        updateValues.push(updates.tags.join(','));
      }

      if (updateFields.length === 0) {
        return {
          status: MCPToolResultStatus.ERROR,
          message: 'No updates provided',
          error: 'At least one field must be updated',
        };
      }

      updateFields.push('updated_at = CURRENT_TIMESTAMP');
      updateValues.push(memoryId, userId);

      const sql = `UPDATE memories SET ${updateFields.join(', ')} WHERE id = ? AND user_id = ?`;
      await this.db.execute(sql, updateValues);

      return {
        status: MCPToolResultStatus.SUCCESS,
        message: 'Memory updated successfully',
        data: { id: memoryId },
      };
    } catch (error) {
      return {
        status: MCPToolResultStatus.ERROR,
        message: 'Failed to update memory',
        error: String(error),
      };
    }
  }

  async deleteMemory(
    memoryId: string,
    options: { userId?: string } = {}
  ): Promise<MCPToolResult> {
    try {
      const userId = this.getUserId(options.userId);

      // First check if memory exists and belongs to user
      const existingResult = await this.getMemory(memoryId, { userId });
      if (existingResult.status !== MCPToolResultStatus.SUCCESS) {
        return existingResult;
      }

      await this.db.execute(
        'DELETE FROM memories WHERE id = ? AND user_id = ?',
        [memoryId, userId]
      );

      return {
        status: MCPToolResultStatus.SUCCESS,
        message: 'Memory deleted successfully',
        data: { id: memoryId },
      };
    } catch (error) {
      return {
        status: MCPToolResultStatus.ERROR,
        message: 'Failed to delete memory',
        error: String(error),
      };
    }
  }

  /**
   * Vector search for memories
   */
  private async vectorSearchMemories(
    userId: string,
    queryEmbedding: number[],
    options: {
      threshold?: number;
      limit?: number;
      memoryTypes?: MemoryType[];
    } = {}
  ): Promise<Memory[]> {
    // Get all memories with embeddings for the user
    const memories = await this.dbOps.getMemoriesByUserId(userId, 1000);

    // Filter by memory types if specified
    const filteredMemories = options.memoryTypes
      ? memories.filter(m => options.memoryTypes!.includes(m.memoryType))
      : memories;

    // Find similar memories - ensure embeddings are valid arrays
    const vectorData = filteredMemories
      .filter(m => {
        // Strict validation: must be array with proper length (1536 for text-embedding-3-small)
        return Array.isArray(m.embedding) && m.embedding.length > 0 &&
               typeof m.embedding[0] === 'number';
      })
      .map(m => ({ vector: m.embedding!, data: m }));

    // Debug logging for development
    if (process.env.MCP_DEBUG) {
      console.log(`[VectorSearch] Query embedding dimensions: ${queryEmbedding.length}`);
      console.log(`[VectorSearch] Valid memory embeddings: ${vectorData.length}/${filteredMemories.length}`);
      console.log(`[VectorSearch] Threshold: ${options.threshold || 0.7}`);
    }

    const similarities = EmbeddingService.findMostSimilar(
      queryEmbedding,
      vectorData,
      options.threshold || 0.7,
      options.limit || 10
    );

    // Debug logging for results
    if (process.env.MCP_DEBUG && similarities.length > 0) {
      console.log(`[VectorSearch] Found ${similarities.length} results with similarities:`,
        similarities.map(s => s.similarity.toFixed(4)));
    }

    return similarities.map(s => s.data);
  }

  // Entity operations
  async createEntity(
    name: string,
    entityType: EntityType,
    options: {
      userId?: string;
      description?: string;
      importance?: ImportanceLevel;
      tags?: string[];
      [key: string]: any;
    } = {}
  ): Promise<MCPToolResult> {
    try {
      const userId = this.getUserId(options.userId);
      
      const entity = createEntity({
        userId,
        name,
        entityType,
        description: options.description,
        importance: options.importance || ImportanceLevel.MEDIUM,
        tags: options.tags,
        ...options,
      });

      const savedEntity = await this.dbOps.createEntity(entity);

      return {
        status: MCPToolResultStatus.SUCCESS,
        message: 'Entity created successfully',
        data: { id: savedEntity.id, name: savedEntity.name },
      };
    } catch (error) {
      return {
        status: MCPToolResultStatus.ERROR,
        message: 'Failed to create entity',
        error: String(error),
      };
    }
  }

  async searchEntities(
    query: string,
    options: { userId?: string; limit?: number } = {}
  ): Promise<MCPToolResult> {
    try {
      const userId = this.getUserId(options.userId);
      const entities = await this.dbOps.searchEntities(userId, query, options.limit || 10);

      return {
        status: MCPToolResultStatus.SUCCESS,
        message: `Found ${entities.length} entities`,
        data: entities,
      };
    } catch (error) {
      return {
        status: MCPToolResultStatus.ERROR,
        message: 'Failed to search entities',
        error: String(error),
      };
    }
  }

  // Unified search across all data types
  async unifiedSearch(
    query: string,
    options: VectorSearchOptions & { userId?: string } = {}
  ): Promise<MCPToolResult> {
    try {
      const userId = this.getUserId(options.userId);
      
      // Search memories and entities in parallel
      const [memoriesResult, entitiesResult] = await Promise.all([
        this.searchMemories(query, { ...options, userId, limit: Math.ceil((options.limit || 10) / 2) }),
        this.searchEntities(query, { userId, limit: Math.ceil((options.limit || 10) / 2) }),
      ]);

      const results: SearchResult[] = [];

      if (memoriesResult.status === MCPToolResultStatus.SUCCESS && memoriesResult.data) {
        const memories = memoriesResult.data as Memory[];
        results.push(...memories.map(m => ({
          item: m,
          score: 1.0, // TODO: Implement proper scoring
          type: 'memory' as const,
        })));
      }

      if (entitiesResult.status === MCPToolResultStatus.SUCCESS && entitiesResult.data) {
        const entities = entitiesResult.data as Entity[];
        results.push(...entities.map(e => ({
          item: e,
          score: 1.0, // TODO: Implement proper scoring
          type: 'entity' as const,
        })));
      }

      // Sort by score and limit
      results.sort((a, b) => b.score - a.score);
      const limitedResults = results.slice(0, options.limit || 10);

      return {
        status: MCPToolResultStatus.SUCCESS,
        message: `Found ${limitedResults.length} results`,
        data: limitedResults,
      };
    } catch (error) {
      return {
        status: MCPToolResultStatus.ERROR,
        message: 'Failed to perform unified search',
        error: String(error),
      };
    }
  }

  // Statistics and health
  async getStatistics(userId?: string): Promise<MCPToolResult> {
    try {
      const targetUserId = userId || this.defaultUserId;
      if (!targetUserId) {
        throw new Error('No user ID provided');
      }

      const [memories, entities] = await Promise.all([
        this.dbOps.getMemoriesByUserId(targetUserId, 10000),
        this.dbOps.getEntitiesByUserId(targetUserId, 10000),
      ]);

      const stats = {
        totalMemories: memories.length,
        totalEntities: entities.length,
        memoriesByType: memories.reduce((acc, m) => {
          acc[m.memoryType] = (acc[m.memoryType] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        entitiesByType: entities.reduce((acc, e) => {
          acc[e.entityType] = (acc[e.entityType] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        memoriesWithEmbeddings: memories.filter(m => m.embedding && m.embedding.length > 0).length,
      };

      return {
        status: MCPToolResultStatus.SUCCESS,
        message: 'Statistics retrieved successfully',
        data: stats,
      };
    } catch (error) {
      return {
        status: MCPToolResultStatus.ERROR,
        message: 'Failed to get statistics',
        error: String(error),
      };
    }
  }

  /**
   * Close the memory core
   */
  async close(): Promise<void> {
    await this.db.disconnect();
  }
}
