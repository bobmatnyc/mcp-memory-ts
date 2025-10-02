/**
 * Import command - Import vCard files to create entities
 */

import * as fs from 'fs/promises';
import { DatabaseConnection } from '../../database/connection.js';
import { DatabaseOperations } from '../../database/operations.js';
import { parseVCard } from '../../vcard/parser.js';
import { vcardToEntity, validateVCard } from '../../vcard/mapper.js';
import { createEntity } from '../../models/index.js';
import type { VCardImportOptions, VCardImportResult } from '../../vcard/types.js';
import type { Entity } from '../../types/base.js';
import { EntityType, ImportanceLevel } from '../../types/enums.js';

export async function importVCard(options: VCardImportOptions): Promise<VCardImportResult> {
  const {
    userId,
    inputPath,
    entityType = EntityType.PERSON,
    personType,
    importance = ImportanceLevel.MEDIUM,
    tags = [],
    dryRun = false,
    merge = false,
  } = options;

  console.log(`Importing vCard from: ${inputPath}`);
  console.log(`User: ${userId}`);
  console.log(`Entity type: ${entityType}`);
  if (personType) console.log(`Person type: ${personType}`);
  console.log(`Importance: ${importance}`);
  if (tags.length > 0) console.log(`Tags: ${tags.join(', ')}`);
  console.log(`Dry run: ${dryRun ? 'YES' : 'NO'}`);
  console.log(`Merge: ${merge ? 'YES' : 'NO'}`);

  // Read vCard file
  const vcardText = await fs.readFile(inputPath, 'utf-8');

  // Parse vCards
  console.log('\nParsing vCard file...');
  const vcards = parseVCard(vcardText);
  console.log(`Found ${vcards.length} vCard entries`);

  const result: VCardImportResult = {
    success: true,
    imported: 0,
    updated: 0,
    failed: 0,
    errors: [],
    entities: [],
  };

  if (vcards.length === 0) {
    console.log('No valid vCards found in file');
    return result;
  }

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

    console.log(`Found user: ${user.email} (${user.id})`);

    // Get existing entities for merge comparison
    let existingEntities: Entity[] = [];
    if (merge) {
      existingEntities = await dbOps.getEntitiesByUserId(user.id, 10000);
      console.log(`Found ${existingEntities.length} existing entities for merge comparison`);
    }

    // Process each vCard
    for (let i = 0; i < vcards.length; i++) {
      const vcard = vcards[i];

      try {
        // Validate vCard
        const validation = validateVCard(vcard);
        if (!validation.valid) {
          result.failed++;
          result.errors.push({
            line: i + 1,
            card: vcard.fn || 'Unknown',
            error: validation.errors.join(', '),
          });
          continue;
        }

        // Convert to entity
        const entityData = vcardToEntity(vcard, user.id, {
          entityType,
          personType,
          importance,
          tags,
        });

        // Check for merge
        let existingEntity: Entity | null = null;
        if (merge) {
          // Try to find by email first, then by name
          existingEntity = existingEntities.find(e =>
            (e.email && entityData.email && e.email.toLowerCase() === entityData.email.toLowerCase()) ||
            (e.name.toLowerCase() === entityData.name.toLowerCase())
          ) || null;
        }

        if (dryRun) {
          console.log(`[DRY RUN] Would ${existingEntity ? 'skip (already exists)' : 'create'}: ${entityData.name}`);
          if (existingEntity && merge) {
            result.updated++;
          } else if (!existingEntity) {
            result.imported++;
          }
          result.entities.push(entityData as Entity);
        } else {
          if (existingEntity && merge) {
            // Skip existing entity in merge mode
            console.log(`⊘ Skipped (already exists): ${entityData.name}`);
            result.updated++;
            result.entities.push(existingEntity);
          } else if (!existingEntity || !merge) {
            // Create new entity
            const entity = createEntity(entityData);
            const savedEntity = await dbOps.createEntity(entity);
            console.log(`✓ Imported: ${entityData.name}`);
            result.imported++;
            result.entities.push(savedEntity);
          }
        }
      } catch (error) {
        result.failed++;
        result.errors.push({
          line: i + 1,
          card: vcard.fn || 'Unknown',
          error: String(error),
        });
        console.error(`✗ Failed: ${vcard.fn || 'Unknown'} - ${error}`);
      }
    }

    // Summary
    console.log('\n=== Import Summary ===');
    console.log(`Total processed: ${vcards.length}`);
    console.log(`Successfully imported: ${result.imported}`);
    console.log(`Successfully updated: ${result.updated}`);
    console.log(`Failed: ${result.failed}`);

    if (result.errors.length > 0) {
      console.log('\n=== Errors ===');
      for (const error of result.errors) {
        console.log(`Line ${error.line} (${error.card}): ${error.error}`);
      }
    }

    result.success = result.failed === 0;
  } finally {
    await db.disconnect();
  }

  return result;
}
