/**
 * MCP tool definitions and schemas
 */

import type { MCPTool } from './types.js';

export const MCP_TOOLS: MCPTool[] = [
  {
    name: 'memory_add',
    description: 'Add a new memory to the database with optional vector embedding',
    inputSchema: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Title or summary of the memory',
        },
        content: {
          type: 'string',
          description: 'Detailed content of the memory',
        },
        memory_type: {
          type: 'string',
          enum: [
            'SYSTEM',
            'LEARNED',
            'MEMORY',
            'biographical',
            'professional',
            'personal',
            'technical',
            'project',
            'interaction',
            'preference',
          ],
          description: 'Type of memory',
          default: 'MEMORY',
        },
        importance: {
          type: 'integer',
          minimum: 1,
          maximum: 4,
          description: 'Importance level (1=low, 2=medium, 3=high, 4=critical)',
          default: 2,
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Tags for categorization',
        },
        entity_ids: {
          type: 'array',
          items: { type: 'integer' },
          description: 'IDs of related entities',
        },
      },
      required: ['title', 'content'],
    },
  },
  {
    name: 'memory_search',
    description: 'Search memories using text and vector similarity',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query',
        },
        limit: {
          type: 'integer',
          minimum: 1,
          maximum: 100,
          description: 'Maximum number of results',
          default: 10,
        },
        threshold: {
          type: 'number',
          minimum: 0,
          maximum: 1,
          description: 'Similarity threshold for vector search',
          default: 0.7,
        },
        memory_types: {
          type: 'array',
          items: {
            type: 'string',
            enum: [
              'SYSTEM',
              'LEARNED',
              'MEMORY',
              'biographical',
              'professional',
              'personal',
              'technical',
              'project',
              'interaction',
              'preference',
            ],
          },
          description: 'Filter by memory types',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'memory_delete',
    description: 'Delete a memory by ID',
    inputSchema: {
      type: 'object',
      properties: {
        memory_id: {
          type: ['integer', 'string'],
          description: 'ID of the memory to delete',
        },
      },
      required: ['memory_id'],
    },
  },
  {
    name: 'entity_create',
    description: 'Create a new entity (person, organization, project, etc.)',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Name of the entity',
        },
        entity_type: {
          type: 'string',
          enum: ['person', 'organization', 'project', 'concept', 'location', 'event'],
          description: 'Type of entity',
        },
        description: {
          type: 'string',
          description: 'Description of the entity',
        },
        company: {
          type: 'string',
          description: 'Company (for person entities)',
        },
        title: {
          type: 'string',
          description: 'Job title (for person entities)',
        },
        email: {
          type: 'string',
          description: 'Email address',
        },
        phone: {
          type: 'string',
          description: 'Phone number',
        },
        website: {
          type: 'string',
          description: 'Website URL',
        },
        importance: {
          type: 'integer',
          minimum: 1,
          maximum: 4,
          description: 'Importance level (1=low, 2=medium, 3=high, 4=critical)',
          default: 2,
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Tags for categorization',
        },
        notes: {
          type: 'string',
          description: 'Additional notes',
        },
      },
      required: ['name', 'entity_type'],
    },
  },
  {
    name: 'entity_search',
    description: 'Search entities by name, description, or other fields',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query',
        },
        limit: {
          type: 'integer',
          minimum: 1,
          maximum: 100,
          description: 'Maximum number of results',
          default: 10,
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'entity_update',
    description: 'Update an existing entity',
    inputSchema: {
      type: 'object',
      properties: {
        entity_id: {
          type: ['integer', 'string'],
          description: 'ID of the entity to update',
        },
        updates: {
          type: 'object',
          description: 'Fields to update',
          properties: {
            name: { type: 'string' },
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
      required: ['entity_id', 'updates'],
    },
  },
  {
    name: 'unified_search',
    description: 'Search across all data types (memories, entities, interactions)',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query',
        },
        limit: {
          type: 'integer',
          minimum: 1,
          maximum: 100,
          description: 'Maximum number of results',
          default: 10,
        },
        threshold: {
          type: 'number',
          minimum: 0,
          maximum: 1,
          description: 'Similarity threshold for vector search',
          default: 0.7,
        },
        memory_types: {
          type: 'array',
          items: {
            type: 'string',
            enum: [
              'SYSTEM',
              'LEARNED',
              'MEMORY',
              'biographical',
              'professional',
              'personal',
              'technical',
              'project',
              'interaction',
              'preference',
            ],
          },
          description: 'Filter by memory types',
        },
        entity_types: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['person', 'organization', 'project', 'concept', 'location', 'event'],
          },
          description: 'Filter by entity types',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_statistics',
    description: 'Get database statistics and health information',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'get_recent_interactions',
    description: 'Get recent interactions and conversation history',
    inputSchema: {
      type: 'object',
      properties: {
        limit: {
          type: 'integer',
          minimum: 1,
          maximum: 100,
          description: 'Maximum number of interactions to return',
          default: 10,
        },
      },
    },
  },
];
