/**
 * Enums for the MCP Memory Service
 * Based on the Python implementation with TypeScript best practices
 */

export enum EntityType {
  PERSON = 'person',
  ORGANIZATION = 'organization',
  PROJECT = 'project',
  CONCEPT = 'concept',
  LOCATION = 'location',
  EVENT = 'event',
}

export enum PersonType {
  ME = 'me', // The privileged user
  FAMILY = 'family',
  FRIEND = 'friend',
  COLLEAGUE = 'colleague',
  CLIENT = 'client',
  OTHER = 'other',
}

export enum MemoryType {
  // 3-tier memory system (core)
  SYSTEM = 'SYSTEM', // Immutable system principles
  LEARNED = 'LEARNED', // Patterns learned from feedback
  MEMORY = 'MEMORY', // General interaction memories

  // Standard memory types
  BIOGRAPHICAL = 'biographical',
  PROFESSIONAL = 'professional',
  PERSONAL = 'personal',
  TECHNICAL = 'technical',
  PROJECT = 'project',
  INTERACTION = 'interaction',
  PREFERENCE = 'preference',
}

export enum ImportanceLevel {
  LOW = 1,
  MEDIUM = 2,
  HIGH = 3,
  CRITICAL = 4,
}

export enum BufferItemStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export enum MCPToolResultStatus {
  SUCCESS = 'success',
  ERROR = 'error',
  WARNING = 'warning',
}

// Validation functions
export const isValidEntityType = (type: string): type is EntityType => {
  return Object.values(EntityType).includes(type as EntityType);
};

export const isValidPersonType = (type: string): type is PersonType => {
  return Object.values(PersonType).includes(type as PersonType);
};

export const isValidMemoryType = (type: string): type is MemoryType => {
  return Object.values(MemoryType).includes(type as MemoryType);
};

export const isValidImportanceLevel = (level: number): level is ImportanceLevel => {
  return Object.values(ImportanceLevel).includes(level as ImportanceLevel);
};
