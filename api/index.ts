/**
 * Main Vercel serverless function entry point
 * Handles all API requests with Clerk authentication
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyToken } from '@clerk/backend';
import { initDatabaseFromEnv } from '../src/database/index.js';
import { MemoryCore } from '../src/core/index.js';
import { MemoryType, EntityType, ImportanceLevel } from '../src/types/enums.js';
import type { ApiResponse } from '../src/types/base.js';
import { withCors, applyCorsHeaders, handlePreflight, getClientType } from './middleware/cors.js';

// Initialize database and memory core
let memoryCore: MemoryCore | null = null;

async function getMemoryCore(): Promise<MemoryCore> {
  if (!memoryCore) {
    const db = initDatabaseFromEnv();
    memoryCore = new MemoryCore(db, process.env.OPENAI_API_KEY);
    await memoryCore.initialize();
  }
  return memoryCore;
}

// Professional HTML landing page
const generateLandingPageHTML = () => `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MCP Memory Service API</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        .container {
            max-width: 900px;
            width: 100%;
            background: white;
            border-radius: 20px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.2);
            overflow: hidden;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 40px;
            text-align: center;
        }
        .header h1 {
            font-size: 2.5em;
            margin-bottom: 10px;
            font-weight: 700;
        }
        .header p {
            font-size: 1.1em;
            opacity: 0.9;
        }
        .status-badge {
            display: inline-block;
            background: #4caf50;
            color: white;
            padding: 5px 15px;
            border-radius: 20px;
            font-size: 0.85em;
            margin-top: 15px;
            font-weight: 500;
        }
        .content {
            padding: 40px;
        }
        .section {
            margin-bottom: 35px;
        }
        .section h2 {
            color: #667eea;
            margin-bottom: 15px;
            font-size: 1.5em;
            font-weight: 600;
        }
        .endpoint-list {
            background: #f8f9fa;
            border-radius: 10px;
            padding: 20px;
            margin-top: 10px;
        }
        .endpoint {
            display: flex;
            align-items: center;
            margin-bottom: 12px;
            padding: 10px;
            background: white;
            border-radius: 8px;
            border: 1px solid #e0e0e0;
        }
        .endpoint:last-child {
            margin-bottom: 0;
        }
        .method {
            display: inline-block;
            padding: 4px 10px;
            border-radius: 4px;
            font-weight: 600;
            font-size: 0.85em;
            margin-right: 15px;
            min-width: 60px;
            text-align: center;
        }
        .method.get { background: #61affe; color: white; }
        .method.post { background: #49cc90; color: white; }
        .method.put { background: #fca130; color: white; }
        .method.delete { background: #f93e3e; color: white; }
        .path {
            font-family: 'Courier New', monospace;
            color: #333;
            font-weight: 500;
            flex-grow: 1;
        }
        .auth-badge {
            display: inline-block;
            padding: 3px 8px;
            border-radius: 4px;
            font-size: 0.75em;
            font-weight: 600;
            margin-left: 10px;
        }
        .auth-badge.required {
            background: #ffebee;
            color: #c62828;
        }
        .auth-badge.public {
            background: #e8f5e9;
            color: #2e7d32;
        }
        .description {
            color: #666;
            font-size: 0.9em;
            margin-left: 85px;
            margin-top: -5px;
        }
        .info-box {
            background: #e3f2fd;
            border-left: 4px solid #2196f3;
            padding: 15px;
            border-radius: 5px;
            margin-top: 20px;
        }
        .info-box h3 {
            color: #1976d2;
            margin-bottom: 8px;
            font-size: 1.1em;
        }
        .code {
            background: #f5f5f5;
            padding: 15px;
            border-radius: 5px;
            font-family: 'Courier New', monospace;
            font-size: 0.9em;
            overflow-x: auto;
            margin-top: 10px;
            border: 1px solid #e0e0e0;
        }
        .footer {
            text-align: center;
            padding: 20px;
            background: #f8f9fa;
            border-top: 1px solid #e0e0e0;
            color: #666;
            font-size: 0.9em;
        }
        .footer a {
            color: #667eea;
            text-decoration: none;
            font-weight: 500;
        }
        .footer a:hover {
            text-decoration: underline;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>MCP Memory Service API</h1>
            <p>Cloud-based vector memory service for AI assistants</p>
            <span class="status-badge">ONLINE</span>
        </div>

        <div class="content">
            <div class="section">
                <h2>API Endpoints</h2>
                <div class="endpoint-list">
                    <div class="endpoint">
                        <span class="method get">GET</span>
                        <span class="path">/api/health</span>
                        <span class="auth-badge public">PUBLIC</span>
                    </div>
                    <p class="description">Health check endpoint - returns service status</p>

                    <div class="endpoint">
                        <span class="method post">POST</span>
                        <span class="path">/api/memories</span>
                        <span class="auth-badge required">AUTH</span>
                    </div>
                    <p class="description">Create a new memory with vector embedding</p>

                    <div class="endpoint">
                        <span class="method get">GET</span>
                        <span class="path">/api/memories/search</span>
                        <span class="auth-badge required">AUTH</span>
                    </div>
                    <p class="description">Search memories using semantic similarity</p>

                    <div class="endpoint">
                        <span class="method post">POST</span>
                        <span class="path">/api/entities</span>
                        <span class="auth-badge required">AUTH</span>
                    </div>
                    <p class="description">Create an entity (person, organization, project)</p>

                    <div class="endpoint">
                        <span class="method get">GET</span>
                        <span class="path">/api/entities/search</span>
                        <span class="auth-badge required">AUTH</span>
                    </div>
                    <p class="description">Search entities by name or attributes</p>

                    <div class="endpoint">
                        <span class="method get">GET</span>
                        <span class="path">/api/search</span>
                        <span class="auth-badge required">AUTH</span>
                    </div>
                    <p class="description">Unified search across memories and entities</p>

                    <div class="endpoint">
                        <span class="method get">GET</span>
                        <span class="path">/api/statistics</span>
                        <span class="auth-badge required">AUTH</span>
                    </div>
                    <p class="description">Get user memory statistics and usage</p>
                </div>
            </div>

            <div class="section">
                <h2>Authentication</h2>
                <p>This API uses Clerk for authentication. Include your authentication token in the Authorization header:</p>
                <div class="code">
Authorization: Bearer YOUR_CLERK_TOKEN
                </div>
                <p style="margin-top: 10px;">Or use the custom header:</p>
                <div class="code">
X-Clerk-Auth-Token: YOUR_CLERK_TOKEN
                </div>
            </div>

            <div class="info-box">
                <h3>Quick Start</h3>
                <p>1. Sign up for a Clerk account at <a href="https://clerk.com" target="_blank" style="color: #2196f3;">clerk.com</a></p>
                <p>2. Get your authentication token from your Clerk dashboard</p>
                <p>3. Make API requests with your token in the Authorization header</p>
                <p>4. Check out the <a href="/api/health" style="color: #2196f3;">health endpoint</a> to verify the service is running</p>
            </div>

            <div class="section">
                <h2>Response Format</h2>
                <p>All API responses follow a consistent JSON format:</p>
                <div class="code">
{
  "success": true,
  "data": { ... },
  "message": "Operation successful",
  "error": null
}
                </div>
            </div>
        </div>

        <div class="footer">
            <p>MCP Memory Service v1.0.0 | Built with TypeScript & Turso</p>
            <p><a href="https://github.com/modelcontextprotocol/servers" target="_blank">GitHub</a> | <a href="/api/health">API Status</a></p>
        </div>
    </div>
</body>
</html>
`;

async function handler(req: VercelRequest, res: VercelResponse) {
  // Handle CORS preflight requests
  if (handlePreflight(req, res)) {
    return;
  }

  // Apply CORS headers
  applyCorsHeaders(req, res);

  // Log client type for debugging
  const clientType = getClientType(req);
  console.log(`Request from ${clientType} client:`, req.method, req.url);

  const { method, url, headers } = req;
  const path = url?.split('?')[0] || '/';

  try {
    // Root endpoint - show HTML landing page
    if (path === '/' && method === 'GET') {
      // Check if client wants JSON (API clients)
      const acceptsJson = headers.accept?.includes('application/json');

      if (acceptsJson) {
        // Return JSON for API clients
        return res.status(200).json({
          name: 'MCP Memory Service API',
          version: '1.0.0',
          description: 'REST API for cloud-based vector memory service with Clerk authentication',
          status: 'online',
          documentation: 'https://mcp-memory-ts.vercel.app/',
          endpoints: {
            'GET /api/health': 'Health check (public)',
            'POST /api/memories': 'Add a new memory (auth required)',
            'GET /api/memories/search': 'Search memories (auth required)',
            'POST /api/entities': 'Create an entity (auth required)',
            'GET /api/entities/search': 'Search entities (auth required)',
            'GET /api/search': 'Unified search (auth required)',
            'GET /api/statistics': 'Get user statistics (auth required)',
          },
        });
      } else {
        // Return HTML landing page for browsers
        res.setHeader('Content-Type', 'text/html');
        return res.status(200).send(generateLandingPageHTML());
      }
    }

    // Health check endpoint (no auth required)
    if (path === '/api/health' || path === '/health') {
      return res.status(200).json({
        success: true,
        status: 'online',
        timestamp: new Date().toISOString(),
        service: 'mcp-memory-ts',
        version: '1.0.0',
        environment: process.env.NODE_ENV || 'production',
      });
    }

    // API documentation endpoint (no auth required)
    if (path === '/api' && method === 'GET') {
      return res.status(200).json({
        name: 'MCP Memory Service API',
        version: '1.0.0',
        description: 'REST API for cloud-based vector memory service',
        authentication: 'Clerk (Bearer token required)',
        baseUrl: 'https://mcp-memory-ts.vercel.app',
        endpoints: {
          public: {
            'GET /': 'API documentation (HTML)',
            'GET /api': 'API documentation (JSON)',
            'GET /api/health': 'Health check endpoint',
          },
          authenticated: {
            memories: {
              'POST /api/memories': 'Create a new memory',
              'GET /api/memories': 'List all memories',
              'GET /api/memories/search': 'Search memories by query',
            },
            entities: {
              'POST /api/entities': 'Create an entity',
              'GET /api/entities': 'List all entities',
              'GET /api/entities/search': 'Search entities',
            },
            search: {
              'GET /api/search': 'Unified search across memories and entities',
            },
            statistics: {
              'GET /api/statistics': 'Get user statistics and usage',
            },
          },
        },
        authentication_headers: {
          'Authorization': 'Bearer YOUR_CLERK_TOKEN',
          'X-Clerk-Auth-Token': 'YOUR_CLERK_TOKEN',
        },
        response_format: {
          success: {
            success: true,
            data: '...',
            message: 'Operation successful',
          },
          error: {
            success: false,
            error: 'Error message',
            message: 'Human-readable error description',
          },
        },
      });
    }

    // Protected routes - require authentication
    const authToken = req.headers.authorization?.replace('Bearer ', '') ||
                     req.headers['x-clerk-auth-token'] as string;

    if (!authToken) {
      return res.status(401).json({
        success: false,
        error: 'Missing authentication token',
        message: 'Please provide a valid Clerk authentication token in the Authorization header',
      });
    }

    // Verify Clerk token
    let userId: string;
    try {
      const secretKey = process.env.CLERK_SECRET_KEY;
      if (!secretKey) {
        console.error('CLERK_SECRET_KEY not configured');
        return res.status(500).json({
          success: false,
          error: 'Authentication service not configured',
          message: 'The server is not properly configured for authentication',
        });
      }

      // Verify the JWT token with Clerk
      const payload = await verifyToken(authToken, {
        secretKey,
        authorizedParties: ['https://mcp-memory-ts.vercel.app', 'http://localhost:3000'],
      });

      userId = payload.sub; // Get user ID from token
    } catch (error) {
      console.error('Token verification failed:', error);

      // In development, allow a fallback for testing
      if (process.env.NODE_ENV === 'development' || process.env.ALLOW_DEV_AUTH === 'true') {
        // Use a hash of the token as user ID for development
        userId = 'dev_' + Buffer.from(authToken).toString('base64').slice(0, 8);
        console.log('Development mode: using fallback user ID:', userId);
      } else {
        return res.status(401).json({
          success: false,
          error: 'Invalid authentication token',
          message: 'The provided authentication token is invalid or expired',
        });
      }
    }

    // Initialize memory core
    const mc = await getMemoryCore();

    // Route to appropriate handler
    if (path.startsWith('/api/memories')) {
      return await handleMemoriesRoute(req, res, mc, userId, path);
    } else if (path.startsWith('/api/entities')) {
      return await handleEntitiesRoute(req, res, mc, userId, path);
    } else if (path === '/api/search') {
      return await handleUnifiedSearch(req, res, mc, userId);
    } else if (path === '/api/statistics') {
      return await handleStatistics(req, res, mc, userId);
    } else {
      return res.status(404).json({
        success: false,
        error: 'Endpoint not found',
        message: `The endpoint ${path} does not exist. Check /api for available endpoints.`,
      });
    }
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
      message: 'An unexpected error occurred while processing your request',
    });
  }
}

async function handleMemoriesRoute(
  req: VercelRequest,
  res: VercelResponse,
  mc: MemoryCore,
  userId: string,
  path: string
): Promise<VercelResponse> {
  if (path === '/api/memories' && req.method === 'POST') {
    const { title, content, memory_type, importance, tags, entity_ids } = req.body as any;

    if (!title || !content) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        message: 'Both title and content are required to create a memory',
      });
    }

    const result = await mc.addMemory(
      title,
      content,
      memory_type as MemoryType || MemoryType.MEMORY,
      {
        userId,
        importance: importance as ImportanceLevel || ImportanceLevel.MEDIUM,
        tags,
        entityIds: entity_ids,
      }
    );

    return res.status(result.status === 'success' ? 201 : 400).json({
      success: result.status === 'success',
      data: result.data,
      message: result.message,
      error: result.error,
    });
  }

  if (path === '/api/memories/search' && req.method === 'GET') {
    const { query, limit, threshold, memory_types } = req.query as any;

    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'Missing query parameter',
        message: 'A search query is required',
      });
    }

    const memoryTypesArray = memory_types
      ? memory_types.split(',').map((t: string) => t.trim() as MemoryType)
      : undefined;

    const result = await mc.searchMemories(query, {
      query,
      userId,
      limit: limit ? parseInt(limit) : 10,
      threshold: threshold ? parseFloat(threshold) : 0.7,
      memoryTypes: memoryTypesArray,
    });

    return res.status(result.status === 'success' ? 200 : 400).json({
      success: result.status === 'success',
      data: result.data,
      message: result.message,
      error: result.error,
    });
  }

  if (path === '/api/memories' && req.method === 'GET') {
    // TODO: Implement get all memories
    return res.status(501).json({
      success: false,
      error: 'Not implemented',
      message: 'List all memories endpoint is not yet implemented',
    });
  }

  return res.status(405).json({
    success: false,
    error: 'Method not allowed',
    message: `The ${req.method} method is not allowed for ${path}`,
  });
}

async function handleEntitiesRoute(
  req: VercelRequest,
  res: VercelResponse,
  mc: MemoryCore,
  userId: string,
  path: string
): Promise<VercelResponse> {
  if (path === '/api/entities' && req.method === 'POST') {
    const { name, entity_type, ...options } = req.body as any;

    if (!name || !entity_type) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        message: 'Both name and entity_type are required to create an entity',
      });
    }

    const result = await mc.createEntity(
      name,
      entity_type as EntityType,
      {
        userId,
        ...options,
        importance: options.importance as ImportanceLevel || ImportanceLevel.MEDIUM,
      }
    );

    return res.status(result.status === 'success' ? 201 : 400).json({
      success: result.status === 'success',
      data: result.data,
      message: result.message,
      error: result.error,
    });
  }

  if (path === '/api/entities/search' && req.method === 'GET') {
    const { query, limit } = req.query as any;

    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'Missing query parameter',
        message: 'A search query is required',
      });
    }

    const result = await mc.searchEntities(query, {
      userId,
      limit: limit ? parseInt(limit) : 10,
    });

    return res.status(result.status === 'success' ? 200 : 400).json({
      success: result.status === 'success',
      data: result.data,
      message: result.message,
      error: result.error,
    });
  }

  if (path === '/api/entities' && req.method === 'GET') {
    // TODO: Implement get all entities
    return res.status(501).json({
      success: false,
      error: 'Not implemented',
      message: 'List all entities endpoint is not yet implemented',
    });
  }

  return res.status(405).json({
    success: false,
    error: 'Method not allowed',
    message: `The ${req.method} method is not allowed for ${path}`,
  });
}

async function handleUnifiedSearch(
  req: VercelRequest,
  res: VercelResponse,
  mc: MemoryCore,
  userId: string
): Promise<VercelResponse> {
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed',
      message: 'Only GET method is allowed for unified search',
    });
  }

  const { query, limit, threshold, memory_types, entity_types } = req.query as any;

  if (!query) {
    return res.status(400).json({
      success: false,
      error: 'Missing query parameter',
      message: 'A search query is required',
    });
  }

  const memoryTypesArray = memory_types
    ? memory_types.split(',').map((t: string) => t.trim() as MemoryType)
    : undefined;

  const entityTypesArray = entity_types
    ? entity_types.split(',').map((t: string) => t.trim() as EntityType)
    : undefined;

  const result = await mc.unifiedSearch(query, {
    query,
    userId,
    limit: limit ? parseInt(limit) : 10,
    threshold: threshold ? parseFloat(threshold) : 0.7,
    memoryTypes: memoryTypesArray,
    entityTypes: entityTypesArray,
  });

  return res.status(result.status === 'success' ? 200 : 400).json({
    success: result.status === 'success',
    data: result.data,
    message: result.message,
    error: result.error,
  });
}

async function handleStatistics(
  req: VercelRequest,
  res: VercelResponse,
  mc: MemoryCore,
  userId: string
): Promise<VercelResponse> {
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed',
      message: 'Only GET method is allowed for statistics',
    });
  }

  const result = await mc.getStatistics(userId);

  return res.status(result.status === 'success' ? 200 : 400).json({
    success: result.status === 'success',
    data: result.data,
    message: result.message,
    error: result.error,
  });
}

export default handler;