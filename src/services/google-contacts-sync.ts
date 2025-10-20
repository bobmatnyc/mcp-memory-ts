/**
 * Google Contacts Sync Service
 *
 * Bidirectional sync between Google Contacts and MCP Memory entities.
 * Reuses existing contact matching and LLM deduplication logic.
 */

import { DatabaseOperations } from '../database/operations.js';
import { GooglePeopleClient, type GoogleContact } from '../integrations/google-people-client.js';
import { GoogleAuthService } from '../utils/google-auth.js';
import {
  batchCheckDuplicates,
  entityToContactInfo,
  type ContactPair,
} from '../utils/deduplication.js';
import { matchContacts, extractMcpUuid } from '../utils/contact-matching.js';
import { vcardToEntity } from '../vcard/mapper.js';
import type { VCardData } from '../vcard/types.js';
import { VCardVersion } from '../vcard/types.js';
import type { Entity } from '../types/base.js';
import { EntityType, ImportanceLevel } from '../types/enums.js';
import { createEntity } from '../models/index.js';

/**
 * Sync options
 */
export interface GoogleContactsSyncOptions {
  userId: string;
  direction: 'export' | 'import' | 'both';
  dryRun?: boolean;
  forceFull?: boolean;
  enableLLMDedup?: boolean;
  deduplicationThreshold?: number;
  pageToken?: string;
  pageSize?: number;
}

/**
 * Sync result
 */
export interface GoogleContactsSyncResult {
  success: boolean;
  exported: number;
  imported: number;
  updated: number;
  duplicatesFound: number;
  merged: number;
  errors: string[];
  nextPageToken?: string;
  hasMore?: boolean;
  totalProcessed?: number;
  totalAvailable?: number;
}

/**
 * Google Contacts Sync Service
 *
 * Features:
 * - Incremental sync with syncToken
 * - LLM-powered deduplication
 * - Bidirectional sync
 * - Conflict resolution
 */
export class GoogleContactsSyncService {
  constructor(
    private db: DatabaseOperations,
    private googleAuth: GoogleAuthService
  ) {}

  /**
   * Sync contacts between Google and MCP Memory
   */
  async sync(options: GoogleContactsSyncOptions): Promise<GoogleContactsSyncResult> {
    const syncId = `sync-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();

    // Use stderr for production logging visibility in PM2
    process.stderr.write(`[GoogleContactsSync Service][${syncId}] ===== SYNC SERVICE STARTED ===== ${JSON.stringify({
      timestamp: new Date().toISOString(),
      userId: options.userId,
      direction: options.direction,
      dryRun: options.dryRun,
      forceFull: options.forceFull,
      enableLLMDedup: options.enableLLMDedup,
      pageToken: options.pageToken ? 'present' : 'none',
      pageSize: options.pageSize,
    })}\n`);

    const result: GoogleContactsSyncResult = {
      success: true,
      exported: 0,
      imported: 0,
      updated: 0,
      duplicatesFound: 0,
      merged: 0,
      errors: [],
    };

    try {
      // Get authenticated client
      console.log(`[GoogleContactsSync Service][${syncId}] Getting auth client...`);
      const authClient = await this.googleAuth.getAuthClient(options.userId);
      if (!authClient) {
        console.error(`[GoogleContactsSync Service][${syncId}] No auth client found`);
        throw new Error(
          'Google authentication required. Please connect your Google account first.'
        );
      }
      console.log(`[GoogleContactsSync Service][${syncId}] Auth client obtained`);

      const peopleClient = new GooglePeopleClient(authClient);

      // Import from Google
      if (options.direction === 'import' || options.direction === 'both') {
        process.stderr.write(`[GoogleContactsSync Service][${syncId}] Starting IMPORT phase...\n`);
        const importStartTime = Date.now();
        await this.importFromGoogle(peopleClient, options, result);
        const importDuration = Date.now() - importStartTime;
        process.stderr.write(`[GoogleContactsSync Service][${syncId}] IMPORT phase completed (${importDuration}ms) ${JSON.stringify({
          imported: result.imported,
          updated: result.updated,
          errorCount: result.errors.length,
        })}\n`);
      }

      // Export to Google
      if (options.direction === 'export' || options.direction === 'both') {
        process.stderr.write(`[GoogleContactsSync Service][${syncId}] Starting EXPORT phase...\n`);
        const exportStartTime = Date.now();
        await this.exportToGoogle(peopleClient, options, result);
        const exportDuration = Date.now() - exportStartTime;
        process.stderr.write(`[GoogleContactsSync Service][${syncId}] EXPORT phase completed (${exportDuration}ms) ${JSON.stringify({
          exported: result.exported,
          errorCount: result.errors.length,
        })}\n`);
      }

      const duration = Date.now() - startTime;
      process.stderr.write(`[GoogleContactsSync Service][${syncId}] ===== SYNC SERVICE COMPLETED (${duration}ms) ===== ${JSON.stringify({
        success: result.success,
        exported: result.exported,
        imported: result.imported,
        updated: result.updated,
        duplicatesFound: result.duplicatesFound,
        merged: result.merged,
        totalErrors: result.errors.length,
      })}\n`);

      // Log return structure BEFORE returning
      process.stderr.write(`[GoogleContactsSync Service] RETURNING RESULT: ${JSON.stringify({
        success: result.success,
        imported: result.imported,
        exported: result.exported,
        updated: result.updated,
        totalAvailable: result.totalAvailable,
        nextPageToken: result.nextPageToken ? 'present' : 'missing',
        hasMore: result.hasMore,
        errorsCount: result.errors?.length || 0,
      })}\n`);

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      process.stderr.write(`[GoogleContactsSync Service][${syncId}] ===== SYNC SERVICE FAILED (${duration}ms) ===== ${JSON.stringify({
        error: error instanceof Error ? {
          name: error.name,
          message: error.message,
          stack: error.stack?.split('\n').slice(0, 10).join('\n'),
        } : error,
      })}\n`);

      result.success = false;
      result.errors.push(error instanceof Error ? error.message : String(error));
      return result;
    }
  }

  /**
   * Import contacts from Google to MCP Memory
   */
  private async importFromGoogle(
    client: GooglePeopleClient,
    options: GoogleContactsSyncOptions,
    result: GoogleContactsSyncResult
  ): Promise<void> {
    process.stderr.write('[GoogleContactsSync Service] Importing from Google Contacts...\n');

    // Get user
    let user = await this.db.getUserByEmail(options.userId);
    if (!user) {
      user = await this.db.getUserById(options.userId);
    }
    if (!user) {
      process.stderr.write(`[GoogleContactsSync Service] User not found: ${options.userId}\n`);
      throw new Error(`User not found: ${options.userId}`);
    }
    process.stderr.write(`[GoogleContactsSync Service] User found: ${user.id}\n`);

    // Get sync token (for incremental sync)
    const syncToken = options.forceFull
      ? undefined
      : (user.metadata?.googleContactsSyncToken as string | undefined);

    const isBatchRequest = !!options.pageToken;
    process.stderr.write(`[GoogleContactsSync Service] Sync mode: ${syncToken ? 'incremental' : 'full'}, ${isBatchRequest ? 'batch/paginated' : 'full-fetch'}\n`);

    // Fetch contacts from Google
    const apiCallStartTime = Date.now();

    // For batch processing, use pageToken-based pagination
    const syncResult = isBatchRequest
      ? await client.listContacts(options.pageToken, options.pageSize || 100)
      : await client.getAllContacts(syncToken);

    const apiCallDuration = Date.now() - apiCallStartTime;

    // Extract error info if result failed (for type safety)
    const errorInfo = !syncResult.ok
      ? {
          type: syncResult.error.type,
          message: syncResult.error.message,
          retryAfter: 'retryAfter' in syncResult.error ? syncResult.error.retryAfter : undefined,
        }
      : null;

    process.stderr.write(`[GoogleContactsSync Service] API call completed (${apiCallDuration}ms): ${JSON.stringify({
      success: syncResult.ok,
      error: errorInfo,
      contactCount: syncResult.ok ? syncResult.data.contacts.length : 0,
    })}\n`);

    if (!syncResult.ok) {
      // Handle expired sync token
      if (syncResult.error.type === 'EXPIRED_SYNC_TOKEN') {
        process.stderr.write('[GoogleContactsSync Service] Sync token expired, retrying with full sync...\n');
        return this.importFromGoogle(client, { ...options, forceFull: true }, result);
      }

      // Return user-friendly error messages
      const errorMessage = this.formatSyncError(syncResult.error);
      throw new Error(errorMessage);
    }

    const googleContacts = syncResult.data.contacts;
    process.stderr.write(`[GoogleContactsSync Service] Fetched ${googleContacts.length} contacts from Google\n`);

    if (googleContacts.length === 0) {
      process.stderr.write('[GoogleContactsSync Service] No contacts to import\n');
      return;
    }

    // Convert Google contacts to VCardData for matching
    const googleVCards = googleContacts.map(gc => this.googleContactToVCard(gc));

    // Get existing MCP entities
    const existingEntities = await this.db.getEntitiesByUserId(user.id, 10000);
    const personEntities = existingEntities.filter(e => e.entityType === EntityType.PERSON);

    // Match contacts using UUID and other identifiers
    const matchResult = matchContacts(personEntities, googleVCards);

    process.stderr.write(`[GoogleContactsSync Service] Match results: ${matchResult.matched.length} matched, ${matchResult.externalUnmatched.length} new, ${matchResult.mcpUnmatched.length} unmatched MCP\n`);

    // Update matched entities
    for (const match of matchResult.matched) {
      if (!options.dryRun && match.mcp.id) {
        try {
          // Convert VCardData to Entity update format
          const updateData = vcardToEntity(match.external, user.id);
          await this.db.updateEntity(String(match.mcp.id), updateData, user.id);
          result.updated++;
        } catch (error) {
          result.errors.push(`Failed to update ${match.mcp.name}: ${error}`);
        }
      } else if (options.dryRun) {
        result.updated++;
      }
    }

    // LLM deduplication for unmatched contacts
    if (options.enableLLMDedup && matchResult.externalUnmatched.length > 0) {
      process.stderr.write('[GoogleContactsSync Service] Running LLM deduplication...\n');

      // Convert VCardData to Entity for deduplication (temporary entities for comparison)
      const tempEntities = matchResult.externalUnmatched.map(vcard => {
        const entityData = vcardToEntity(vcard, user.id);
        return { ...entityData, id: 'temp', createdAt: '', updatedAt: '' } as Entity;
      });

      const contactPairs: ContactPair[] = tempEntities.map(entity => ({
        contact1: entityToContactInfo(entity),
        contact2: entityToContactInfo(entity), // Will compare against existing
      }));

      const llmResults = await batchCheckDuplicates(
        contactPairs,
        {
          enableLLMDeduplication: true,
          threshold: (options.deduplicationThreshold || 0.8) * 100, // Convert to 0-100 scale
          chatgptModel: 'gpt-4o-mini',
          maxRetries: 3,
          retryDelayMs: 1000,
        },
        process.env.OPENAI_API_KEY || '',
        (current, total) => {
          process.stdout.write(`\r  Checked ${current}/${total}...`);
        }
      );

      const duplicates = llmResults.filter(
        r => r.isDuplicate && r.confidence >= (options.deduplicationThreshold || 0.8)
      );
      result.duplicatesFound = duplicates.length;

      process.stderr.write(`[GoogleContactsSync Service] Found ${duplicates.length} duplicates via LLM\n`);
    }

    // Create new entities for unmatched Google contacts
    for (const googleEntity of matchResult.externalUnmatched) {
      if (!options.dryRun) {
        try {
          // Convert VCardData to Entity format
          const entityData = vcardToEntity(googleEntity, user.id);
          const entity = createEntity(entityData);
          await this.db.createEntity(entity);
          result.imported++;
        } catch (error) {
          result.errors.push(`Failed to import ${googleEntity.fn}: ${error}`);
        }
      } else {
        result.imported++;
      }
    }

    // Store new sync token for incremental sync (only for full sync, not batch mode)
    if (syncResult.data.nextSyncToken && !options.dryRun && !isBatchRequest) {
      await this.db.updateUser(user.id, {
        metadata: {
          ...user.metadata,
          googleContactsSyncToken: syncResult.data.nextSyncToken,
          googleContactsSyncAt: new Date().toISOString(),
        },
      });
      process.stderr.write('[GoogleContactsSync Service] Sync token saved\n');
    }

    // Set pagination info for batch processing
    if (isBatchRequest) {
      result.nextPageToken = syncResult.data.nextPageToken;
      result.hasMore = !!syncResult.data.nextPageToken;
      result.totalProcessed = googleContacts.length;

      // CRITICAL: Set totalAvailable from Google API response if available
      if (syncResult.data.totalItems !== undefined) {
        result.totalAvailable = syncResult.data.totalItems;
      }

      process.stderr.write(`[GoogleContactsSync Service] BATCH RESULT SET: ${JSON.stringify({
        imported: result.imported,
        updated: result.updated,
        nextPageToken: result.nextPageToken ? 'present' : 'missing',
        hasMore: result.hasMore,
        totalProcessed: result.totalProcessed,
        totalAvailable: result.totalAvailable,
        totalAvailableSource: syncResult.data.totalItems !== undefined ? 'API' : 'undefined',
      })}\n`);
    } else {
      process.stderr.write(`[GoogleContactsSync Service] Import complete: ${result.imported} imported, ${result.updated} updated\n`);
    }
  }

  /**
   * Export MCP entities to Google Contacts
   */
  /**
   * Helper: Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Helper: Retry operation with exponential backoff for rate limits
   */
  private async retryWithBackoff<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000
  ): Promise<T> {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        const isLastAttempt = attempt === maxRetries - 1;
        const isRateLimit = error instanceof Error &&
          (error.message.includes('Rate limit') || error.message.includes('429'));

        if (isRateLimit && !isLastAttempt) {
          const delay = baseDelay * Math.pow(2, attempt); // Exponential backoff
          process.stderr.write(`[GoogleContactsSync Service] Rate limit hit, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})...\n`);
          await this.sleep(delay);
        } else {
          throw error;
        }
      }
    }
    throw new Error('Max retries exceeded');
  }

  private async exportToGoogle(
    client: GooglePeopleClient,
    options: GoogleContactsSyncOptions,
    result: GoogleContactsSyncResult
  ): Promise<void> {
    process.stderr.write('[GoogleContactsSync Service] Exporting to Google Contacts...\n');

    // Get user
    let user = await this.db.getUserByEmail(options.userId);
    if (!user) {
      user = await this.db.getUserById(options.userId);
    }
    if (!user) {
      throw new Error(`User not found: ${options.userId}`);
    }

    // Get MCP entities
    const entities = await this.db.getEntitiesByUserId(user.id, 10000);
    const personEntities = entities.filter(e => e.entityType === EntityType.PERSON);

    process.stderr.write(`[GoogleContactsSync Service] Found ${personEntities.length} person entities to export\n`);
    process.stderr.write('[GoogleContactsSync Service] Using rate limiting: 100ms between requests, 3 retries with exponential backoff\n');

    // Export each entity (check if exists first)
    let processedCount = 0;
    for (const entity of personEntities) {
      processedCount++;

      // Log progress every 10 contacts
      if (processedCount % 10 === 0) {
        process.stderr.write(`[GoogleContactsSync Service] Export progress: ${processedCount}/${personEntities.length} contacts processed\n`);
      }
      const resourceName = this.extractGoogleResourceName(entity);

      if (!options.dryRun) {
        try {
          if (resourceName) {
            // Update existing contact with retry logic for rate limits
            const googleContact = this.entityToGoogleContact(entity, true); // Include ETag for updates

            const updateResult = await this.retryWithBackoff(async () => {
              const result = await client.updateContact(resourceName, googleContact, [
                'names',
                'emailAddresses',
                'phoneNumbers',
                'organizations',
                'biographies',
              ]);

              // Throw error if rate limited to trigger retry
              if (!result.ok) {
                if (result.error.message?.includes('Rate limit')) {
                  throw new Error(`Rate limit exceeded, retry after 60s`);
                }
              }

              return result;
            });

            if (updateResult.ok) {
              // Update stored ETag after successful update
              if (updateResult.data.etag) {
                const currentMetadata =
                  typeof entity.metadata === 'string'
                    ? JSON.parse(entity.metadata)
                    : entity.metadata || {};

                await this.db.updateEntity(
                  String(entity.id),
                  {
                    metadata: {
                      ...currentMetadata,
                      googleEtag: updateResult.data.etag,
                      googleLastSync: new Date().toISOString(),
                    },
                  },
                  user.id
                );
              }
              result.exported++;
            } else {
              // Handle ETag conflicts (contact modified by another source)
              if (
                updateResult.error.message?.includes('failedPrecondition') ||
                updateResult.error.message?.includes('etag')
              ) {
                process.stderr.write(
                  `[GoogleContactsSync Service] ETag conflict for ${entity.name}, re-fetching latest version...\n`
                );

                // Re-fetch contact to get latest ETag with retry logic
                const getResult = await this.retryWithBackoff(async () => {
                  const result = await client.getContact(resourceName);

                  // Throw error if rate limited to trigger retry
                  if (!result.ok) {
                    if (result.error.message?.includes('Rate limit')) {
                      throw new Error(`Rate limit exceeded, retry after 60s`);
                    }
                  }

                  return result;
                });
                if (getResult.ok) {
                  const latestContact = getResult.data;

                  // Store updated ETag and retry
                  const currentMetadata =
                    typeof entity.metadata === 'string'
                      ? JSON.parse(entity.metadata)
                      : entity.metadata || {};

                  await this.db.updateEntity(
                    String(entity.id),
                    {
                      metadata: {
                        ...currentMetadata,
                        googleEtag: latestContact.etag,
                      },
                    },
                    user.id
                  );

                  // Retry with fresh ETag and rate limit handling
                  const refreshedEntity = await this.db.getEntityById(String(entity.id), user.id);
                  if (refreshedEntity) {
                    const retryContact = this.entityToGoogleContact(refreshedEntity, true);

                    const retryResult = await this.retryWithBackoff(async () => {
                      const result = await client.updateContact(resourceName, retryContact, [
                        'names',
                        'emailAddresses',
                        'phoneNumbers',
                        'organizations',
                        'biographies',
                      ]);

                      // Throw error if rate limited to trigger retry
                      if (!result.ok) {
                        if (result.error.message?.includes('Rate limit')) {
                          throw new Error(`Rate limit exceeded, retry after 60s`);
                        }
                      }

                      return result;
                    });

                    if (retryResult.ok) {
                      result.exported++;
                    } else {
                      result.errors.push(
                        `Failed to update ${entity.name} after ETag refresh: ${retryResult.error.message}`
                      );
                    }
                  }
                } else {
                  result.errors.push(
                    `Failed to re-fetch ${entity.name} for ETag update: ${getResult.error.message}`
                  );
                }
              } else {
                result.errors.push(`Failed to update ${entity.name}: ${updateResult.error.message}`);
              }
            }
          } else {
            // Create new contact with retry logic for rate limits
            const googleContact = this.entityToGoogleContact(entity);

            const createResult = await this.retryWithBackoff(async () => {
              const result = await client.createContact(googleContact);

              // Throw error if rate limited to trigger retry
              if (!result.ok) {
                if (result.error.message?.includes('Rate limit')) {
                  throw new Error(`Rate limit exceeded, retry after 60s`);
                }
              }

              return result;
            });

            if (createResult.ok) {
              // Store Google resource name and ETag in entity metadata
              await this.db.updateEntity(
                String(entity.id),
                {
                  metadata: {
                    ...entity.metadata,
                    googleResourceName: createResult.data.resourceName,
                    googleEtag: createResult.data.etag,
                    googleCreatedAt: new Date().toISOString(),
                  },
                },
                user.id
              );
              result.exported++;
            } else {
              result.errors.push(`Failed to create ${entity.name}: ${createResult.error.message}`);
            }
          }
        } catch (error) {
          result.errors.push(`Export error for ${entity.name}: ${error}`);
        }
      } else {
        result.exported++;
      }

      // Rate limiting: Add delay between API requests to avoid hitting Google's rate limits
      // 100ms = 10 requests/second, well below Google's limits
      if (!options.dryRun && processedCount < personEntities.length) {
        await this.sleep(100); // 100ms between requests
      }
    }

    process.stderr.write(`[GoogleContactsSync Service] Export complete: ${result.exported} contacts\n`);
  }

  /**
   * Convert Google Contact to VCardData for matching
   */
  private googleContactToVCard(contact: GoogleContact): VCardData {
    const name = contact.names?.[0];
    const displayName = name?.displayName || contact.emailAddresses?.[0]?.value || 'Unknown';

    const vcard: VCardData = {
      version: VCardVersion.V4_0,
      fn: displayName,
    };

    // Parse name
    if (name) {
      vcard.n = {
        givenName: name.givenName ?? undefined,
        familyName: name.familyName ?? undefined,
      };
    }

    // Map contact fields to vCard
    if (contact.emailAddresses) {
      vcard.email = contact.emailAddresses.map(e => e.value).filter(Boolean) as string[];
    }
    if (contact.phoneNumbers) {
      vcard.tel = contact.phoneNumbers.map(p => p.value).filter(Boolean) as string[];
    }
    if (contact.organizations?.[0]) {
      vcard.org = contact.organizations[0].name ?? undefined;
      vcard.title = contact.organizations[0].title ?? undefined;
    }
    if (contact.biographies?.[0]) {
      vcard.note = contact.biographies[0].value ?? undefined;
    }
    if (contact.urls) {
      vcard.url = contact.urls.map(u => u.value).filter(Boolean) as string[];
    }

    // Store Google metadata
    vcard.raw = {
      'X-GOOGLE-RESOURCE-NAME': contact.resourceName,
      'X-GOOGLE-ETAG': contact.etag,
    };

    return vcard;
  }

  /**
   * Convert Google Contact to MCP Entity
   */
  private googleContactToEntity(contact: GoogleContact, userId: string): Entity {
    const name = contact.names?.[0];
    const displayName = name?.displayName || contact.emailAddresses?.[0]?.value || 'Unknown';

    return {
      userId,
      name: displayName,
      entityType: EntityType.PERSON,
      email: contact.emailAddresses?.[0]?.value,
      phone: contact.phoneNumbers?.[0]?.value,
      company: contact.organizations?.[0]?.name,
      title: contact.organizations?.[0]?.title,
      notes: contact.biographies?.[0]?.value,
      website: contact.urls?.[0]?.value,
      importance: ImportanceLevel.MEDIUM,
      interactionCount: 0,
      isArchived: false,
      metadata: {
        googleResourceName: contact.resourceName,
        googleEtag: contact.etag,
        source: 'google-contacts',
      },
    } as Entity;
  }

  /**
   * Convert MCP Entity to Google Contact
   * @param entity - Entity to convert
   * @param includeEtag - Whether to include ETag (required for updates)
   */
  private entityToGoogleContact(entity: Entity, includeEtag: boolean = false): Partial<GoogleContact> {
    const contact: Partial<GoogleContact> = {};

    // Name
    if (entity.name) {
      const nameParts = entity.name.split(' ');
      contact.names = [
        {
          givenName: nameParts[0] || '',
          familyName: nameParts.slice(1).join(' ') || '',
          displayName: entity.name,
        },
      ];
    }

    // Email
    if (entity.email) {
      contact.emailAddresses = [
        {
          value: entity.email,
          type: 'work',
        },
      ];
    }

    // Phone
    if (entity.phone) {
      contact.phoneNumbers = [
        {
          value: entity.phone,
          type: 'work',
        },
      ];
    }

    // Organization
    if (entity.company || entity.title) {
      contact.organizations = [
        {
          name: entity.company,
          title: entity.title,
        },
      ];
    }

    // Biography/Notes
    if (entity.notes) {
      contact.biographies = [
        {
          value: entity.notes,
          contentType: 'TEXT_PLAIN',
        },
      ];
    }

    // Website
    if (entity.website) {
      contact.urls = [
        {
          value: entity.website,
          type: 'work',
        },
      ];
    }

    // Include ETag for update operations (required by Google API)
    if (includeEtag) {
      const etag = this.extractGoogleEtag(entity);
      if (etag) {
        contact.etag = etag;
      }
    }

    return contact;
  }

  /**
   * Extract Google resource name from entity metadata
   */
  private extractGoogleResourceName(entity: Entity): string | null {
    return (entity.metadata?.googleResourceName as string) || null;
  }

  /**
   * Extract Google ETag from entity metadata
   * ETags are required for update operations to prevent conflicts
   */
  private extractGoogleEtag(entity: Entity): string | undefined {
    if (!entity.metadata) return undefined;

    const metadata =
      typeof entity.metadata === 'string' ? JSON.parse(entity.metadata) : entity.metadata;

    return metadata?.googleEtag;
  }

  /**
   * Format sync error into user-friendly message
   */
  private formatSyncError(error: any): string {
    const statusCode = error.statusCode || error.code;

    if (statusCode === 401) {
      return 'Authentication expired. Please reconnect your Google account.';
    } else if (statusCode === 403) {
      return 'Permission denied. Please ensure Google Contacts access is granted and reconnect your account.';
    } else if (statusCode === 404) {
      return 'Google Contacts API not found. Please check your Google Cloud Console configuration.';
    } else if (error.type === 'RATE_LIMIT') {
      const retryAfter = error.retryAfter || 60;
      return `Google API rate limit exceeded. Please try again in ${retryAfter} seconds.`;
    } else if (error.message?.includes('timeout')) {
      return 'Request timed out. Please try again.';
    } else if (error.type === 'NETWORK_ERROR') {
      return `Network error: ${error.message}. Please check your internet connection and try again.`;
    } else {
      return `Google API error: ${error.message}`;
    }
  }
}
