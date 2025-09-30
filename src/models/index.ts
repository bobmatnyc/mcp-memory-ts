/**
 * Model exports for the MCP Memory Service
 */

// Schema exports
export * from './schemas.js';

// Utility functions for model operations
import { v4 as uuidv4 } from 'uuid';
import type { User, Entity, Memory, Interaction } from '../types/base.js';

/**
 * Create a new user with default values
 */
export function createUser(data: Partial<User>): User {
  const now = new Date().toISOString();
  return {
    id: data.id || uuidv4(),
    email: data.email || '',
    name: data.name,
    organization: data.organization,
    apiKey: data.apiKey,
    oauthProvider: data.oauthProvider,
    oauthId: data.oauthId,
    isActive: data.isActive ?? true,
    metadata: data.metadata,
    createdAt: data.createdAt || now,
    updatedAt: data.updatedAt || now,
  };
}

/**
 * Create a new entity with default values
 */
export function createEntity(data: Partial<Entity>): Omit<Entity, 'id'> {
  const now = new Date().toISOString();
  return {
    userId: data.userId,
    name: data.name || '',
    entityType: data.entityType!,
    personType: data.personType,
    description: data.description,
    company: data.company,
    title: data.title,
    email: data.email,
    phone: data.phone,
    address: data.address,
    website: data.website,
    socialMedia: data.socialMedia,
    notes: data.notes,
    importance: data.importance || 2,
    tags: data.tags,
    relationships: data.relationships,
    lastInteraction: data.lastInteraction,
    interactionCount: data.interactionCount || 0,
    metadata: data.metadata,
    createdAt: data.createdAt || now,
    updatedAt: data.updatedAt || now,
  };
}

/**
 * Create a new memory with default values
 */
export function createMemory(data: Partial<Memory>): Omit<Memory, 'id'> {
  const now = new Date().toISOString();
  return {
    userId: data.userId,
    title: data.title || '',
    content: data.content || '',
    memoryType: data.memoryType!,
    importance: data.importance !== undefined ? data.importance as any : 0.5,
    tags: data.tags,
    entityIds: data.entityIds,
    embedding: data.embedding,
    metadata: data.metadata,
    isArchived: data.isArchived || false,
    createdAt: data.createdAt || now,
    updatedAt: data.updatedAt || now,
  };
}

/**
 * Create a new interaction with default values
 */
export function createInteraction(data: Partial<Interaction>): Omit<Interaction, 'id'> {
  const now = new Date().toISOString();
  return {
    userId: data.userId,
    userPrompt: data.userPrompt || '',
    assistantResponse: data.assistantResponse || '',
    context: data.context,
    feedback: data.feedback,
    sentiment: data.sentiment,
    metadata: data.metadata,
    createdAt: data.createdAt || now,
    updatedAt: data.updatedAt || now,
  };
}

/**
 * Generate a hash for API keys
 */
export async function hashApiKey(apiKey: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(apiKey);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Validate and sanitize tags
 */
export function sanitizeTags(tags?: string[]): string[] {
  if (!tags) return [];
  return tags
    .filter(tag => typeof tag === 'string' && tag.trim().length > 0)
    .map(tag => tag.trim().toLowerCase())
    .filter((tag, index, arr) => arr.indexOf(tag) === index); // Remove duplicates
}

/**
 * Parse metadata safely
 */
export function parseMetadata(metadata?: string | Record<string, unknown>): Record<string, unknown> {
  if (!metadata) return {};
  if (typeof metadata === 'object') return metadata;
  try {
    return JSON.parse(metadata) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/**
 * Stringify metadata safely
 */
export function stringifyMetadata(metadata?: Record<string, unknown>): string {
  if (!metadata) return '{}';
  try {
    return JSON.stringify(metadata);
  } catch {
    return '{}';
  }
}
