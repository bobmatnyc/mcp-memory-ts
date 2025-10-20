/**
 * Deep Inspection of Entity Issues
 *
 * Examines specific problematic entities and provides detailed information
 */

import { createClient } from '@libsql/client';
import * as dotenv from 'dotenv';

dotenv.config();

async function inspectEntityIssues() {
  const tursoUrl = process.env.TURSO_URL;
  const tursoAuthToken = process.env.TURSO_AUTH_TOKEN;

  if (!tursoUrl || !tursoAuthToken) {
    throw new Error('Missing TURSO_URL or TURSO_AUTH_TOKEN');
  }

  const db = createClient({
    url: tursoUrl,
    authToken: tursoAuthToken,
  });

  console.log('🔍 DEEP ENTITY INSPECTION\n');

  // 1. Entities with NULL user_id
  console.log('═════════════════════════════════════════════════════════════');
  console.log('1. ENTITIES WITH NULL user_id (Security Issue)');
  console.log('═════════════════════════════════════════════════════════════\n');

  const nullUserIdResult = await db.execute(`
    SELECT id, name, entity_type, email, phone, company, created_at
    FROM entities
    WHERE user_id IS NULL
    LIMIT 20
  `);

  console.log(`Total entities with NULL user_id: ${nullUserIdResult.rows.length}`);
  console.log('\nSample (first 20):');
  nullUserIdResult.rows.forEach((row: any) => {
    console.log(`  ID: ${row.id}`);
    console.log(`    Name: ${row.name}`);
    console.log(`    Type: ${row.entity_type}`);
    console.log(`    Email: ${row.email || 'N/A'}`);
    console.log(`    Phone: ${row.phone || 'N/A'}`);
    console.log(`    Company: ${row.company || 'N/A'}`);
    console.log(`    Created: ${row.created_at}`);
    console.log('');
  });

  // 2. Count all NULL user_id
  const nullCountResult = await db.execute(`
    SELECT COUNT(*) as count FROM entities WHERE user_id IS NULL
  `);
  console.log(`\nTotal NULL user_id entities: ${(nullCountResult.rows[0] as any).count}\n`);

  // 3. Entities with no contact info
  console.log('═════════════════════════════════════════════════════════════');
  console.log('2. PERSON ENTITIES WITH NO CONTACT INFO');
  console.log('═════════════════════════════════════════════════════════════\n');

  const noContactResult = await db.execute(`
    SELECT COUNT(*) as count
    FROM entities
    WHERE entity_type = 'person'
      AND (email IS NULL OR email = '')
      AND (phone IS NULL OR phone = '')
  `);
  console.log(`Total person entities without email or phone: ${(noContactResult.rows[0] as any).count}\n`);

  // 4. Sample person entities
  const samplePeopleResult = await db.execute(`
    SELECT id, user_id, name, entity_type, email, phone, company, description, notes, created_at
    FROM entities
    WHERE entity_type = 'person'
    LIMIT 10
  `);

  console.log('Sample person entities (first 10):');
  samplePeopleResult.rows.forEach((row: any) => {
    console.log(`  ID: ${row.id}`);
    console.log(`    User: ${row.user_id || 'NULL'}`);
    console.log(`    Name: ${row.name}`);
    console.log(`    Email: ${row.email || 'N/A'}`);
    console.log(`    Phone: ${row.phone || 'N/A'}`);
    console.log(`    Company: ${row.company || 'N/A'}`);
    console.log(`    Description: ${row.description ? row.description.substring(0, 50) + '...' : 'N/A'}`);
    console.log(`    Notes: ${row.notes ? row.notes.substring(0, 50) + '...' : 'N/A'}`);
    console.log('');
  });

  // 5. Check if entities have IDs with NULL strings
  console.log('═════════════════════════════════════════════════════════════');
  console.log('3. ENTITIES WITH UNUSUAL IDs');
  console.log('═════════════════════════════════════════════════════════════\n');

  const nullIdStringResult = await db.execute(`
    SELECT id, user_id, name, entity_type, created_at
    FROM entities
    WHERE id = 'null' OR id = 'NULL' OR id = ''
    LIMIT 10
  `);

  if (nullIdStringResult.rows.length > 0) {
    console.log(`Found ${nullIdStringResult.rows.length} entities with 'null' string IDs:`);
    nullIdStringResult.rows.forEach((row: any) => {
      console.log(`  ID: "${row.id}"`);
      console.log(`    Name: ${row.name}`);
      console.log(`    Type: ${row.entity_type}`);
      console.log('');
    });
  } else {
    console.log('✅ No entities with "null" string IDs found\n');
  }

  // 6. Duplicate names inspection
  console.log('═════════════════════════════════════════════════════════════');
  console.log('4. DUPLICATE NAMES ANALYSIS');
  console.log('═════════════════════════════════════════════════════════════\n');

  const duplicatesResult = await db.execute(`
    SELECT name, COUNT(*) as count, GROUP_CONCAT(id) as ids
    FROM entities
    GROUP BY LOWER(name)
    HAVING count > 1
    ORDER BY count DESC
    LIMIT 10
  `);

  console.log('Top 10 duplicate names:');
  for (const row of duplicatesResult.rows as any[]) {
    console.log(`  "${row.name}" appears ${row.count} times`);

    // Get details for each duplicate
    const entityIds = row.ids.split(',');
    for (const id of entityIds.slice(0, 3)) { // Show first 3
      const detailResult = await db.execute(`
        SELECT id, user_id, name, entity_type, email, phone, company, created_at
        FROM entities
        WHERE id = ?
      `, [id]);

      if (detailResult.rows.length > 0) {
        const entity = detailResult.rows[0] as any;
        console.log(`    ID: ${entity.id}`);
        console.log(`      User: ${entity.user_id || 'NULL'}`);
        console.log(`      Email: ${entity.email || 'N/A'}`);
        console.log(`      Phone: ${entity.phone || 'N/A'}`);
        console.log(`      Company: ${entity.company || 'N/A'}`);
        console.log(`      Created: ${entity.created_at}`);
      }
    }
    console.log('');
  }

  // 7. Check memory associations
  console.log('═════════════════════════════════════════════════════════════');
  console.log('5. ENTITY-MEMORY LINKING ANALYSIS');
  console.log('═════════════════════════════════════════════════════════════\n');

  const memoriesWithEntitiesResult = await db.execute(`
    SELECT id, entity_ids
    FROM memories
    WHERE entity_ids IS NOT NULL AND entity_ids != '' AND entity_ids != '[]'
    LIMIT 10
  `);

  console.log(`Memories with entity_ids: ${memoriesWithEntitiesResult.rows.length}`);
  console.log('\nSample memory-entity associations:');
  memoriesWithEntitiesResult.rows.forEach((row: any) => {
    console.log(`  Memory ID: ${row.id}`);
    console.log(`    Entity IDs JSON: ${row.entity_ids}`);

    try {
      const entityIds = JSON.parse(row.entity_ids);
      console.log(`    Parsed IDs: ${JSON.stringify(entityIds)}`);
    } catch (e) {
      console.log(`    ERROR parsing JSON: ${e.message}`);
    }
    console.log('');
  });

  // 8. Check if entity IDs in memories actually exist
  console.log('═════════════════════════════════════════════════════════════');
  console.log('6. ORPHANED MEMORY ASSOCIATIONS (Entity IDs that don\'t exist)');
  console.log('═════════════════════════════════════════════════════════════\n');

  const allMemoriesWithEntitiesResult = await db.execute(`
    SELECT id, entity_ids
    FROM memories
    WHERE entity_ids IS NOT NULL AND entity_ids != '' AND entity_ids != '[]'
  `);

  const orphanedEntityIds = new Set<string>();

  for (const row of allMemoriesWithEntitiesResult.rows as any[]) {
    try {
      const entityIds = JSON.parse(row.entity_ids);
      if (Array.isArray(entityIds)) {
        for (const entityId of entityIds) {
          // Check if entity exists
          const checkResult = await db.execute(`
            SELECT id FROM entities WHERE id = ?
          `, [String(entityId)]);

          if (checkResult.rows.length === 0) {
            orphanedEntityIds.add(String(entityId));
          }
        }
      }
    } catch (e) {
      // Invalid JSON
    }
  }

  if (orphanedEntityIds.size > 0) {
    console.log(`⚠️  Found ${orphanedEntityIds.size} entity IDs referenced in memories but don't exist:`);
    Array.from(orphanedEntityIds).slice(0, 20).forEach(id => {
      console.log(`  - ${id}`);
    });
  } else {
    console.log('✅ All entity IDs in memories exist in the entities table\n');
  }

  // 9. Test data pollution check
  console.log('\n═════════════════════════════════════════════════════════════');
  console.log('7. TEST DATA POLLUTION CHECK');
  console.log('═════════════════════════════════════════════════════════════\n');

  const testDataResult = await db.execute(`
    SELECT COUNT(*) as count
    FROM entities
    WHERE user_id LIKE 'test-%' OR user_id LIKE '%test%' OR name LIKE '%test%'
  `);

  console.log(`Entities with "test" in user_id or name: ${(testDataResult.rows[0] as any).count}\n`);

  // 10. Summary
  console.log('═════════════════════════════════════════════════════════════');
  console.log('SUMMARY');
  console.log('═════════════════════════════════════════════════════════════\n');

  const summaryResult = await db.execute(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN user_id IS NULL THEN 1 ELSE 0 END) as null_users,
      SUM(CASE WHEN email IS NULL OR email = '' THEN 1 ELSE 0 END) as no_email,
      SUM(CASE WHEN phone IS NULL OR phone = '' THEN 1 ELSE 0 END) as no_phone,
      SUM(CASE WHEN description IS NULL OR description = '' THEN 1 ELSE 0 END) as no_description
    FROM entities
  `);

  const summary = summaryResult.rows[0] as any;
  console.log('Entity Database Summary:');
  console.log(`  Total Entities: ${summary.total}`);
  console.log(`  NULL user_id: ${summary.null_users} (${((summary.null_users / summary.total) * 100).toFixed(1)}%)`);
  console.log(`  No Email: ${summary.no_email} (${((summary.no_email / summary.total) * 100).toFixed(1)}%)`);
  console.log(`  No Phone: ${summary.no_phone} (${((summary.no_phone / summary.total) * 100).toFixed(1)}%)`);
  console.log(`  No Description: ${summary.no_description} (${((summary.no_description / summary.total) * 100).toFixed(1)}%)`);
  console.log('');
}

async function main() {
  try {
    await inspectEntityIssues();
  } catch (error) {
    console.error('❌ Inspection failed:', error);
    process.exit(1);
  }
}

main();
