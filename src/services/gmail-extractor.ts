/**
 * Gmail Content Extractor
 *
 * Uses GPT-4 to analyze email content and extract:
 * - Facts and insights (memories)
 * - People, organizations, projects (entities)
 * - Important dates, events, decisions
 */

import OpenAI from 'openai';
import type { Email } from '../integrations/gmail-client.js';
import type { Memory, Entity } from '../types/base.js';

export interface ExtractedMemory {
  title: string;
  content: string;
  memory_type: 'SYSTEM' | 'LEARNED' | 'MEMORY';
  importance: number;
  tags: string[];
  entity_names?: string[];
  metadata?: {
    source: 'gmail';
    email_id?: string;
    email_date?: string;
    email_from?: string;
  };
}

export interface ExtractedEntity {
  name: string;
  entity_type: 'person' | 'organization' | 'project';
  person_type?: 'colleague' | 'friend' | 'family' | 'client' | 'vendor' | 'other';
  description?: string;
  company?: string;
  title?: string;
  email?: string;
  phone?: string;
  importance: number;
  tags: string[];
  notes?: string;
  metadata?: {
    source: 'gmail';
    first_mentioned?: string;
  };
}

export interface ExtractionResult {
  memories: ExtractedMemory[];
  entities: ExtractedEntity[];
  summary: string;
  emails_analyzed: number;
  processing_time_ms: number;
}

export class GmailExtractor {
  private openai: OpenAI;

  constructor(apiKey?: string) {
    this.openai = new OpenAI({
      apiKey: apiKey || process.env.OPENAI_API_KEY,
    });
  }

  /**
   * Extract memories and entities from a batch of emails
   */
  async extractFromEmails(
    emails: Email[],
    userId: string,
    batchSize = 10
  ): Promise<ExtractionResult> {
    const startTime = Date.now();

    if (emails.length === 0) {
      return {
        memories: [],
        entities: [],
        summary: 'No emails to process',
        emails_analyzed: 0,
        processing_time_ms: 0,
      };
    }

    console.log(`Extracting from ${emails.length} emails in batches of ${batchSize}...`);

    const allMemories: ExtractedMemory[] = [];
    const allEntities: ExtractedEntity[] = [];

    // Process in batches to avoid token limits
    for (let i = 0; i < emails.length; i += batchSize) {
      const batch = emails.slice(i, i + batchSize);
      console.log(
        `Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(emails.length / batchSize)}...`
      );

      try {
        const result = await this.extractFromBatch(batch);
        allMemories.push(...result.memories);
        allEntities.push(...result.entities);
      } catch (error) {
        console.error(`Failed to process batch ${i}-${i + batchSize}:`, error);
        // Continue with other batches
      }
    }

    // Deduplicate entities by name
    const uniqueEntities = this.deduplicateEntities(allEntities);

    const processingTime = Date.now() - startTime;

    return {
      memories: allMemories,
      entities: uniqueEntities,
      summary: this.generateSummary(allMemories, uniqueEntities, emails.length),
      emails_analyzed: emails.length,
      processing_time_ms: processingTime,
    };
  }

  /**
   * Extract from a single batch of emails
   */
  private async extractFromBatch(emails: Email[]): Promise<{
    memories: ExtractedMemory[];
    entities: ExtractedEntity[];
  }> {
    const emailSummaries = emails.map((email, idx) => ({
      index: idx,
      id: email.id,
      date: email.date.toISOString(),
      from: email.from,
      subject: email.subject,
      snippet: email.snippet,
      body: email.body.substring(0, 2000), // Limit to prevent token overload
    }));

    const prompt = this.buildExtractionPrompt(emailSummaries);

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          {
            role: 'system',
            content:
              'You are an expert at analyzing email content and extracting structured information about facts, insights, people, organizations, and projects. Return only valid JSON.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No content in GPT-4 response');
      }

      const parsed = JSON.parse(content);

      // Add metadata to each extracted item
      const memories: ExtractedMemory[] = (parsed.memories || []).map((m: any) => ({
        ...m,
        metadata: {
          source: 'gmail',
          ...m.metadata,
        },
      }));

      const entities: ExtractedEntity[] = (parsed.entities || []).map((e: any) => ({
        ...e,
        metadata: {
          source: 'gmail',
          ...e.metadata,
        },
      }));

      return { memories, entities };
    } catch (error) {
      console.error('GPT-4 extraction failed:', error);
      throw error;
    }
  }

  /**
   * Build extraction prompt for GPT-4
   */
  private buildExtractionPrompt(emailSummaries: any[]): string {
    return `Analyze these emails and extract structured information. Focus on:

1. **Memories (facts/insights)**: Important information, decisions, events, commitments, or learnings
2. **Entities**: People, organizations, or projects mentioned

**Emails to analyze:**
${JSON.stringify(emailSummaries, null, 2)}

**Instructions:**
- Extract only significant, actionable information
- For memories: Include context, why it matters, when it occurred
- For entities: Extract contact details if available
- Assign importance: 1=low, 2=medium, 3=high, 4=critical, 5=essential
- For memories: Use type MEMORY for facts/events, LEARNED for patterns/insights
- For entities: Choose appropriate type (person/organization/project) and person_type if applicable
- Add relevant tags for searchability
- Link entities to memories by including entity_names array in memories

**Return JSON with this exact structure:**
{
  "memories": [
    {
      "title": "Brief descriptive title",
      "content": "Detailed content with context",
      "memory_type": "MEMORY" | "LEARNED",
      "importance": 1-5,
      "tags": ["tag1", "tag2"],
      "entity_names": ["Person Name", "Organization Name"],
      "metadata": {
        "source": "gmail",
        "email_id": "email_id_if_single_source",
        "email_date": "ISO date",
        "email_from": "sender email"
      }
    }
  ],
  "entities": [
    {
      "name": "Full Name or Organization",
      "entity_type": "person" | "organization" | "project",
      "person_type": "colleague" | "friend" | "family" | "client" | "vendor" | "other",
      "description": "Brief description",
      "company": "Company name if person",
      "title": "Job title if person",
      "email": "email@example.com",
      "phone": "phone number",
      "importance": 1-5,
      "tags": ["tag1", "tag2"],
      "notes": "Additional context",
      "metadata": {
        "source": "gmail",
        "first_mentioned": "ISO date"
      }
    }
  ]
}

Focus on quality over quantity. Only extract truly meaningful information.`;
  }

  /**
   * Deduplicate entities by name (case-insensitive)
   */
  private deduplicateEntities(entities: ExtractedEntity[]): ExtractedEntity[] {
    const entityMap = new Map<string, ExtractedEntity>();

    for (const entity of entities) {
      const key = entity.name.toLowerCase().trim();

      if (!entityMap.has(key)) {
        entityMap.set(key, entity);
      } else {
        // Merge information from duplicate
        const existing = entityMap.get(key)!;

        // Keep higher importance
        if (entity.importance > existing.importance) {
          existing.importance = entity.importance;
        }

        // Merge tags
        const allTags = new Set([...existing.tags, ...entity.tags]);
        existing.tags = Array.from(allTags);

        // Update fields if not present
        existing.email = existing.email || entity.email;
        existing.phone = existing.phone || entity.phone;
        existing.company = existing.company || entity.company;
        existing.title = existing.title || entity.title;
        existing.description = existing.description || entity.description;

        // Merge notes
        if (entity.notes && !existing.notes?.includes(entity.notes)) {
          existing.notes = existing.notes ? `${existing.notes}\n${entity.notes}` : entity.notes;
        }
      }
    }

    return Array.from(entityMap.values());
  }

  /**
   * Generate summary of extraction results
   */
  private generateSummary(
    memories: ExtractedMemory[],
    entities: ExtractedEntity[],
    emailCount: number
  ): string {
    const people = entities.filter(e => e.entity_type === 'person').length;
    const orgs = entities.filter(e => e.entity_type === 'organization').length;
    const projects = entities.filter(e => e.entity_type === 'project').length;

    const highImportance = memories.filter(m => m.importance >= 4).length;

    return `Analyzed ${emailCount} emails. Extracted ${memories.length} memories (${highImportance} high-importance) and ${entities.length} entities (${people} people, ${orgs} organizations, ${projects} projects).`;
  }

  /**
   * Test OpenAI connection
   */
  async testConnection(): Promise<{ success: boolean; model?: string; error?: string }> {
    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 5,
      });

      return {
        success: true,
        model: response.model,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
