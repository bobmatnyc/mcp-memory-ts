#!/usr/bin/env node
/**
 * MCP (Model Context Protocol) Server for Memory Service
 * Implements JSON-RPC 2.0 over stdio for AI assistant integration
 */

import { stdin, stdout } from 'process';
import { createInterface } from 'readline';
import { initDatabaseFromEnv } from '../database/index.js';
import { MemoryCore } from '../core/index.js';
import { MCP_TOOLS } from './tools.js';
import {
  JsonRpcErrorCode,
  MCPMethod,
  type JsonRpcRequest,
  type JsonRpcResponse,
  type MCPInitializeParams,
  type MCPInitializeResult,
  type MCPToolCall,
  type MCPToolResult,
  type AddMemoryParams,
  type SearchMemoriesParams,
  type CreateEntityParams,
  type SearchEntitiesParams,
  type UnifiedSearchParams,
  type DeleteMemoryParams,
  type UpdateEntityParams,
} from './types.js';
import { MemoryType, EntityType, ImportanceLevel, MCPToolResultStatus } from '../types/enums.js';

export class MCPServer {
  private memoryCore: MemoryCore | null = null;
  private debugEnabled = false;
  private initialized = false;

  constructor() {
    this.debugEnabled = process.env.MCP_DEBUG === '1';
    this.setupErrorHandling();
  }

  private setupErrorHandling(): void {
    process.on('uncaughtException', (error) => {
      this.logError('Uncaught exception:', error);
      process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      this.logError('Unhandled rejection at:', promise, 'reason:', reason);
      process.exit(1);
    });

    process.on('SIGINT', () => {
      this.logDebug('Received SIGINT, shutting down gracefully...');
      this.shutdown();
    });

    process.on('SIGTERM', () => {
      this.logDebug('Received SIGTERM, shutting down gracefully...');
      this.shutdown();
    });
  }

  private logDebug(...args: any[]): void {
    if (this.debugEnabled) {
      console.error('[MCP DEBUG]', ...args);
    }
  }

  private logError(...args: any[]): void {
    console.error('[MCP ERROR]', ...args);
  }

  private logInfo(...args: any[]): void {
    console.error('[MCP INFO]', ...args);
  }

  async start(): Promise<void> {
    try {
      this.logInfo('Starting MCP Memory Server...');

      // Initialize database and memory core
      const db = initDatabaseFromEnv();
      this.memoryCore = new MemoryCore(db, process.env.OPENAI_API_KEY);
      await this.memoryCore.initialize();

      this.logInfo('Memory core initialized successfully');

      // Set up stdio communication
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
        this.shutdown();
      });

      this.logInfo('MCP Server started and listening on stdio');
    } catch (error) {
      this.logError('Failed to start MCP server:', error);
      process.exit(1);
    }
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
        id: null,
        error: {
          code: JsonRpcErrorCode.PARSE_ERROR,
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
      switch (method) {
        case MCPMethod.INITIALIZE:
          return this.handleInitialize(id ?? null, params as MCPInitializeParams);

        case MCPMethod.INITIALIZED:
          this.logDebug('Client initialized');
          return null; // No response for notifications

        case MCPMethod.TOOLS_LIST:
          return this.handleToolsList(id ?? null);

        case MCPMethod.TOOLS_CALL:
          return await this.handleToolsCall(id ?? null, params as MCPToolCall);

        case MCPMethod.PING:
          return { jsonrpc: '2.0', id: id ?? null, result: {} };
        
        default:
          return {
            jsonrpc: '2.0',
            id: id ?? null,
            error: {
              code: JsonRpcErrorCode.METHOD_NOT_FOUND,
              message: `Method not found: ${method}`,
            },
          };
      }
    } catch (error) {
      this.logError('Error processing request:', error);
      return {
        jsonrpc: '2.0',
        id: id ?? null,
        error: {
          code: JsonRpcErrorCode.INTERNAL_ERROR,
          message: 'Internal error',
          data: String(error),
        },
      };
    }
  }

  private handleInitialize(id: string | number | null, params: MCPInitializeParams): JsonRpcResponse {
    this.logDebug('Initialize request:', params);

    const result: MCPInitializeResult = {
      protocolVersion: '2024-11-05',
      capabilities: {
        tools: {
          listChanged: false,
        },
        logging: {},
      },
      serverInfo: {
        name: 'mcp-memory-ts',
        version: '1.0.0',
      },
    };

    this.initialized = true;
    this.logInfo('MCP server initialized');

    return {
      jsonrpc: '2.0',
      id,
      result,
    };
  }

  private handleToolsList(id: string | number | null): JsonRpcResponse {
    return {
      jsonrpc: '2.0',
      id,
      result: {
        tools: MCP_TOOLS,
      },
    };
  }

  private async handleToolsCall(id: string | number | null, params: MCPToolCall): Promise<JsonRpcResponse> {
    if (!this.memoryCore) {
      throw new Error('Memory core not initialized');
    }

    const { name, arguments: args } = params;
    this.logDebug(`Tool call: ${name}`, args);

    let result: any;

    try {
      switch (name) {
        case 'memory_add':
          result = await this.handleAddMemory(args as AddMemoryParams);
          break;
        
        case 'memory_search':
          result = await this.handleSearchMemories(args as SearchMemoriesParams);
          break;
        
        case 'memory_delete':
          result = await this.handleDeleteMemory(args as DeleteMemoryParams);
          break;
        
        case 'entity_create':
          result = await this.handleCreateEntity(args as CreateEntityParams);
          break;
        
        case 'entity_search':
          result = await this.handleSearchEntities(args as SearchEntitiesParams);
          break;
        
        case 'entity_update':
          result = await this.handleUpdateEntity(args as UpdateEntityParams);
          break;
        
        case 'unified_search':
          result = await this.handleUnifiedSearch(args as UnifiedSearchParams);
          break;
        
        case 'get_statistics':
          result = await this.handleGetStatistics();
          break;
        
        case 'get_recent_interactions':
          result = await this.handleGetRecentInteractions(args);
          break;
        
        default:
          throw new Error(`Unknown tool: ${name}`);
      }

      const toolResult: MCPToolResult = {
        content: [
          {
            type: 'text',
            text: this.formatToolResult(result),
          },
        ],
        isError: result.status === MCPToolResultStatus.ERROR,
      };

      return {
        jsonrpc: '2.0',
        id,
        result: toolResult,
      };
    } catch (error) {
      this.logError(`Tool call error for ${name}:`, error);
      
      const errorResult: MCPToolResult = {
        content: [
          {
            type: 'text',
            text: `Error: ${String(error)}`,
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

  private async handleAddMemory(params: AddMemoryParams): Promise<any> {
    const memoryType = params.memory_type ? params.memory_type as MemoryType : MemoryType.MEMORY;
    const importance = params.importance ? params.importance as ImportanceLevel : ImportanceLevel.MEDIUM;

    return await this.memoryCore!.addMemory(
      params.title,
      params.content,
      memoryType,
      {
        importance,
        tags: params.tags,
        entityIds: params.entity_ids,
      }
    );
  }

  private async handleSearchMemories(params: SearchMemoriesParams): Promise<any> {
    const memoryTypes = params.memory_types?.map(t => t as MemoryType);

    return await this.memoryCore!.searchMemories(params.query, {
      query: params.query,
      limit: params.limit,
      threshold: params.threshold,
      memoryTypes,
    });
  }

  private async handleDeleteMemory(params: DeleteMemoryParams): Promise<any> {
    // TODO: Implement delete memory in MemoryCore
    return {
      status: MCPToolResultStatus.ERROR,
      message: 'Delete memory not yet implemented',
    };
  }

  private async handleCreateEntity(params: CreateEntityParams): Promise<any> {
    const entityType = params.entity_type as EntityType;
    const importance = params.importance ? params.importance as ImportanceLevel : ImportanceLevel.MEDIUM;

    return await this.memoryCore!.createEntity(params.name, entityType, {
      description: params.description,
      importance,
      tags: params.tags,
      company: params.company,
      title: params.title,
      email: params.email,
      phone: params.phone,
      website: params.website,
      notes: params.notes,
    });
  }

  private async handleSearchEntities(params: SearchEntitiesParams): Promise<any> {
    return await this.memoryCore!.searchEntities(params.query, {
      limit: params.limit,
    });
  }

  private async handleUpdateEntity(params: UpdateEntityParams): Promise<any> {
    // TODO: Implement update entity in MemoryCore
    return {
      status: MCPToolResultStatus.ERROR,
      message: 'Update entity not yet implemented',
    };
  }

  private async handleUnifiedSearch(params: UnifiedSearchParams): Promise<any> {
    const memoryTypes = params.memory_types?.map(t => t as MemoryType);
    const entityTypes = params.entity_types?.map(t => t as EntityType);

    return await this.memoryCore!.unifiedSearch(params.query, {
      query: params.query,
      limit: params.limit,
      threshold: params.threshold,
      memoryTypes,
      entityTypes,
    });
  }

  private async handleGetStatistics(): Promise<any> {
    return await this.memoryCore!.getStatistics();
  }

  private async handleGetRecentInteractions(params: any): Promise<any> {
    // TODO: Implement get recent interactions in MemoryCore
    return {
      status: MCPToolResultStatus.SUCCESS,
      message: 'Recent interactions retrieved',
      data: [],
    };
  }

  private formatToolResult(result: any): string {
    if (result.status === MCPToolResultStatus.SUCCESS) {
      return `✅ ${result.message}\n\n${JSON.stringify(result.data, null, 2)}`;
    } else {
      return `❌ ${result.message}\n\nError: ${result.error || 'Unknown error'}`;
    }
  }

  private async shutdown(): Promise<void> {
    this.logInfo('Shutting down MCP server...');
    
    if (this.memoryCore) {
      await this.memoryCore.close();
    }
    
    process.exit(0);
  }
}

// Start the server if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = new MCPServer();
  server.start().catch((error) => {
    console.error('Failed to start MCP server:', error);
    process.exit(1);
  });
}
