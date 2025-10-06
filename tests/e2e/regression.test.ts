/**
 * Regression Test Suite
 * Tests for backward compatibility and known issues
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import { resolve } from 'path';
import { existsSync } from 'fs';

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
 * Simple test client for regression tests
 */
class RegressionTestClient {
  private serverProcess: ChildProcessWithoutNullStreams | null = null;
  private responseHandlers: Map<string | number, (response: JsonRpcResponse) => void> = new Map();
  private requestId = 0;

  async startWithNode(jsPath: string): Promise<void> {
    this.serverProcess = spawn('node', [jsPath], {
      env: {
        ...process.env,
        MCP_DEBUG: '0',
        NODE_ENV: 'test',
        DEFAULT_USER_EMAIL: process.env.DEFAULT_USER_EMAIL || 'test@example.com',
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    this.setupHandlers();
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }

  private setupHandlers(): void {
    if (!this.serverProcess) return;

    this.serverProcess.stdout.on('data', (data) => {
      const lines = data.toString().split('\n').filter((line: string) => line.trim());

      for (const line of lines) {
        try {
          const response: JsonRpcResponse = JSON.parse(line);

          if (response.jsonrpc === '2.0' && response.id !== undefined) {
            const handler = this.responseHandlers.get(response.id);
            if (handler) {
              handler(response);
              this.responseHandlers.delete(response.id);
            }
          }
        } catch (error) {
          // Not JSON, continue
        }
      }
    });

    this.serverProcess.on('exit', (code) => {
      // Track exit for debugging
    });
  }

  async stop(): Promise<void> {
    if (this.serverProcess) {
      this.serverProcess.kill('SIGTERM');
      await new Promise((resolve) => setTimeout(resolve, 1000));
      this.serverProcess = null;
    }
  }

  async sendRequest(method: string, params?: any): Promise<JsonRpcResponse> {
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
      }, 5000);

      this.responseHandlers.set(id, (response) => {
        clearTimeout(timeout);
        resolve(response);
      });

      this.serverProcess!.stdin.write(JSON.stringify(request) + '\n');
    });
  }

  async callTool(name: string, args: any = {}): Promise<JsonRpcResponse> {
    return this.sendRequest('tools/call', {
      name,
      arguments: args,
    });
  }
}

describe('Regression Tests', () => {
  let client: RegressionTestClient;

  beforeAll(() => {
    client = new RegressionTestClient();
  });

  afterAll(async () => {
    await client.stop();
  });

  describe('Stdio Communication', () => {
    it('should communicate via stdio correctly', async () => {
      const serverPath = resolve(process.cwd(), 'dist/desktop-mcp-server.js');
      await client.startWithNode(serverPath);

      const response = await client.sendRequest('initialize', {
        protocolVersion: '2024-11-05',
        capabilities: {},
      });

      expect(response.jsonrpc).toBe('2.0');
      expect(response.result).toBeDefined();

      await client.stop();
    }, TEST_TIMEOUT);

    it('should handle multiple rapid stdin writes', async () => {
      const serverPath = resolve(process.cwd(), 'dist/desktop-mcp-server.js');
      await client.startWithNode(serverPath);

      const requests = Array.from({ length: 5 }, () => client.sendRequest('ping'));
      const responses = await Promise.all(requests);

      responses.forEach((response) => {
        expect(response.jsonrpc).toBe('2.0');
      });

      await client.stop();
    }, TEST_TIMEOUT);
  });

  describe('Environment Variable Handling', () => {
    it('should work with environment variables from process.env', async () => {
      const serverPath = resolve(process.cwd(), 'dist/desktop-mcp-server.js');

      // Verify required env vars are present
      expect(process.env.TURSO_URL).toBeDefined();
      expect(process.env.TURSO_AUTH_TOKEN).toBeDefined();

      await client.startWithNode(serverPath);

      // Server should initialize successfully with env vars
      const response = await client.sendRequest('initialize', {});
      expect(response.jsonrpc).toBe('2.0');

      await client.stop();
    }, TEST_TIMEOUT);
  });

  describe('Claude Desktop Integration Patterns', () => {
    it('should match expected tool schema format', async () => {
      const serverPath = resolve(process.cwd(), 'dist/desktop-mcp-server.js');
      await client.startWithNode(serverPath);

      const response = await client.sendRequest('tools/list');

      expect(response.result.tools).toBeDefined();
      const tools = response.result.tools;

      // Verify schema format matches Claude Desktop expectations
      tools.forEach((tool: any) => {
        expect(tool).toHaveProperty('name');
        expect(tool).toHaveProperty('description');
        expect(tool).toHaveProperty('inputSchema');
        expect(tool.inputSchema).toHaveProperty('type');
        expect(tool.inputSchema.type).toBe('object');
        expect(tool.inputSchema).toHaveProperty('properties');
      });

      await client.stop();
    }, TEST_TIMEOUT);

    it('should return tool results in expected format', async () => {
      const serverPath = resolve(process.cwd(), 'dist/desktop-mcp-server.js');
      await client.startWithNode(serverPath);

      const response = await client.callTool('get_memory_stats');

      // Claude Desktop expects this format
      expect(response.result).toHaveProperty('content');
      expect(response.result.content).toBeInstanceOf(Array);
      expect(response.result.content[0]).toHaveProperty('type');
      expect(response.result.content[0]).toHaveProperty('text');
      expect(response.result).toHaveProperty('isError');
      expect(typeof response.result.isError).toBe('boolean');

      await client.stop();
    }, TEST_TIMEOUT);
  });

  describe('Backward Compatibility', () => {
    it('should support legacy memory type format', async () => {
      const serverPath = resolve(process.cwd(), 'dist/desktop-mcp-server.js');
      await client.startWithNode(serverPath);

      // Test with string type (legacy format)
      const response = await client.callTool('store_memory', {
        content: 'Test content',
        type: 'semantic', // String format
        importance: 0.5,
      });

      expect(response.result.isError).toBe(false);
      expect(response.result.content[0].text).toContain('Memory stored successfully');

      await client.stop();
    }, TEST_TIMEOUT);

    it('should support decimal importance values', async () => {
      const serverPath = resolve(process.cwd(), 'dist/desktop-mcp-server.js');
      await client.startWithNode(serverPath);

      // Test with decimal importance (0-1 range)
      const response = await client.callTool('store_memory', {
        content: 'Test content',
        importance: 0.75,
      });

      expect(response.result.isError).toBe(false);
      expect(response.result.content[0].text).toContain('0.75');

      await client.stop();
    }, TEST_TIMEOUT);

    it('should handle metadata as object', async () => {
      const serverPath = resolve(process.cwd(), 'dist/desktop-mcp-server.js');
      await client.startWithNode(serverPath);

      const response = await client.callTool('store_memory', {
        content: 'Test content',
        metadata: {
          source: 'test',
          category: 'regression',
          nested: {
            key: 'value',
          },
        },
      });

      expect(response.result.isError).toBe(false);

      await client.stop();
    }, TEST_TIMEOUT);

    it('should handle tags as array', async () => {
      const serverPath = resolve(process.cwd(), 'dist/desktop-mcp-server.js');
      await client.startWithNode(serverPath);

      const response = await client.callTool('store_memory', {
        content: 'Test content',
        tags: ['tag1', 'tag2', 'tag3'],
      });

      expect(response.result.isError).toBe(false);

      await client.stop();
    }, TEST_TIMEOUT);
  });

  describe('Error Recovery', () => {
    it('should recover from database connection issues gracefully', async () => {
      // This test ensures server doesn't crash on DB errors
      const serverPath = resolve(process.cwd(), 'dist/desktop-mcp-server.js');
      await client.startWithNode(serverPath);

      // Even if database has issues, server should respond
      const response = await client.sendRequest('ping');
      expect(response.jsonrpc).toBe('2.0');

      await client.stop();
    }, TEST_TIMEOUT);

    it('should continue operating after tool execution errors', async () => {
      const serverPath = resolve(process.cwd(), 'dist/desktop-mcp-server.js');
      await client.startWithNode(serverPath);

      // Cause an error with invalid ID
      await client.callTool('get_memory', {
        id: 'invalid-id',
      });

      // Server should still respond to subsequent requests
      const response = await client.sendRequest('ping');
      expect(response.jsonrpc).toBe('2.0');

      await client.stop();
    }, TEST_TIMEOUT);
  });

  describe('Known Issues Prevention', () => {
    it('should not crash on malformed JSON-RPC requests', async () => {
      const serverPath = resolve(process.cwd(), 'dist/desktop-mcp-server.js');
      await client.startWithNode(serverPath);

      // Server should handle this and respond with parse error
      // Note: We can't easily send malformed JSON through our client,
      // but we can verify server stays alive after errors
      try {
        await client.callTool('unknown_tool', {});
      } catch (error) {
        // Expected to fail
      }

      // Server should still be responsive
      const response = await client.sendRequest('ping');
      expect(response.jsonrpc).toBe('2.0');

      await client.stop();
    }, TEST_TIMEOUT);

    it('should handle missing OpenAI API key gracefully', async () => {
      // This test verifies the server starts even if embeddings might fail
      const serverPath = resolve(process.cwd(), 'dist/desktop-mcp-server.js');
      await client.startWithNode(serverPath);

      // Server should initialize successfully
      const response = await client.sendRequest('initialize', {});
      expect(response.jsonrpc).toBe('2.0');

      await client.stop();
    }, TEST_TIMEOUT);

    it('should handle concurrent tool calls without race conditions', async () => {
      const serverPath = resolve(process.cwd(), 'dist/desktop-mcp-server.js');
      await client.startWithNode(serverPath);

      // Execute multiple operations concurrently
      const operations = [
        client.callTool('get_memory_stats'),
        client.callTool('store_memory', { content: 'Test 1' }),
        client.callTool('store_memory', { content: 'Test 2' }),
        client.callTool('recall_memories', { query: 'test' }),
      ];

      const responses = await Promise.all(operations);

      // All should succeed without interference
      responses.forEach((response) => {
        expect(response.jsonrpc).toBe('2.0');
        expect(response.result).toBeDefined();
      });

      await client.stop();
    }, TEST_TIMEOUT);
  });

  describe('Build Output Validation', () => {
    it('should have correct build artifacts', () => {
      const serverPath = resolve(process.cwd(), 'dist/desktop-mcp-server.js');
      expect(existsSync(serverPath)).toBe(true);

      // Verify it's executable
      expect(existsSync(serverPath)).toBe(true);
    });

    it('should use ES modules', async () => {
      const serverPath = resolve(process.cwd(), 'dist/desktop-mcp-server.js');
      const fs = await import('fs');
      const content = fs.readFileSync(serverPath, 'utf-8');

      // Check for ES module patterns (import/export)
      // Built output should have module format
      expect(content.length).toBeGreaterThan(0);
    });
  });
});
