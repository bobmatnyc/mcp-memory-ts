#!/usr/bin/env node
/**
 * REST API Server for Memory Service
 * Provides HTTP interface for web applications
 */

import Fastify, { type FastifyInstance, type FastifyRequest, type FastifyReply } from 'fastify';
import { initDatabaseFromEnv } from '../database/index.js';
import { MemoryCore } from '../core/index.js';
import { MemoryType, EntityType, ImportanceLevel } from '../types/enums.js';
import type { ApiResponse } from '../types/base.js';

interface AuthenticatedRequest extends FastifyRequest {
  user?: { id: string; email: string };
}

class APIServer {
  private fastify: FastifyInstance;
  private memoryCore: MemoryCore | null = null;
  private port: number;
  private host: string;

  constructor(port = 3000, host = '0.0.0.0') {
    this.port = port;
    this.host = host;
    this.fastify = Fastify({
      logger: {
        level: process.env['LOG_LEVEL'] || 'info',
      },
    });

    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  private setupMiddleware(): void {
    // CORS
    this.fastify.register(import('@fastify/cors'), {
      origin: true,
      credentials: true,
    });

    // Authentication middleware
    this.fastify.addHook('preHandler', async (request: AuthenticatedRequest, reply) => {
      // Skip auth for health check and public endpoints
      if (request.url === '/health' || request.url === '/') {
        return;
      }

      const authHeader = request.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        reply.code(401).send({ success: false, error: 'Missing or invalid authorization header' });
        return;
      }

      const apiKey = authHeader.substring(7);
      if (!this.memoryCore) {
        reply.code(500).send({ success: false, error: 'Server not initialized' });
        return;
      }

      try {
        const user = await this.memoryCore.getUserByApiKey(apiKey);
        if (!user || !user.isActive) {
          reply.code(401).send({ success: false, error: 'Invalid API key' });
          return;
        }

        request.user = { id: user.id, email: user.email };
      } catch {
        reply.code(500).send({ success: false, error: 'Authentication error' });
        return;
      }
    });
  }

  private setupRoutes(): void {
    // Health check
    this.fastify.get('/health', async () => {
      return { status: 'ok', timestamp: new Date().toISOString() };
    });

    // Root endpoint
    this.fastify.get('/', async () => {
      return {
        name: 'MCP Memory Service API',
        version: '1.0.0',
        description: 'REST API for cloud-based vector memory service',
      };
    });

    // Memory endpoints
    this.fastify.post(
      '/api/memories',
      {
        schema: {
          body: {
            type: 'object',
            required: ['title', 'content'],
            properties: {
              title: { type: 'string' },
              content: { type: 'string' },
              memory_type: { type: 'string' },
              importance: { type: 'integer', minimum: 1, maximum: 4 },
              tags: { type: 'array', items: { type: 'string' } },
              entity_ids: { type: 'array', items: { type: 'integer' } },
            },
          },
        },
      },
      this.addMemory.bind(this)
    );

    this.fastify.get(
      '/api/memories/search',
      {
        schema: {
          querystring: {
            type: 'object',
            required: ['query'],
            properties: {
              query: { type: 'string' },
              limit: { type: 'integer', minimum: 1, maximum: 100 },
              threshold: { type: 'number', minimum: 0, maximum: 1 },
              memory_types: { type: 'string' }, // Comma-separated
            },
          },
        },
      },
      this.searchMemories.bind(this)
    );

    this.fastify.get('/api/memories', this.getMemories.bind(this));

    // Entity endpoints
    this.fastify.post(
      '/api/entities',
      {
        schema: {
          body: {
            type: 'object',
            required: ['name', 'entity_type'],
            properties: {
              name: { type: 'string' },
              entity_type: { type: 'string' },
              description: { type: 'string' },
              company: { type: 'string' },
              title: { type: 'string' },
              email: { type: 'string' },
              phone: { type: 'string' },
              website: { type: 'string' },
              importance: { type: 'integer', minimum: 1, maximum: 4 },
              tags: { type: 'array', items: { type: 'string' } },
              notes: { type: 'string' },
            },
          },
        },
      },
      this.createEntity.bind(this)
    );

    this.fastify.get(
      '/api/entities/search',
      {
        schema: {
          querystring: {
            type: 'object',
            required: ['query'],
            properties: {
              query: { type: 'string' },
              limit: { type: 'integer', minimum: 1, maximum: 100 },
            },
          },
        },
      },
      this.searchEntities.bind(this)
    );

    this.fastify.get('/api/entities', this.getEntities.bind(this));

    // Search endpoints
    this.fastify.get(
      '/api/search',
      {
        schema: {
          querystring: {
            type: 'object',
            required: ['query'],
            properties: {
              query: { type: 'string' },
              limit: { type: 'integer', minimum: 1, maximum: 100 },
              threshold: { type: 'number', minimum: 0, maximum: 1 },
              memory_types: { type: 'string' }, // Comma-separated
              entity_types: { type: 'string' }, // Comma-separated
            },
          },
        },
      },
      this.unifiedSearch.bind(this)
    );

    // Statistics endpoint
    this.fastify.get('/api/statistics', this.getStatistics.bind(this));

    // User management endpoints
    this.fastify.post(
      '/api/users',
      {
        schema: {
          body: {
            type: 'object',
            required: ['email'],
            properties: {
              email: { type: 'string' },
              name: { type: 'string' },
              organization: { type: 'string' },
            },
          },
        },
      },
      this.createUser.bind(this)
    );
  }

  private setupErrorHandling(): void {
    this.fastify.setErrorHandler((error, request, reply) => {
      this.fastify.log.error(error);

      const response: ApiResponse = {
        success: false,
        error: error.message || 'Internal server error',
      };

      reply.code(error.statusCode || 500).send(response);
    });

    this.fastify.setNotFoundHandler((request, reply) => {
      const response: ApiResponse = {
        success: false,
        error: 'Not found',
      };

      reply.code(404).send(response);
    });
  }

  // Route handlers
  private async addMemory(
    request: AuthenticatedRequest,
    _reply: FastifyReply
  ): Promise<ApiResponse> {
    const { title, content, memory_type, importance, tags, entity_ids } = request.body as any;

    const result = await this.memoryCore!.addMemory(
      title,
      content,
      (memory_type as MemoryType) || MemoryType.MEMORY,
      {
        userId: request.user!.id,
        importance: (importance as ImportanceLevel) || ImportanceLevel.MEDIUM,
        tags,
        entityIds: entity_ids,
      }
    );

    return {
      success: result.status === 'success',
      data: result.data,
      message: result.message,
      error: result.error,
    };
  }

  private async searchMemories(
    request: AuthenticatedRequest,
    _reply: FastifyReply
  ): Promise<ApiResponse> {
    const { query, limit, threshold, memory_types } = request.query as any;

    const memoryTypesArray = memory_types
      ? memory_types.split(',').map((t: string) => t.trim() as MemoryType)
      : undefined;

    const result = await this.memoryCore!.searchMemories(query, {
      query,
      userId: request.user!.id,
      limit: limit ? parseInt(limit) : 10,
      threshold: threshold ? parseFloat(threshold) : 0.7,
      memoryTypes: memoryTypesArray,
    });

    return {
      success: result.status === 'success',
      data: result.data,
      message: result.message,
      error: result.error,
    };
  }

  private async getMemories(
    _request: AuthenticatedRequest,
    _reply: FastifyReply
  ): Promise<ApiResponse> {
    // TODO: Implement get memories in MemoryCore
    return {
      success: false,
      error: 'Get memories not yet implemented',
    };
  }

  private async createEntity(
    request: AuthenticatedRequest,
    _reply: FastifyReply
  ): Promise<ApiResponse> {
    const { name, entity_type, ...options } = request.body as any;

    const result = await this.memoryCore!.createEntity(name, entity_type as EntityType, {
      userId: request.user!.id,
      ...options,
      importance: (options.importance as ImportanceLevel) || ImportanceLevel.MEDIUM,
    });

    return {
      success: result.status === 'success',
      data: result.data,
      message: result.message,
      error: result.error,
    };
  }

  private async searchEntities(
    request: AuthenticatedRequest,
    _reply: FastifyReply
  ): Promise<ApiResponse> {
    const { query, limit } = request.query as any;

    const result = await this.memoryCore!.searchEntities(query, {
      userId: request.user!.id,
      limit: limit ? parseInt(limit) : 10,
    });

    return {
      success: result.status === 'success',
      data: result.data,
      message: result.message,
      error: result.error,
    };
  }

  private async getEntities(
    _request: AuthenticatedRequest,
    _reply: FastifyReply
  ): Promise<ApiResponse> {
    // TODO: Implement get entities in MemoryCore
    return {
      success: false,
      error: 'Get entities not yet implemented',
    };
  }

  private async unifiedSearch(
    request: AuthenticatedRequest,
    _reply: FastifyReply
  ): Promise<ApiResponse> {
    const { query, limit, threshold, memory_types, entity_types } = request.query as any;

    const memoryTypesArray = memory_types
      ? memory_types.split(',').map((t: string) => t.trim() as MemoryType)
      : undefined;

    const entityTypesArray = entity_types
      ? entity_types.split(',').map((t: string) => t.trim() as EntityType)
      : undefined;

    const result = await this.memoryCore!.unifiedSearch(query, {
      query,
      userId: request.user!.id,
      limit: limit ? parseInt(limit) : 10,
      threshold: threshold ? parseFloat(threshold) : 0.7,
      memoryTypes: memoryTypesArray,
      entityTypes: entityTypesArray,
    });

    return {
      success: result.status === 'success',
      data: result.data,
      message: result.message,
      error: result.error,
    };
  }

  private async getStatistics(
    request: AuthenticatedRequest,
    _reply: FastifyReply
  ): Promise<ApiResponse> {
    const result = await this.memoryCore!.getStatistics(request.user!.id);

    return {
      success: result.status === 'success',
      data: result.data,
      message: result.message,
      error: result.error,
    };
  }

  private async createUser(request: FastifyRequest, _reply: FastifyReply): Promise<ApiResponse> {
    const userData = request.body as any;

    const result = await this.memoryCore!.createUser(userData);

    return {
      success: result.status === 'success',
      data: result.data,
      message: result.message,
      error: result.error,
    };
  }

  async start(): Promise<void> {
    try {
      // Initialize database and memory core
      const db = initDatabaseFromEnv();
      this.memoryCore = new MemoryCore(db, process.env.OPENAI_API_KEY);
      await this.memoryCore.initialize();

      // Start the server
      await this.fastify.listen({ port: this.port, host: this.host });
      this.fastify.log.info(`API server listening on ${this.host}:${this.port}`);
    } catch (error) {
      this.fastify.log.error('Failed to start API server: %s', String(error));
      process.exit(1);
    }
  }

  async stop(): Promise<void> {
    if (this.memoryCore) {
      await this.memoryCore.close();
    }
    await this.fastify.close();
  }
}

// Start the server if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const port = process.env.PORT ? parseInt(process.env.PORT) : 3000;
  const host = process.env.HOST || '0.0.0.0';

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
}

export { APIServer };
