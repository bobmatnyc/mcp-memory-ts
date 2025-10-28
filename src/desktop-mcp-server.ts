#!/usr/bin/env node
/**
 * Simple MCP Server for Memory Service
 * A minimal working implementation
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { existsSync } from 'fs';
import { stdin, stdout } from 'process';
import { createInterface } from 'readline';
import { initDatabaseFromEnv, DatabaseOperations } from './database/index.js';
import { MemoryCore } from './core/index.js';
import { MemoryType, ImportanceLevel, MCPToolResultStatus } from './types/enums.js';
import { UsageTrackingDB } from './database/usage-tracking.js';

// Load environment variables from .env.local if it exists, otherwise fall back to .env
const envLocalPath = resolve(process.cwd(), '.env.local');
const envPath = resolve(process.cwd(), '.env');

if (existsSync(envLocalPath)) {
  config({ path: envLocalPath });
} else if (existsSync(envPath)) {
  config({ path: envPath });
}

// Simple types
interface JsonRpcRequest {
  jsonrpc: '2.0';
  id?: string | number | null;
  method: string;
  params?: any;
}

interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

// Simple MCP Server
class SimpleMCPServer {
  private debugEnabled = false;
  private logLevel: string;
  private requestCounter = 0;
  private memoryCore: MemoryCore | null = null;
  private db: any = null;
  private dbOps: DatabaseOperations | null = null;
  private defaultUserId: string | null = null;

  constructor() {
    this.debugEnabled = process.env.MCP_DEBUG === '1';
    this.logLevel = process.env.LOG_LEVEL?.toLowerCase() || 'info';

    // CRITICAL: Use stderr to avoid breaking MCP stdio protocol
    // stdout is reserved for JSON-RPC messages only
    if (this.debugEnabled || this.logLevel === 'debug') {
      console.error(`[MCPServer] Log level: ${this.logLevel}`);
    }
  }

  private ensureValidId(id?: string | number | null): string | number {
    if (id !== undefined && id !== null) {
      return id;
    }
    // Generate a unique ID if none provided
    return `auto-${++this.requestCounter}`;
  }

  private logDebug(...args: any[]): void {
    if (this.debugEnabled) {
      console.error('[MCP DEBUG]', ...args);
    }
  }

  private logError(...args: any[]): void {
    console.error('[MCP ERROR]', ...args);
  }

  private getUserId(): string {
    // Return the cached user UUID, not the email address
    // This is properly initialized in start() by looking up the user from the database
    if (!this.defaultUserId) {
      throw new Error('User ID not initialized - call start() first');
    }
    return this.defaultUserId;
  }

  async start(): Promise<void> {
    this.logDebug('Starting Simple MCP Memory Server...');

    // Initialize database and memory core
    try {
      this.db = initDatabaseFromEnv();
      this.dbOps = new DatabaseOperations(this.db);
      this.memoryCore = new MemoryCore(this.db, process.env.OPENAI_API_KEY);
      await this.memoryCore.initialize();
      this.logDebug('Memory core initialized successfully');

      // Cache the default user ID (UUID, not email)
      const defaultEmail = process.env.DEFAULT_USER_EMAIL || process.env.MCP_DEFAULT_USER_EMAIL;
      if (defaultEmail) {
        const user = await this.dbOps.getUserByEmail(defaultEmail);
        if (user) {
          this.defaultUserId = user.id;
          this.logDebug(`Cached user ID for ${defaultEmail}: ${this.defaultUserId}`);
        } else {
          this.logError(`User not found for email: ${defaultEmail}`);
        }
      }
    } catch (error) {
      this.logError('Failed to initialize memory core:', error);
      throw error;
    }

    const rl = createInterface({
      input: stdin,
      output: stdout,
      terminal: false,
    });

    rl.on('line', async (line) => {
      await this.handleMessage(line.trim());
    });

    rl.on('close', () => {
      this.logDebug('Input stream closed');
      process.exit(0);
    });

    this.logDebug('Simple MCP Server started and listening on stdio');
  }

  private async handleMessage(message: string): Promise<void> {
    if (!message) return;

    this.logDebug('Received message:', message);

    try {
      const request: JsonRpcRequest = JSON.parse(message);
      const response = await this.processRequest(request);
      
      if (response) {
        const responseStr = JSON.stringify(response);
        this.logDebug('Sending response:', responseStr);
        stdout.write(responseStr + '\n');
      }
    } catch (error) {
      this.logError('Error processing message:', error);
      
      const errorResponse: JsonRpcResponse = {
        jsonrpc: '2.0',
        id: this.ensureValidId(null),
        error: {
          code: -32700,
          message: 'Parse error',
          data: String(error),
        },
      };
      
      stdout.write(JSON.stringify(errorResponse) + '\n');
    }
  }

  private async processRequest(request: JsonRpcRequest): Promise<JsonRpcResponse | null> {
    const { id, method, params } = request;

    try {
      const validId = this.ensureValidId(id);

      switch (method) {
        case 'initialize':
          return this.handleInitialize(validId, params);

        case 'initialized':
          this.logDebug('Client initialized');
          return null;

        case 'notifications/initialized':
          this.logDebug('Notifications initialized');
          return null;

        case 'tools/list':
          return this.handleToolsList(validId);

        case 'tools/call':
          return await this.handleToolsCall(validId, params);

        case 'prompts/list':
          return {
            jsonrpc: '2.0',
            id: validId,
            result: { prompts: [] }
          };

        case 'resources/list':
          return {
            jsonrpc: '2.0',
            id: validId,
            result: { resources: [] }
          };

        case 'ping':
          return { jsonrpc: '2.0', id: validId, result: {} };

        default:
          return {
            jsonrpc: '2.0',
            id: validId,
            error: {
              code: -32601,
              message: `Method not found: ${method}`,
            },
          };
      }
    } catch (error) {
      this.logError('Error processing request:', error);
      return {
        jsonrpc: '2.0',
        id: this.ensureValidId(id),
        error: {
          code: -32603,
          message: 'Internal error',
          data: String(error),
        },
      };
    }
  }

  private handleInitialize(id: string | number, params: any): JsonRpcResponse {
    this.logDebug('Initialize request:', params);

    const result = {
      protocolVersion: '2024-11-05',
      capabilities: {
        tools: {
          listChanged: false,
        },
        logging: {},
      },
      serverInfo: {
        name: 'mcp-memory-ts-simple',
        version: '1.0.0',
      },
    };

    this.logDebug('MCP server initialized');

    return {
      jsonrpc: '2.0',
      id,
      result,
    };
  }

  private handleToolsList(id: string | number): JsonRpcResponse {
    const tools = [
      {
        name: 'store_memory',
        description: 'Store a new memory',
        inputSchema: {
          type: 'object',
          properties: {
            content: { type: 'string', description: 'The content to store in memory' },
            type: {
              type: 'string',
              enum: ['episodic', 'semantic', 'procedural', 'working', 'sensory'],
              description: 'Type of memory',
              default: 'semantic'
            },
            importance: {
              type: 'number',
              minimum: 0,
              maximum: 1,
              description: 'Importance score (0-1)',
              default: 0.5
            },
            metadata: { type: 'object', description: 'Additional metadata' },
          },
          required: ['content'],
        },
      },
      {
        name: 'recall_memories',
        description: 'Retrieve memories based on a query',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Query string to search memories' },
            limit: {
              type: 'integer',
              minimum: 1,
              maximum: 100,
              description: 'Maximum number of memories to retrieve',
              default: 10
            },
            strategy: {
              type: 'string',
              enum: ['recency', 'frequency', 'importance', 'similarity', 'composite'],
              description: 'Recall strategy to use',
              default: 'composite'
            },
            threshold: {
              type: 'number',
              minimum: 0,
              maximum: 1,
              description: 'Minimum relevance threshold',
              default: 0.3
            },
          },
          required: ['query'],
        },
      },
      {
        name: 'get_memory',
        description: 'Retrieve a specific memory by ID',
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Memory item ID' },
          },
          required: ['id'],
        },
      },
      {
        name: 'update_memory',
        description: 'Update an existing memory',
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Memory item ID to update' },
            title: { type: 'string', description: 'Updated title' },
            content: { type: 'string', description: 'Updated content' },
            importance: {
              type: 'number',
              minimum: 0,
              maximum: 1,
              description: 'Updated importance score'
            },
            tags: {
              type: 'array',
              items: { type: 'string' },
              description: 'Updated tags'
            },
            metadata: { type: 'object', description: 'Updated metadata' },
          },
          required: ['id'],
        },
      },
      {
        name: 'delete_memory',
        description: 'Delete a memory by ID',
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Memory item ID to delete' },
          },
          required: ['id'],
        },
      },
      {
        name: 'get_memory_stats',
        description: 'Get statistics about stored memories',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'update_missing_embeddings',
        description: 'Manually trigger embedding generation for all memories without embeddings',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'get_daily_costs',
        description: 'Get daily API usage costs for OpenAI embeddings. Returns token usage and costs for the current day or a specific date.',
        inputSchema: {
          type: 'object',
          properties: {
            date: {
              type: 'string',
              description: 'Date in YYYY-MM-DD format (defaults to today)',
            },
          },
        },
      },
      {
        name: 'list_entities',
        description: 'List all entities for the user',
        inputSchema: {
          type: 'object',
          properties: {
            limit: {
              type: 'integer',
              minimum: 1,
              maximum: 1000,
              description: 'Maximum number of entities to retrieve',
              default: 100
            },
          },
        },
      },
      {
        name: 'get_entity',
        description: 'Retrieve a specific entity by ID',
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Entity ID' },
          },
          required: ['id'],
        },
      },
      {
        name: 'search_entities',
        description: 'Search entities by name, description, or other attributes',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query' },
            limit: {
              type: 'integer',
              minimum: 1,
              maximum: 100,
              description: 'Maximum number of entities to retrieve',
              default: 10
            },
          },
          required: ['query'],
        },
      },
      {
        name: 'create_entity',
        description: 'Create a new entity (person, company, organization)',
        inputSchema: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Entity name' },
            entityType: {
              type: 'string',
              enum: ['person', 'company', 'organization', 'project', 'other'],
              description: 'Type of entity',
              default: 'person'
            },
            description: { type: 'string', description: 'Entity description' },
            importance: {
              type: 'number',
              minimum: 1,
              maximum: 4,
              description: 'Importance level (1=low, 2=medium, 3=high, 4=critical)',
              default: 2
            },
            tags: {
              type: 'array',
              items: { type: 'string' },
              description: 'Tags for categorization'
            },
            contactInfo: { type: 'string', description: 'Contact information' },
            email: { type: 'string', description: 'Email address' },
            phone: { type: 'string', description: 'Phone number' },
            company: { type: 'string', description: 'Company name (for persons)' },
            title: { type: 'string', description: 'Job title (for persons)' },
          },
          required: ['name', 'entityType'],
        },
      },
      {
        name: 'update_entity',
        description: 'Update an existing entity',
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Entity ID to update' },
            name: { type: 'string', description: 'Updated name' },
            description: { type: 'string', description: 'Updated description' },
            importance: {
              type: 'number',
              minimum: 1,
              maximum: 4,
              description: 'Updated importance level'
            },
            tags: {
              type: 'array',
              items: { type: 'string' },
              description: 'Updated tags'
            },
            contactInfo: { type: 'string', description: 'Updated contact information' },
            email: { type: 'string', description: 'Updated email address' },
            phone: { type: 'string', description: 'Updated phone number' },
            company: { type: 'string', description: 'Updated company name' },
            title: { type: 'string', description: 'Updated job title' },
          },
          required: ['id'],
        },
      },
      {
        name: 'delete_entity',
        description: 'Delete an entity by ID',
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Entity ID to delete' },
          },
          required: ['id'],
        },
      },
    ];

    return {
      jsonrpc: '2.0',
      id,
      result: { tools },
    };
  }

  private async handleToolsCall(id: string | number, params: any): Promise<JsonRpcResponse> {
    const { name, arguments: args } = params;
    this.logDebug(`Tool call: ${name}`, args);

    if (!this.memoryCore) {
      throw new Error('Memory core not initialized');
    }

    let resultText = '';

    try {
      switch (name) {
        case 'store_memory':
          // Use the actual type string without mapping to enums
          const inputType = args.type || 'semantic';

          // Keep importance as decimal (0-1) without conversion
          const importanceValue = args.importance !== undefined ? args.importance : 0.5;

          // Extract title from metadata or args
          const title = args.title || args.metadata?.title || 'Memory';

          // Extract tags from args or metadata
          const tags = args.tags || args.metadata?.tags || [];

          // Prepare metadata object, excluding title and tags which are handled separately
          let metadataToStore: Record<string, unknown> | undefined;
          if (args.metadata && typeof args.metadata === 'object') {
            const { title: _title, tags: _tags, ...remainingMetadata } = args.metadata;
            if (Object.keys(remainingMetadata).length > 0) {
              metadataToStore = remainingMetadata;
            }
          }

          const storeUserId = this.getUserId();
          const addResult = await this.memoryCore.addMemory(
            title,
            args.content,
            inputType as any, // Pass the actual type string
            {
              userId: storeUserId,
              tags: Array.isArray(tags) ? tags : [tags],
              importance: importanceValue as any, // Pass decimal importance directly
              metadata: metadataToStore,
              generateEmbedding: 'async', // Use async embedding for faster response (~50ms vs ~500-2000ms)
            }
          );

          if (addResult.status === MCPToolResultStatus.SUCCESS) {
            const memoryData = addResult.data as any;
            const embeddingStatus = memoryData?.hasEmbedding
              ? ' ✅ with embedding'
              : memoryData?.embeddingQueued
                ? ' 🔄 embedding queued (generating in background)'
                : ' ⚠️  without embedding (will be generated)';
            resultText = `✅ Memory stored successfully!${embeddingStatus}\n\nID: ${memoryData?.id || 'unknown'}\nContent: ${args.content}\nType: ${inputType}\nImportance: ${importanceValue}`;
          } else {
            resultText = `❌ Failed to store memory: ${addResult.error || addResult.message}`;
          }
          break;

        case 'recall_memories':
          const recallUserId = this.getUserId();
          const searchResult = await this.memoryCore.searchMemories(args.query, {
            limit: args.limit || 10,
            threshold: args.threshold || 0.3,
            strategy: args.strategy || 'composite',
            userId: recallUserId,
          });

          if (searchResult.status === MCPToolResultStatus.SUCCESS && searchResult.data) {
            const memories = searchResult.data as any[];
            if (memories.length === 0) {
              resultText = `🔍 No memories found for "${args.query}"`;
            } else {
              resultText = `🔍 Found ${memories.length} memories for "${args.query}":\n\n`;
              memories.forEach((memory, index) => {
                const tagsDisplay = Array.isArray(memory.tags) && memory.tags.length > 0
                  ? memory.tags.join(', ')
                  : 'none';
                const metadataDisplay = memory.metadata && Object.keys(memory.metadata).length > 0
                  ? JSON.stringify(memory.metadata, null, 2)
                  : 'none';

                resultText += `${index + 1}. Memory ID: ${memory.id}\n   Content: ${memory.content.substring(0, 150)}${memory.content.length > 150 ? '...' : ''}\n   Type: ${memory.memoryType || 'semantic'}\n   Importance: ${memory.importance !== undefined ? memory.importance : 0.5}\n   Tags: ${tagsDisplay}\n   Metadata: ${metadataDisplay}\n   Created: ${new Date(memory.createdAt).toLocaleDateString()}\n\n`;
              });
            }
          } else {
            resultText = `❌ Search failed: ${searchResult.error || searchResult.message}`;
          }
          break;

        case 'get_memory':
          const userId = this.getUserId();
          const getResult = await this.memoryCore.getMemory(args.id, { userId });

          if (getResult.status === MCPToolResultStatus.SUCCESS && getResult.data) {
            const memory = getResult.data as any;
            const tagsDisplay = Array.isArray(memory.tags) && memory.tags.length > 0
              ? memory.tags.join(', ')
              : 'none';
            const metadataDisplay = memory.metadata && Object.keys(memory.metadata).length > 0
              ? JSON.stringify(memory.metadata, null, 2)
              : 'none';

            resultText = `📄 Memory Details:\n\nID: ${memory.id}\nContent: ${memory.content}\nType: ${memory.memoryType || 'semantic'}\nImportance: ${memory.importance !== undefined ? memory.importance : 0.5}\nCreated: ${new Date(memory.createdAt).toLocaleString()}\nTags: ${tagsDisplay}\nMetadata: ${metadataDisplay}`;
          } else {
            resultText = `❌ Memory not found: ${getResult.error || getResult.message}`;
          }
          break;

        case 'update_memory':
          // Build updates object with only provided fields
          const updateUserId = this.getUserId();
          const updates: any = {};
          if (args.content !== undefined) updates.content = args.content;
          if (args.title !== undefined) updates.title = args.title;
          if (args.importance !== undefined) updates.importance = args.importance;
          if (args.tags !== undefined) updates.tags = args.tags;
          if (args.metadata !== undefined) updates.metadata = args.metadata;

          const memoryUpdateResult = await this.memoryCore.updateMemory(args.id, updates, { userId: updateUserId });

          if (memoryUpdateResult.status === MCPToolResultStatus.SUCCESS) {
            resultText = `✅ Memory ${args.id} updated successfully!`;
          } else {
            resultText = `❌ Failed to update memory: ${memoryUpdateResult.error || memoryUpdateResult.message}`;
          }
          break;

        case 'delete_memory':
          const deleteUserId = this.getUserId();
          const deleteResult = await this.memoryCore.deleteMemory(args.id, { userId: deleteUserId });

          if (deleteResult.status === MCPToolResultStatus.SUCCESS) {
            resultText = `✅ Memory ${args.id} deleted successfully!`;
          } else {
            resultText = `❌ Failed to delete memory: ${deleteResult.error || deleteResult.message}`;
          }
          break;


        case 'get_memory_stats':
          const statsUserId = this.getUserId();
          const statsResult = await this.memoryCore.getStatistics(statsUserId);

          if (statsResult.status === MCPToolResultStatus.SUCCESS && statsResult.data) {
            const stats = statsResult.data as any;
            const memoryTypeBreakdown = stats.memoriesByType || {};
            const typeLines = Object.entries(memoryTypeBreakdown)
              .map(([type, count]) => `  - ${type}: ${count}`)
              .join('\n');

            const embeddingCoverage = Math.round(((stats.memoriesWithEmbeddings || 0) / Math.max(stats.totalMemories, 1)) * 100);
            const embeddingStatus = embeddingCoverage === 100 ? '✅' : embeddingCoverage >= 90 ? '⚠️' : '❌';

            resultText = `📊 Memory Statistics:\n\n• Total Memories: ${stats.totalMemories}\n• Total Entities: ${stats.totalEntities}\n• Memories by Type:\n${typeLines || '  - None'}\n• Vector Embeddings: ${embeddingStatus} ${stats.memoriesWithEmbeddings || 0}/${stats.totalMemories} (${embeddingCoverage}%)\n\n${stats.vectorSearchHealth?.recommendation || ''}`;
          } else {
            resultText = `❌ Failed to get statistics: ${statsResult.error || statsResult.message}`;
          }
          break;

        case 'update_missing_embeddings':
          const embeddingUserId = this.getUserId();
          const embeddingUpdateResult = await this.memoryCore.updateMissingEmbeddings(embeddingUserId);

          if (embeddingUpdateResult.status === MCPToolResultStatus.SUCCESS && embeddingUpdateResult.data) {
            const updateStats = embeddingUpdateResult.data as any;
            resultText = `✅ Embedding update completed!\n\n• Updated: ${updateStats.updated}\n• Failed: ${updateStats.failed}\n• Total processed: ${updateStats.updated + updateStats.failed}`;
          } else {
            resultText = `❌ Failed to update embeddings: ${embeddingUpdateResult.error || embeddingUpdateResult.message}`;
          }
          break;

        case 'get_daily_costs':
          try {
            const date = args.date || new Date().toISOString().split('T')[0];
            const userId = this.getUserId();

            if (!this.db) {
              resultText = '❌ Database not initialized';
              break;
            }

            const usageTracker = new UsageTrackingDB(this.db);
            const usage = await usageTracker.getDailyUsage(userId, date);

            const report = `📊 Daily API Cost Report - ${date}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

OpenAI (Embeddings):
  • Requests: ${usage.openai.requests}
  • Tokens: ${usage.openai.tokens.toLocaleString()}
  • Cost: $${usage.openai.cost.toFixed(4)}

OpenRouter:
  • Requests: ${usage.openrouter.requests}
  • Tokens: ${usage.openrouter.tokens.toLocaleString()}
  • Cost: $${usage.openrouter.cost.toFixed(4)}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total Daily Cost: $${usage.total.cost.toFixed(4)}
Total Requests: ${usage.total.requests}
Total Tokens: ${usage.total.tokens.toLocaleString()}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

            resultText = report;
          } catch (error) {
            resultText = `❌ Failed to get daily costs: ${error instanceof Error ? error.message : String(error)}`;
          }
          break;

        case 'list_entities':
          const listEntitiesUserId = this.getUserId();
          if (!this.dbOps) throw new Error('Database operations not initialized');
          const listResult = await this.dbOps.getEntitiesByUserId(listEntitiesUserId, args.limit || 100);

          if (listResult.length === 0) {
            resultText = '📋 No entities found';
          } else {
            resultText = `📋 Found ${listResult.length} entities:\n\n`;
            listResult.forEach((entity: any, index: number) => {
              const tagsDisplay = Array.isArray(entity.tags) && entity.tags.length > 0
                ? entity.tags.join(', ')
                : 'none';
              
              resultText += `${index + 1}. ${entity.name} (${entity.entityType})\n`;
              resultText += `   ID: ${entity.id}\n`;
              if (entity.description) resultText += `   Description: ${entity.description}\n`;
              if (entity.email) resultText += `   Email: ${entity.email}\n`;
              if (entity.company) resultText += `   Company: ${entity.company}\n`;
              if (entity.title) resultText += `   Title: ${entity.title}\n`;
              resultText += `   Importance: ${entity.importance || 2}\n`;
              resultText += `   Tags: ${tagsDisplay}\n\n`;
            });
          }
          break;

        case 'get_entity':
          const getEntityUserId = this.getUserId();
          if (!this.dbOps) throw new Error('Database operations not initialized');
          const entityResult = await this.dbOps.getEntityById(args.id, getEntityUserId);

          if (entityResult) {
            const entity = entityResult as any;
            const tagsDisplay = Array.isArray(entity.tags) && entity.tags.length > 0
              ? entity.tags.join(', ')
              : 'none';

            resultText = `👤 Entity Details:\n\n`;
            resultText += `Name: ${entity.name}\n`;
            resultText += `Type: ${entity.entityType}\n`;
            resultText += `ID: ${entity.id}\n`;
            if (entity.description) resultText += `Description: ${entity.description}\n`;
            if (entity.email) resultText += `Email: ${entity.email}\n`;
            if (entity.phone) resultText += `Phone: ${entity.phone}\n`;
            if (entity.company) resultText += `Company: ${entity.company}\n`;
            if (entity.title) resultText += `Title: ${entity.title}\n`;
            if (entity.contactInfo) resultText += `Contact Info: ${entity.contactInfo}\n`;
            resultText += `Importance: ${entity.importance || 2}\n`;
            resultText += `Tags: ${tagsDisplay}\n`;
            resultText += `Created: ${new Date(entity.createdAt).toLocaleString()}\n`;
            if (entity.lastInteraction) resultText += `Last Interaction: ${new Date(entity.lastInteraction).toLocaleString()}\n`;
            if (entity.interactionCount) resultText += `Interaction Count: ${entity.interactionCount}\n`;
          } else {
            resultText = `❌ Entity not found: ${args.id}`;
          }
          break;

        case 'search_entities':
          const searchEntitiesUserId = this.getUserId();
          const searchEntitiesResult = await this.memoryCore.searchEntities(args.query, {
            userId: searchEntitiesUserId,
            limit: args.limit || 10,
          });

          if (searchEntitiesResult.status === MCPToolResultStatus.SUCCESS && searchEntitiesResult.data) {
            const entities = searchEntitiesResult.data as any[];
            if (entities.length === 0) {
              resultText = `🔍 No entities found for "${args.query}"`;
            } else {
              resultText = `🔍 Found ${entities.length} entities for "${args.query}":\n\n`;
              entities.forEach((entity, index) => {
                const tagsDisplay = Array.isArray(entity.tags) && entity.tags.length > 0
                  ? entity.tags.join(', ')
                  : 'none';
                
                resultText += `${index + 1}. ${entity.name} (${entity.entityType})\n`;
                resultText += `   ID: ${entity.id}\n`;
                if (entity.description) resultText += `   Description: ${entity.description.substring(0, 100)}${entity.description.length > 100 ? '...' : ''}\n`;
                if (entity.email) resultText += `   Email: ${entity.email}\n`;
                if (entity.company) resultText += `   Company: ${entity.company}\n`;
                resultText += `   Tags: ${tagsDisplay}\n\n`;
              });
            }
          } else {
            resultText = `❌ Search failed: ${searchEntitiesResult.error || searchEntitiesResult.message}`;
          }
          break;

        case 'create_entity':
          const createEntityUserId = this.getUserId();
          const createResult = await this.memoryCore.createEntity(
            args.name,
            args.entityType as any,
            {
              userId: createEntityUserId,
              description: args.description,
              importance: args.importance,
              tags: args.tags,
              contactInfo: args.contactInfo,
              email: args.email,
              phone: args.phone,
              company: args.company,
              title: args.title,
            }
          );

          if (createResult.status === MCPToolResultStatus.SUCCESS) {
            const entityData = createResult.data as any;
            resultText = `✅ Entity created successfully!\n\nID: ${entityData?.id}\nName: ${args.name}\nType: ${args.entityType}`;
          } else {
            resultText = `❌ Failed to create entity: ${createResult.error || createResult.message}`;
          }
          break;

        case 'update_entity':
          const updateEntityUserId = this.getUserId();
          if (!this.dbOps) throw new Error('Database operations not initialized');
          const entityUpdates: any = {};
          if (args.name !== undefined) entityUpdates.name = args.name;
          if (args.description !== undefined) entityUpdates.description = args.description;
          if (args.importance !== undefined) entityUpdates.importance = args.importance;
          if (args.tags !== undefined) entityUpdates.tags = args.tags;
          if (args.contactInfo !== undefined) entityUpdates.contactInfo = args.contactInfo;
          if (args.email !== undefined) entityUpdates.email = args.email;
          if (args.phone !== undefined) entityUpdates.phone = args.phone;
          if (args.company !== undefined) entityUpdates.company = args.company;
          if (args.title !== undefined) entityUpdates.title = args.title;

          const updateEntityResult = await this.dbOps.updateEntity(args.id, entityUpdates, updateEntityUserId);

          if (updateEntityResult) {
            resultText = `✅ Entity ${args.id} updated successfully!`;
          } else {
            resultText = `❌ Failed to update entity: Entity not found or update failed`;
          }
          break;

        case 'delete_entity':
          const deleteEntityUserId = this.getUserId();
          if (!this.dbOps) throw new Error('Database operations not initialized');
          
          // First check if entity exists
          const entityToDelete = await this.dbOps.getEntityById(args.id, deleteEntityUserId);
          
          if (!entityToDelete) {
            resultText = `❌ Entity not found: ${args.id}`;
            break;
          }

          // Delete the entity
          await this.db.execute('DELETE FROM entities WHERE id = ? AND user_id = ?', [
            args.id,
            deleteEntityUserId,
          ]);

          resultText = `✅ Entity ${args.id} deleted successfully!`;
          break;

        default:
          // Return JSON-RPC error for unknown tools
          return {
            jsonrpc: '2.0',
            id,
            error: {
              code: -32601,
              message: `Unknown tool: ${name}`,
              data: { toolName: name },
            },
          };
      }

      const toolResult = {
        content: [
          {
            type: 'text',
            text: resultText,
          },
        ],
        isError: false,
      };

      return {
        jsonrpc: '2.0',
        id,
        result: toolResult,
      };
    } catch (error) {
      this.logError(`Tool call error for ${name}:`, error);

      // Return JSON-RPC error for tool execution errors
      return {
        jsonrpc: '2.0',
        id,
        error: {
          code: -32603,
          message: 'Tool execution failed',
          data: { toolName: name, error: String(error) },
        },
      };
    }
  }
}

// Start the server if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = new SimpleMCPServer();
  server.start().catch((error) => {
    console.error('Failed to start Simple MCP server:', error);
    process.exit(1);
  });
}

export { SimpleMCPServer };
