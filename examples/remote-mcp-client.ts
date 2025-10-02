/**
 * Example Client for Remote MCP Server
 * Demonstrates how to interact with the Remote MCP Server using Clerk authentication
 */

// NOTE: This is a demonstration example. In production, you would use actual Clerk tokens.

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
 * Remote MCP Client
 */
class RemoteMCPClient {
  private baseUrl: string;
  private authToken: string;

  constructor(baseUrl: string, authToken: string) {
    this.baseUrl = baseUrl;
    this.authToken = authToken;
  }

  /**
   * Send a JSON-RPC request to the remote MCP server
   */
  async sendRequest(method: string, params?: any): Promise<JsonRpcResponse> {
    const request: JsonRpcRequest = {
      jsonrpc: '2.0',
      id: Date.now(),
      method,
      params,
    };

    const response = await fetch(`${this.baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.authToken}`,
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Initialize MCP session
   */
  async initialize(): Promise<any> {
    const response = await this.sendRequest('initialize', {
      protocolVersion: '2024-11-05',
      clientInfo: {
        name: 'remote-mcp-client-example',
        version: '1.0.0',
      },
    });

    if (response.error) {
      throw new Error(`Initialize failed: ${response.error.message}`);
    }

    return response.result;
  }

  /**
   * List available tools
   */
  async listTools(): Promise<any[]> {
    const response = await this.sendRequest('tools/list');

    if (response.error) {
      throw new Error(`List tools failed: ${response.error.message}`);
    }

    return response.result?.tools || [];
  }

  /**
   * Call a tool
   */
  async callTool(toolName: string, args: any): Promise<any> {
    const response = await this.sendRequest('tools/call', {
      name: toolName,
      arguments: args,
    });

    if (response.error) {
      throw new Error(`Tool call failed: ${response.error.message}`);
    }

    return response.result;
  }

  /**
   * Store a memory
   */
  async storeMemory(content: string, options: any = {}): Promise<any> {
    return this.callTool('store_memory', {
      content,
      type: options.type || 'semantic',
      importance: options.importance || 0.5,
      metadata: options.metadata,
    });
  }

  /**
   * Recall memories
   */
  async recallMemories(
    query: string,
    options: { limit?: number; threshold?: number; strategy?: string } = {}
  ): Promise<any> {
    return this.callTool('recall_memories', {
      query,
      limit: options.limit || 10,
      threshold: options.threshold || 0.3,
      strategy: options.strategy || 'composite',
    });
  }

  /**
   * Get memory by ID
   */
  async getMemory(id: string): Promise<any> {
    return this.callTool('get_memory', { id });
  }

  /**
   * Update a memory
   */
  async updateMemory(id: string, updates: any): Promise<any> {
    return this.callTool('update_memory', { id, ...updates });
  }

  /**
   * Delete a memory
   */
  async deleteMemory(id: string): Promise<any> {
    return this.callTool('delete_memory', { id });
  }

  /**
   * Get memory statistics
   */
  async getMemoryStats(): Promise<any> {
    return this.callTool('get_memory_stats', {});
  }

  /**
   * Update missing embeddings
   */
  async updateMissingEmbeddings(): Promise<any> {
    return this.callTool('update_missing_embeddings', {});
  }

  /**
   * Get daily costs
   */
  async getDailyCosts(date?: string): Promise<any> {
    return this.callTool('get_daily_costs', { date });
  }
}

/**
 * Example usage
 */
async function main() {
  console.log('Remote MCP Client Example\n');

  // Configuration
  const BASE_URL = process.env.REMOTE_MCP_URL || 'http://localhost:3001';
  const AUTH_TOKEN = process.env.CLERK_TOKEN || 'your-clerk-session-token';

  console.log(`Connecting to: ${BASE_URL}`);
  console.log(`Auth token: ${AUTH_TOKEN.substring(0, 20)}...\n`);

  // Create client
  const client = new RemoteMCPClient(BASE_URL, AUTH_TOKEN);

  try {
    // 1. Initialize
    console.log('1. Initializing MCP session...');
    const initResult = await client.initialize();
    console.log('   Server info:', initResult.serverInfo);
    console.log('   Protocol version:', initResult.protocolVersion);
    console.log();

    // 2. List tools
    console.log('2. Listing available tools...');
    const tools = await client.listTools();
    console.log(`   Found ${tools.length} tools:`);
    tools.forEach((tool) => {
      console.log(`   - ${tool.name}: ${tool.description}`);
    });
    console.log();

    // 3. Store a memory
    console.log('3. Storing a memory...');
    const storeResult = await client.storeMemory(
      'This is a test memory stored via the remote MCP server',
      {
        type: 'semantic',
        importance: 0.8,
        metadata: {
          source: 'example-client',
          category: 'test',
        },
      }
    );
    console.log('   Result:', storeResult.content[0].text);
    console.log();

    // 4. Recall memories
    console.log('4. Recalling memories...');
    const recallResult = await client.recallMemories('test memory', {
      limit: 5,
      threshold: 0.3,
    });
    console.log('   Result:', recallResult.content[0].text);
    console.log();

    // 5. Get statistics
    console.log('5. Getting memory statistics...');
    const statsResult = await client.getMemoryStats();
    console.log('   Result:', statsResult.content[0].text);
    console.log();

    // 6. Get daily costs
    console.log('6. Getting daily costs...');
    const costsResult = await client.getDailyCosts();
    console.log('   Result:', costsResult.content[0].text);
    console.log();

    console.log('✅ All operations completed successfully!');
  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// Run example if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { RemoteMCPClient };
