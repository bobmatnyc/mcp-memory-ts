#!/usr/bin/env tsx
/**
 * Test MCP server directly to diagnose issues
 */

import { spawn } from 'child_process';
import { createInterface } from 'readline';

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: number;
  method: string;
  params?: any;
}

interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: number;
  result?: any;
  error?: any;
}

class MCPServerTester {
  private server: any;
  private rl: any;
  private requestId = 1;
  private responses = new Map<number, (response: any) => void>();

  async start() {
    console.log('🚀 Starting MCP Server Test\n');

    // Start the MCP server
    this.server = spawn('tsx', ['src/desktop-mcp-server.ts'], {
      env: { ...process.env, MCP_DEBUG: '1' },
    });

    this.rl = createInterface({
      input: this.server.stdout,
      output: process.stdin,
      terminal: false,
    });

    this.rl.on('line', (line: string) => {
      if (line.trim()) {
        try {
          const response = JSON.parse(line) as JsonRpcResponse;
          const resolver = this.responses.get(response.id);
          if (resolver) {
            resolver(response);
            this.responses.delete(response.id);
          }
        } catch (e) {
          console.error('Failed to parse response:', line);
        }
      }
    });

    this.server.stderr.on('data', (data: Buffer) => {
      const msg = data.toString();
      if (msg.includes('[MCP DEBUG]') || msg.includes('[MCP ERROR]')) {
        console.log('Server:', msg.trim());
      }
    });

    // Initialize
    await this.sendRequest('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
    });

    await this.sendRequest('initialized', {});
  }

  private sendRequest(method: string, params?: any): Promise<JsonRpcResponse> {
    return new Promise((resolve) => {
      const id = this.requestId++;
      const request: JsonRpcRequest = {
        jsonrpc: '2.0',
        id,
        method,
        params,
      };

      this.responses.set(id, resolve);
      this.server.stdin.write(JSON.stringify(request) + '\n');
    });
  }

  async testMetadataUpdate() {
    console.log('\n1️⃣ TESTING METADATA UPDATE PERSISTENCE:\n');

    // Step 1: Create a memory with initial metadata
    console.log('Creating memory with initial metadata...');
    const createResponse = await this.sendRequest('tools/call', {
      name: 'store_memory',
      arguments: {
        content: 'Test memory for metadata persistence',
        title: 'Metadata Test',
        type: 'semantic',
        importance: 0.5,
        metadata: {
          project: 'alpha',
          version: '1.0',
          status: 'draft',
        },
      },
    });

    console.log('Create response:', JSON.stringify(createResponse.result, null, 2));

    // Extract memory ID from response
    const createText = createResponse.result?.content?.[0]?.text || '';
    const idMatch = createText.match(/ID: ([a-f0-9-]+)/);
    const memoryId = idMatch ? idMatch[1] : null;

    if (!memoryId) {
      console.error('❌ Failed to extract memory ID');
      return;
    }

    console.log(`Memory created with ID: ${memoryId}`);

    // Step 2: Get the memory to verify initial metadata
    console.log('\nGetting memory to verify initial metadata...');
    const getResponse1 = await this.sendRequest('tools/call', {
      name: 'get_memory',
      arguments: { id: memoryId },
    });

    console.log('Initial memory:', getResponse1.result?.content?.[0]?.text);

    // Step 3: Update the metadata
    console.log('\nUpdating metadata...');
    const updateResponse = await this.sendRequest('tools/call', {
      name: 'update_memory',
      arguments: {
        id: memoryId,
        metadata: {
          project: 'alpha',
          version: '2.0',
          status: 'published',
          newField: 'added',
        },
      },
    });

    console.log('Update response:', updateResponse.result?.content?.[0]?.text);

    // Step 4: Get the memory again to check if metadata persisted
    console.log('\nGetting memory after update...');
    const getResponse2 = await this.sendRequest('tools/call', {
      name: 'get_memory',
      arguments: { id: memoryId },
    });

    const afterUpdateText = getResponse2.result?.content?.[0]?.text || '';
    console.log('After update:', afterUpdateText);

    // Check if metadata was updated
    if (afterUpdateText.includes('version":"2.0"') && afterUpdateText.includes('status":"published"')) {
      console.log('✅ Metadata update persisted successfully!');
    } else {
      console.log('❌ Metadata update did NOT persist - original metadata retained');
    }

    // Clean up
    await this.sendRequest('tools/call', {
      name: 'delete_memory',
      arguments: { id: memoryId },
    });
  }

  async testMetadataSearch() {
    console.log('\n2️⃣ TESTING METADATA SEARCH:\n');

    // Create test memories
    console.log('Creating test memories with metadata...');

    const mem1 = await this.sendRequest('tools/call', {
      name: 'store_memory',
      arguments: {
        title: 'Project Alpha Doc',
        content: 'Documentation for Project Alpha',
        type: 'semantic',
        metadata: {
          project: 'alpha',
          docType: 'technical',
          priority: 'high',
        },
      },
    });

    const mem2 = await this.sendRequest('tools/call', {
      name: 'store_memory',
      arguments: {
        title: 'Project Beta Code',
        content: 'Source code for Project Beta',
        type: 'semantic',
        metadata: {
          project: 'beta',
          docType: 'code',
          priority: 'medium',
        },
      },
    });

    console.log('Memories created');

    // Test metadata search
    console.log('\nSearching for project:alpha...');
    const searchResponse1 = await this.sendRequest('tools/call', {
      name: 'recall_memories',
      arguments: {
        query: 'project:alpha',
        limit: 10,
      },
    });

    const searchText1 = searchResponse1.result?.content?.[0]?.text || '';
    console.log('Search result:', searchText1.substring(0, 200));

    if (searchText1.includes('Project Alpha Doc')) {
      console.log('✅ Metadata search by project:alpha works!');
    } else {
      console.log('❌ Metadata search by project:alpha NOT working');
    }

    // Test another metadata field
    console.log('\nSearching for docType:code...');
    const searchResponse2 = await this.sendRequest('tools/call', {
      name: 'recall_memories',
      arguments: {
        query: 'docType:code',
        limit: 10,
      },
    });

    const searchText2 = searchResponse2.result?.content?.[0]?.text || '';
    if (searchText2.includes('Project Beta Code')) {
      console.log('✅ Metadata search by docType:code works!');
    } else {
      console.log('❌ Metadata search by docType:code NOT working');
    }
  }

  async testVectorEmbeddings() {
    console.log('\n3️⃣ TESTING VECTOR EMBEDDINGS:\n');

    // Get stats first
    const statsResponse = await this.sendRequest('tools/call', {
      name: 'get_memory_stats',
      arguments: {},
    });

    const statsText = statsResponse.result?.content?.[0]?.text || '';
    console.log('Memory stats:', statsText);

    // Check embedding percentage
    const embedMatch = statsText.match(/Vector Embeddings: (\d+)\/(\d+) \((\d+)%\)/);
    if (embedMatch) {
      const [, withEmbeddings, total, percentage] = embedMatch;
      console.log(`Embeddings: ${withEmbeddings}/${total} (${percentage}%)`);

      if (percentage === '0') {
        console.log('❌ Vector embeddings at 0% - not working');
      } else {
        console.log('✅ Vector embeddings working');
      }
    }
  }

  async stop() {
    this.server.kill();
    this.rl.close();
  }

  async runTests() {
    await this.start();

    try {
      await this.testMetadataUpdate();
      await this.testMetadataSearch();
      await this.testVectorEmbeddings();
    } catch (error) {
      console.error('Test error:', error);
    }

    await this.stop();
    console.log('\n✅ Tests completed');
    process.exit(0);
  }
}

const tester = new MCPServerTester();
tester.runTests().catch(console.error);