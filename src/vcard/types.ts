/**
 * TypeScript interfaces for vCard data
 */

import type { Entity } from '../types/base.js';
import type { EntityType, PersonType, ImportanceLevel } from '../types/enums.js';

/**
 * vCard version
 */
export enum VCardVersion {
  V3_0 = '3.0',
  V4_0 = '4.0',
}

/**
 * Parsed vCard data structure
 */
export interface VCardData {
  version: VCardVersion;
  fn: string; // Formatted Name (required)
  n?: {
    familyName?: string;
    givenName?: string;
    additionalNames?: string;
    honorificPrefixes?: string;
    honorificSuffixes?: string;
  };
  email?: string[];
  tel?: string[];
  adr?: {
    poBox?: string;
    extendedAddress?: string;
    streetAddress?: string;
    locality?: string;
    region?: string;
    postalCode?: string;
    country?: string;
  }[];
  org?: string;
  title?: string;
  url?: string[];
  note?: string;
  categories?: string[];
  // Custom MCP properties (X- prefix)
  'x-mcp-uuid'?: string; // MCP entity UUID for sync matching
  'x-mcp-entity-type'?: EntityType;
  'x-mcp-person-type'?: PersonType;
  'x-mcp-importance'?: ImportanceLevel;
  'x-mcp-social-media'?: string;
  'x-mcp-relationships'?: string;
  'x-mcp-last-interaction'?: string;
  'x-mcp-interaction-count'?: number;
  // Raw properties for additional data
  raw?: Record<string, string | string[]>;
}

/**
 * vCard export options
 */
export interface VCardExportOptions {
  userId: string;
  outputPath?: string;
  entityType?: EntityType;
  version?: VCardVersion;
  includeAllTypes?: boolean;
}

/**
 * vCard import options
 */
export interface VCardImportOptions {
  userId: string;
  inputPath: string;
  entityType?: EntityType;
  personType?: PersonType;
  importance?: ImportanceLevel;
  tags?: string[];
  dryRun?: boolean;
  merge?: boolean;
}

/**
 * vCard import result
 */
export interface VCardImportResult {
  success: boolean;
  imported: number;
  updated: number;
  failed: number;
  errors: Array<{
    line: number;
    card: string;
    error: string;
  }>;
  entities: Entity[];
}
