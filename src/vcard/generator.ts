/**
 * Generate vCard text format from VCardData objects
 * Supports vCard 3.0 and 4.0 formats (RFC 2426 and RFC 6350)
 */

import { VCardVersion, type VCardData } from './types.js';

/**
 * Generate vCard text from VCardData objects
 */
export function generateVCard(
  cards: VCardData[],
  version: VCardVersion = VCardVersion.V4_0
): string {
  return cards.map(card => generateSingleVCard(card, version)).join('\n');
}

/**
 * Generate a single vCard
 */
function generateSingleVCard(card: VCardData, version: VCardVersion): string {
  const lines: string[] = [];

  // BEGIN
  lines.push('BEGIN:VCARD');

  // VERSION
  lines.push(`VERSION:${version}`);

  // FN (required)
  lines.push(formatLine('FN', card.fn));

  // N (structured name)
  if (card.n) {
    const n = card.n;
    const nameValue = [
      n.familyName || '',
      n.givenName || '',
      n.additionalNames || '',
      n.honorificPrefixes || '',
      n.honorificSuffixes || '',
    ].join(';');
    lines.push(formatLine('N', nameValue));
  }

  // EMAIL
  if (card.email && card.email.length > 0) {
    for (const email of card.email) {
      lines.push(formatLine('EMAIL', email));
    }
  }

  // TEL
  if (card.tel && card.tel.length > 0) {
    for (const tel of card.tel) {
      lines.push(formatLine('TEL', tel));
    }
  }

  // ADR
  if (card.adr && card.adr.length > 0) {
    for (const adr of card.adr) {
      const adrValue = [
        adr.poBox || '',
        adr.extendedAddress || '',
        adr.streetAddress || '',
        adr.locality || '',
        adr.region || '',
        adr.postalCode || '',
        adr.country || '',
      ].join(';');
      lines.push(formatLine('ADR', adrValue));
    }
  }

  // ORG
  if (card.org) {
    lines.push(formatLine('ORG', card.org));
  }

  // TITLE
  if (card.title) {
    lines.push(formatLine('TITLE', card.title));
  }

  // URL
  if (card.url && card.url.length > 0) {
    for (const url of card.url) {
      lines.push(formatLine('URL', url));
    }
  }

  // NOTE
  if (card.note) {
    lines.push(formatLine('NOTE', card.note));
  }

  // CATEGORIES
  if (card.categories && card.categories.length > 0) {
    lines.push(formatLine('CATEGORIES', card.categories.join(',')));
  }

  // MCP custom properties (X- prefix)
  if (card['x-mcp-uuid']) {
    lines.push(formatLine('X-MCP-UUID', card['x-mcp-uuid']));
  }

  if (card['x-mcp-entity-type']) {
    lines.push(formatLine('X-MCP-ENTITY-TYPE', card['x-mcp-entity-type']));
  }

  if (card['x-mcp-person-type']) {
    lines.push(formatLine('X-MCP-PERSON-TYPE', card['x-mcp-person-type']));
  }

  if (card['x-mcp-importance'] !== undefined) {
    lines.push(formatLine('X-MCP-IMPORTANCE', String(card['x-mcp-importance'])));
  }

  if (card['x-mcp-social-media']) {
    lines.push(formatLine('X-MCP-SOCIAL-MEDIA', card['x-mcp-social-media']));
  }

  if (card['x-mcp-relationships']) {
    lines.push(formatLine('X-MCP-RELATIONSHIPS', card['x-mcp-relationships']));
  }

  if (card['x-mcp-last-interaction']) {
    lines.push(formatLine('X-MCP-LAST-INTERACTION', card['x-mcp-last-interaction']));
  }

  if (card['x-mcp-interaction-count'] !== undefined) {
    lines.push(formatLine('X-MCP-INTERACTION-COUNT', String(card['x-mcp-interaction-count'])));
  }

  // END
  lines.push('END:VCARD');

  return lines.join('\n');
}

/**
 * Format a vCard line with proper escaping and folding
 */
function formatLine(property: string, value: string): string {
  const escapedValue = escapeValue(value);
  const line = `${property}:${escapedValue}`;

  // Fold line if it exceeds 75 characters (RFC 6350 section 3.2)
  return foldLine(line);
}

/**
 * Escape vCard value (RFC 6350 section 3.3)
 */
function escapeValue(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

/**
 * Fold long lines (RFC 6350 section 3.2)
 * Lines should be folded at 75 characters
 */
function foldLine(line: string, maxLength: number = 75): string {
  if (line.length <= maxLength) {
    return line;
  }

  const folded: string[] = [];
  let remaining = line;

  while (remaining.length > maxLength) {
    folded.push(remaining.slice(0, maxLength));
    remaining = ' ' + remaining.slice(maxLength);
    maxLength = 74; // Account for leading space
  }

  if (remaining.length > 0) {
    folded.push(remaining);
  }

  return folded.join('\n');
}
