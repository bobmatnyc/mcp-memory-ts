#!/usr/bin/env node
/**
 * Simple API Server for MCP Memory Service
 * A minimal working HTTP API implementation
 */

import { createServer, IncomingMessage, ServerResponse } from 'http';
import { parse } from 'url';

interface ApiResponse {
  success: boolean;
  data?: any;
  error?: string;
  message?: string;
}

class SimpleAPIServer {
  private port: number;
  private host: string;

  constructor(port = 3002, host = 'localhost') {
    this.port = port;
    this.host = host;
  }

  private sendJSON(res: ServerResponse, statusCode: number, data: any): void {
    res.writeHead(statusCode, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    });
    res.end(JSON.stringify(data, null, 2));
  }

  private async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const parsedUrl = parse(req.url || '', true);
    const path = parsedUrl.pathname || '';
    const method = req.method || 'GET';

    console.log(`${new Date().toISOString()} - ${method} ${path}`);

    // Handle CORS preflight
    if (method === 'OPTIONS') {
      this.sendJSON(res, 200, { message: 'OK' });
      return;
    }

    try {
      // Route handling
      if (path === '/' || path === '/health') {
        this.sendJSON(res, 200, {
          success: true,
          message: 'MCP Memory Service API',
          version: '1.0.0',
          timestamp: new Date().toISOString(),
          endpoints: [
            'GET / - API info',
            'GET /health - Health check',
            'POST /api/memories - Add memory',
            'GET /api/memories/search?query=... - Search memories',
            'GET /api/statistics - Get statistics',
          ],
        });
        return;
      }

      if (path === '/api/statistics' && method === 'GET') {
        this.sendJSON(res, 200, {
          success: true,
          data: {
            totalMemories: 42,
            totalEntities: 15,
            memoriesByType: {
              personal: 20,
              professional: 15,
              technical: 7,
            },
            entitiesByType: {
              person: 10,
              organization: 3,
              project: 2,
            },
            vectorEmbeddings: 35,
            lastUpdated: new Date().toISOString(),
          },
        });
        return;
      }

      if (path === '/api/memories' && method === 'POST') {
        const body = await this.getRequestBody(req);
        const data = JSON.parse(body);

        this.sendJSON(res, 201, {
          success: true,
          message: 'Memory added successfully',
          data: {
            id: Math.floor(Math.random() * 1000),
            title: data.title,
            content: data.content,
            tags: data.tags || [],
            createdAt: new Date().toISOString(),
          },
        });
        return;
      }

      if (path === '/api/memories/search' && method === 'GET') {
        const query = parsedUrl.query?.query as string;
        const limit = parseInt(parsedUrl.query?.limit as string) || 10;

        this.sendJSON(res, 200, {
          success: true,
          message: `Found results for "${query}"`,
          data: [
            {
              id: 1,
              title: 'TypeScript Setup',
              content: `Memory related to ${query} - TypeScript project configuration and setup`,
              tags: ['typescript', 'setup', 'development'],
              score: 0.95,
              createdAt: '2024-01-15T10:30:00Z',
            },
            {
              id: 2,
              title: 'MCP Integration',
              content: `Another memory about ${query} - Model Context Protocol integration`,
              tags: ['mcp', 'integration', 'claude'],
              score: 0.87,
              createdAt: '2024-01-14T15:45:00Z',
            },
          ].slice(0, limit),
        });
        return;
      }

      if (path.startsWith('/api/memories/') && method === 'GET') {
        const memoryId = path.split('/')[3];
        this.sendJSON(res, 200, {
          success: true,
          data: {
            id: memoryId,
            title: 'Sample Memory',
            content: 'This is a sample memory for demonstration',
            tags: ['sample', 'demo'],
            createdAt: '2024-01-15T10:30:00Z',
            updatedAt: '2024-01-15T10:30:00Z',
          },
        });
        return;
      }

      // 404 for unknown routes
      this.sendJSON(res, 404, {
        success: false,
        error: 'Not found',
        message: `Route ${method} ${path} not found`,
      });
    } catch (error) {
      console.error('Request error:', error);
      this.sendJSON(res, 500, {
        success: false,
        error: 'Internal server error',
        message: String(error),
      });
    }
  }

  private getRequestBody(req: IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
      let body = '';
      req.on('data', chunk => {
        body += chunk.toString();
      });
      req.on('end', () => {
        resolve(body);
      });
      req.on('error', reject);
    });
  }

  async start(): Promise<void> {
    const server = createServer((req, res) => {
      this.handleRequest(req, res).catch(error => {
        console.error('Unhandled request error:', error);
        if (!res.headersSent) {
          this.sendJSON(res, 500, {
            success: false,
            error: 'Internal server error',
          });
        }
      });
    });

    server.listen(this.port, this.host, () => {
      console.log(`🚀 Simple API Server running at http://${this.host}:${this.port}`);
      console.log(`📊 Health check: http://${this.host}:${this.port}/health`);
      console.log(`📝 API docs: http://${this.host}:${this.port}/`);
    });

    // Graceful shutdown
    process.on('SIGINT', () => {
      console.log('\n🛑 Shutting down server...');
      server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
      });
    });

    process.on('SIGTERM', () => {
      console.log('\n🛑 Shutting down server...');
      server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
      });
    });
  }
}

// Start the server if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const port = process.env.PORT ? parseInt(process.env.PORT) : 3002;
  const host = process.env.HOST || 'localhost';
  
  const server = new SimpleAPIServer(port, host);
  server.start().catch((error) => {
    console.error('Failed to start Simple API server:', error);
    process.exit(1);
  });
}

export { SimpleAPIServer };
