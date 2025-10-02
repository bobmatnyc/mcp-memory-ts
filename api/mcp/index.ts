/**
 * Vercel Serverless Function for Remote MCP Server
 * Handles MCP JSON-RPC requests with Clerk OAuth authentication
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { config } from 'dotenv';
import { resolve } from 'path';
import { existsSync } from 'fs';
import { initDatabaseFromEnv } from '../../src/database/index.js';
import { MultiTenantMemoryCore } from '../../src/core/multi-tenant-memory-core.js';
import { authenticateRequest, logAuthEvent } from '../../src/middleware/mcp-auth.js';
import { MemoryType, ImportanceLevel, MCPToolResultStatus } from '../../src/types/enums.js';
import { UsageTrackingDB } from '../../src/database/usage-tracking.js';

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

// Singleton instances for serverless
let memoryCore: MultiTenantMemoryCore | null = null;
let db: any = null;
let requestCounter = 0;

/**
 * Initialize database and memory core (singleton pattern for serverless)
 */
async function initializeCore(): Promise<MultiTenantMemoryCore> {
  if (!memoryCore) {
    db = initDatabaseFromEnv();
    memoryCore = new MultiTenantMemoryCore(db, process.env.OPENAI_API_KEY);
    await memoryCore.initialize();
    console.info('[Vercel MCP] Multi-tenant memory core initialized');
  }
  return memoryCore;
}

function ensureValidId(id?: string | number | null): string | number {
  if (id !== undefined && id !== null) {
    return id;
  }
  return `auto-${++requestCounter}`;
}

/**
 * Process a JSON-RPC request
 */
async function processRequest(
  request: JsonRpcRequest,
  userEmail: string
): Promise<JsonRpcResponse> {
  const { id, method, params } = request;
  const core = await initializeCore();

  try {
    const validId = ensureValidId(id);

    switch (method) {
      case 'initialize':
        return {
          jsonrpc: '2.0',
          id: validId,
          result: {
            protocolVersion: '2024-11-05',
            capabilities: {
              tools: { listChanged: false },
              logging: {},
            },
            serverInfo: {
              name: 'vercel-mcp-memory-ts',
              version: '1.0.0',
            },
          },
        };

      case 'initialized':
      case 'notifications/initialized':
        return { jsonrpc: '2.0', id: validId, result: {} };

      case 'tools/list':
        return {
          jsonrpc: '2.0',
          id: validId,
          result: {
            tools: [
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
                      default: 'semantic',
                    },
                    importance: { type: 'number', minimum: 0, maximum: 1, default: 0.5 },
                    metadata: { type: 'object' },
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
                    query: { type: 'string' },
                    limit: { type: 'integer', minimum: 1, maximum: 100, default: 10 },
                    strategy: {
                      type: 'string',
                      enum: ['recency', 'frequency', 'importance', 'similarity', 'composite'],
                      default: 'composite',
                    },
                    threshold: { type: 'number', minimum: 0, maximum: 1, default: 0.3 },
                  },
                  required: ['query'],
                },
              },
              {
                name: 'get_memory',
                description: 'Retrieve a specific memory by ID',
                inputSchema: {
                  type: 'object',
                  properties: { id: { type: 'string' } },
                  required: ['id'],
                },
              },
              {
                name: 'update_memory',
                description: 'Update an existing memory',
                inputSchema: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    title: { type: 'string' },
                    content: { type: 'string' },
                    importance: { type: 'number', minimum: 0, maximum: 1 },
                    tags: { type: 'array', items: { type: 'string' } },
                    metadata: { type: 'object' },
                  },
                  required: ['id'],
                },
              },
              {
                name: 'delete_memory',
                description: 'Delete a memory by ID',
                inputSchema: {
                  type: 'object',
                  properties: { id: { type: 'string' } },
                  required: ['id'],
                },
              },
              {
                name: 'get_memory_stats',
                description: 'Get statistics about stored memories',
                inputSchema: { type: 'object', properties: {} },
              },
              {
                name: 'update_missing_embeddings',
                description: 'Generate embeddings for memories without them',
                inputSchema: { type: 'object', properties: {} },
              },
              {
                name: 'get_daily_costs',
                description: 'Get daily API usage costs',
                inputSchema: {
                  type: 'object',
                  properties: { date: { type: 'string', description: 'YYYY-MM-DD format' } },
                },
              },
            ],
          },
        };

      case 'tools/call':
        return await handleToolCall(validId, params, userEmail, core);

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
          error: { code: -32601, message: `Method not found: ${method}` },
        };
    }
  } catch (error) {
    console.error('[Vercel MCP] Error processing request:', error);
    return {
      jsonrpc: '2.0',
      id: ensureValidId(id),
      error: { code: -32603, message: 'Internal error', data: String(error) },
    };
  }
}

/**
 * Handle tool calls
 */
async function handleToolCall(
  id: string | number,
  params: any,
  userEmail: string,
  core: MultiTenantMemoryCore
): Promise<JsonRpcResponse> {
  const { name, arguments: args } = params;

  try {
    let resultText = '';

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

        const addResult = await core.addMemory(title, args.content, inputType as any, {
          userId: userEmail,
          tags: Array.isArray(tags) ? tags : [tags],
          importance: importanceValue as any,
          metadata: metadataToStore,
          generateEmbedding: true,
          useBuffer: false,
        });

        if (addResult.status === MCPToolResultStatus.SUCCESS) {
          const memoryData = addResult.data as any;
          resultText = `✅ Memory stored successfully!\n\nID: ${memoryData?.id || 'unknown'}\nUser: ${userEmail}`;
        } else {
          resultText = `❌ Failed to store memory: ${addResult.error || addResult.message}`;
        }
        break;

      case 'recall_memories':
        const searchResult = await core.searchMemories(args.query, {
          userId: userEmail,
          limit: args.limit || 10,
          threshold: args.threshold || 0.3,
          strategy: args.strategy || 'composite',
        });

        if (searchResult.status === MCPToolResultStatus.SUCCESS && searchResult.data) {
          const memories = searchResult.data as any[];
          resultText =
            memories.length === 0
              ? `🔍 No memories found for "${args.query}"`
              : `🔍 Found ${memories.length} memories for "${args.query}"`;
        } else {
          resultText = `❌ Search failed: ${searchResult.error || searchResult.message}`;
        }
        break;

      case 'get_memory':
        const getResult = await core.getMemory(args.id);
        if (getResult.status === MCPToolResultStatus.SUCCESS && getResult.data) {
          const memory = getResult.data as any;
          if (memory.userId !== userEmail) {
            resultText = `❌ Access denied: You do not own this memory`;
          } else {
            resultText = `📄 Memory: ${memory.content}`;
          }
        } else {
          resultText = `❌ Memory not found`;
        }
        break;

      case 'update_memory':
        const updates: any = {};
        if (args.content !== undefined) updates.content = args.content;
        if (args.title !== undefined) updates.title = args.title;
        if (args.importance !== undefined) updates.importance = args.importance;
        if (args.tags !== undefined) updates.tags = args.tags;
        if (args.metadata !== undefined) updates.metadata = args.metadata;

        const updateResult = await core.updateMemory(args.id, updates);
        resultText =
          updateResult.status === MCPToolResultStatus.SUCCESS
            ? `✅ Memory updated`
            : `❌ Failed to update memory`;
        break;

      case 'delete_memory':
        const deleteResult = await core.deleteMemory(args.id);
        resultText =
          deleteResult.status === MCPToolResultStatus.SUCCESS
            ? `✅ Memory deleted`
            : `❌ Failed to delete memory`;
        break;

      case 'get_memory_stats':
        const statsResult = await core.getStatistics(userEmail);
        if (statsResult.status === MCPToolResultStatus.SUCCESS && statsResult.data) {
          const stats = statsResult.data as any;
          resultText = `📊 Stats: ${stats.totalMemories} memories, ${stats.totalEntities} entities`;
        } else {
          resultText = `❌ Failed to get statistics`;
        }
        break;

      case 'update_missing_embeddings':
        const embResult = await core.updateMissingEmbeddings();
        resultText =
          embResult.status === MCPToolResultStatus.SUCCESS
            ? `✅ Embeddings updated`
            : `❌ Failed to update embeddings`;
        break;

      case 'get_daily_costs':
        const date = args.date || new Date().toISOString().split('T')[0];
        if (db) {
          const usageTracker = new UsageTrackingDB(db);
          const usage = await usageTracker.getDailyUsage(userEmail, date);
          resultText = `📊 Daily costs for ${date}: $${usage.total.cost.toFixed(4)}`;
        } else {
          resultText = `❌ Database not initialized`;
        }
        break;

      default:
        return {
          jsonrpc: '2.0',
          id,
          error: { code: -32601, message: `Unknown tool: ${name}` },
        };
    }

    return {
      jsonrpc: '2.0',
      id,
      result: {
        content: [{ type: 'text', text: resultText }],
        isError: false,
      },
    };
  } catch (error) {
    console.error(`[Vercel MCP] Tool call error for ${name}:`, error);
    return {
      jsonrpc: '2.0',
      id,
      error: { code: -32603, message: 'Tool execution failed', data: String(error) },
    };
  }
}

/**
 * Main Vercel serverless function handler
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', process.env.CORS_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Health check
  if (req.method === 'GET' && req.url === '/health') {
    return res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'vercel-mcp-server',
    });
  }

  // Only accept POST for MCP requests
  if (req.method !== 'POST') {
    return res.status(405).json({
      jsonrpc: '2.0',
      id: null,
      error: { code: -32700, message: 'Method not allowed' },
    });
  }

  try {
    // Authenticate request
    const authResult = await authenticateRequest(req.headers.authorization as string);

    if (!authResult.authenticated || !authResult.user) {
      logAuthEvent('failure', {
        error: authResult.error,
        url: req.url,
      });

      return res.status(401).json({
        jsonrpc: '2.0',
        id: null,
        error: {
          code: -32001,
          message: 'Authentication required',
          data: { reason: authResult.error },
        },
      });
    }

    logAuthEvent('success', {
      email: authResult.user.email,
      userId: authResult.user.userId,
    });

    // Process JSON-RPC request
    const rpcRequest = req.body as JsonRpcRequest;
    const response = await processRequest(rpcRequest, authResult.user.email);

    return res.status(200).json(response);
  } catch (error) {
    console.error('[Vercel MCP] Handler error:', error);
    return res.status(500).json({
      jsonrpc: '2.0',
      id: null,
      error: { code: -32603, message: 'Internal server error', data: String(error) },
    });
  }
}
