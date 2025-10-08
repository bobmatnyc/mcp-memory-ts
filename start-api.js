#!/usr/bin/env node
/**
 * PM2 Wrapper for API Server
 */
import { APIServer } from './dist/api/server.js';

const port = process.env.PORT ? parseInt(process.env.PORT) : 3000;
const host = process.env.HOST || '0.0.0.0';

console.log(`Starting MCP Memory API Server on ${host}:${port}...`);

const server = new APIServer(port, host);

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Received SIGINT, shutting down gracefully...');
  await server.stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Received SIGTERM, shutting down gracefully...');
  await server.stop();
  process.exit(0);
});

server.start().catch(error => {
  console.error('Failed to start API server:', error);
  process.exit(1);
});
