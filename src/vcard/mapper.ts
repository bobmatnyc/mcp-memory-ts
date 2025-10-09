/**
 * Field mapping and validation utilities for vCard <-> Entity conversion
 */

import type { Entity } from '../types/base.js';
import { EntityType, ImportanceLevel } from '../types/enums.js';
import { VCardVersion, type VCardData } from './types.js';

/**
 * Map Entity to VCardData
 */
export function entityToVCard(entity: Entity): VCardData {
  const vcard: VCardData = {
    version: VCardVersion.V4_0,
    fn: entity.name,
  };

  // Parse name if possible (simple heuristic)
  const nameParts = entity.name.split(' ');
  if (nameParts.length > 1) {
    vcard.n = {
      givenName: nameParts[0],
      familyName: nameParts.slice(1).join(' '),
    };
  } else {
    vcard.n = {
      givenName: entity.name,
    };
  }

  // Map standard fields
  if (entity.email) vcard.email = [entity.email];
  if (entity.phone) vcard.tel = [entity.phone];
  if (entity.address) {
    vcard.adr = [
      {
        streetAddress: entity.address,
      },
    ];
  }
  if (entity.company) vcard.org = entity.company;
  if (entity.title) vcard.title = entity.title;
  if (entity.website) vcard.url = [entity.website];
  if (entity.notes) vcard.note = entity.notes;
  if (entity.tags && entity.tags.length > 0) vcard.categories = entity.tags;

  // Map MCP custom properties
  if (entity.id) vcard['x-mcp-uuid'] = String(entity.id);
  vcard['x-mcp-entity-type'] = entity.entityType;
  if (entity.personType) vcard['x-mcp-person-type'] = entity.personType;
  vcard['x-mcp-importance'] = entity.importance;
  if (entity.socialMedia) vcard['x-mcp-social-media'] = entity.socialMedia;
  if (entity.relationships) vcard['x-mcp-relationships'] = entity.relationships;
  if (entity.lastInteraction) vcard['x-mcp-last-interaction'] = entity.lastInteraction;
  if (entity.interactionCount) vcard['x-mcp-interaction-count'] = entity.interactionCount;

  return vcard;
}

/**
 * Map VCardData to Entity
 */
export function vcardToEntity(
  vcard: VCardData,
  userId: string,
  overrides?: Partial<Entity>
): Omit<Entity, 'id' | 'createdAt' | 'updatedAt'> {
  const entity: Omit<Entity, 'id' | 'createdAt' | 'updatedAt'> = {
    userId,
    name: vcard.fn,
    entityType: overrides?.entityType || vcard['x-mcp-entity-type'] || EntityType.PERSON,
    personType: overrides?.personType || vcard['x-mcp-person-type'],
    importance: overrides?.importance || vcard['x-mcp-importance'] || ImportanceLevel.MEDIUM,
    interactionCount: vcard['x-mcp-interaction-count'] || 0,
  };

  // Map standard fields
  if (vcard.email && vcard.email.length > 0) {
    entity.email = vcard.email[0];
  }
  if (vcard.tel && vcard.tel.length > 0) {
    entity.phone = vcard.tel[0];
  }
  if (vcard.adr && vcard.adr.length > 0) {
    const addr = vcard.adr[0];
    const addressParts: string[] = [];
    if (addr.streetAddress) addressParts.push(addr.streetAddress);
    if (addr.locality) addressParts.push(addr.locality);
    if (addr.region) addressParts.push(addr.region);
    if (addr.postalCode) addressParts.push(addr.postalCode);
    if (addr.country) addressParts.push(addr.country);
    entity.address = addressParts.join(', ');
  }
  if (vcard.org) entity.company = vcard.org;
  if (vcard.title) entity.title = vcard.title;
  if (vcard.url && vcard.url.length > 0) {
    entity.website = vcard.url[0];
  }
  if (vcard.note) entity.notes = vcard.note;
  if (vcard.categories && vcard.categories.length > 0) {
    entity.tags = vcard.categories;
  }

  // Map MCP custom properties
  if (vcard['x-mcp-social-media']) entity.socialMedia = vcard['x-mcp-social-media'];
  if (vcard['x-mcp-relationships']) entity.relationships = vcard['x-mcp-relationships'];
  if (vcard['x-mcp-last-interaction']) entity.lastInteraction = vcard['x-mcp-last-interaction'];

  // Apply overrides
  if (overrides?.tags) {
    entity.tags = [...(entity.tags || []), ...overrides.tags];
  }

  return entity;
}

/**
 * Validate vCard data
 */
export function validateVCard(vcard: VCardData): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Required field: FN (Formatted Name)
  if (!vcard.fn || vcard.fn.trim().length === 0) {
    errors.push('FN (Formatted Name) is required');
  }

  // Validate email format if present
  if (vcard.email && vcard.email.length > 0) {
    for (const email of vcard.email) {
      if (!isValidEmail(email)) {
        errors.push(`Invalid email format: ${email}`);
      }
    }
  }

  // Validate URL format if present
  if (vcard.url && vcard.url.length > 0) {
    for (const url of vcard.url) {
      if (!isValidUrl(url)) {
        errors.push(`Invalid URL format: ${url}`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Simple email validation
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Simple URL validation
 */
function isValidUrl(url: string): boolean {
  try {
    // eslint-disable-next-line no-undef
    new URL(url);
    return true;
  } catch {
    return false;
  }
}
