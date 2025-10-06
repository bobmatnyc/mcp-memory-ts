/**
 * LLM-based Deduplication Utility
 * Uses ChatGPT-4 to intelligently detect duplicate contacts
 */

import OpenAI from 'openai';
import type { Entity } from '../types/base.js';
import type { VCardData } from '../vcard/types.js';

export interface DeduplicationConfig {
  threshold: number; // Confidence threshold (0-100%)
  chatgptModel: string; // e.g., "gpt-4o", "gpt-4-turbo"
  enableLLMDeduplication: boolean;
  maxRetries: number;
  retryDelayMs: number;
}

export interface DuplicationCheckResult {
  confidence: number; // 0-100
  reasoning: string;
  isDuplicate: boolean;
}

export interface ContactPair {
  contact1: ContactInfo;
  contact2: ContactInfo;
}

export interface ContactInfo {
  name: string;
  email?: string;
  phone?: string;
  organization?: string;
  address?: string;
  title?: string;
}

/**
 * Default configuration for deduplication
 */
export const DEFAULT_DEDUP_CONFIG: DeduplicationConfig = {
  threshold: 90,
  chatgptModel: 'gpt-4o',
  enableLLMDeduplication: true,
  maxRetries: 3,
  retryDelayMs: 1000,
};

/**
 * Extract contact info from Entity
 */
export function entityToContactInfo(entity: Entity): ContactInfo {
  return {
    name: entity.name,
    email: entity.email,
    phone: entity.phone,
    organization: entity.company,
    address: entity.address,
    title: entity.title,
  };
}

/**
 * Extract contact info from VCardData
 */
export function vcardToContactInfo(vcard: VCardData): ContactInfo {
  return {
    name: vcard.fn,
    email: vcard.email?.[0],
    phone: vcard.tel?.[0],
    organization: vcard.org,
    address: vcard.adr?.[0]
      ? [
          vcard.adr[0].streetAddress,
          vcard.adr[0].locality,
          vcard.adr[0].region,
          vcard.adr[0].postalCode,
          vcard.adr[0].country,
        ]
          .filter(Boolean)
          .join(', ')
      : undefined,
    title: vcard.title,
  };
}

/**
 * Format contact info for LLM prompt
 */
function formatContactForPrompt(contact: ContactInfo): string {
  const parts: string[] = [];
  parts.push(`Name: ${contact.name}`);
  if (contact.email) parts.push(`Email: ${contact.email}`);
  if (contact.phone) parts.push(`Phone: ${contact.phone}`);
  if (contact.organization) parts.push(`Organization: ${contact.organization}`);
  if (contact.title) parts.push(`Title: ${contact.title}`);
  if (contact.address) parts.push(`Address: ${contact.address}`);
  return parts.join('\n');
}

/**
 * Build ChatGPT prompt for duplicate detection
 */
function buildDuplicationPrompt(contact1: ContactInfo, contact2: ContactInfo): string {
  return `Compare these two contacts and determine if they represent the same person.
Return ONLY a JSON object with this exact format (no markdown, no code blocks):
{
  "confidence": <0-100>,
  "reasoning": "<brief explanation>",
  "isDuplicate": <true/false>
}

Contact A:
${formatContactForPrompt(contact1)}

Contact B:
${formatContactForPrompt(contact2)}

Consider:
- Name variations (nicknames, middle names, maiden names, initials)
- Email domain matches (same company/organization)
- Phone number formatting differences
- Similar organizations or titles
- Address proximity

Confidence scale:
- 100: Exact match (same email or phone)
- 90-99: Very likely same person (multiple matching fields)
- 70-89: Probably same person (name match + one other field)
- 50-69: Possibly same person (similar name)
- 0-49: Probably different people`;
}

/**
 * Sleep utility for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Check if two contacts are duplicates using ChatGPT-4
 */
export async function checkDuplication(
  pair: ContactPair,
  config: DeduplicationConfig,
  openaiApiKey: string
): Promise<DuplicationCheckResult> {
  if (!config.enableLLMDeduplication) {
    // Fallback to simple exact match
    return simpleDuplicationCheck(pair.contact1, pair.contact2);
  }

  const openai = new OpenAI({ apiKey: openaiApiKey });
  const prompt = buildDuplicationPrompt(pair.contact1, pair.contact2);

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < config.maxRetries; attempt++) {
    try {
      const response = await openai.chat.completions.create({
        model: config.chatgptModel,
        messages: [
          {
            role: 'system',
            content:
              'You are a contact deduplication expert. Analyze contact pairs and return ONLY valid JSON.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.1, // Low temperature for consistent results
        max_tokens: 200,
      });

      const content = response.choices[0]?.message?.content?.trim();
      if (!content) {
        throw new Error('Empty response from ChatGPT');
      }

      // Parse JSON response (strip markdown code blocks if present)
      let jsonText = content;
      if (content.startsWith('```')) {
        const match = content.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
        if (match) {
          jsonText = match[1];
        }
      }

      const result = JSON.parse(jsonText) as DuplicationCheckResult;

      // Validate result structure
      if (
        typeof result.confidence !== 'number' ||
        typeof result.reasoning !== 'string' ||
        typeof result.isDuplicate !== 'boolean'
      ) {
        throw new Error('Invalid response structure from ChatGPT');
      }

      // Ensure confidence is in valid range
      result.confidence = Math.max(0, Math.min(100, result.confidence));

      return result;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // If it's a rate limit error, wait longer
      if (lastError.message.includes('rate_limit') || lastError.message.includes('429')) {
        const backoffDelay = config.retryDelayMs * Math.pow(2, attempt);
        console.warn(`Rate limited, retrying in ${backoffDelay}ms...`);
        await sleep(backoffDelay);
      } else if (attempt < config.maxRetries - 1) {
        // For other errors, use standard retry delay
        await sleep(config.retryDelayMs);
      }
    }
  }

  // If all retries failed, fall back to simple check
  console.warn(
    `LLM deduplication failed after ${config.maxRetries} attempts: ${lastError?.message}. Falling back to simple check.`
  );
  return simpleDuplicationCheck(pair.contact1, pair.contact2);
}

/**
 * Simple rule-based duplicate detection (fallback)
 */
export function simpleDuplicationCheck(
  contact1: ContactInfo,
  contact2: ContactInfo
): DuplicationCheckResult {
  let confidence = 0;
  const reasons: string[] = [];

  // Exact email match = 100% confidence
  if (
    contact1.email &&
    contact2.email &&
    contact1.email.toLowerCase() === contact2.email.toLowerCase()
  ) {
    return {
      confidence: 100,
      reasoning: 'Exact email match',
      isDuplicate: true,
    };
  }

  // Exact phone match (normalize first)
  const phone1 = normalizePhone(contact1.phone);
  const phone2 = normalizePhone(contact2.phone);
  if (phone1 && phone2 && phone1 === phone2) {
    return {
      confidence: 100,
      reasoning: 'Exact phone match',
      isDuplicate: true,
    };
  }

  // Name similarity
  const name1 = contact1.name.toLowerCase().trim();
  const name2 = contact2.name.toLowerCase().trim();

  if (name1 === name2) {
    confidence += 50;
    reasons.push('Exact name match');
  } else if (namesAreSimilar(name1, name2)) {
    confidence += 30;
    reasons.push('Similar name');
  }

  // Email domain match
  if (contact1.email && contact2.email) {
    const domain1 = contact1.email.split('@')[1]?.toLowerCase();
    const domain2 = contact2.email.split('@')[1]?.toLowerCase();
    if (domain1 && domain2 && domain1 === domain2) {
      confidence += 20;
      reasons.push('Same email domain');
    }
  }

  // Organization match
  if (contact1.organization && contact2.organization) {
    if (contact1.organization.toLowerCase().trim() === contact2.organization.toLowerCase().trim()) {
      confidence += 15;
      reasons.push('Same organization');
    }
  }

  // Title match
  if (contact1.title && contact2.title) {
    if (contact1.title.toLowerCase().trim() === contact2.title.toLowerCase().trim()) {
      confidence += 10;
      reasons.push('Same title');
    }
  }

  return {
    confidence: Math.min(100, confidence),
    reasoning: reasons.length > 0 ? reasons.join(', ') : 'No significant matches',
    isDuplicate: confidence >= 70,
  };
}

/**
 * Normalize phone number (remove non-digits)
 */
function normalizePhone(phone?: string): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  // Return null if too short to be a valid phone
  return digits.length >= 10 ? digits : null;
}

/**
 * Check if two names are similar (handles common variations)
 */
function namesAreSimilar(name1: string, name2: string): boolean {
  // Split into parts
  const parts1 = name1.split(/\s+/).filter(Boolean);
  const parts2 = name2.split(/\s+/).filter(Boolean);

  // If either name is a single word, check if it's contained in the other
  if (parts1.length === 1 || parts2.length === 1) {
    return parts1.some(p1 => parts2.some(p2 => p1.includes(p2) || p2.includes(p1)));
  }

  // Check if first and last names match (allowing for middle names/initials)
  const first1 = parts1[0];
  const last1 = parts1[parts1.length - 1];
  const first2 = parts2[0];
  const last2 = parts2[parts2.length - 1];

  // First initial match + last name match
  if (first1[0] === first2[0] && last1 === last2) {
    return true;
  }

  // First name match + last initial match
  if (first1 === first2 && last1[0] === last2[0]) {
    return true;
  }

  return false;
}

/**
 * Batch check multiple contact pairs for duplicates
 */
export async function batchCheckDuplicates(
  pairs: ContactPair[],
  config: DeduplicationConfig,
  openaiApiKey: string,
  onProgress?: (current: number, total: number) => void
): Promise<DuplicationCheckResult[]> {
  const results: DuplicationCheckResult[] = [];

  for (let i = 0; i < pairs.length; i++) {
    const result = await checkDuplication(pairs[i], config, openaiApiKey);
    results.push(result);

    if (onProgress) {
      onProgress(i + 1, pairs.length);
    }

    // Add small delay to avoid rate limiting
    if (i < pairs.length - 1 && config.enableLLMDeduplication) {
      await sleep(200);
    }
  }

  return results;
}
