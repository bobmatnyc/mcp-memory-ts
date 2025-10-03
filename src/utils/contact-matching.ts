/**
 * Contact Matching Utility
 * UID-based matching and pairing logic for sync operations
 */

import type { Entity } from '../types/base.js';
import type { VCardData } from '../vcard/types.js';

export interface MatchResult {
  matched: MatchPair[];
  mcpUnmatched: Entity[];
  externalUnmatched: VCardData[];
}

export interface MatchPair {
  mcp: Entity;
  external: VCardData;
  matchType: 'uid' | 'email' | 'phone' | 'name';
  confidence: number; // 0-100
}

/**
 * Extract MCP UUID from vCard (stored in X-MCP-UUID or NOTE field)
 */
export function extractMcpUuid(vcard: VCardData): string | null {
  // First try X-MCP-UUID custom field
  if (vcard['x-mcp-uuid']) {
    return vcard['x-mcp-uuid'];
  }

  // Try to extract from NOTE field (format: [MCP-UUID: xxx-xxx-xxx])
  if (vcard.note) {
    const match = vcard.note.match(/\[MCP-UUID:\s*([^\]]+)\]/);
    if (match) {
      return match[1].trim();
    }
  }

  // Try raw properties
  if (vcard.raw && vcard.raw['X-MCP-UUID']) {
    const uuid = vcard.raw['X-MCP-UUID'];
    return typeof uuid === 'string' ? uuid : null;
  }

  return null;
}

/**
 * Match contacts by UUID first, then fall back to other matching strategies
 */
export function matchContacts(
  mcpEntities: Entity[],
  externalContacts: VCardData[]
): MatchResult {
  const matched: MatchPair[] = [];
  const mcpUnmatched: Entity[] = [];
  const externalUnmatched: VCardData[] = [];

  const mcpById = new Map<string, Entity>();
  const matchedMcpIds = new Set<string>();
  const matchedExternalIndices = new Set<number>();

  // Index MCP entities by ID
  for (const entity of mcpEntities) {
    if (entity.id) {
      mcpById.set(String(entity.id), entity);
    }
  }

  // Phase 1: Match by UUID
  for (let i = 0; i < externalContacts.length; i++) {
    const external = externalContacts[i];
    const uuid = extractMcpUuid(external);

    if (uuid && mcpById.has(uuid)) {
      const mcp = mcpById.get(uuid)!;
      matched.push({
        mcp,
        external,
        matchType: 'uid',
        confidence: 100,
      });
      matchedMcpIds.add(uuid);
      matchedExternalIndices.add(i);
    }
  }

  // Phase 2: Match by email (for unmatched contacts)
  for (let i = 0; i < externalContacts.length; i++) {
    if (matchedExternalIndices.has(i)) continue;

    const external = externalContacts[i];
    const externalEmail = external.email?.[0]?.toLowerCase().trim();

    if (externalEmail) {
      for (const entity of mcpEntities) {
        const entityId = String(entity.id);
        if (matchedMcpIds.has(entityId)) continue;

        const mcpEmail = entity.email?.toLowerCase().trim();
        if (mcpEmail && mcpEmail === externalEmail) {
          matched.push({
            mcp: entity,
            external,
            matchType: 'email',
            confidence: 95,
          });
          matchedMcpIds.add(entityId);
          matchedExternalIndices.add(i);
          break;
        }
      }
    }
  }

  // Phase 3: Match by phone (for still unmatched contacts)
  for (let i = 0; i < externalContacts.length; i++) {
    if (matchedExternalIndices.has(i)) continue;

    const external = externalContacts[i];
    const externalPhone = normalizePhone(external.tel?.[0]);

    if (externalPhone) {
      for (const entity of mcpEntities) {
        const entityId = String(entity.id);
        if (matchedMcpIds.has(entityId)) continue;

        const mcpPhone = normalizePhone(entity.phone);
        if (mcpPhone && mcpPhone === externalPhone) {
          matched.push({
            mcp: entity,
            external,
            matchType: 'phone',
            confidence: 90,
          });
          matchedMcpIds.add(entityId);
          matchedExternalIndices.add(i);
          break;
        }
      }
    }
  }

  // Phase 4: Match by exact name (for still unmatched contacts)
  for (let i = 0; i < externalContacts.length; i++) {
    if (matchedExternalIndices.has(i)) continue;

    const external = externalContacts[i];
    const externalName = external.fn.toLowerCase().trim();

    for (const entity of mcpEntities) {
      const entityId = String(entity.id);
      if (matchedMcpIds.has(entityId)) continue;

      const mcpName = entity.name.toLowerCase().trim();
      if (mcpName === externalName) {
        matched.push({
          mcp: entity,
          external,
          matchType: 'name',
          confidence: 70,
        });
        matchedMcpIds.add(entityId);
        matchedExternalIndices.add(i);
        break;
      }
    }
  }

  // Collect unmatched
  for (const entity of mcpEntities) {
    const entityId = String(entity.id);
    if (!matchedMcpIds.has(entityId)) {
      mcpUnmatched.push(entity);
    }
  }

  for (let i = 0; i < externalContacts.length; i++) {
    if (!matchedExternalIndices.has(i)) {
      externalUnmatched.push(externalContacts[i]);
    }
  }

  return {
    matched,
    mcpUnmatched,
    externalUnmatched,
  };
}

/**
 * Normalize phone number (strip non-digits)
 */
function normalizePhone(phone?: string): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 10 ? digits : null;
}

/**
 * Create pairs for LLM deduplication from unmatched contacts
 */
export interface PotentialDuplicatePair {
  mcpIndex: number;
  externalIndex: number;
  mcp: Entity;
  external: VCardData;
  preliminaryScore: number; // Initial score before LLM check
}

export function findPotentialDuplicates(
  mcpUnmatched: Entity[],
  externalUnmatched: VCardData[],
  maxPairsPerContact: number = 3
): PotentialDuplicatePair[] {
  const pairs: PotentialDuplicatePair[] = [];

  for (let i = 0; i < mcpUnmatched.length; i++) {
    const mcp = mcpUnmatched[i];
    const candidates: PotentialDuplicatePair[] = [];

    for (let j = 0; j < externalUnmatched.length; j++) {
      const external = externalUnmatched[j];
      const score = calculatePreliminaryScore(mcp, external);

      if (score > 20) {
        // Only consider if some similarity
        candidates.push({
          mcpIndex: i,
          externalIndex: j,
          mcp,
          external,
          preliminaryScore: score,
        });
      }
    }

    // Sort by score and take top N candidates
    candidates.sort((a, b) => b.preliminaryScore - a.preliminaryScore);
    pairs.push(...candidates.slice(0, maxPairsPerContact));
  }

  // Remove duplicates and sort by score
  const uniquePairs = new Map<string, PotentialDuplicatePair>();
  for (const pair of pairs) {
    const key = `${pair.mcpIndex}-${pair.externalIndex}`;
    if (!uniquePairs.has(key) || uniquePairs.get(key)!.preliminaryScore < pair.preliminaryScore) {
      uniquePairs.set(key, pair);
    }
  }

  return Array.from(uniquePairs.values()).sort((a, b) => b.preliminaryScore - a.preliminaryScore);
}

/**
 * Calculate preliminary similarity score (0-100) without LLM
 * Used to filter candidates before expensive LLM calls
 */
function calculatePreliminaryScore(mcp: Entity, external: VCardData): number {
  let score = 0;

  // Name similarity
  const mcpName = mcp.name.toLowerCase().trim();
  const extName = external.fn.toLowerCase().trim();

  if (mcpName === extName) {
    score += 50;
  } else if (namesOverlap(mcpName, extName)) {
    score += 30;
  } else if (nameInitialsMatch(mcpName, extName)) {
    score += 20;
  }

  // Email domain similarity
  const mcpEmail = mcp.email?.toLowerCase();
  const extEmail = external.email?.[0]?.toLowerCase();

  if (mcpEmail && extEmail) {
    const mcpDomain = mcpEmail.split('@')[1];
    const extDomain = extEmail.split('@')[1];

    if (mcpDomain && extDomain && mcpDomain === extDomain) {
      score += 20;
    }
  }

  // Organization match
  const mcpOrg = mcp.company?.toLowerCase().trim();
  const extOrg = external.org?.toLowerCase().trim();

  if (mcpOrg && extOrg && mcpOrg === extOrg) {
    score += 15;
  }

  // Phone similarity
  const mcpPhone = normalizePhone(mcp.phone);
  const extPhone = normalizePhone(external.tel?.[0]);

  if (mcpPhone && extPhone) {
    // Check if one is a substring of the other (e.g., with/without country code)
    if (mcpPhone.includes(extPhone) || extPhone.includes(mcpPhone)) {
      score += 10;
    }
  }

  // Title match
  const mcpTitle = mcp.title?.toLowerCase().trim();
  const extTitle = external.title?.toLowerCase().trim();

  if (mcpTitle && extTitle && mcpTitle === extTitle) {
    score += 5;
  }

  return Math.min(100, score);
}

/**
 * Check if names have overlapping parts
 */
function namesOverlap(name1: string, name2: string): boolean {
  const parts1 = name1.split(/\s+/).filter(p => p.length > 1);
  const parts2 = name2.split(/\s+/).filter(p => p.length > 1);

  for (const p1 of parts1) {
    for (const p2 of parts2) {
      if (p1 === p2) return true;
    }
  }

  return false;
}

/**
 * Check if name initials match (first + last)
 */
function nameInitialsMatch(name1: string, name2: string): boolean {
  const parts1 = name1.split(/\s+/).filter(Boolean);
  const parts2 = name2.split(/\s+/).filter(Boolean);

  if (parts1.length < 2 || parts2.length < 2) return false;

  const initials1 = parts1[0][0] + parts1[parts1.length - 1][0];
  const initials2 = parts2[0][0] + parts2[parts2.length - 1][0];

  return initials1 === initials2;
}

/**
 * Filter duplicate pairs by confidence threshold
 */
export function filterByConfidence(
  pairs: PotentialDuplicatePair[],
  minConfidence: number
): PotentialDuplicatePair[] {
  return pairs.filter(pair => pair.preliminaryScore >= minConfidence);
}

/**
 * Group duplicate pairs by MCP entity (one entity might match multiple external contacts)
 */
export function groupByMcpEntity(
  pairs: PotentialDuplicatePair[]
): Map<number, PotentialDuplicatePair[]> {
  const grouped = new Map<number, PotentialDuplicatePair[]>();

  for (const pair of pairs) {
    const existing = grouped.get(pair.mcpIndex) || [];
    existing.push(pair);
    grouped.set(pair.mcpIndex, existing);
  }

  return grouped;
}
