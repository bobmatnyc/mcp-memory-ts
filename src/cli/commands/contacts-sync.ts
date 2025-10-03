/**
 * Contacts Sync Command - Sync entities with macOS Contacts app
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { DatabaseConnection } from '../../database/connection.js';
import { DatabaseOperations } from '../../database/operations.js';
import { entityToVCard } from '../../vcard/mapper.js';
import { generateVCard } from '../../vcard/generator.js';
import { parseVCard } from '../../vcard/parser.js';
import { vcardToEntity, validateVCard } from '../../vcard/mapper.js';
import { createEntity } from '../../models/index.js';
import type { Entity } from '../../types/base.js';
import { EntityType, ImportanceLevel } from '../../types/enums.js';
import { colors, icons } from '../colors.js';

const execAsync = promisify(exec);

export interface ContactsSyncOptions {
  userId: string;
  direction: 'export' | 'import' | 'both';
  dryRun?: boolean;
}

export interface ContactsSyncResult {
  success: boolean;
  exported: number;
  imported: number;
  updated: number;
  failed: number;
  errors: string[];
}

/**
 * Check if running on macOS
 */
function isMacOS(): boolean {
  return process.platform === 'darwin';
}

/**
 * Export entities to macOS Contacts using osascript
 */
async function exportToContacts(
  entities: Entity[],
  dryRun: boolean
): Promise<{ success: number; failed: number; errors: string[] }> {
  const result = { success: 0, failed: 0, errors: [] as string[] };

  console.log(`\n${icons.cycle} Exporting ${entities.length} entities to macOS Contacts...`);

  for (const entity of entities) {
    try {
      if (dryRun) {
        console.log(`${colors.dim('[DRY RUN]')} Would export: ${entity.name}`);
        result.success++;
        continue;
      }

      // Build AppleScript to create contact
      const firstName = entity.name.split(' ')[0] || '';
      const lastName = entity.name.split(' ').slice(1).join(' ') || '';
      const email = entity.email || '';
      const phone = entity.phone || '';
      const notes = entity.description || '';

      const script = `
        tell application "Contacts"
          set newPerson to make new person with properties {first name:"${escapeAppleScript(firstName)}", last name:"${escapeAppleScript(lastName)}"}
          ${email ? `make new email at end of emails of newPerson with properties {value:"${escapeAppleScript(email)}", label:"work"}` : ''}
          ${phone ? `make new phone at end of phones of newPerson with properties {value:"${escapeAppleScript(phone)}", label:"work"}` : ''}
          ${notes ? `set note of newPerson to "${escapeAppleScript(notes)}"` : ''}
          save
        end tell
      `;

      await execAsync(`osascript -e '${script}'`);
      console.log(`${icons.success} Exported: ${entity.name}`);
      result.success++;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`${icons.error} Failed to export ${entity.name}: ${errorMsg}`);
      result.failed++;
      result.errors.push(`${entity.name}: ${errorMsg}`);
    }
  }

  return result;
}

/**
 * Import contacts from macOS Contacts using osascript
 */
async function importFromContacts(
  userId: string,
  dbOps: DatabaseOperations,
  dryRun: boolean
): Promise<{ success: number; updated: number; failed: number; errors: string[] }> {
  const result = { success: 0, updated: 0, failed: 0, errors: [] as string[] };

  console.log(`\n${icons.cycle} Importing contacts from macOS Contacts...`);

  try {
    // Get all contacts as vCard format
    const script = `
      tell application "Contacts"
        set allPeople to every person
        set vcardData to ""
        repeat with aPerson in allPeople
          set vcardData to vcardData & vcard of aPerson
        end repeat
        return vcardData
      end tell
    `;

    const { stdout } = await execAsync(`osascript -e '${script}'`);

    if (!stdout || stdout.trim().length === 0) {
      console.log('No contacts found in macOS Contacts');
      return result;
    }

    // Parse vCards
    const vcards = parseVCard(stdout);
    console.log(`Found ${vcards.length} contacts to import`);

    // Get existing entities for merge comparison
    const existingEntities = await dbOps.getEntitiesByUserId(userId, 10000);
    console.log(`Found ${existingEntities.length} existing entities`);

    // Process each vCard
    for (const vcard of vcards) {
      try {
        // Validate vCard
        const validation = validateVCard(vcard);
        if (!validation.valid) {
          result.failed++;
          result.errors.push(`${vcard.fn || 'Unknown'}: ${validation.errors.join(', ')}`);
          continue;
        }

        // Convert to entity
        const entityData = vcardToEntity(vcard, userId, {
          entityType: EntityType.PERSON,
          importance: ImportanceLevel.MEDIUM,
          tags: ['imported-from-contacts'],
        });

        // Check if entity already exists
        const existingEntity = existingEntities.find(e =>
          (e.email && entityData.email && e.email.toLowerCase() === entityData.email.toLowerCase()) ||
          (e.name.toLowerCase() === entityData.name.toLowerCase())
        );

        if (dryRun) {
          console.log(
            `${colors.dim('[DRY RUN]')} Would ${existingEntity ? 'update' : 'create'}: ${entityData.name}`
          );
          if (existingEntity) {
            result.updated++;
          } else {
            result.success++;
          }
        } else {
          if (existingEntity) {
            // Entity already exists, skip
            console.log(`${colors.dim('⊘')} Skipped (already exists): ${entityData.name}`);
            result.updated++;
          } else {
            // Create new entity
            const entity = createEntity(entityData);
            await dbOps.createEntity(entity);
            console.log(`${icons.success} Imported: ${entityData.name}`);
            result.success++;
          }
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        result.failed++;
        result.errors.push(`${vcard.fn || 'Unknown'}: ${errorMsg}`);
        console.error(`${icons.error} Failed: ${vcard.fn || 'Unknown'} - ${errorMsg}`);
      }
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    result.errors.push(`Import failed: ${errorMsg}`);
    console.error(`${icons.error} Import failed: ${errorMsg}`);
  }

  return result;
}

/**
 * Escape special characters for AppleScript
 */
function escapeAppleScript(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
}

/**
 * Sync entities with macOS Contacts
 */
export async function syncContacts(options: ContactsSyncOptions): Promise<ContactsSyncResult> {
  const { userId, direction, dryRun = false } = options;

  // Check if running on macOS
  if (!isMacOS()) {
    throw new Error('Contacts sync is only available on macOS');
  }

  console.log(`\n${icons.robot} ${colors.title('macOS Contacts Sync')}`);
  console.log(`${colors.dim('User:')} ${userId}`);
  console.log(`${colors.dim('Direction:')} ${direction}`);
  console.log(`${colors.dim('Dry run:')} ${dryRun ? 'YES' : 'NO'}`);

  const result: ContactsSyncResult = {
    success: true,
    exported: 0,
    imported: 0,
    updated: 0,
    failed: 0,
    errors: [],
  };

  // Connect to database
  const dbUrl = process.env.TURSO_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (!dbUrl || !authToken) {
    throw new Error('TURSO_URL and TURSO_AUTH_TOKEN environment variables are required');
  }

  const db = new DatabaseConnection({
    url: dbUrl,
    authToken,
  });
  await db.connect();

  const dbOps = new DatabaseOperations(db);

  try {
    // Get user by email or ID
    let user = await dbOps.getUserByEmail(userId);
    if (!user) {
      user = await dbOps.getUserById(userId);
    }

    if (!user) {
      throw new Error(`User not found: ${userId}`);
    }

    console.log(`${icons.success} Found user: ${user.email} (${user.id})`);

    // Export to Contacts
    if (direction === 'export' || direction === 'both') {
      const entities = await dbOps.getEntitiesByUserId(user.id, 10000);
      const peopleEntities = entities.filter(e => e.entityType === EntityType.PERSON);

      if (peopleEntities.length === 0) {
        console.log('\nNo person entities found to export');
      } else {
        const exportResult = await exportToContacts(peopleEntities, dryRun);
        result.exported = exportResult.success;
        result.failed += exportResult.failed;
        result.errors.push(...exportResult.errors);
      }
    }

    // Import from Contacts
    if (direction === 'import' || direction === 'both') {
      const importResult = await importFromContacts(user.id, dbOps, dryRun);
      result.imported = importResult.success;
      result.updated = importResult.updated;
      result.failed += importResult.failed;
      result.errors.push(...importResult.errors);
    }

    // Print summary
    console.log(`\n${colors.title('=== Sync Summary ===')}`);
    if (direction === 'export' || direction === 'both') {
      console.log(`${colors.dim('Exported to Contacts:')} ${result.exported}`);
    }
    if (direction === 'import' || direction === 'both') {
      console.log(`${colors.dim('Imported from Contacts:')} ${result.imported}`);
      console.log(`${colors.dim('Already existing:')} ${result.updated}`);
    }
    console.log(`${colors.dim('Failed:')} ${result.failed}`);

    if (result.errors.length > 0) {
      console.log(`\n${colors.warning('Errors:')}`);
      for (const error of result.errors.slice(0, 10)) {
        console.log(`  ${colors.error('•')} ${error}`);
      }
      if (result.errors.length > 10) {
        console.log(`  ${colors.dim(`... and ${result.errors.length - 10} more`)}`);
      }
    }

    result.success = result.failed === 0;
  } finally {
    await db.disconnect();
  }

  return result;
}
