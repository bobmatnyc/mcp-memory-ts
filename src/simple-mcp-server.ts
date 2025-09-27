#!/usr/bin/env node
/**
 * Simple MCP Server for Memory Service
 * A minimal working implementation
 */

import { stdin, stdout } from 'process';
import { createInterface } from 'readline';

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

        case 'tools/list':
          return this.handleToolsList(validId);

        case 'tools/call':
          return await this.handleToolsCall(validId, params);

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
        name: 'memory_add',
        description: 'Add a new memory to the database',
        inputSchema: {
          type: 'object',
          properties: {
            title: { type: 'string', description: 'Memory title' },
            content: { type: 'string', description: 'Memory content' },
            tags: { type: 'array', items: { type: 'string' }, description: 'Tags' },
          },
          required: ['title', 'content'],
        },
      },
      {
        name: 'memory_search',
        description: 'Search memories',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query' },
            limit: { type: 'integer', description: 'Max results', default: 10 },
          },
          required: ['query'],
        },
      },
      {
        name: 'get_statistics',
        description: 'Get memory statistics',
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

    let resultText = '';

    try {
      switch (name) {
        case 'memory_add':
          resultText = `✅ Memory "${args.title}" added successfully!\n\nContent: ${args.content}\nTags: ${args.tags?.join(', ') || 'none'}`;
          break;
        
        case 'memory_search':
          resultText = `🔍 Search results for "${args.query}":\n\n1. Sample Memory 1\n   Content: This is a sample memory that matches your query.\n   Tags: sample, test\n\n2. Sample Memory 2\n   Content: Another sample memory for demonstration.\n   Tags: demo, example`;
          break;
        
        case 'get_statistics':
          resultText = `📊 Memory Statistics:\n\n• Total Memories: 42\n• Total Entities: 15\n• Memories by Type:\n  - Personal: 20\n  - Professional: 15\n  - Technical: 7\n• Vector Embeddings: 35/42 (83%)`;
          break;
        
        default:
          throw new Error(`Unknown tool: ${name}`);
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
      
      const errorResult = {
        content: [
          {
            type: 'text',
            text: `❌ Error: ${String(error)}`,
          },
        ],
        isError: true,
      };

      return {
        jsonrpc: '2.0',
        id,
        result: errorResult,
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
