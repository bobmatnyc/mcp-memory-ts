/**
 * Base types and interfaces for the MCP Memory Service
 */

import { z } from 'zod';
import {
  EntityType,
  PersonType,
  MemoryType,
  ImportanceLevel,
  BufferItemStatus,
  MCPToolResultStatus,
} from './enums.js';

// Base interface for all database entities
export interface BaseEntity {
  id?: string; // All IDs normalized to strings at database boundary
  createdAt?: string;
  updatedAt?: string;
}

// User interface for multi-tenant support
export interface User extends BaseEntity {
  id: string;
  email: string;
  name?: string;
  organization?: string;
  apiKey?: string; // Will be hashed when stored
  oauthProvider?: string;
  oauthId?: string;
  isActive: boolean;
  metadata?: Record<string, unknown>;
}

// Entity interface
export interface Entity extends BaseEntity {
  id?: string; // Normalized to string at database boundary
  userId?: string; // For multi-tenant support
  name: string;
  entityType: EntityType;
  personType?: PersonType;
  description?: string;
  company?: string;
  title?: string;
  email?: string;
  phone?: string;
  address?: string;
  website?: string;
  socialMedia?: string;
  notes?: string;
  importance: ImportanceLevel;
  tags?: string[];
  relationships?: string;
  lastInteraction?: string;
  interactionCount: number;
  metadata?: Record<string, unknown>;
}

// Memory interface
export interface Memory extends BaseEntity {
  id?: string; // Normalized to string at database boundary
  userId?: string; // For multi-tenant support
  title: string;
  content: string;
  memoryType: MemoryType;
  importance: ImportanceLevel;
  tags?: string[];
  entityIds?: number[];
  embedding?: number[]; // Vector embedding for semantic search
  metadata?: Record<string, unknown>;
  isArchived: boolean;
}

// Interaction interface
export interface Interaction extends BaseEntity {
  id?: string; // Normalized to string at database boundary
  userId?: string;
  userPrompt: string;
  assistantResponse: string;
  context?: string;
  feedback?: string;
  sentiment?: string;
  metadata?: Record<string, unknown>;
}

// Buffer item for async processing
export interface BufferItem {
  id: string;
  type: 'memory' | 'entity' | 'interaction';
  data: Record<string, unknown>;
  status: BufferItemStatus;
  priority: number;
  retryCount: number;
  maxRetries: number;
  createdAt: string;
  processedAt?: string;
  error?: string;
}

// MCP Tool Result
export interface MCPToolResult {
  status: MCPToolResultStatus;
  message: string;
  data?: unknown;
  error?: string;
}

// Search result interface
export interface SearchResult<T = unknown> {
  item: T;
  score: number;
  type: 'memory' | 'entity' | 'interaction';
}

// Search strategy types
export type SearchStrategy = 'recency' | 'frequency' | 'importance' | 'similarity' | 'composite';

// Vector search options
export interface VectorSearchOptions {
  query?: string;
  limit?: number;
  threshold?: number;
  strategy?: SearchStrategy;
  includeEmbedding?: boolean;
  memoryTypes?: MemoryType[];
  entityTypes?: EntityType[];
}

// Database connection options
export interface DatabaseConfig {
  url: string;
  authToken: string;
  syncUrl?: string;
}

// Memory creation options
export interface AddMemoryOptions {
  userId?: string;
  importance?: ImportanceLevel | number;
  tags?: string[];
  entityIds?: number[];
  metadata?: Record<string, unknown>;
  /**
   * Embedding generation mode:
   * - `true` or `'sync'`: Generate embedding synchronously (blocks until complete, ~500-2000ms)
   * - `'async'`: Create memory immediately, queue embedding generation in background (~50ms response)
   * - `false`: Skip embedding generation entirely
   *
   * @default 'sync' (backward compatible)
   */
  generateEmbedding?: boolean | 'sync' | 'async';
}

// API response wrapper
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
