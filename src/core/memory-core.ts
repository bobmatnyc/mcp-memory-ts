/**
 * Core memory service with vector search capabilities
 */

import { v4 as uuidv4 } from 'uuid';
import { DatabaseConnection, DatabaseOperations, initializeSchema } from '../database/index.js';
import { SchemaCompatibility } from '../database/compatibility.js';
import { EmbeddingService } from '../utils/embeddings.js';
import { EmbeddingUpdater, createEmbeddingUpdater } from '../services/embedding-updater.js';
import type {
  User,
  Entity,
  Memory,
  Interaction,
  SearchResult,
  VectorSearchOptions,
  SearchStrategy,
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
  protected embeddingUpdater: EmbeddingUpdater | null = null;
  protected defaultUserId: string | null = null;
  protected autoUpdateEmbeddings: boolean = true;

  constructor(db: DatabaseConnection, openaiApiKey?: string, options: { autoUpdateEmbeddings?: boolean } = {}) {
    this.db = db;
    this.dbOps = new DatabaseOperations(db);
    // Pass database connection to enable usage tracking
    this.embeddings = new EmbeddingService(openaiApiKey, 'text-embedding-3-small', db);
    this.autoUpdateEmbeddings = options.autoUpdateEmbeddings !== false;

    // Create embedding updater if API key is available and auto-update is enabled
    const apiKey = openaiApiKey || process.env.OPENAI_API_KEY;
    if (apiKey && this.autoUpdateEmbeddings) {
      this.embeddingUpdater = createEmbeddingUpdater(db, apiKey, {
        batchSize: 10,
        retryAttempts: 3,
        retryDelay: 1000,
      });
    }
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

    // Start embedding monitoring if enabled
    if (this.embeddingUpdater && process.env.ENABLE_EMBEDDING_MONITOR === 'true') {
      const interval = parseInt(process.env.EMBEDDING_MONITOR_INTERVAL || '60000', 10);
      await this.embeddingUpdater.startMonitoring(interval);
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
      metadata?: Record<string, unknown>;
      generateEmbedding?: boolean;
    } = {}
  ): Promise<MCPToolResult> {
    try {
      const userId = this.getUserId(options.userId);

      // Validate importance if provided
      if (options.importance !== undefined) {
        const importance = typeof options.importance === 'number' ? options.importance : options.importance;
        if (importance < 0.0 || importance > 1.0) {
          return {
            status: MCPToolResultStatus.ERROR,
            message: 'Failed to add memory',
            error: 'Importance must be between 0.0 and 1.0',
          };
        }
      }

      // Generate embedding if requested (default: true)
      let embedding: number[] | undefined;
      if (options.generateEmbedding !== false) {
        try {
          const embeddingText = EmbeddingService.createMemoryEmbeddingText({
            title,
            content,
            tags: options.tags,
            memoryType: memoryType as any,
          });
          const generatedEmbedding = await this.embeddings.generateEmbedding(embeddingText, userId);

          // Only use embedding if it's valid (non-empty array with proper dimensions)
          if (generatedEmbedding && generatedEmbedding.length > 0) {
            embedding = generatedEmbedding;
            console.error(`[MemoryCore] ✅ Generated embedding with ${embedding.length} dimensions for memory "${title}"`);
          } else {
            console.warn(`[MemoryCore] ⚠️  Empty embedding returned for memory "${title}" - will queue for retry`);
          }
        } catch (error) {
          console.error(`[MemoryCore] ❌ Failed to generate embedding for memory "${title}":`, error);
          // Continue without embedding - it will be queued for retry by embedding updater
        }
      } else {
        console.error(`[MemoryCore] ⏭️  Skipping embedding generation for memory "${title}" (disabled by options)`);
      }

      const memory = createMemory({
        userId,
        title,
        content,
        memoryType: memoryType as any,
        importance: options.importance !== undefined ? options.importance as any : 0.5,
        tags: options.tags,
        entityIds: options.entityIds,
        metadata: options.metadata,
        embedding,
      });

      const savedMemory = await this.dbOps.createMemory(memory);

      // Queue for embedding update if auto-update is enabled and no valid embedding was generated
      if (this.embeddingUpdater && (!embedding || embedding.length === 0)) {
        console.error(`[MemoryCore] 🔄 Queuing memory ${savedMemory.id} for embedding update (${!embedding ? 'no embedding' : 'empty embedding'})`);
        this.embeddingUpdater.queueMemoryUpdate(savedMemory.id as string);
      } else if (!embedding || embedding.length === 0) {
        console.warn(`[MemoryCore] ⚠️  Memory ${savedMemory.id} saved without embedding and no updater available`);
      }

      return {
        status: MCPToolResultStatus.SUCCESS,
        message: 'Memory added successfully',
        data: { id: savedMemory.id, title: savedMemory.title, hasEmbedding: !!(embedding && embedding.length > 0) },
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
      const strategy = options.strategy || 'composite';

      // Check for metadata search syntax: "metadata.field:value" or "field:value"
      const metadataMatch = query.match(/^(?:metadata\.)?(\w+):(.+)$/);

      if (metadataMatch) {
        // Metadata field search
        const [, field, value] = metadataMatch;
        const trimmedValue = value.trim();

        try {
          // Use json_extract to search within JSON metadata field
          const sql = `
            SELECT * FROM memories
            WHERE user_id = ? AND is_archived = 0
            AND json_extract(metadata, ?) = ?
            ORDER BY updated_at DESC
            LIMIT ?
          `;

          const result = await this.db.execute(sql, [
            userId,
            `$.${field}`,
            trimmedValue,
            limit
          ]);

          const metadataResults = result.rows.map(row =>
            SchemaCompatibility.mapMemoryFromDatabase(row as any)
          );

          return {
            status: MCPToolResultStatus.SUCCESS,
            message: `Found ${metadataResults.length} memories with metadata.${field}=${trimmedValue}`,
            data: metadataResults,
          };
        } catch (error) {
          return {
            status: MCPToolResultStatus.ERROR,
            message: 'Failed to search metadata',
            error: String(error),
          };
        }
      }

      // Determine search approach based on strategy
      const usePureVectorSearch = strategy === 'similarity';

      // Regular search (non-metadata)
      let vectorResults: Memory[] = [];
      let vectorSearchUsed = false;
      let vectorSearchError: string | null = null;

      // Attempt vector search if query is provided
      if (query.trim()) {
        try {
          const queryEmbedding = await this.embeddings.generateEmbedding(query, userId);

          if (!queryEmbedding || queryEmbedding.length === 0) {
            throw new Error('Failed to generate query embedding');
          }

          // For similarity strategy, use lower threshold (0.3) to capture semantic matches
          // For other strategies, use higher threshold (0.6)
          const defaultThreshold = usePureVectorSearch ? 0.3 : 0.6;

          vectorResults = await this.vectorSearchMemories(userId, queryEmbedding, {
            threshold: options.threshold !== undefined ? options.threshold : defaultThreshold,
            limit,
            memoryTypes: options.memoryTypes,
          });
          vectorSearchUsed = true;

          if (process.env.MCP_DEBUG) {
            console.error(`[SearchMemories] Vector search returned ${vectorResults.length} results (threshold: ${options.threshold !== undefined ? options.threshold : defaultThreshold})`);
          }
        } catch (error) {
          vectorSearchError = String(error);
          console.error('[SearchMemories] Vector search failed:', error);

          // For similarity strategy, if vector search fails, return error instead of falling back
          if (usePureVectorSearch) {
            return {
              status: MCPToolResultStatus.ERROR,
              message: 'Semantic search failed - vector embeddings not available',
              error: vectorSearchError,
            };
          }
        }
      }

      // Text search handling based on strategy
      let textResults: Memory[] = [];
      let textSearchUsed = false;

      // Only use text search if:
      // 1. NOT using pure vector search (similarity strategy)
      // 2. Vector search didn't return enough results OR vector search failed
      if (!usePureVectorSearch && (vectorResults.length < limit || vectorSearchError)) {
        textResults = await this.dbOps.searchMemories(
          userId,
          query,
          limit - vectorResults.length
        );
        textSearchUsed = textResults.length > 0;

        if (process.env.MCP_DEBUG) {
          console.error(`[SearchMemories] Text search returned ${textResults.length} results`);
        }
      }

      // Combine and deduplicate results
      const allResults = [...vectorResults];
      const existingIds = new Set(vectorResults.map(m => m.id));

      for (const result of textResults) {
        if (!existingIds.has(result.id)) {
          allResults.push(result);
        }
      }

      // Apply search strategy sorting (but vector results are already sorted by similarity)
      if (strategy !== 'similarity') {
        this.sortByStrategy(allResults, strategy);
      }

      // Build informative message
      let message = `Found ${allResults.length} memories`;
      if (usePureVectorSearch) {
        message += ` (semantic/vector search only)`;
      } else if (vectorSearchUsed && textSearchUsed) {
        message += ` (${vectorResults.length} via semantic search, ${textResults.length} via text search)`;
      } else if (vectorSearchUsed) {
        message += ` (semantic search)`;
      } else if (textSearchUsed) {
        message += ` (text search)`;
      }

      if (vectorSearchError && !usePureVectorSearch) {
        message += ` [Vector search unavailable: ${vectorSearchError}]`;
      }

      return {
        status: MCPToolResultStatus.SUCCESS,
        message,
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
      metadata?: Record<string, unknown>;
    },
    options: { userId?: string } = {}
  ): Promise<MCPToolResult> {
    try {
      const userId = this.getUserId(options.userId);

      // Validate importance if provided
      if (updates.importance !== undefined) {
        const importance = typeof updates.importance === 'number' ? updates.importance : updates.importance;
        if (importance < 0.0 || importance > 1.0) {
          return {
            status: MCPToolResultStatus.ERROR,
            message: 'Failed to update memory',
            error: 'Importance must be between 0.0 and 1.0',
          };
        }
      }

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
        // Store tags as JSON array to match database format
        updateValues.push(JSON.stringify(updates.tags));
      }

      if (updates.metadata !== undefined) {
        updateFields.push('metadata = ?');
        updateValues.push(JSON.stringify(updates.metadata));
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

      // Queue for embedding regeneration if content or tags changed
      if (this.embeddingUpdater && (updates.content || updates.title || updates.tags)) {
        console.error(`[MemoryCore] 🔄 Queuing memory ${memoryId} for embedding regeneration (content/title/tags changed)`);
        this.embeddingUpdater.queueMemoryUpdate(memoryId);
      } else if ((updates.content || updates.title || updates.tags) && !this.embeddingUpdater) {
        console.warn(`[MemoryCore] ⚠️  Memory ${memoryId} content changed but no embedding updater available`);
      }

      return {
        status: MCPToolResultStatus.SUCCESS,
        message: 'Memory updated successfully',
        data: { id: memoryId, embeddingUpdateQueued: !!(this.embeddingUpdater && (updates.content || updates.title || updates.tags)) },
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
   * Calculate temporal decay factor for a memory
   * Uses a logarithmic decay function that never reaches zero
   */
  private calculateTemporalDecay(createdAt: string | undefined): number {
    if (!createdAt) return 0.5; // Default for missing dates

    const now = Date.now();
    const memoryTime = new Date(createdAt).getTime();
    const ageInDays = (now - memoryTime) / (24 * 60 * 60 * 1000);

    // Logarithmic decay: starts at 1.0, approaches but never reaches 0
    // Half-life of ~30 days (0.5 decay after one month)
    // After 1 year: ~0.2, After 2 years: ~0.15
    const decay = 1 / (1 + Math.log10(1 + ageInDays / 30));

    return Math.max(0.1, decay); // Never go below 0.1
  }

  /**
   * Sort memories by strategy with temporal decay and semantic linking
   */
  private sortByStrategy(memories: Memory[], strategy: SearchStrategy): void {
    // Apply temporal decay to all memories first
    const memoriesWithDecay = memories.map(memory => ({
      memory,
      temporalDecay: this.calculateTemporalDecay(memory.createdAt),
      semanticBoost: 0, // Will be calculated if memories are linked
    }));

    // Detect semantic links between memories (similar content or tags)
    // Boost newer memories that are semantically linked to older important memories
    for (let i = 0; i < memoriesWithDecay.length; i++) {
      for (let j = i + 1; j < memoriesWithDecay.length; j++) {
        const memA = memoriesWithDecay[i];
        const memB = memoriesWithDecay[j];

        // Check for tag overlap
        const tagsA = memA.memory.tags || [];
        const tagsB = memB.memory.tags || [];
        const sharedTags = tagsA.filter(tag => tagsB.includes(tag));

        if (sharedTags.length > 0) {
          // Boost the newer memory based on the older memory's importance
          const newer = memA.temporalDecay > memB.temporalDecay ? memA : memB;
          const older = memA.temporalDecay > memB.temporalDecay ? memB : memA;

          const olderImportance = typeof older.memory.importance === 'number'
            ? older.memory.importance : 0.5;

          // Semantic boost: newer linked memories get a boost from important older memories
          newer.semanticBoost = Math.max(
            newer.semanticBoost,
            olderImportance * 0.3 * sharedTags.length / Math.max(tagsA.length, tagsB.length)
          );
        }
      }
    }

    switch (strategy) {
      case 'recency':
        // Sort by temporal decay (recent memories have higher decay values)
        memoriesWithDecay.sort((a, b) => b.temporalDecay - a.temporalDecay);
        break;

      case 'frequency':
        // Sort by importance with temporal decay factor
        memoriesWithDecay.sort((a, b) => {
          const freqA = (typeof a.memory.importance === 'number' ? a.memory.importance : 0.5) * a.temporalDecay;
          const freqB = (typeof b.memory.importance === 'number' ? b.memory.importance : 0.5) * b.temporalDecay;
          return freqB - freqA;
        });
        break;

      case 'importance':
        // Sort by importance with slight temporal decay influence
        memoriesWithDecay.sort((a, b) => {
          const impA = typeof a.memory.importance === 'number' ? a.memory.importance : 0.5;
          const impB = typeof b.memory.importance === 'number' ? b.memory.importance : 0.5;
          // 80% importance, 20% temporal decay
          const scoreA = impA * 0.8 + a.temporalDecay * 0.2;
          const scoreB = impB * 0.8 + b.temporalDecay * 0.2;
          return scoreB - scoreA;
        });
        break;

      case 'similarity':
        // Apply temporal decay to similarity scores
        // Memories are already sorted by similarity, just apply decay
        memoriesWithDecay.sort((a, b) => {
          // Maintain original order but boost by temporal decay
          const indexA = memories.indexOf(a.memory);
          const indexB = memories.indexOf(b.memory);
          const simScoreA = (1 - indexA / memories.length) * a.temporalDecay;
          const simScoreB = (1 - indexB / memories.length) * b.temporalDecay;
          return simScoreB - simScoreA;
        });
        break;

      case 'composite':
      default:
        // Composite score with temporal decay and semantic linking
        memoriesWithDecay.sort((a, b) => {
          const impA = typeof a.memory.importance === 'number' ? a.memory.importance : 0.5;
          const impB = typeof b.memory.importance === 'number' ? b.memory.importance : 0.5;

          // Composite score:
          // - 30% temporal decay
          // - 40% importance
          // - 30% semantic boost (favors newer linked memories)
          const scoreA = a.temporalDecay * 0.3 + impA * 0.4 + a.semanticBoost * 0.3;
          const scoreB = b.temporalDecay * 0.3 + impB * 0.4 + b.semanticBoost * 0.3;

          return scoreB - scoreA;
        });
        break;
    }

    // Replace original array contents with sorted results
    memories.length = 0;
    memories.push(...memoriesWithDecay.map(item => item.memory));
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
      console.error(`[VectorSearch] Query embedding dimensions: ${queryEmbedding.length}`);
      console.error(`[VectorSearch] Valid memory embeddings: ${vectorData.length}/${filteredMemories.length}`);
      console.error(`[VectorSearch] Threshold: ${options.threshold || 0.7}`);
    }

    const similarities = EmbeddingService.findMostSimilar(
      queryEmbedding,
      vectorData,
      options.threshold || 0.7,
      options.limit || 10
    );

    // Debug logging for results
    if (process.env.MCP_DEBUG && similarities.length > 0) {
      console.error(`[VectorSearch] Found ${similarities.length} results with similarities:`,
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

      const memoriesWithEmbeddings = memories.filter(m => m.embedding && m.embedding.length > 0);
      const embeddingCoverage = memories.length > 0
        ? Math.round((memoriesWithEmbeddings.length / memories.length) * 100)
        : 0;

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
        memoriesWithEmbeddings: memoriesWithEmbeddings.length,
        embeddingCoverage: `${embeddingCoverage}%`,
        vectorSearchHealth: {
          enabled: this.embeddings !== null && (this.embeddings as any).openai !== null,
          memoriesWithValidEmbeddings: memoriesWithEmbeddings.length,
          memoriesWithoutEmbeddings: memories.length - memoriesWithEmbeddings.length,
          coveragePercentage: embeddingCoverage,
          recommendation: embeddingCoverage < 90
            ? 'Consider running updateMissingEmbeddings() to improve semantic search coverage'
            : 'Vector search coverage is healthy',
        },
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
   * Manually trigger embedding update for all memories without embeddings
   */
  async updateMissingEmbeddings(): Promise<MCPToolResult> {
    if (!this.embeddingUpdater) {
      return {
        status: MCPToolResultStatus.ERROR,
        message: 'Embedding updater not available',
        error: 'No OpenAI API key configured or auto-update disabled',
      };
    }

    try {
      const stats = await this.embeddingUpdater.updateAllMissingEmbeddings();
      return {
        status: MCPToolResultStatus.SUCCESS,
        message: `Updated ${stats.updated} embeddings`,
        data: stats,
      };
    } catch (error) {
      return {
        status: MCPToolResultStatus.ERROR,
        message: 'Failed to update embeddings',
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
