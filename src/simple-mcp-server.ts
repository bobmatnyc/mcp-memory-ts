#!/usr/bin/env node
/**
 * Simple MCP Server for Memory Service
 * A minimal working implementation
 */

import { stdin, stdout } from 'process';
import { createInterface } from 'readline';
import { initDatabaseFromEnv } from './database/index.js';
import { MemoryCore } from './core/index.js';
import { MemoryType, ImportanceLevel, MCPToolResultStatus } from './types/enums.js';

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
  private requestCounter = 0;
  private memoryCore: MemoryCore | null = null;

  constructor() {
    this.debugEnabled = process.env.MCP_DEBUG === '1';
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

  async start(): Promise<void> {
    this.logDebug('Starting Simple MCP Memory Server...');

    // Initialize database and memory core
    try {
      const db = initDatabaseFromEnv();
      this.memoryCore = new MemoryCore(db, process.env.OPENAI_API_KEY);
      await this.memoryCore.initialize();
      this.logDebug('Memory core initialized successfully');
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
            content: { type: 'string', description: 'Updated content' },
            importance: {
              type: 'number',
              minimum: 0,
              maximum: 1,
              description: 'Updated importance score'
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
        name: 'clear_memories',
        description: 'Clear all memories or memories of a specific type',
        inputSchema: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: ['episodic', 'semantic', 'procedural', 'working', 'sensory'],
              description: 'Type of memories to clear (omit to clear all)'
            },
          },
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

          const addResult = await this.memoryCore.addMemory(
            title,
            args.content,
            inputType as any, // Pass the actual type string
            {
              tags: Array.isArray(tags) ? tags : [tags],
              importance: importanceValue as any, // Pass decimal importance directly
              metadata: metadataToStore,
              generateEmbedding: true,
            }
          );

          if (addResult.status === MCPToolResultStatus.SUCCESS) {
            const memoryData = addResult.data as any;
            resultText = `✅ Memory stored successfully!\n\nID: ${memoryData?.id || 'unknown'}\nContent: ${args.content}\nType: ${inputType}\nImportance: ${importanceValue}`;
          } else {
            resultText = `❌ Failed to store memory: ${addResult.error || addResult.message}`;
          }
          break;

        case 'recall_memories':
          const searchResult = await this.memoryCore.searchMemories(args.query, {
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
          const getResult = await this.memoryCore.getMemory(args.id);

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
          // Keep importance as decimal (0-1) without conversion
          const updateResult = await this.memoryCore.updateMemory(args.id, {
            content: args.content,
            importance: args.importance as any, // Pass decimal importance directly
          });

          if (updateResult.status === MCPToolResultStatus.SUCCESS) {
            resultText = `✅ Memory ${args.id} updated successfully!`;
          } else {
            resultText = `❌ Failed to update memory: ${updateResult.error || updateResult.message}`;
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

        case 'clear_memories':
          // For now, we'll just return a message since this is a dangerous operation
          resultText = `⚠️ Clear memories operation not implemented for safety. Use delete_memory for individual deletions.`;
          break;

        case 'get_memory_stats':
          const statsResult = await this.memoryCore.getStatistics();

          if (statsResult.status === MCPToolResultStatus.SUCCESS && statsResult.data) {
            const stats = statsResult.data as any;
            const memoryTypeBreakdown = stats.memoriesByType || {};
            const typeLines = Object.entries(memoryTypeBreakdown)
              .map(([type, count]) => `  - ${type}: ${count}`)
              .join('\n');

            resultText = `📊 Memory Statistics:\n\n• Total Memories: ${stats.totalMemories}\n• Total Entities: ${stats.totalEntities}\n• Memories by Type:\n${typeLines || '  - None'}\n• Vector Embeddings: ${stats.memoriesWithEmbeddings || 0}/${stats.totalMemories} (${Math.round(((stats.memoriesWithEmbeddings || 0) / Math.max(stats.totalMemories, 1)) * 100)}%)`;
          } else {
            resultText = `❌ Failed to get statistics: ${statsResult.error || statsResult.message}`;
          }
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
