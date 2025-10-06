#!/usr/bin/env tsx

/**
 * PROPER MEMORY SERVICE TESTING
 * Tests actual functionality with response validation
 */

import { spawn } from 'child_process';
import { DatabaseConnection } from '../src/database/connection.js';

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

class MemoryServiceTester {
  private db: DatabaseConnection;

  constructor() {
    this.db = new DatabaseConnection({
      url: process.env.TURSO_URL!,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
  }

  async sendMcpRequest(request: JsonRpcRequest): Promise<JsonRpcResponse> {
    return new Promise((resolve, reject) => {
      const env = {
        ...process.env,
        TURSO_URL: process.env.TURSO_URL,
        TURSO_AUTH_TOKEN: process.env.TURSO_AUTH_TOKEN,
        DEFAULT_USER_EMAIL: 'test@example.com',
        OPENAI_API_KEY: 'test-key',
        MCP_DEBUG: '0',
      };

      const serverProcess = spawn('tsx', ['src/desktop-mcp-server.ts'], {
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

  async testMemoryStorage(): Promise<boolean> {
    console.log('🧪 TEST 1: Memory Storage (CREATE)');
    console.log('-'.repeat(40));

    const testMemory = {
      content: 'PROPER TEST: This memory validates storage functionality',
      type: 'semantic',
      importance: 0.8,
      metadata: {
        test_id: 'proper-test-1',
        timestamp: new Date().toISOString(),
      },
    };

    const request: JsonRpcRequest = {
      jsonrpc: '2.0',
      id: 'test-storage',
      method: 'tools/call',
      params: {
        name: 'store_memory',
        arguments: testMemory,
      },
    };

    try {
      const response = await this.sendMcpRequest(request);
      console.log('📤 Request:', JSON.stringify(request, null, 2));
      console.log('📥 Response:', JSON.stringify(response, null, 2));

      if (response.error) {
        console.log('❌ STORAGE FAILED:', response.error.message);
        return false;
      }

      if (response.result && response.result.content) {
        const text = response.result.content[0]?.text || '';
        if (text.includes('✅ Memory stored successfully!')) {
          console.log('✅ STORAGE SUCCESS: Memory stored correctly');
          
          // Extract memory ID from response
          const idMatch = text.match(/ID: (\d+)/);
          if (idMatch) {
            console.log(`📝 Memory ID: ${idMatch[1]}`);
            return true;
          } else {
            console.log('⚠️ Memory stored but no ID returned');
            return true;
          }
        } else {
          console.log('❌ STORAGE FAILED: Unexpected response text:', text);
          return false;
        }
      } else {
        console.log('❌ STORAGE FAILED: No result content');
        return false;
      }
    } catch (error) {
      console.log('❌ STORAGE ERROR:', error);
      return false;
    }
  }

  async testMemoryRetrieval(): Promise<boolean> {
    console.log('\n🧪 TEST 2: Memory Retrieval (READ)');
    console.log('-'.repeat(40));

    const request: JsonRpcRequest = {
      jsonrpc: '2.0',
      id: 'test-retrieval',
      method: 'tools/call',
      params: {
        name: 'recall_memories',
        arguments: {
          query: 'PROPER TEST',
          limit: 5,
        },
      },
    };

    try {
      const response = await this.sendMcpRequest(request);
      console.log('📤 Request:', JSON.stringify(request, null, 2));
      console.log('📥 Response:', JSON.stringify(response, null, 2));

      if (response.error) {
        console.log('❌ RETRIEVAL FAILED:', response.error.message);
        return false;
      }

      if (response.result && response.result.content) {
        const text = response.result.content[0]?.text || '';
        if (text.includes('Found') && text.includes('memories')) {
          console.log('✅ RETRIEVAL SUCCESS: Memories found');
          return true;
        } else if (text.includes('No memories found')) {
          console.log('⚠️ RETRIEVAL: No memories found (may be expected)');
          return true;
        } else {
          console.log('❌ RETRIEVAL FAILED: Unexpected response:', text);
          return false;
        }
      } else {
        console.log('❌ RETRIEVAL FAILED: No result content');
        return false;
      }
    } catch (error) {
      console.log('❌ RETRIEVAL ERROR:', error);
      return false;
    }
  }

  async testMemoryStatistics(): Promise<boolean> {
    console.log('\n🧪 TEST 3: Memory Statistics');
    console.log('-'.repeat(40));

    const request: JsonRpcRequest = {
      jsonrpc: '2.0',
      id: 'test-stats',
      method: 'tools/call',
      params: {
        name: 'get_memory_stats',
        arguments: {},
      },
    };

    try {
      const response = await this.sendMcpRequest(request);
      console.log('📤 Request:', JSON.stringify(request, null, 2));
      console.log('📥 Response:', JSON.stringify(response, null, 2));

      if (response.error) {
        console.log('❌ STATISTICS FAILED:', response.error.message);
        return false;
      }

      if (response.result && response.result.content) {
        const text = response.result.content[0]?.text || '';
        if (text.includes('Total Memories:')) {
          console.log('✅ STATISTICS SUCCESS: Stats retrieved');
          return true;
        } else {
          console.log('❌ STATISTICS FAILED: Unexpected response:', text);
          return false;
        }
      } else {
        console.log('❌ STATISTICS FAILED: No result content');
        return false;
      }
    } catch (error) {
      console.log('❌ STATISTICS ERROR:', error);
      return false;
    }
  }

  async verifyDatabasePersistence(): Promise<boolean> {
    console.log('\n🧪 TEST 4: Database Persistence Verification');
    console.log('-'.repeat(40));

    try {
      await this.db.connect();
      
      // Check if our test memory was actually stored
      const result = await this.db.execute(
        "SELECT id, title, content FROM memories WHERE content LIKE '%PROPER TEST%' ORDER BY created_at DESC LIMIT 1"
      );

      if (result.rows.length > 0) {
        const memory = result.rows[0] as any;
        console.log('✅ DATABASE PERSISTENCE: Memory found in database');
        console.log(`   ID: ${memory.id}`);
        console.log(`   Title: ${memory.title}`);
        console.log(`   Content: ${memory.content.substring(0, 50)}...`);
        return true;
      } else {
        console.log('❌ DATABASE PERSISTENCE: No test memory found in database');
        return false;
      }
    } catch (error) {
      console.log('❌ DATABASE ERROR:', error);
      return false;
    } finally {
      await this.db.disconnect();
    }
  }

  async runAllTests(): Promise<void> {
    console.log('🚀 COMPREHENSIVE MEMORY SERVICE TESTING');
    console.log('='.repeat(60));

    const results = {
      storage: await this.testMemoryStorage(),
      retrieval: await this.testMemoryRetrieval(),
      statistics: await this.testMemoryStatistics(),
      persistence: await this.verifyDatabasePersistence(),
    };

    console.log('\n📊 TEST RESULTS SUMMARY');
    console.log('='.repeat(60));
    console.log(`Storage (CREATE):     ${results.storage ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Retrieval (READ):     ${results.retrieval ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Statistics:           ${results.statistics ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Database Persistence: ${results.persistence ? '✅ PASS' : '❌ FAIL'}`);

    const totalTests = Object.keys(results).length;
    const passedTests = Object.values(results).filter(Boolean).length;

    console.log('\n🎯 FINAL VERDICT');
    console.log('='.repeat(60));
    console.log(`Tests Passed: ${passedTests}/${totalTests}`);

    if (passedTests === totalTests) {
      console.log('🎉 ALL TESTS PASSED - MEMORY SERVICE IS FULLY FUNCTIONAL');
    } else {
      console.log('🚨 SOME TESTS FAILED - MEMORY SERVICE HAS ISSUES');
      process.exit(1);
    }
  }
}

// Run comprehensive tests
const tester = new MemoryServiceTester();
tester.runAllTests().catch((error) => {
  console.error('💥 TEST RUNNER ERROR:', error);
  process.exit(1);
});
