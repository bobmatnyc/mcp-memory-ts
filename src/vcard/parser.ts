/**
 * Parse vCard from text format to VCardData objects
 * Supports vCard 3.0 and 4.0 formats (RFC 2426 and RFC 6350)
 */

import { VCardVersion, type VCardData } from './types.js';
import { EntityType, PersonType, ImportanceLevel } from '../types/enums.js';

/**
 * Parse vCard text into VCardData objects
 */
export function parseVCard(vcardText: string): VCardData[] {
  const cards: VCardData[] = [];
  const lines = unfoldLines(vcardText.split(/\r?\n/));

  let currentCard: Partial<VCardData> | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (line === '') continue;

    if (line === 'BEGIN:VCARD') {
      currentCard = {
        version: VCardVersion.V3_0,
        raw: {},
      };
      continue;
    }

    if (line === 'END:VCARD') {
      if (currentCard && currentCard.fn) {
        cards.push(currentCard as VCardData);
      }
      currentCard = null;
      continue;
    }

    if (!currentCard) continue;

    const { property, parameters, value } = parseLine(line);

    switch (property.toUpperCase()) {
      case 'VERSION':
        currentCard.version = value as VCardVersion;
        break;

      case 'FN':
        currentCard.fn = value;
        break;

      case 'N':
        currentCard.n = parseStructuredName(value);
        break;

      case 'EMAIL':
        if (!currentCard.email) currentCard.email = [];
        currentCard.email.push(value);
        break;

      case 'TEL':
        if (!currentCard.tel) currentCard.tel = [];
        currentCard.tel.push(value);
        break;

      case 'ADR':
        if (!currentCard.adr) currentCard.adr = [];
        currentCard.adr.push(parseStructuredAddress(value));
        break;

      case 'ORG':
        currentCard.org = value;
        break;

      case 'TITLE':
        currentCard.title = value;
        break;

      case 'URL':
        if (!currentCard.url) currentCard.url = [];
        currentCard.url.push(value);
        break;

      case 'NOTE':
        currentCard.note = value;
        break;

      case 'CATEGORIES':
        currentCard.categories = value.split(',').map(c => c.trim());
        break;

      // MCP custom properties
      case 'X-MCP-ENTITY-TYPE':
        currentCard['x-mcp-entity-type'] = value as EntityType;
        break;

      case 'X-MCP-PERSON-TYPE':
        currentCard['x-mcp-person-type'] = value as PersonType;
        break;

      case 'X-MCP-IMPORTANCE':
        const importance = parseInt(value, 10);
        if (!isNaN(importance) && importance >= 1 && importance <= 4) {
          currentCard['x-mcp-importance'] = importance as ImportanceLevel;
        }
        break;

      case 'X-MCP-SOCIAL-MEDIA':
        currentCard['x-mcp-social-media'] = value;
        break;

      case 'X-MCP-RELATIONSHIPS':
        currentCard['x-mcp-relationships'] = value;
        break;

      case 'X-MCP-LAST-INTERACTION':
        currentCard['x-mcp-last-interaction'] = value;
        break;

      case 'X-MCP-INTERACTION-COUNT':
        const count = parseInt(value, 10);
        if (!isNaN(count)) {
          currentCard['x-mcp-interaction-count'] = count;
        }
        break;

      default:
        // Store unknown properties in raw
        if (!currentCard.raw) currentCard.raw = {};
        currentCard.raw[property] = value;
        break;
    }
  }

  return cards;
}

/**
 * Unfold lines (vCard spec allows line folding with CRLF + space/tab)
 */
function unfoldLines(lines: string[]): string[] {
  const unfolded: string[] = [];
  let current = '';

  for (const line of lines) {
    if (line.startsWith(' ') || line.startsWith('\t')) {
      // Continuation of previous line
      current += line.slice(1);
    } else {
      if (current) {
        unfolded.push(current);
      }
      current = line;
    }
  }

  if (current) {
    unfolded.push(current);
  }

  return unfolded;
}

/**
 * Parse a vCard line into property, parameters, and value
 */
function parseLine(line: string): {
  property: string;
  parameters: Record<string, string>;
  value: string;
} {
  const colonIndex = line.indexOf(':');
  if (colonIndex === -1) {
    return { property: '', parameters: {}, value: line };
  }

  const beforeColon = line.slice(0, colonIndex);
  const value = unescapeValue(line.slice(colonIndex + 1));

  // Parse property and parameters
  const parts = beforeColon.split(';');
  const property = parts[0];
  const parameters: Record<string, string> = {};

  for (let i = 1; i < parts.length; i++) {
    const [key, val] = parts[i].split('=');
    if (key && val) {
      parameters[key.toLowerCase()] = val;
    }
  }

  return { property, parameters, value };
}

/**
 * Unescape vCard value (RFC 6350 section 3.3)
 */
function unescapeValue(value: string): string {
  return value
    .replace(/\\n/g, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\');
}

/**
 * Parse structured name (N property)
 * Format: family;given;additional;prefix;suffix
 */
function parseStructuredName(value: string): VCardData['n'] {
  const parts = value.split(';');
  return {
    familyName: parts[0] || undefined,
    givenName: parts[1] || undefined,
    additionalNames: parts[2] || undefined,
    honorificPrefixes: parts[3] || undefined,
    honorificSuffixes: parts[4] || undefined,
  };
}

/**
 * Parse structured address (ADR property)
 * Format: pobox;extended;street;locality;region;postal;country
 */
function parseStructuredAddress(value: string): NonNullable<VCardData['adr']>[0] {
  const parts = value.split(';');
  return {
    poBox: parts[0] || undefined,
    extendedAddress: parts[1] || undefined,
    streetAddress: parts[2] || undefined,
    locality: parts[3] || undefined,
    region: parts[4] || undefined,
    postalCode: parts[5] || undefined,
    country: parts[6] || undefined,
  };
}
