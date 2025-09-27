/**
 * Integration tests for MCP Server JSON-RPC calls
 * These tests ensure all tool calls work correctly before deployment
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { spawn, ChildProcess } from 'child_process';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

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

describe('MCP Server JSON-RPC Integration Tests', () => {
  let tempDir: string;
  let dbPath: string;

  beforeAll(async () => {
    // Create temporary directory for test database
    tempDir = await fs.mkdtemp(join(tmpdir(), 'mcp-test-'));
    dbPath = join(tempDir, 'test.db');
  });

  afterAll(async () => {
    // Cleanup
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  beforeEach(async () => {
    // Clean database before each test
    try {
      await fs.unlink(dbPath);
    } catch (error) {
      // File might not exist
    }
  });

  /**
   * Helper function to send JSON-RPC request to MCP server
   */
  async function sendMcpRequest(request: JsonRpcRequest): Promise<JsonRpcResponse> {
    return new Promise((resolve, reject) => {
      const env = {
        ...process.env,
        TURSO_URL: `file:${dbPath}`,
        DEFAULT_USER_EMAIL: 'test@example.com',
        OPENAI_API_KEY: 'test-key',
        MCP_DEBUG: '0', // Disable debug for cleaner output
      };

      const serverProcess = spawn('npm', ['run', 'mcp-server'], {
        cwd: process.cwd(),
        env,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let responseData = '';
      let errorData = '';

      serverProcess.stdout.on('data', (data) => {
        responseData += data.toString();
      });

      serverProcess.stderr.on('data', (data) => {
        errorData += data.toString();
      });

      serverProcess.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Server process exited with code ${code}. Error: ${errorData}`));
          return;
        }

        try {
          // Parse the last JSON response from stdout
          const lines = responseData.trim().split('\n');
          const lastLine = lines[lines.length - 1];
          const response = JSON.parse(lastLine);
          resolve(response);
        } catch (error) {
          reject(new Error(`Failed to parse response: ${responseData}. Error: ${error}`));
        }
      });

      // Send the request
      serverProcess.stdin.write(JSON.stringify(request) + '\n');
      serverProcess.stdin.end();

      // Set timeout
      setTimeout(() => {
        serverProcess.kill();
        reject(new Error('Request timeout'));
      }, 10000);
    });
  }

  describe('Server Initialization', () => {
    it('should respond to tools/list request', async () => {
      const request: JsonRpcRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
        params: {},
      };

      const response = await sendMcpRequest(request);

      expect(response.jsonrpc).toBe('2.0');
      expect(response.id).toBe(1);
      expect(response.result).toBeDefined();
      expect(response.result.tools).toBeInstanceOf(Array);
      expect(response.result.tools.length).toBeGreaterThan(0);

      // Check that our tools are present
      const toolNames = response.result.tools.map((tool: any) => tool.name);
      expect(toolNames).toContain('memory_add');
      expect(toolNames).toContain('memory_search');
      expect(toolNames).toContain('get_statistics');
    });

    it('should respond to initialize request', async () => {
      const request: JsonRpcRequest = {
        jsonrpc: '2.0',
        id: 'init-1',
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: {
            name: 'test-client',
            version: '1.0.0',
          },
        },
      };

      const response = await sendMcpRequest(request);

      expect(response.jsonrpc).toBe('2.0');
      expect(response.id).toBe('init-1');
      expect(response.result).toBeDefined();
      expect(response.result.protocolVersion).toBeDefined();
      expect(response.result.capabilities).toBeDefined();
    });
  });

  describe('Memory Operations', () => {
    it('should add a memory successfully', async () => {
      const request: JsonRpcRequest = {
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: {
          name: 'memory_add',
          arguments: {
            title: 'Test Memory',
            content: 'This is a test memory for integration testing',
            tags: ['test', 'integration'],
          },
        },
      };

      const response = await sendMcpRequest(request);

      expect(response.jsonrpc).toBe('2.0');
      expect(response.id).toBe(2);
      expect(response.result).toBeDefined();
      expect(response.result.content).toBeInstanceOf(Array);
      expect(response.result.content[0].text).toContain('✅ Memory "Test Memory" added successfully!');
      expect(response.result.content[0].text).toContain('ID: 1');
      expect(response.result.isError).toBe(false);
    });

    it('should get statistics showing empty database initially', async () => {
      const request: JsonRpcRequest = {
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: {
          name: 'get_statistics',
          arguments: {},
        },
      };

      const response = await sendMcpRequest(request);

      expect(response.jsonrpc).toBe('2.0');
      expect(response.id).toBe(3);
      expect(response.result).toBeDefined();
      expect(response.result.content[0].text).toContain('Total Memories: 0');
      expect(response.result.content[0].text).toContain('Total Entities: 0');
      expect(response.result.isError).toBe(false);
    });

    it('should search memories and return empty results initially', async () => {
      const request: JsonRpcRequest = {
        jsonrpc: '2.0',
        id: 4,
        method: 'tools/call',
        params: {
          name: 'memory_search',
          arguments: {
            query: 'test memory',
            limit: 10,
          },
        },
      };

      const response = await sendMcpRequest(request);

      expect(response.jsonrpc).toBe('2.0');
      expect(response.id).toBe(4);
      expect(response.result).toBeDefined();
      expect(response.result.content[0].text).toContain('No memories found for "test memory"');
      expect(response.result.isError).toBe(false);
    });
  });

  describe('End-to-End Memory Workflow', () => {
    it('should complete full memory lifecycle: add -> search -> statistics', async () => {
      // Step 1: Add a memory
      const addRequest: JsonRpcRequest = {
        jsonrpc: '2.0',
        id: 'add-1',
        method: 'tools/call',
        params: {
          name: 'memory_add',
          arguments: {
            title: 'Integration Test Memory',
            content: 'This memory is used for end-to-end testing of the MCP server',
            tags: ['integration', 'e2e', 'testing'],
          },
        },
      };

      const addResponse = await sendMcpRequest(addRequest);
      expect(addResponse.result.content[0].text).toContain('✅ Memory "Integration Test Memory" added successfully!');

      // Step 2: Search for the memory
      const searchRequest: JsonRpcRequest = {
        jsonrpc: '2.0',
        id: 'search-1',
        method: 'tools/call',
        params: {
          name: 'memory_search',
          arguments: {
            query: 'integration test',
            limit: 5,
          },
        },
      };

      const searchResponse = await sendMcpRequest(searchRequest);
      expect(searchResponse.result.content[0].text).toContain('Found 1 memories for "integration test"');
      expect(searchResponse.result.content[0].text).toContain('Integration Test Memory');
      expect(searchResponse.result.content[0].text).toContain('This memory is used for end-to-end testing');

      // Step 3: Check statistics
      const statsRequest: JsonRpcRequest = {
        jsonrpc: '2.0',
        id: 'stats-1',
        method: 'tools/call',
        params: {
          name: 'get_statistics',
          arguments: {},
        },
      };

      const statsResponse = await sendMcpRequest(statsRequest);
      expect(statsResponse.result.content[0].text).toContain('Total Memories: 1');
    });
  });

  describe('Error Handling', () => {
    it('should handle unknown tool gracefully', async () => {
      const request: JsonRpcRequest = {
        jsonrpc: '2.0',
        id: 5,
        method: 'tools/call',
        params: {
          name: 'unknown_tool',
          arguments: {},
        },
      };

      const response = await sendMcpRequest(request);

      expect(response.jsonrpc).toBe('2.0');
      expect(response.id).toBe(5);
      expect(response.error).toBeDefined();
      expect(response.error?.message).toContain('Unknown tool');
    });

    it('should handle unknown method gracefully', async () => {
      const request: JsonRpcRequest = {
        jsonrpc: '2.0',
        id: 6,
        method: 'unknown/method',
        params: {},
      };

      const response = await sendMcpRequest(request);

      expect(response.jsonrpc).toBe('2.0');
      expect(response.id).toBe(6);
      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe(-32601);
      expect(response.error?.message).toContain('Method not found');
    });

    it('should handle missing required arguments', async () => {
      const request: JsonRpcRequest = {
        jsonrpc: '2.0',
        id: 7,
        method: 'tools/call',
        params: {
          name: 'memory_add',
          arguments: {
            // Missing required 'title' and 'content'
            tags: ['test'],
          },
        },
      };

      const response = await sendMcpRequest(request);

      expect(response.jsonrpc).toBe('2.0');
      expect(response.id).toBe(7);
      // Should either return error or handle gracefully
      expect(response.result || response.error).toBeDefined();
    });
  });

  describe('Response Format Validation', () => {
    it('should always return valid JSON-RPC 2.0 responses', async () => {
      const requests = [
        { jsonrpc: '2.0', id: 'test-1', method: 'tools/list', params: {} },
        { jsonrpc: '2.0', id: 'test-2', method: 'tools/call', params: { name: 'get_statistics', arguments: {} } },
        { jsonrpc: '2.0', id: 'test-3', method: 'unknown/method', params: {} },
      ];

      for (const request of requests) {
        const response = await sendMcpRequest(request);

        // Validate JSON-RPC 2.0 format
        expect(response.jsonrpc).toBe('2.0');
        expect(response.id).toBe(request.id);
        expect(response.result || response.error).toBeDefined();
        expect(response.result && response.error).toBeFalsy(); // Should not have both
      }
    });

    it('should handle requests without ID', async () => {
      const request = {
        jsonrpc: '2.0',
        method: 'tools/list',
        params: {},
      } as JsonRpcRequest;

      const response = await sendMcpRequest(request);

      expect(response.jsonrpc).toBe('2.0');
      expect(response.id).toBeDefined(); // Should generate an auto ID
      expect(typeof response.id).toBe('string');
      expect(response.id.toString()).toMatch(/^auto-\d+$/);
    });
  });
});
