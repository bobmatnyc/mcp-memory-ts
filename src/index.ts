/**
 * Main entry point for MCP Memory Service
 */

import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });
dotenv.config();

// Export all modules
export * from './types/index.js';
export * from './models/index.js';
export * from './database/index.js';
export * from './core/index.js';
export * from './api/index.js';
export * from './utils/index.js';

// Main function for CLI usage
export async function main(): Promise<void> {
  const command = process.argv[2];

  switch (command) {
    case 'mcp-server':
      const mcpModule = await import('./mcp/server.js');
      const mcpServer = new mcpModule.MCPServer();
      await mcpServer.start();
      break;

    case 'api-server':
      const { APIServer } = await import('./api/server.js');
      const apiServer = new APIServer();
      await apiServer.start();
      break;

    case 'init-db':
      const { initDatabaseFromEnv, initializeSchema } = await import('./database/index.js');
      const db = initDatabaseFromEnv();
      await db.connect();
      await initializeSchema(db);
      console.log('Database initialized successfully');
      await db.disconnect();
      break;

    default:
      console.log('MCP Memory Service - TypeScript');
      console.log('');
      console.log('Available commands:');
      console.log('  mcp-server    Start MCP server for Claude Desktop');
      console.log('  api-server    Start REST API server');
      console.log('  init-db       Initialize database schema');
      console.log('');
      console.log('Environment variables:');
      console.log('  TURSO_URL           Database URL');
      console.log('  TURSO_AUTH_TOKEN    Database auth token');
      console.log('  OPENAI_API_KEY      OpenAI API key for embeddings');
      console.log('  DEFAULT_USER_EMAIL  Default user email');
      console.log('  MCP_DEBUG           Enable debug logging (0 or 1)');
      break;
  }
}

// Run main if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
}
