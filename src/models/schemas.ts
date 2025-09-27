/**
 * Zod schemas for validation and type safety
 */

import { z } from 'zod';
import {
  EntityType,
  PersonType,
  MemoryType,
  ImportanceLevel,
  BufferItemStatus,
  MCPToolResultStatus,
} from '../types/enums.js';

// Base schema
const baseEntitySchema = z.object({
  id: z.union([z.string(), z.number()]).optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

// User schema
export const userSchema = baseEntitySchema.extend({
  id: z.string(),
  email: z.string().email(),
  name: z.string().optional(),
  organization: z.string().optional(),
  apiKey: z.string().optional(),
  oauthProvider: z.string().optional(),
  oauthId: z.string().optional(),
  isActive: z.boolean().default(true),
  metadata: z.record(z.unknown()).optional(),
});

// Entity schema
export const entitySchema = baseEntitySchema.extend({
  userId: z.string().optional(),
  name: z.string().min(1, 'Name is required'),
  entityType: z.nativeEnum(EntityType),
  personType: z.nativeEnum(PersonType).optional(),
  description: z.string().optional(),
  company: z.string().optional(),
  title: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  website: z.string().url().optional(),
  socialMedia: z.string().optional(),
  notes: z.string().optional(),
  importance: z.nativeEnum(ImportanceLevel).default(ImportanceLevel.MEDIUM),
  tags: z.array(z.string()).optional(),
  relationships: z.string().optional(),
  lastInteraction: z.string().optional(),
  interactionCount: z.number().default(0),
  metadata: z.record(z.unknown()).optional(),
});

// Memory schema
export const memorySchema = baseEntitySchema.extend({
  userId: z.string().optional(),
  title: z.string().min(1, 'Title is required'),
  content: z.string().min(1, 'Content is required'),
  memoryType: z.nativeEnum(MemoryType).default(MemoryType.MEMORY),
  importance: z.nativeEnum(ImportanceLevel).default(ImportanceLevel.MEDIUM),
  tags: z.array(z.string()).optional(),
  entityIds: z.array(z.number()).optional(),
  embedding: z.array(z.number()).optional(),
  metadata: z.record(z.unknown()).optional(),
  isArchived: z.boolean().default(false),
});

// Interaction schema
export const interactionSchema = baseEntitySchema.extend({
  userId: z.string().optional(),
  userPrompt: z.string().min(1, 'User prompt is required'),
  assistantResponse: z.string().min(1, 'Assistant response is required'),
  context: z.string().optional(),
  feedback: z.string().optional(),
  sentiment: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

// Buffer item schema
export const bufferItemSchema = z.object({
  id: z.string(),
  type: z.enum(['memory', 'entity', 'interaction']),
  data: z.record(z.unknown()),
  status: z.nativeEnum(BufferItemStatus),
  priority: z.number().min(1).max(10),
  retryCount: z.number().default(0),
  maxRetries: z.number().default(3),
  createdAt: z.string(),
  processedAt: z.string().optional(),
  error: z.string().optional(),
});

// MCP Tool Result schema
export const mcpToolResultSchema = z.object({
  status: z.nativeEnum(MCPToolResultStatus),
  message: z.string(),
  data: z.unknown().optional(),
  error: z.string().optional(),
});

// Search options schema
export const vectorSearchOptionsSchema = z.object({
  query: z.string().min(1, 'Query is required'),
  limit: z.number().min(1).max(100).default(10),
  threshold: z.number().min(0).max(1).default(0.7),
  includeEmbedding: z.boolean().default(false),
  memoryTypes: z.array(z.nativeEnum(MemoryType)).optional(),
  entityTypes: z.array(z.nativeEnum(EntityType)).optional(),
});

// Database config schema
export const databaseConfigSchema = z.object({
  url: z.string().url(),
  authToken: z.string().min(1),
  syncUrl: z.string().url().optional(),
});

// API response schema
export const apiResponseSchema = z.object({
  success: z.boolean(),
  data: z.unknown().optional(),
  error: z.string().optional(),
  message: z.string().optional(),
});

// Input schemas for API endpoints
export const createMemoryInputSchema = memorySchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  embedding: true,
});

export const updateMemoryInputSchema = createMemoryInputSchema.partial();

export const createEntityInputSchema = entitySchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  interactionCount: true,
});

export const updateEntityInputSchema = createEntityInputSchema.partial();

export const createUserInputSchema = userSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateUserInputSchema = createUserInputSchema.partial();

// Type exports
export type UserInput = z.infer<typeof userSchema>;
export type EntityInput = z.infer<typeof entitySchema>;
export type MemoryInput = z.infer<typeof memorySchema>;
export type InteractionInput = z.infer<typeof interactionSchema>;
export type BufferItemInput = z.infer<typeof bufferItemSchema>;
export type MCPToolResultInput = z.infer<typeof mcpToolResultSchema>;
export type VectorSearchOptionsInput = z.infer<typeof vectorSearchOptionsSchema>;
export type DatabaseConfigInput = z.infer<typeof databaseConfigSchema>;
export type ApiResponseInput = z.infer<typeof apiResponseSchema>;

export type CreateMemoryInput = z.infer<typeof createMemoryInputSchema>;
export type UpdateMemoryInput = z.infer<typeof updateMemoryInputSchema>;
export type CreateEntityInput = z.infer<typeof createEntityInputSchema>;
export type UpdateEntityInput = z.infer<typeof updateEntityInputSchema>;
export type CreateUserInput = z.infer<typeof createUserInputSchema>;
export type UpdateUserInput = z.infer<typeof updateUserInputSchema>;
