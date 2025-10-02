/**
 * Export command - Export entities to vCard format
 */

import * as fs from 'fs/promises';
import { DatabaseConnection } from '../../database/connection.js';
import { DatabaseOperations } from '../../database/operations.js';
import { entityToVCard } from '../../vcard/mapper.js';
import { generateVCard } from '../../vcard/generator.js';
import type { VCardVersion, VCardExportOptions } from '../../vcard/types.js';
import { EntityType } from '../../types/enums.js';

export async function exportVCard(options: VCardExportOptions): Promise<void> {
  const {
    userId,
    outputPath = 'entities.vcf',
    entityType = EntityType.PERSON,
    version = '4.0' as VCardVersion,
    includeAllTypes = false,
  } = options;

  console.log(`Exporting entities for user: ${userId}`);
  console.log(`Entity type filter: ${includeAllTypes ? 'ALL' : entityType}`);
  console.log(`vCard version: ${version}`);
  console.log(`Output file: ${outputPath}`);

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

    // Get entities
    const allEntities = await dbOps.getEntitiesByUserId(user.id, 10000);

    // Filter by entity type if not including all
    const entities = includeAllTypes
      ? allEntities
      : allEntities.filter(e => e.entityType === entityType);

    if (entities.length === 0) {
      console.log('No entities found to export');
      await db.disconnect();
      return;
    }

    console.log(`Found ${entities.length} entities to export`);

    // Convert entities to vCards
    const vcards = entities.map(entity => entityToVCard(entity));

    // Generate vCard text
    const vcardText = generateVCard(vcards, version);

    // Write to file
    await fs.writeFile(outputPath, vcardText, 'utf-8');

    console.log(`\n✅ Successfully exported ${entities.length} entities to ${outputPath}`);

    // Show breakdown by entity type
    const breakdown = entities.reduce((acc, e) => {
      acc[e.entityType] = (acc[e.entityType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    console.log('\nBreakdown by entity type:');
    for (const [type, count] of Object.entries(breakdown)) {
      console.log(`  ${type}: ${count}`);
    }
  } finally {
    await db.disconnect();
  }
}
