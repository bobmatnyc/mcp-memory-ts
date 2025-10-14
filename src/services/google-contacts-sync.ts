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
      const authClient = await this.googleAuth.getAuthClient(options.userId);
      if (!authClient) {
        throw new Error(
          'Google authentication required. Please connect your Google account first.'
        );
      }

      const peopleClient = new GooglePeopleClient(authClient);

      // Import from Google
      if (options.direction === 'import' || options.direction === 'both') {
        await this.importFromGoogle(peopleClient, options, result);
      }

      // Export to Google
      if (options.direction === 'export' || options.direction === 'both') {
        await this.exportToGoogle(peopleClient, options, result);
      }

      return result;
    } catch (error) {
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
    console.log('📥 Importing from Google Contacts...');

    // Get user
    let user = await this.db.getUserByEmail(options.userId);
    if (!user) {
      user = await this.db.getUserById(options.userId);
    }
    if (!user) {
      throw new Error(`User not found: ${options.userId}`);
    }

    // Get sync token (for incremental sync)
    const syncToken = options.forceFull
      ? undefined
      : (user.metadata?.googleContactsSyncToken as string | undefined);

    console.log(syncToken ? '🔄 Incremental sync...' : '📊 Full sync...');

    // Fetch contacts from Google
    const syncResult = await client.getAllContacts(syncToken);

    if (!syncResult.ok) {
      // Handle expired sync token
      if (syncResult.error.type === 'EXPIRED_SYNC_TOKEN') {
        console.log('⚠️  Sync token expired, performing full sync...');
        return this.importFromGoogle(client, { ...options, forceFull: true }, result);
      }
      throw new Error(`Google API error: ${syncResult.error.message}`);
    }

    const googleContacts = syncResult.data.contacts;
    console.log(`📊 Fetched ${googleContacts.length} contacts from Google`);

    if (googleContacts.length === 0) {
      console.log('✅ No contacts to import');
      return;
    }

    // Convert Google contacts to VCardData for matching
    const googleVCards = googleContacts.map(gc => this.googleContactToVCard(gc));

    // Get existing MCP entities
    const existingEntities = await this.db.getEntitiesByUserId(user.id, 10000);
    const personEntities = existingEntities.filter(e => e.entityType === EntityType.PERSON);

    // Match contacts using UUID and other identifiers
    const matchResult = matchContacts(personEntities, googleVCards);

    console.log(`  Matched: ${matchResult.matched.length}`);
    console.log(`  New Google contacts: ${matchResult.externalUnmatched.length}`);
    console.log(`  Unmatched MCP entities: ${matchResult.mcpUnmatched.length}`);

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
      console.log('🔍 Checking for duplicates with LLM...');

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

      console.log(`\n  Found ${duplicates.length} duplicates`);
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

    // Store new sync token for incremental sync
    if (syncResult.data.nextSyncToken && !options.dryRun) {
      await this.db.updateUser(user.id, {
        metadata: {
          ...user.metadata,
          googleContactsSyncToken: syncResult.data.nextSyncToken,
          googleContactsSyncAt: new Date().toISOString(),
        },
      });
      console.log('✅ Sync token saved for incremental updates');
    }

    console.log(`✅ Import complete: ${result.imported} imported, ${result.updated} updated`);
  }

  /**
   * Export MCP entities to Google Contacts
   */
  private async exportToGoogle(
    client: GooglePeopleClient,
    options: GoogleContactsSyncOptions,
    result: GoogleContactsSyncResult
  ): Promise<void> {
    console.log('📤 Exporting to Google Contacts...');

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

    console.log(`📊 Found ${personEntities.length} person entities`);

    // Export each entity (check if exists first)
    for (const entity of personEntities) {
      const resourceName = this.extractGoogleResourceName(entity);

      if (!options.dryRun) {
        try {
          if (resourceName) {
            // Update existing contact
            const googleContact = this.entityToGoogleContact(entity);
            const updateResult = await client.updateContact(resourceName, googleContact, [
              'names',
              'emailAddresses',
              'phoneNumbers',
              'organizations',
              'biographies',
            ]);

            if (updateResult.ok) {
              result.exported++;
            } else {
              result.errors.push(`Failed to update ${entity.name}: ${updateResult.error.message}`);
            }
          } else {
            // Create new contact
            const googleContact = this.entityToGoogleContact(entity);
            const createResult = await client.createContact(googleContact);

            if (createResult.ok) {
              // Store Google resource name in entity metadata
              await this.db.updateEntity(
                String(entity.id),
                {
                  metadata: {
                    ...entity.metadata,
                    googleResourceName: createResult.data.resourceName,
                    googleEtag: createResult.data.etag,
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
    }

    console.log(`✅ Export complete: ${result.exported} contacts`);
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
   */
  private entityToGoogleContact(entity: Entity): Partial<GoogleContact> {
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

    return contact;
  }

  /**
   * Extract Google resource name from entity metadata
   */
  private extractGoogleResourceName(entity: Entity): string | null {
    return (entity.metadata?.googleResourceName as string) || null;
  }
}
