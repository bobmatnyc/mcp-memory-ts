#!/usr/bin/env node
/**
 * Remote MCP Server for Memory Service
 * HTTP-based MCP server with Clerk OAuth authentication
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { existsSync } from 'fs';
import Fastify, { type FastifyInstance, type FastifyRequest, type FastifyReply } from 'fastify';
import cors from '@fastify/cors';
import { initDatabaseFromEnv } from './database/index.js';
import { MultiTenantMemoryCore } from './core/multi-tenant-memory-core.js';
import { MemoryType, ImportanceLevel, MCPToolResultStatus } from './types/enums.js';
import { UsageTrackingDB } from './database/usage-tracking.js';
import {
  authenticateRequest,
  SessionManager,
  logAuthEvent,
  type AuthenticatedUser,
} from './middleware/mcp-auth.js';

// Load environment variables
const envLocalPath = resolve(process.cwd(), '.env.local');
const envPath = resolve(process.cwd(), '.env');

if (existsSync(envLocalPath)) {
  config({ path: envLocalPath });
} else if (existsSync(envPath)) {
  config({ path: envPath });
}

// JSON-RPC types
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

interface AuthenticatedRequest extends FastifyRequest {
  user?: AuthenticatedUser;
}

/**
 * Remote MCP Server with HTTP transport and OAuth authentication
 */
export class RemoteMCPServer {
  private fastify: FastifyInstance;
  private memoryCore: MultiTenantMemoryCore | null = null;
  private db: any = null;
  private sessionManager: SessionManager;
  private debugEnabled = false;
  private requestCounter = 0;
  private port: number;
  private host: string;

  constructor(port = 3001, host = '0.0.0.0') {
    this.port = port;
    this.host = host;
    this.debugEnabled = process.env.MCP_DEBUG === '1';
    this.sessionManager = new SessionManager();

    this.fastify = Fastify({
      logger: {
        level: process.env.LOG_LEVEL || 'info',
      },
    });

    this.setupMiddleware();
    this.setupRoutes();
  }

  private logDebug(...args: any[]): void {
    if (this.debugEnabled) {
      console.error('[Remote MCP DEBUG]', ...args);
    }
  }

  private logError(...args: any[]): void {
    console.error('[Remote MCP ERROR]', ...args);
  }

  private ensureValidId(id?: string | number | null): string | number {
    if (id !== undefined && id !== null) {
      return id;
    }
    return `auto-${++this.requestCounter}`;
  }

  private setupMiddleware(): void {
    // Register CORS
    this.fastify.register(cors, {
      origin: process.env.CORS_ORIGIN || true,
      credentials: true,
      methods: ['GET', 'POST', 'OPTIONS'],
    });

    // Authentication middleware for MCP endpoints
    this.fastify.addHook('preHandler', async (request: AuthenticatedRequest, reply) => {
      // Skip auth for health check
      if (request.url === '/health' || request.url === '/') {
        return;
      }

      // All MCP endpoints require authentication
      const authResult = await authenticateRequest(
        request.headers.authorization,
        this.sessionManager
      );

      if (!authResult.authenticated) {
        logAuthEvent('failure', {
          error: authResult.error,
          url: request.url,
          ip: request.ip,
        });

        reply.code(401).send({
          jsonrpc: '2.0',
          id: null,
          error: {
            code: -32001,
            message: 'Authentication required',
            data: { reason: authResult.error },
          },
        });
        return;
      }

      // Attach user to request
      request.user = authResult.user;

      logAuthEvent('success', {
        email: authResult.user?.email,
        userId: authResult.user?.userId,
      });
    });
  }

  private setupRoutes(): void {
    // Health check endpoint (no auth required)
    this.fastify.get('/health', async (request, reply) => {
      return {
        status: 'ok',
        timestamp: new Date().toISOString(),
        service: 'remote-mcp-server',
        activeSessions: this.sessionManager.getActiveSessions(),
      };
    });

    // Root endpoint (no auth required)
    this.fastify.get('/', async (request, reply) => {
      return {
        name: 'Remote MCP Memory Server',
        version: '1.0.0',
        description: 'HTTP-based MCP server with Clerk OAuth authentication',
        protocol: 'JSON-RPC 2.0',
      };
    });

    // Main MCP endpoint
    this.fastify.post('/mcp', async (request: AuthenticatedRequest, reply) => {
      return this.handleMCPRequest(request, reply);
    });

    // MCP methods as individual endpoints (alternative to JSON-RPC)
    this.fastify.post('/mcp/initialize', async (request: AuthenticatedRequest, reply) => {
      const rpcRequest: JsonRpcRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: request.body,
      };
      return this.processRequest(rpcRequest, request.user!);
    });

    this.fastify.get('/mcp/tools/list', async (request: AuthenticatedRequest, reply) => {
      const rpcRequest: JsonRpcRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
      };
      return this.processRequest(rpcRequest, request.user!);
    });

    this.fastify.post('/mcp/tools/call', async (request: AuthenticatedRequest, reply) => {
      const rpcRequest: JsonRpcRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: request.body,
      };
      return this.processRequest(rpcRequest, request.user!);
    });
  }

  private async handleMCPRequest(
    request: AuthenticatedRequest,
    reply: FastifyReply
  ): Promise<JsonRpcResponse> {
    const rpcRequest = request.body as JsonRpcRequest;
    this.logDebug('MCP Request:', rpcRequest);

    const response = await this.processRequest(rpcRequest, request.user!);
    this.logDebug('MCP Response:', response);

    return response;
  }

  private async processRequest(
    request: JsonRpcRequest,
    user: AuthenticatedUser
  ): Promise<JsonRpcResponse> {
    const { id, method, params } = request;

    try {
      const validId = this.ensureValidId(id);

      switch (method) {
        case 'initialize':
          return this.handleInitialize(validId, params);

        case 'initialized':
        case 'notifications/initialized':
          this.logDebug('Client initialized');
          return { jsonrpc: '2.0', id: validId, result: {} };

        case 'tools/list':
          return this.handleToolsList(validId);

        case 'tools/call':
          return await this.handleToolsCall(validId, params, user);

        case 'prompts/list':
          return { jsonrpc: '2.0', id: validId, result: { prompts: [] } };

        case 'resources/list':
          return { jsonrpc: '2.0', id: validId, result: { resources: [] } };

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
        name: 'remote-mcp-memory-ts',
        version: '1.0.0',
      },
    };

    this.logDebug('Remote MCP server initialized');

    return {
      jsonrpc: '2.0',
      id,
      result,
    };
  }

  private handleToolsList(id: string | number): JsonRpcResponse {
    // Same tools as the stdio MCP server
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
              default: 'semantic',
            },
            importance: {
              type: 'number',
              minimum: 0,
              maximum: 1,
              description: 'Importance score (0-1)',
              default: 0.5,
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
              default: 10,
            },
            strategy: {
              type: 'string',
              enum: ['recency', 'frequency', 'importance', 'similarity', 'composite'],
              description: 'Recall strategy to use',
              default: 'composite',
            },
            threshold: {
              type: 'number',
              minimum: 0,
              maximum: 1,
              description: 'Minimum relevance threshold',
              default: 0.3,
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
              description: 'Updated importance score',
            },
            tags: {
              type: 'array',
              items: { type: 'string' },
              description: 'Updated tags',
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
        description:
          'Get daily API usage costs for OpenAI embeddings. Returns token usage and costs for the current day or a specific date.',
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
    ];

    return {
      jsonrpc: '2.0',
      id,
      result: { tools },
    };
  }

  private async handleToolsCall(
    id: string | number,
    params: any,
    user: AuthenticatedUser
  ): Promise<JsonRpcResponse> {
    const { name, arguments: args } = params;
    this.logDebug(`Tool call: ${name}`, args, `User: ${user.email}`);

    if (!this.memoryCore) {
      throw new Error('Memory core not initialized');
    }

    let resultText = '';

    try {
      switch (name) {
        case 'store_memory':
          const inputType = args.type || 'semantic';
          const importanceValue = args.importance !== undefined ? args.importance : 0.5;
          const title = args.title || args.metadata?.title || 'Memory';
          const tags = args.tags || args.metadata?.tags || [];

          let metadataToStore: Record<string, unknown> | undefined;
          if (args.metadata && typeof args.metadata === 'object') {
            const { title: _title, tags: _tags, ...remainingMetadata } = args.metadata;
            if (Object.keys(remainingMetadata).length > 0) {
              metadataToStore = remainingMetadata;
            }
          }

          const addResult = await this.memoryCore.addMemory(
            title,
            args.content,
            inputType as any,
            {
              userId: user.email, // Use email as user identifier
              tags: Array.isArray(tags) ? tags : [tags],
              importance: importanceValue as any,
              metadata: metadataToStore,
              generateEmbedding: true,
              useBuffer: false, // Direct write for remote MCP
            }
          );

          if (addResult.status === MCPToolResultStatus.SUCCESS) {
            const memoryData = addResult.data as any;
            const embeddingStatus = memoryData?.hasEmbedding
              ? '✅ with embedding'
              : '⚠️  without embedding (will be generated)';
            resultText = `✅ Memory stored successfully ${embeddingStatus}!\n\nID: ${memoryData?.id || 'unknown'}\nContent: ${args.content}\nType: ${inputType}\nImportance: ${importanceValue}\nUser: ${user.email}`;
          } else {
            resultText = `❌ Failed to store memory: ${addResult.error || addResult.message}`;
          }
          break;

        case 'recall_memories':
          const searchResult = await this.memoryCore.searchMemories(args.query, {
            userId: user.email,
            limit: args.limit || 10,
            threshold: args.threshold || 0.3,
            strategy: args.strategy || 'composite',
          });

          if (searchResult.status === MCPToolResultStatus.SUCCESS && searchResult.data) {
            const memories = searchResult.data as any[];
            if (memories.length === 0) {
              resultText = `🔍 No memories found for "${args.query}"`;
            } else {
              resultText = `🔍 Found ${memories.length} memories for "${args.query}":\n\n`;
              memories.forEach((memory, index) => {
                const tagsDisplay =
                  Array.isArray(memory.tags) && memory.tags.length > 0
                    ? memory.tags.join(', ')
                    : 'none';
                const metadataDisplay =
                  memory.metadata && Object.keys(memory.metadata).length > 0
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
          const getResult = await this.memoryCore.getMemory(args.id);

          if (getResult.status === MCPToolResultStatus.SUCCESS && getResult.data) {
            const memory = getResult.data as any;
            // Verify user owns this memory
            if (memory.userId !== user.email) {
              resultText = `❌ Access denied: You do not own this memory`;
              break;
            }

            const tagsDisplay =
              Array.isArray(memory.tags) && memory.tags.length > 0
                ? memory.tags.join(', ')
                : 'none';
            const metadataDisplay =
              memory.metadata && Object.keys(memory.metadata).length > 0
                ? JSON.stringify(memory.metadata, null, 2)
                : 'none';

            resultText = `📄 Memory Details:\n\nID: ${memory.id}\nContent: ${memory.content}\nType: ${memory.memoryType || 'semantic'}\nImportance: ${memory.importance !== undefined ? memory.importance : 0.5}\nCreated: ${new Date(memory.createdAt).toLocaleString()}\nTags: ${tagsDisplay}\nMetadata: ${metadataDisplay}`;
          } else {
            resultText = `❌ Memory not found: ${getResult.error || getResult.message}`;
          }
          break;

        case 'update_memory':
          const updates: any = {};
          if (args.content !== undefined) updates.content = args.content;
          if (args.title !== undefined) updates.title = args.title;
          if (args.importance !== undefined) updates.importance = args.importance;
          if (args.tags !== undefined) updates.tags = args.tags;
          if (args.metadata !== undefined) updates.metadata = args.metadata;

          const memoryUpdateResult = await this.memoryCore.updateMemory(args.id, updates);

          if (memoryUpdateResult.status === MCPToolResultStatus.SUCCESS) {
            resultText = `✅ Memory ${args.id} updated successfully!`;
          } else {
            resultText = `❌ Failed to update memory: ${memoryUpdateResult.error || memoryUpdateResult.message}`;
          }
          break;

        case 'delete_memory':
          const deleteResult = await this.memoryCore.deleteMemory(args.id);

          if (deleteResult.status === MCPToolResultStatus.SUCCESS) {
            resultText = `✅ Memory ${args.id} deleted successfully!`;
          } else {
            resultText = `❌ Failed to delete memory: ${deleteResult.error || deleteResult.message}`;
          }
          break;

        case 'get_memory_stats':
          const statsResult = await this.memoryCore.getStatistics(user.email);

          if (statsResult.status === MCPToolResultStatus.SUCCESS && statsResult.data) {
            const stats = statsResult.data as any;
            const memoryTypeBreakdown = stats.memoriesByType || {};
            const typeLines = Object.entries(memoryTypeBreakdown)
              .map(([type, count]) => `  - ${type}: ${count}`)
              .join('\n');

            const embeddingCoverage = Math.round(
              ((stats.memoriesWithEmbeddings || 0) / Math.max(stats.totalMemories, 1)) * 100
            );
            const embeddingStatus =
              embeddingCoverage === 100 ? '✅' : embeddingCoverage >= 90 ? '⚠️' : '❌';

            resultText = `📊 Memory Statistics for ${user.email}:\n\n• Total Memories: ${stats.totalMemories}\n• Total Entities: ${stats.totalEntities}\n• Memories by Type:\n${typeLines || '  - None'}\n• Vector Embeddings: ${embeddingStatus} ${stats.memoriesWithEmbeddings || 0}/${stats.totalMemories} (${embeddingCoverage}%)\n\n${stats.vectorSearchHealth?.recommendation || ''}`;
          } else {
            resultText = `❌ Failed to get statistics: ${statsResult.error || statsResult.message}`;
          }
          break;

        case 'update_missing_embeddings':
          const embeddingUpdateResult = await this.memoryCore.updateMissingEmbeddings();

          if (
            embeddingUpdateResult.status === MCPToolResultStatus.SUCCESS &&
            embeddingUpdateResult.data
          ) {
            const updateStats = embeddingUpdateResult.data as any;
            resultText = `✅ Embedding update completed!\n\n• Updated: ${updateStats.updated}\n• Failed: ${updateStats.failed}\n• Total processed: ${updateStats.updated + updateStats.failed}`;
          } else {
            resultText = `❌ Failed to update embeddings: ${embeddingUpdateResult.error || embeddingUpdateResult.message}`;
          }
          break;

        case 'get_daily_costs':
          try {
            const date = args.date || new Date().toISOString().split('T')[0];

            if (!this.db) {
              resultText = '❌ Database not initialized';
              break;
            }

            const usageTracker = new UsageTrackingDB(this.db);
            const usage = await usageTracker.getDailyUsage(user.email, date);

            const report = `📊 Daily API Cost Report - ${date} (${user.email})
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

        default:
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

  async start(): Promise<void> {
    try {
      this.logDebug('Starting Remote MCP Memory Server...');

      // Initialize database and memory core
      this.db = initDatabaseFromEnv();
      this.memoryCore = new MultiTenantMemoryCore(this.db, process.env.OPENAI_API_KEY);
      await this.memoryCore.initialize();
      this.logDebug('Multi-tenant memory core initialized successfully');

      // Start the server
      await this.fastify.listen({ port: this.port, host: this.host });
      this.fastify.log.info(`Remote MCP server listening on ${this.host}:${this.port}`);
    } catch (error) {
      this.logError('Failed to start Remote MCP server:', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (this.memoryCore) {
      await this.memoryCore.close();
    }
    await this.fastify.close();
    this.logDebug('Remote MCP server stopped');
  }

  /**
   * Handle a single JSON-RPC request (for serverless/Vercel)
   */
  async handleRequest(
    rpcRequest: JsonRpcRequest,
    authHeader: string
  ): Promise<JsonRpcResponse> {
    // Authenticate
    const authResult = await authenticateRequest(authHeader, this.sessionManager);

    if (!authResult.authenticated || !authResult.user) {
      return {
        jsonrpc: '2.0',
        id: this.ensureValidId(rpcRequest.id),
        error: {
          code: -32001,
          message: 'Authentication required',
          data: { reason: authResult.error },
        },
      };
    }

    // Process request
    return this.processRequest(rpcRequest, authResult.user);
  }
}

// Start the server if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const port = process.env.REMOTE_MCP_PORT ? parseInt(process.env.REMOTE_MCP_PORT) : 3001;
  const host = process.env.REMOTE_MCP_HOST || '0.0.0.0';

  const server = new RemoteMCPServer(port, host);

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('Received SIGINT, shutting down gracefully...');
    await server.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('Received SIGTERM, shutting down gracefully...');
    await server.stop();
    process.exit(0);
  });

  server.start().catch((error) => {
    console.error('Failed to start Remote MCP server:', error);
    process.exit(1);
  });
}
