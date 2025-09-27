#!/usr/bin/env tsx

/**
 * Pre-deployment regression test script
 * Validates all JSON-RPC calls work correctly before deployment
 */

import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  response?: any;
}

class MCPRegressionTester {
  private tempDir: string = '';
  private dbPath: string = '';
  private testResults: TestResult[] = [];

  async setup(): Promise<void> {
    console.log('🔧 Setting up test environment...');
    this.tempDir = await fs.mkdtemp(join(tmpdir(), 'mcp-regression-'));
    this.dbPath = join(this.tempDir, 'regression-test.db');
    console.log(`📁 Test database: ${this.dbPath}`);
  }

  async cleanup(): Promise<void> {
    try {
      await fs.rm(this.tempDir, { recursive: true, force: true });
      console.log('🧹 Cleaned up test environment');
    } catch (error) {
      console.warn('⚠️ Cleanup warning:', error);
    }
  }

  async sendRequest(request: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const env = {
        ...process.env,
        TURSO_URL: `file:${this.dbPath}`,
        DEFAULT_USER_EMAIL: 'regression-test@example.com',
        OPENAI_API_KEY: 'test-key',
        MCP_DEBUG: '0',
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
          reject(new Error(`Process exited with code ${code}. Error: ${errorData}`));
          return;
        }

        try {
          const lines = responseData.trim().split('\n');
          const lastLine = lines[lines.length - 1];
          const response = JSON.parse(lastLine);
          resolve(response);
        } catch (error) {
          reject(new Error(`Parse error: ${error}. Response: ${responseData}`));
        }
      });

      serverProcess.stdin.write(JSON.stringify(request) + '\n');
      serverProcess.stdin.end();

      setTimeout(() => {
        serverProcess.kill();
        reject(new Error('Request timeout (10s)'));
      }, 10000);
    });
  }

  async runTest(name: string, testFn: () => Promise<void>): Promise<void> {
    console.log(`🧪 Running: ${name}`);
    try {
      await testFn();
      this.testResults.push({ name, passed: true });
      console.log(`✅ PASS: ${name}`);
    } catch (error) {
      this.testResults.push({ 
        name, 
        passed: false, 
        error: error instanceof Error ? error.message : String(error) 
      });
      console.log(`❌ FAIL: ${name} - ${error}`);
    }
  }

  async runAllTests(): Promise<void> {
    console.log('🚀 Starting MCP Server Regression Tests\n');

    // Test 1: Server initialization
    await this.runTest('Server responds to tools/list', async () => {
      const request = {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
        params: {},
      };

      const response = await this.sendRequest(request);
      
      if (response.jsonrpc !== '2.0') throw new Error('Invalid JSON-RPC version');
      if (response.id !== 1) throw new Error('Invalid response ID');
      if (!response.result) throw new Error('Missing result');
      if (!Array.isArray(response.result.tools)) throw new Error('Tools not array');
      if (response.result.tools.length === 0) throw new Error('No tools returned');

      const toolNames = response.result.tools.map((t: any) => t.name);
      if (!toolNames.includes('memory_add')) throw new Error('memory_add tool missing');
      if (!toolNames.includes('memory_search')) throw new Error('memory_search tool missing');
      if (!toolNames.includes('get_statistics')) throw new Error('get_statistics tool missing');
    });

    // Test 2: Initialize method
    await this.runTest('Server responds to initialize', async () => {
      const request = {
        jsonrpc: '2.0',
        id: 'init-test',
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'regression-test', version: '1.0.0' },
        },
      };

      const response = await this.sendRequest(request);
      
      if (response.jsonrpc !== '2.0') throw new Error('Invalid JSON-RPC version');
      if (response.id !== 'init-test') throw new Error('Invalid response ID');
      if (!response.result) throw new Error('Missing result');
      if (!response.result.protocolVersion) throw new Error('Missing protocol version');
    });

    // Test 3: Empty statistics
    await this.runTest('Get statistics from empty database', async () => {
      const request = {
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: {
          name: 'get_statistics',
          arguments: {},
        },
      };

      const response = await this.sendRequest(request);
      
      if (response.jsonrpc !== '2.0') throw new Error('Invalid JSON-RPC version');
      if (!response.result) throw new Error('Missing result');
      if (response.result.isError) throw new Error('Tool returned error');
      
      const text = response.result.content[0].text;
      if (!text.includes('Total Memories: 0')) throw new Error('Expected 0 memories');
    });

    // Test 4: Add memory
    await this.runTest('Add memory successfully', async () => {
      const request = {
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: {
          name: 'memory_add',
          arguments: {
            title: 'Regression Test Memory',
            content: 'This memory validates the add functionality',
            tags: ['regression', 'test'],
          },
        },
      };

      const response = await this.sendRequest(request);
      
      if (response.jsonrpc !== '2.0') throw new Error('Invalid JSON-RPC version');
      if (!response.result) throw new Error('Missing result');
      if (response.result.isError) throw new Error('Tool returned error');
      
      const text = response.result.content[0].text;
      if (!text.includes('✅ Memory "Regression Test Memory" added successfully!')) {
        throw new Error('Memory add confirmation missing');
      }
      if (!text.includes('ID: 1')) throw new Error('Memory ID missing');
    });

    // Test 5: Statistics after adding memory
    await this.runTest('Statistics show added memory', async () => {
      const request = {
        jsonrpc: '2.0',
        id: 4,
        method: 'tools/call',
        params: {
          name: 'get_statistics',
          arguments: {},
        },
      };

      const response = await this.sendRequest(request);
      
      if (!response.result) throw new Error('Missing result');
      if (response.result.isError) throw new Error('Tool returned error');
      
      const text = response.result.content[0].text;
      if (!text.includes('Total Memories: 1')) throw new Error('Expected 1 memory');
    });

    // Test 6: Search for added memory
    await this.runTest('Search finds added memory', async () => {
      const request = {
        jsonrpc: '2.0',
        id: 5,
        method: 'tools/call',
        params: {
          name: 'memory_search',
          arguments: {
            query: 'regression test',
            limit: 10,
          },
        },
      };

      const response = await this.sendRequest(request);
      
      if (!response.result) throw new Error('Missing result');
      if (response.result.isError) throw new Error('Tool returned error');
      
      const text = response.result.content[0].text;
      if (!text.includes('Found 1 memories for "regression test"')) {
        throw new Error('Search should find 1 memory');
      }
      if (!text.includes('Regression Test Memory')) {
        throw new Error('Search should return the added memory');
      }
    });

    // Test 7: Error handling
    await this.runTest('Unknown tool returns error', async () => {
      const request = {
        jsonrpc: '2.0',
        id: 6,
        method: 'tools/call',
        params: {
          name: 'unknown_tool',
          arguments: {},
        },
      };

      const response = await this.sendRequest(request);
      
      if (response.jsonrpc !== '2.0') throw new Error('Invalid JSON-RPC version');
      if (!response.error) throw new Error('Expected error response');
      if (!response.error.message.includes('Unknown tool')) {
        throw new Error('Expected unknown tool error');
      }
    });

    // Test 8: Auto ID generation
    await this.runTest('Auto ID generation for requests without ID', async () => {
      const request = {
        jsonrpc: '2.0',
        method: 'tools/list',
        params: {},
      };

      const response = await this.sendRequest(request);
      
      if (response.jsonrpc !== '2.0') throw new Error('Invalid JSON-RPC version');
      if (!response.id) throw new Error('Missing auto-generated ID');
      if (!response.id.toString().startsWith('auto-')) {
        throw new Error('Auto ID should start with "auto-"');
      }
    });
  }

  printResults(): void {
    console.log('\n📊 REGRESSION TEST RESULTS');
    console.log('=' .repeat(50));
    
    const passed = this.testResults.filter(r => r.passed).length;
    const total = this.testResults.length;
    
    this.testResults.forEach(result => {
      const status = result.passed ? '✅ PASS' : '❌ FAIL';
      console.log(`${status} ${result.name}`);
      if (!result.passed && result.error) {
        console.log(`    Error: ${result.error}`);
      }
    });
    
    console.log('=' .repeat(50));
    console.log(`📈 Results: ${passed}/${total} tests passed`);
    
    if (passed === total) {
      console.log('🎉 ALL TESTS PASSED - READY FOR DEPLOYMENT!');
    } else {
      console.log('🚨 TESTS FAILED - DO NOT DEPLOY!');
      process.exit(1);
    }
  }

  async run(): Promise<void> {
    try {
      await this.setup();
      await this.runAllTests();
      this.printResults();
    } catch (error) {
      console.error('💥 Test runner error:', error);
      process.exit(1);
    } finally {
      await this.cleanup();
    }
  }
}

// Run the tests
const tester = new MCPRegressionTester();
tester.run().catch(console.error);
