#!/usr/bin/env tsx

/**
 * Debug script to investigate regression test failures
 */

import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

async function testMemoryPersistence() {
  console.log('🔍 Testing memory persistence...\n');

  // Create temp database
  const tempDir = await fs.mkdtemp(join(tmpdir(), 'mcp-debug-'));
  const dbPath = join(tempDir, 'debug-test.db');
  console.log(`📁 Test database: ${dbPath}\n`);

  const env = {
    ...process.env,
    TURSO_URL: `file:${dbPath}`,
    DEFAULT_USER_EMAIL: 'debug-test@example.com',
    OPENAI_API_KEY: 'test-key',
    MCP_DEBUG: '1',
  };

  // Helper to send request
  async function sendRequest(request: any, testName: string): Promise<any> {
    return new Promise((resolve, reject) => {
      console.log(`📤 Sending request: ${testName}`);
      console.log(JSON.stringify(request, null, 2));

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
        console.log(`\n📥 Response received (exit code: ${code}):`);
        console.log('STDERR:', errorData);
        console.log('STDOUT:', responseData);

        if (code !== 0) {
          reject(new Error(`Process exited with code ${code}. Error: ${errorData}`));
          return;
        }

        try {
          const lines = responseData.trim().split('\n');
          const lastLine = lines[lines.length - 1];
          const response = JSON.parse(lastLine);
          console.log('Parsed response:', JSON.stringify(response, null, 2));
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

  try {
    // Test 1: Get stats (empty)
    console.log('\n' + '='.repeat(80));
    console.log('TEST 1: Get statistics from empty database');
    console.log('='.repeat(80));

    const statsResponse1 = await sendRequest({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: {
        name: 'get_memory_stats',
        arguments: {},
      },
    }, 'Empty Stats');

    console.log('\n✅ Stats Response:', statsResponse1.result?.content?.[0]?.text || 'N/A');

    // Test 2: Add memory
    console.log('\n' + '='.repeat(80));
    console.log('TEST 2: Add memory');
    console.log('='.repeat(80));

    const addResponse = await sendRequest({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: {
        name: 'store_memory',
        arguments: {
          content: 'This is a debug test memory',
          type: 'semantic',
          importance: 0.7,
          metadata: {
            title: 'Debug Test',
            tags: ['debug', 'test'],
          },
        },
      },
    }, 'Add Memory');

    console.log('\n✅ Add Response:', addResponse.result?.content?.[0]?.text || 'N/A');

    // Test 3: Get stats (should show 1 memory)
    console.log('\n' + '='.repeat(80));
    console.log('TEST 3: Get statistics after adding memory');
    console.log('='.repeat(80));

    const statsResponse2 = await sendRequest({
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: {
        name: 'get_memory_stats',
        arguments: {},
      },
    }, 'Stats After Add');

    console.log('\n✅ Stats Response:', statsResponse2.result?.content?.[0]?.text || 'N/A');

    // Test 4: Search for memory
    console.log('\n' + '='.repeat(80));
    console.log('TEST 4: Search for added memory');
    console.log('='.repeat(80));

    const searchResponse = await sendRequest({
      jsonrpc: '2.0',
      id: 4,
      method: 'tools/call',
      params: {
        name: 'recall_memories',
        arguments: {
          query: 'debug test',
          limit: 10,
        },
      },
    }, 'Search Memory');

    console.log('\n✅ Search Response:', searchResponse.result?.content?.[0]?.text || 'N/A');

    // Check database file
    console.log('\n' + '='.repeat(80));
    console.log('DATABASE FILE CHECK');
    console.log('='.repeat(80));

    const dbStats = await fs.stat(dbPath);
    console.log(`Database file size: ${dbStats.size} bytes`);
    console.log(`Database exists: ${dbStats.isFile()}`);

    // Cleanup
    await fs.rm(tempDir, { recursive: true, force: true });
    console.log('\n🧹 Cleaned up test environment');

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    // Cleanup on error
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (e) {
      // Ignore cleanup errors
    }
    process.exit(1);
  }
}

testMemoryPersistence().catch(console.error);
