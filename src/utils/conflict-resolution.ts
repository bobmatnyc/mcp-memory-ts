/**
 * Conflict Resolution Utility
 * Handles sync conflicts between MCP Memory and external sources
 */

import type { Entity } from '../types/base.js';
import type { VCardData } from '../vcard/types.js';

export type ConflictResolutionStrategy = 'newest' | 'oldest' | 'prompt' | 'merge';

export interface ConflictResolutionConfig {
  strategy: ConflictResolutionStrategy;
  autoMerge: boolean;
  preferredSource?: 'mcp' | 'external';
}

export interface SyncConflict {
  mcpEntity: Entity;
  externalContact: VCardData;
  mcpModified?: Date;
  externalModified?: Date;
}

export interface ConflictResolution {
  action: 'use_mcp' | 'use_external' | 'merge' | 'skip';
  mergedData?: Partial<Entity>;
  reasoning: string;
}

/**
 * Default conflict resolution configuration
 */
export const DEFAULT_CONFLICT_CONFIG: ConflictResolutionConfig = {
  strategy: 'newest',
  autoMerge: true,
  preferredSource: undefined,
};

/**
 * Resolve sync conflict between MCP entity and external contact
 */
export function resolveConflict(
  conflict: SyncConflict,
  config: ConflictResolutionConfig
): ConflictResolution {
  // If strategy is prompt, we can't auto-resolve
  if (config.strategy === 'prompt') {
    return {
      action: 'skip',
      reasoning: 'Manual resolution required (prompt strategy)',
    };
  }

  // Newest strategy: use the most recently modified
  if (config.strategy === 'newest') {
    return resolveByNewest(conflict);
  }

  // Oldest strategy: use the least recently modified
  if (config.strategy === 'oldest') {
    return resolveByOldest(conflict);
  }

  // Merge strategy: combine data from both sides
  if (config.strategy === 'merge' || config.autoMerge) {
    return resolveByMerge(conflict);
  }

  // Fallback: prefer MCP
  return {
    action: 'use_mcp',
    reasoning: 'Default: keeping MCP data',
  };
}

/**
 * Resolve by choosing the newest data
 */
function resolveByNewest(conflict: SyncConflict): ConflictResolution {
  const mcpTime = conflict.mcpModified || conflict.mcpEntity.updatedAt;
  const externalTime = conflict.externalModified;

  if (!mcpTime && !externalTime) {
    // No timestamps, merge instead
    return resolveByMerge(conflict);
  }

  if (!externalTime) {
    return {
      action: 'use_mcp',
      reasoning: 'MCP has timestamp, external does not',
    };
  }

  if (!mcpTime) {
    return {
      action: 'use_external',
      reasoning: 'External has timestamp, MCP does not',
    };
  }

  const mcpDate = typeof mcpTime === 'string' ? new Date(mcpTime) : mcpTime;
  const externalDate = typeof externalTime === 'string' ? new Date(externalTime) : externalTime;

  if (externalDate > mcpDate) {
    return {
      action: 'use_external',
      reasoning: `External is newer (${externalDate.toISOString()} > ${mcpDate.toISOString()})`,
    };
  } else if (mcpDate > externalDate) {
    return {
      action: 'use_mcp',
      reasoning: `MCP is newer (${mcpDate.toISOString()} > ${externalDate.toISOString()})`,
    };
  } else {
    // Same timestamp, merge
    return resolveByMerge(conflict);
  }
}

/**
 * Resolve by choosing the oldest data
 */
function resolveByOldest(conflict: SyncConflict): ConflictResolution {
  const mcpTime = conflict.mcpModified || conflict.mcpEntity.updatedAt;
  const externalTime = conflict.externalModified;

  if (!mcpTime && !externalTime) {
    // No timestamps, merge instead
    return resolveByMerge(conflict);
  }

  if (!externalTime) {
    return {
      action: 'use_mcp',
      reasoning: 'MCP has timestamp, external does not',
    };
  }

  if (!mcpTime) {
    return {
      action: 'use_external',
      reasoning: 'External has timestamp, MCP does not',
    };
  }

  const mcpDate = typeof mcpTime === 'string' ? new Date(mcpTime) : mcpTime;
  const externalDate = typeof externalTime === 'string' ? new Date(externalTime) : externalTime;

  if (externalDate < mcpDate) {
    return {
      action: 'use_external',
      reasoning: `External is older (${externalDate.toISOString()} < ${mcpDate.toISOString()})`,
    };
  } else if (mcpDate < externalDate) {
    return {
      action: 'use_mcp',
      reasoning: `MCP is older (${mcpDate.toISOString()} < ${externalDate.toISOString()})`,
    };
  } else {
    // Same timestamp, merge
    return resolveByMerge(conflict);
  }
}

/**
 * Resolve by merging data from both sides
 * Strategy: Take most complete/recent data for each field
 */
function resolveByMerge(conflict: SyncConflict): ConflictResolution {
  const mcp = conflict.mcpEntity;
  const ext = conflict.externalContact;

  const merged: Partial<Entity> = {
    // Always keep MCP's core fields
    id: mcp.id,
    userId: mcp.userId,
    entityType: mcp.entityType,
    createdAt: mcp.createdAt,
  };

  // Name: prefer external if different (user might have updated in Contacts)
  merged.name = ext.fn || mcp.name;

  // Email: collect unique emails
  const emails = new Set<string>();
  if (mcp.email) emails.add(mcp.email.toLowerCase());
  if (ext.email) ext.email.forEach(e => emails.add(e.toLowerCase()));
  merged.email = emails.size > 0 ? Array.from(emails)[0] : undefined;

  // Phone: collect unique phones
  const phones = new Set<string>();
  if (mcp.phone) phones.add(normalizePhone(mcp.phone));
  if (ext.tel) ext.tel.forEach(p => phones.add(normalizePhone(p)));
  merged.phone = phones.size > 0 ? Array.from(phones)[0] : undefined;

  // Organization: prefer non-empty
  merged.company = ext.org || mcp.company;

  // Title: prefer non-empty
  merged.title = ext.title || mcp.title;

  // Address: prefer external if present (more likely to be updated)
  if (ext.adr && ext.adr.length > 0) {
    const addr = ext.adr[0];
    merged.address = [addr.streetAddress, addr.locality, addr.region, addr.postalCode, addr.country]
      .filter(Boolean)
      .join(', ');
  } else {
    merged.address = mcp.address;
  }

  // Website: prefer non-empty
  merged.website = (ext.url && ext.url[0]) || mcp.website;

  // Notes: combine both if different
  const mcpNotes = mcp.notes?.trim() || '';
  const extNotes = ext.note?.trim() || '';
  if (mcpNotes && extNotes && mcpNotes !== extNotes) {
    merged.notes = `${mcpNotes}\n\n[From Contacts]: ${extNotes}`;
  } else {
    merged.notes = extNotes || mcpNotes || undefined;
  }

  // Tags: combine unique tags
  const tags = new Set<string>();
  if (mcp.tags) mcp.tags.forEach(t => tags.add(t));
  if (ext.categories) ext.categories.forEach(t => tags.add(t));
  merged.tags = tags.size > 0 ? Array.from(tags) : undefined;

  // MCP-specific fields: keep from MCP
  merged.personType = mcp.personType;
  merged.importance = mcp.importance;
  merged.socialMedia = mcp.socialMedia;
  merged.relationships = mcp.relationships;
  merged.lastInteraction = mcp.lastInteraction;
  merged.interactionCount = mcp.interactionCount;
  merged.metadata = mcp.metadata;

  // Update timestamp
  merged.updatedAt = new Date().toISOString();

  return {
    action: 'merge',
    mergedData: merged,
    reasoning: 'Merged data from both sources, preferring most complete information',
  };
}

/**
 * Normalize phone number for comparison
 */
function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

/**
 * Merge multiple email/phone arrays
 */
export function mergeContactArrays(
  mcpValues: string[] | undefined,
  externalValues: string[] | undefined
): string[] {
  const merged = new Set<string>();

  if (mcpValues) {
    mcpValues.forEach(v => merged.add(v.toLowerCase().trim()));
  }

  if (externalValues) {
    externalValues.forEach(v => merged.add(v.toLowerCase().trim()));
  }

  return Array.from(merged);
}

/**
 * Determine if two entities have conflicting data
 */
export function hasConflict(mcpEntity: Entity, externalContact: VCardData): boolean {
  // Check if key fields differ
  const conflicts: boolean[] = [];

  // Name differs
  if (externalContact.fn && mcpEntity.name !== externalContact.fn) {
    conflicts.push(true);
  }

  // Email differs
  if (
    externalContact.email &&
    externalContact.email.length > 0 &&
    mcpEntity.email !== externalContact.email[0]
  ) {
    conflicts.push(true);
  }

  // Phone differs
  if (
    externalContact.tel &&
    externalContact.tel.length > 0 &&
    mcpEntity.phone !== externalContact.tel[0]
  ) {
    conflicts.push(true);
  }

  // Organization differs
  if (externalContact.org && mcpEntity.company !== externalContact.org) {
    conflicts.push(true);
  }

  return conflicts.length > 0;
}

/**
 * Create a summary of changes between two contacts
 */
export interface ChangeSummary {
  field: string;
  mcpValue: string | undefined;
  externalValue: string | undefined;
  action: 'keep_mcp' | 'use_external' | 'merge';
}

export function summarizeChanges(
  mcpEntity: Entity,
  externalContact: VCardData,
  resolution: ConflictResolution
): ChangeSummary[] {
  const changes: ChangeSummary[] = [];

  // Helper to add change
  const addChange = (
    field: string,
    mcpVal: string | undefined,
    extVal: string | undefined,
    action: ChangeSummary['action']
  ) => {
    if (mcpVal !== extVal) {
      changes.push({
        field,
        mcpValue: mcpVal,
        externalValue: extVal,
        action,
      });
    }
  };

  const action: ChangeSummary['action'] =
    resolution.action === 'use_mcp'
      ? 'keep_mcp'
      : resolution.action === 'use_external'
        ? 'use_external'
        : 'merge';

  addChange('Name', mcpEntity.name, externalContact.fn, action);
  addChange('Email', mcpEntity.email, externalContact.email?.[0], action);
  addChange('Phone', mcpEntity.phone, externalContact.tel?.[0], action);
  addChange('Organization', mcpEntity.company, externalContact.org, action);
  addChange('Title', mcpEntity.title, externalContact.title, action);

  return changes;
}
