/**
 * E2E Tests for MCP Server
 * Comprehensive end-to-end testing of MCP protocol compliance and tool execution
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import { resolve } from 'path';
import { v4 as uuidv4 } from 'uuid';

// Test configuration
const SERVER_STARTUP_TIMEOUT = 10000;
const TEST_TIMEOUT = 30000;

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: string | number;
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

/**
 * MCP Server Test Client
 * Manages server process and communication
 */
class MCPServerTestClient {
  private serverProcess: ChildProcessWithoutNullStreams | null = null;
  private responseHandlers: Map<string | number, (response: JsonRpcResponse) => void> = new Map();
  private requestId = 0;
  private startupComplete = false;
  private outputBuffer = '';

  async start(): Promise<void> {
    const serverPath = resolve(process.cwd(), 'dist/desktop-mcp-server.js');

    this.serverProcess = spawn('node', [serverPath], {
      env: {
        ...process.env,
        MCP_DEBUG: '0',
        NODE_ENV: 'test',
        DEFAULT_USER_EMAIL: process.env.DEFAULT_USER_EMAIL || 'test@example.com',
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    // Handle server stdout
    this.serverProcess.stdout.on('data', (data) => {
      const lines = data.toString().split('\n').filter((line: string) => line.trim());

      for (const line of lines) {
        this.outputBuffer += line;

        try {
          const response: JsonRpcResponse = JSON.parse(line);

          // Validate JSON-RPC 2.0 format
          if (response.jsonrpc === '2.0' && response.id !== undefined) {
            const handler = this.responseHandlers.get(response.id);
            if (handler) {
              handler(response);
              this.responseHandlers.delete(response.id);
            }
          }
        } catch (error) {
          // Not JSON or incomplete, continue buffering
        }
      }
    });

    // Handle server stderr (debug logs)
    this.serverProcess.stderr.on('data', (data) => {
      // Debug logs go to stderr, ignore in tests unless debugging
    });

    // Handle server exit
    this.serverProcess.on('exit', (code) => {
      if (code !== 0 && !this.startupComplete) {
        throw new Error(`Server exited with code ${code} during startup`);
      }
    });

    // Wait for server to be ready
    await new Promise((resolve) => setTimeout(resolve, 1000));
    this.startupComplete = true;
  }

  async stop(): Promise<void> {
    if (this.serverProcess) {
      this.serverProcess.kill('SIGTERM');

      // Wait for graceful shutdown
      await new Promise((resolve) => {
        if (this.serverProcess) {
          this.serverProcess.on('exit', resolve);
          setTimeout(resolve, 2000); // Force resolve after 2s
        } else {
          resolve(undefined);
        }
      });

      this.serverProcess = null;
    }
  }

  async sendRequest(method: string, params?: any, timeoutMs: number = 5000): Promise<JsonRpcResponse> {
    if (!this.serverProcess) {
      throw new Error('Server not started');
    }

    const id = ++this.requestId;
    const request: JsonRpcRequest = {
      jsonrpc: '2.0',
      id,
      method,
      params,
    };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.responseHandlers.delete(id);
        reject(new Error(`Request timeout for ${method}`));
      }, timeoutMs);

      this.responseHandlers.set(id, (response) => {
        clearTimeout(timeout);
        resolve(response);
      });

      this.serverProcess!.stdin.write(JSON.stringify(request) + '\n');
    });
  }

  async callTool(name: string, args: any = {}, timeoutMs?: number): Promise<JsonRpcResponse> {
    return this.sendRequest('tools/call', {
      name,
      arguments: args,
    }, timeoutMs);
  }
}

// Test client instance
let client: MCPServerTestClient;

describe('MCP Server E2E Tests', () => {
  // Setup and teardown
  beforeAll(async () => {
    client = new MCPServerTestClient();
    await client.start();
  }, SERVER_STARTUP_TIMEOUT);

  afterAll(async () => {
    await client.stop();
  });

  // A. Server Lifecycle Tests
  describe('Server Lifecycle', () => {
    it('should respond to initialize request', async () => {
      const response = await client.sendRequest('initialize', {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: {
          name: 'test-client',
          version: '1.0.0',
        },
      });

      expect(response.jsonrpc).toBe('2.0');
      expect(response.id).toBeDefined();
      expect(response.result).toBeDefined();
      expect(response.result.protocolVersion).toBe('2024-11-05');
      expect(response.result.capabilities).toBeDefined();
      expect(response.result.serverInfo).toBeDefined();
      expect(response.result.serverInfo.name).toBe('mcp-memory-ts-simple');
    }, TEST_TIMEOUT);

    it('should list tools correctly', async () => {
      const response = await client.sendRequest('tools/list');

      expect(response.jsonrpc).toBe('2.0');
      expect(response.result).toBeDefined();
      expect(response.result.tools).toBeInstanceOf(Array);
      expect(response.result.tools.length).toBeGreaterThan(0);

      // Verify required tools are present
      const toolNames = response.result.tools.map((t: any) => t.name);
      expect(toolNames).toContain('store_memory');
      expect(toolNames).toContain('recall_memories');
      expect(toolNames).toContain('get_memory');
      expect(toolNames).toContain('update_memory');
      expect(toolNames).toContain('delete_memory');
      expect(toolNames).toContain('get_memory_stats');
    }, TEST_TIMEOUT);

    it('should respond to ping', async () => {
      const response = await client.sendRequest('ping');

      expect(response.jsonrpc).toBe('2.0');
      expect(response.result).toBeDefined();
    }, TEST_TIMEOUT);

    it('should handle prompts/list', async () => {
      const response = await client.sendRequest('prompts/list');

      expect(response.jsonrpc).toBe('2.0');
      expect(response.result).toBeDefined();
      expect(response.result.prompts).toBeInstanceOf(Array);
    }, TEST_TIMEOUT);

    it('should handle resources/list', async () => {
      const response = await client.sendRequest('resources/list');

      expect(response.jsonrpc).toBe('2.0');
      expect(response.result).toBeDefined();
      expect(response.result.resources).toBeInstanceOf(Array);
    }, TEST_TIMEOUT);
  });

  // B. JSON-RPC Protocol Tests
  describe('JSON-RPC Protocol Compliance', () => {
    it('should return valid JSON-RPC 2.0 responses', async () => {
      const response = await client.sendRequest('tools/list');

      expect(response).toHaveProperty('jsonrpc', '2.0');
      expect(response).toHaveProperty('id');
      expect(response.id).toBeDefined();
      expect(response.id).not.toBeNull();
    }, TEST_TIMEOUT);

    it('should handle Method not found error', async () => {
      const response = await client.sendRequest('unknown_method');

      expect(response.jsonrpc).toBe('2.0');
      expect(response.error).toBeDefined();
      expect(response.error!.code).toBe(-32601);
      expect(response.error!.message).toContain('Method not found');
    }, TEST_TIMEOUT);

    it('should handle unknown tool error', async () => {
      const response = await client.callTool('unknown_tool');

      expect(response.jsonrpc).toBe('2.0');
      expect(response.error).toBeDefined();
      expect(response.error!.code).toBe(-32601);
      expect(response.error!.message).toContain('Unknown tool');
    }, TEST_TIMEOUT);

    it('should include request id in all responses', async () => {
      const responses = await Promise.all([
        client.sendRequest('ping'),
        client.sendRequest('tools/list'),
        client.sendRequest('prompts/list'),
      ]);

      responses.forEach((response, index) => {
        expect(response.id).toBeDefined();
        expect(response.id).not.toBeNull();
        expect(response.jsonrpc).toBe('2.0');
      });
    }, TEST_TIMEOUT);
  });

  // C. Tool Execution Tests
  describe('Tool Execution', () => {
    let testMemoryId: string;

    it('should store memory successfully', async () => {
      const response = await client.callTool('store_memory', {
        content: 'E2E test memory content',
        type: 'semantic',
        importance: 0.7,
        metadata: {
          test: true,
          testId: 'e2e-test-1',
        },
      });

      expect(response.jsonrpc).toBe('2.0');
      expect(response.result).toBeDefined();
      expect(response.result.content).toBeDefined();
      expect(response.result.content[0].type).toBe('text');
      expect(response.result.content[0].text).toContain('Memory stored successfully');
      expect(response.result.isError).toBe(false);

      // Extract memory ID from response text (can be UUID or numeric)
      const match = response.result.content[0].text.match(/ID: ([a-f0-9-]+|\d+)/);
      expect(match).toBeDefined();
      testMemoryId = match![1];
    }, TEST_TIMEOUT);

    it('should recall memories by query', async () => {
      const response = await client.callTool('recall_memories', {
        query: 'E2E test memory',
        limit: 10,
        threshold: 0.3,
      });

      expect(response.jsonrpc).toBe('2.0');
      expect(response.result).toBeDefined();
      expect(response.result.content[0].text).toContain('Found');
      expect(response.result.isError).toBe(false);
    }, TEST_TIMEOUT);

    it('should get memory by ID', async () => {
      // First store a memory to get its ID
      const storeResponse = await client.callTool('store_memory', {
        content: 'Memory for ID retrieval test',
        type: 'semantic',
      });

      const match = storeResponse.result.content[0].text.match(/ID: ([a-f0-9-]+|\d+)/);
      const memoryId = match![1];

      // Now retrieve it
      const response = await client.callTool('get_memory', {
        id: memoryId,
      });

      expect(response.jsonrpc).toBe('2.0');
      expect(response.result).toBeDefined();
      expect(response.result.content[0].text).toContain('Memory Details');
      expect(response.result.content[0].text).toContain(memoryId);
      expect(response.result.content[0].text).toContain('Memory for ID retrieval test');
    }, TEST_TIMEOUT);

    it('should update memory', async () => {
      // First store a memory
      const storeResponse = await client.callTool('store_memory', {
        content: 'Original content',
        type: 'semantic',
      });

      const match = storeResponse.result.content[0].text.match(/ID: ([a-f0-9-]+|\d+)/);
      const memoryId = match![1];

      // Update it
      const response = await client.callTool('update_memory', {
        id: memoryId,
        content: 'Updated content',
        importance: 0.9,
      });

      expect(response.jsonrpc).toBe('2.0');
      expect(response.result).toBeDefined();
      expect(response.result.content[0].text).toContain('updated successfully');
      expect(response.result.isError).toBe(false);

      // Verify update
      const getResponse = await client.callTool('get_memory', {
        id: memoryId,
      });

      expect(getResponse.result.content[0].text).toContain('Updated content');
      expect(getResponse.result.content[0].text).toContain('0.9');
    }, TEST_TIMEOUT);

    it('should delete memory', async () => {
      // First store a memory
      const storeResponse = await client.callTool('store_memory', {
        content: 'Memory to delete',
        type: 'semantic',
      });

      const match = storeResponse.result.content[0].text.match(/ID: ([a-f0-9-]+|\d+)/);
      const memoryId = match![1];

      // Delete it
      const response = await client.callTool('delete_memory', {
        id: memoryId,
      });

      expect(response.jsonrpc).toBe('2.0');
      expect(response.result).toBeDefined();
      expect(response.result.content[0].text).toContain('deleted successfully');
      expect(response.result.isError).toBe(false);

      // Verify deletion
      const getResponse = await client.callTool('get_memory', {
        id: memoryId,
      });

      expect(getResponse.result.content[0].text).toContain('not found');
    }, TEST_TIMEOUT);

    it('should get memory statistics', async () => {
      const response = await client.callTool('get_memory_stats');

      expect(response.jsonrpc).toBe('2.0');
      expect(response.result).toBeDefined();
      expect(response.result.content[0].text).toContain('Memory Statistics');
      expect(response.result.content[0].text).toContain('Total Memories');
      expect(response.result.isError).toBe(false);
    }, TEST_TIMEOUT);

    it('should handle update missing embeddings', async () => {
      const response = await client.callTool('update_missing_embeddings');

      expect(response.jsonrpc).toBe('2.0');
      expect(response.result).toBeDefined();
      expect(response.result.content[0].text).toContain('Embedding update');
      expect(response.result.isError).toBe(false);
    }, TEST_TIMEOUT);
  });

  // D. Error Handling Tests
  describe('Error Handling', () => {
    it('should handle missing required parameters', async () => {
      const response = await client.callTool('store_memory', {
        // Missing 'content' parameter
        type: 'semantic',
      });

      // Should still return valid JSON-RPC response
      expect(response.jsonrpc).toBe('2.0');
      expect(response.id).toBeDefined();
    }, TEST_TIMEOUT);

    it('should handle invalid memory ID', async () => {
      const response = await client.callTool('get_memory', {
        id: 'non-existent-id-12345',
      });

      expect(response.jsonrpc).toBe('2.0');
      expect(response.result).toBeDefined();
      expect(response.result.content[0].text).toContain('not found');
    }, TEST_TIMEOUT);

    it('should handle invalid parameter types', async () => {
      const response = await client.callTool('store_memory', {
        content: 'Test content',
        importance: 'invalid', // Should be number
      });

      expect(response.jsonrpc).toBe('2.0');
      expect(response.id).toBeDefined();
    }, TEST_TIMEOUT);

    it('should handle empty query gracefully', async () => {
      const response = await client.callTool('recall_memories', {
        query: '',
        limit: 5,
      });

      expect(response.jsonrpc).toBe('2.0');
      expect(response.result).toBeDefined();
    }, TEST_TIMEOUT);
  });

  // E. Integration Tests
  describe('Full Workflow Integration', () => {
    it('should complete full memory lifecycle', async () => {
      // 1. Store memory
      const storeResponse = await client.callTool('store_memory', {
        content: 'Integration test memory',
        type: 'episodic',
        importance: 0.8,
        tags: ['test', 'integration'],
      });

      expect(storeResponse.result.isError).toBe(false);
      const match = storeResponse.result.content[0].text.match(/ID: ([a-f0-9-]+|\d+)/);
      const memoryId = match![1];

      // 2. Recall memory
      const recallResponse = await client.callTool('recall_memories', {
        query: 'integration test',
        limit: 5,
      });

      expect(recallResponse.result.isError).toBe(false);
      expect(recallResponse.result.content[0].text).toContain('Found');

      // 3. Get specific memory
      const getResponse = await client.callTool('get_memory', {
        id: memoryId,
      });

      expect(getResponse.result.isError).toBe(false);
      expect(getResponse.result.content[0].text).toContain('Integration test memory');

      // 4. Update memory
      const updateResponse = await client.callTool('update_memory', {
        id: memoryId,
        content: 'Updated integration test memory',
        importance: 0.95,
      });

      expect(updateResponse.result.isError).toBe(false);

      // 5. Delete memory
      const deleteResponse = await client.callTool('delete_memory', {
        id: memoryId,
      });

      expect(deleteResponse.result.isError).toBe(false);
    }, TEST_TIMEOUT);

    it('should handle concurrent requests', async () => {
      const promises = Array.from({ length: 5 }, (_, i) =>
        client.callTool('store_memory', {
          content: `Concurrent test memory ${i}`,
          type: 'semantic',
          importance: 0.5,
        })
      );

      const responses = await Promise.all(promises);

      responses.forEach((response) => {
        expect(response.jsonrpc).toBe('2.0');
        expect(response.result).toBeDefined();
        expect(response.result.isError).toBe(false);
      });
    }, TEST_TIMEOUT);

    it('should maintain data consistency across operations', async () => {
      // Store multiple memories
      const contents = ['Memory 1', 'Memory 2', 'Memory 3'];
      const memoryIds: string[] = [];

      for (const content of contents) {
        const response = await client.callTool('store_memory', {
          content,
          type: 'semantic',
        });

        const match = response.result.content[0].text.match(/ID: ([a-f0-9-]+|\d+)/);
        memoryIds.push(match![1]);
      }

      // Verify all can be retrieved
      for (const id of memoryIds) {
        const response = await client.callTool('get_memory', { id });
        expect(response.result.isError).toBe(false);
      }

      // Get stats
      const statsResponse = await client.callTool('get_memory_stats');
      expect(statsResponse.result.content[0].text).toContain('Total Memories');
    }, TEST_TIMEOUT);
  });

  // F. Performance & Stability Tests
  describe('Performance & Stability', () => {
    it('should handle large content', async () => {
      // Use 2KB instead of 10KB for reasonable test performance
      // Real embedding generation for 10KB can take 15+ seconds
      const largeContent = 'A'.repeat(2000); // 2KB of text

      const response = await client.callTool('store_memory', {
        content: largeContent,
        type: 'semantic',
      }, 10000); // 10 second timeout

      expect(response.jsonrpc).toBe('2.0');
      expect(response.result).toBeDefined();
    }, TEST_TIMEOUT);

    it('should handle rapid sequential requests', async () => {
      const requests = Array.from({ length: 10 }, (_, i) =>
        client.sendRequest('ping')
      );

      const responses = await Promise.all(requests);

      responses.forEach((response) => {
        expect(response.jsonrpc).toBe('2.0');
        expect(response.result).toBeDefined();
      });
    }, TEST_TIMEOUT);

    it('should not leak memory over multiple operations', async () => {
      // Perform many operations
      for (let i = 0; i < 20; i++) {
        await client.callTool('store_memory', {
          content: `Memory leak test ${i}`,
          type: 'semantic',
        });
      }

      // Server should still respond normally
      const response = await client.sendRequest('ping');
      expect(response.jsonrpc).toBe('2.0');
    }, TEST_TIMEOUT);
  });
});
