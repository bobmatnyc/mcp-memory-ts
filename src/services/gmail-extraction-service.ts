/**
 * Gmail Extraction Service
 *
 * Orchestrates the weekly extraction process:
 * 1. Checks if week already extracted
 * 2. Fetches emails from Gmail
 * 3. Extracts content with GPT-4
 * 4. Saves to database
 * 5. Tracks extraction progress
 */

import { randomUUID } from 'crypto';
import {
  GmailClient,
  getWeekDates,
  getCurrentWeekIdentifier,
} from '../integrations/gmail-client.js';
import { GmailExtractor } from './gmail-extractor.js';
import type { ExtractedMemory, ExtractedEntity } from './gmail-extractor.js';
import { DatabaseConnection } from '../database/connection.js';
import { MemoryCore } from '../core/memory-core.js';
import type { Memory, Entity } from '../types/base.js';
import { EntityType } from '../types/enums.js';

export interface ExtractionLog {
  id: string;
  user_id: string;
  week_identifier: string;
  start_date: string;
  end_date: string;
  emails_processed: number;
  memories_created: number;
  entities_created: number;
  status: 'processing' | 'completed' | 'failed';
  error_message?: string;
  created_at: string;
  completed_at?: string;
}

export interface ExtractionResult {
  success: boolean;
  skipped?: boolean;
  reason?: string;
  log?: ExtractionLog;
  memories_created?: number;
  entities_created?: number;
  emails_processed?: number;
  summary?: string;
  error?: string;
}

export class GmailExtractionService {
  private db: DatabaseConnection;
  private memoryCore: MemoryCore;

  constructor(db: DatabaseConnection, memoryCore: MemoryCore) {
    this.db = db;
    this.memoryCore = memoryCore;
  }

  /**
   * Extract memories and entities from Gmail for a specific week
   */
  async extractWeek(
    userId: string,
    weekIdentifier: string,
    gmailAccessToken: string,
    openaiApiKey?: string
  ): Promise<ExtractionResult> {
    try {
      // 1. Check if week already extracted
      const existing = await this.checkExtractionLog(userId, weekIdentifier);
      if (existing) {
        console.log(`Week ${weekIdentifier} already extracted`);
        return {
          success: true,
          skipped: true,
          reason: 'Week already extracted',
          log: existing,
        };
      }

      // 2. Create extraction log entry
      const logId = await this.createExtractionLog(userId, weekIdentifier);

      try {
        // 3. Initialize clients
        const gmailClient = new GmailClient(gmailAccessToken);
        const extractor = new GmailExtractor(openaiApiKey);

        // 4. Test connections
        const gmailTest = await gmailClient.testConnection();
        if (!gmailTest.success) {
          throw new Error(`Gmail connection failed: ${gmailTest.error}`);
        }

        const openaiTest = await extractor.testConnection();
        if (!openaiTest.success) {
          throw new Error(`OpenAI connection failed: ${openaiTest.error}`);
        }

        console.log(`Connected to Gmail (${gmailTest.email}) and OpenAI (${openaiTest.model})`);

        // 5. Get emails for week
        const { start, end } = getWeekDates(weekIdentifier);
        console.log(`Fetching emails from ${start.toISOString()} to ${end.toISOString()}`);

        const emailBatch = await gmailClient.getEmailsForWeek(start, end);

        if (emailBatch.emails.length === 0) {
          console.log('No emails found for this week');
          await this.completeExtractionLog(logId, {
            emails_processed: 0,
            memories_created: 0,
            entities_created: 0,
            status: 'completed',
          });

          return {
            success: true,
            emails_processed: 0,
            memories_created: 0,
            entities_created: 0,
            summary: 'No emails found for this week',
          };
        }

        // 6. Extract with GPT-4
        console.log(`Extracting content from ${emailBatch.emails.length} emails...`);
        const extraction = await extractor.extractFromEmails(emailBatch.emails, userId);

        // 7. Save to database
        console.log(
          `Saving ${extraction.memories.length} memories and ${extraction.entities.length} entities...`
        );
        const saveResult = await this.saveExtractions(
          userId,
          extraction.memories,
          extraction.entities
        );

        // 8. Update extraction log
        await this.completeExtractionLog(logId, {
          emails_processed: emailBatch.emails.length,
          memories_created: saveResult.memories_created,
          entities_created: saveResult.entities_created,
          status: 'completed',
        });

        console.log('Extraction completed successfully');

        return {
          success: true,
          emails_processed: emailBatch.emails.length,
          memories_created: saveResult.memories_created,
          entities_created: saveResult.entities_created,
          summary: extraction.summary,
        };
      } catch (error) {
        // Mark as failed
        await this.failExtractionLog(
          logId,
          error instanceof Error ? error.message : 'Unknown error'
        );
        throw error;
      }
    } catch (error) {
      console.error('Extraction failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Extract current week
   */
  async extractCurrentWeek(
    userId: string,
    gmailAccessToken: string,
    openaiApiKey?: string
  ): Promise<ExtractionResult> {
    const weekIdentifier = getCurrentWeekIdentifier();
    return this.extractWeek(userId, weekIdentifier, gmailAccessToken, openaiApiKey);
  }

  /**
   * Get extraction logs for a user
   */
  async getExtractionLogs(userId: string, limit = 50): Promise<ExtractionLog[]> {
    const result = await this.db.execute(
      `SELECT * FROM gmail_extraction_log
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT ?`,
      [userId, limit]
    );

    return result.rows as any[];
  }

  /**
   * Get extraction log for a specific week
   */
  async getExtractionLog(userId: string, weekIdentifier: string): Promise<ExtractionLog | null> {
    const result = await this.db.execute(
      `SELECT * FROM gmail_extraction_log
       WHERE user_id = ? AND week_identifier = ?`,
      [userId, weekIdentifier]
    );

    return result.rows.length > 0 ? (result.rows[0] as any) : null;
  }

  /**
   * Check if week already extracted
   */
  private async checkExtractionLog(
    userId: string,
    weekIdentifier: string
  ): Promise<ExtractionLog | null> {
    const result = await this.db.execute(
      `SELECT * FROM gmail_extraction_log
       WHERE user_id = ? AND week_identifier = ? AND status = 'completed'`,
      [userId, weekIdentifier]
    );

    return result.rows.length > 0 ? (result.rows[0] as any) : null;
  }

  /**
   * Create extraction log entry
   */
  private async createExtractionLog(userId: string, weekIdentifier: string): Promise<string> {
    const { start, end } = getWeekDates(weekIdentifier);
    const id = randomUUID();

    await this.db.execute(
      `INSERT INTO gmail_extraction_log (
        id, user_id, week_identifier, start_date, end_date,
        emails_processed, memories_created, entities_created,
        status, created_at
      ) VALUES (?, ?, ?, ?, ?, 0, 0, 0, 'processing', ?)`,
      [id, userId, weekIdentifier, start.toISOString(), end.toISOString(), new Date().toISOString()]
    );

    return id;
  }

  /**
   * Update extraction log on completion
   */
  private async completeExtractionLog(
    logId: string,
    data: {
      emails_processed: number;
      memories_created: number;
      entities_created: number;
      status: 'completed' | 'failed';
    }
  ): Promise<void> {
    await this.db.execute(
      `UPDATE gmail_extraction_log
       SET emails_processed = ?,
           memories_created = ?,
           entities_created = ?,
           status = ?,
           completed_at = ?
       WHERE id = ?`,
      [
        data.emails_processed,
        data.memories_created,
        data.entities_created,
        data.status,
        new Date().toISOString(),
        logId,
      ]
    );
  }

  /**
   * Mark extraction as failed
   */
  private async failExtractionLog(logId: string, errorMessage: string): Promise<void> {
    await this.db.execute(
      `UPDATE gmail_extraction_log
       SET status = 'failed',
           error_message = ?,
           completed_at = ?
       WHERE id = ?`,
      [errorMessage, new Date().toISOString(), logId]
    );
  }

  /**
   * Save extracted memories and entities to database
   */
  private async saveExtractions(
    userId: string,
    memories: ExtractedMemory[],
    entities: ExtractedEntity[]
  ): Promise<{ memories_created: number; entities_created: number }> {
    let memoriesCreated = 0;
    let entitiesCreated = 0;

    // Save entities first
    for (const entityData of entities) {
      try {
        await this.memoryCore.createEntity(entityData.name, entityData.entity_type as EntityType, {
          userId,
          personType: entityData.person_type,
          description: entityData.description,
          company: entityData.company,
          title: entityData.title,
          email: entityData.email,
          phone: entityData.phone,
          importance: entityData.importance,
          tags: entityData.tags,
          notes: entityData.notes,
          metadata: entityData.metadata,
        });
        entitiesCreated++;
      } catch (error) {
        console.error(`Failed to save entity ${entityData.name}:`, error);
        // Continue with other entities
      }
    }

    // Build entity name to ID map for linking
    const entityNameMap = new Map<string, number>();
    if (entities.length > 0) {
      const result = await this.db.execute(
        `SELECT id, name FROM entities WHERE user_id = ? AND name IN (${entities.map(() => '?').join(',')})`,
        [userId, ...entities.map(e => e.name)]
      );

      for (const row of result.rows as any[]) {
        entityNameMap.set(row.name.toLowerCase(), row.id);
      }
    }

    // Save memories
    for (const memoryData of memories) {
      try {
        // Map entity names to IDs
        const entityIds: number[] = [];
        if (memoryData.entity_names) {
          for (const name of memoryData.entity_names) {
            const entityId = entityNameMap.get(name.toLowerCase());
            if (entityId) {
              entityIds.push(entityId);
            }
          }
        }

        await this.memoryCore.addMemory(
          memoryData.title,
          memoryData.content,
          memoryData.memory_type,
          {
            userId,
            importance: memoryData.importance,
            tags: memoryData.tags,
            entityIds,
            metadata: memoryData.metadata,
          }
        );
        memoriesCreated++;
      } catch (error) {
        console.error(`Failed to save memory ${memoryData.title}:`, error);
        // Continue with other memories
      }
    }

    return { memories_created: memoriesCreated, entities_created: entitiesCreated };
  }

  /**
   * Delete extraction log and associated data
   */
  async deleteExtractionLog(userId: string, weekIdentifier: string): Promise<boolean> {
    const result = await this.db.execute(
      `DELETE FROM gmail_extraction_log
       WHERE user_id = ? AND week_identifier = ?`,
      [userId, weekIdentifier]
    );

    return (result as any).rowsAffected > 0;
  }
}
