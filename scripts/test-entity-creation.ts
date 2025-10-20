/**
 * Test script to verify entity creation with new schema columns
 *
 * This script tests that entities can be created with the new columns
 * (importance, website, social_media, relationships, last_interaction, interaction_count)
 *
 * Usage:
 *   tsx scripts/test-entity-creation.ts
 */

import { createClient } from '@libsql/client';
import * as dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';

dotenv.config();

async function testEntityCreation() {
  const client = createClient({
    url: process.env.TURSO_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN!,
  });

  console.log('\n🧪 Testing Entity Creation with New Schema');
  console.log('═══════════════════════════════════════════\n');

  try {
    const testUserId = process.env.DEFAULT_USER_EMAIL || 'test@example.com';
    const testEntityName = `Test Entity ${Date.now()}`;

    // Generate UUID for entity ID
    const entityId = uuidv4();

    // Test data for all new columns
    const testData = {
      id: entityId,
      user_id: testUserId,
      name: testEntityName,
      entity_type: 'person',
      person_type: 'contact',
      description: 'Test entity to verify schema migration',
      company: 'Test Company',
      title: 'Test Title',
      contact_info: JSON.stringify({
        email: 'test@example.com',
        phone: '555-1234',
      }),
      notes: 'Created by test script',
      tags: JSON.stringify(['test', 'migration']),
      metadata: JSON.stringify({ source: 'test-script' }),
      importance: 3, // NEW COLUMN
      website: 'https://example.com', // NEW COLUMN
      social_media: JSON.stringify({
        // NEW COLUMN
        twitter: '@testuser',
        linkedin: 'testuser',
      }),
      relationships: JSON.stringify([
        // NEW COLUMN
        { type: 'colleague', entityId: '123' },
      ]),
      last_interaction: new Date().toISOString(), // NEW COLUMN
      interaction_count: 5, // NEW COLUMN
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    console.log('📝 Attempting to create entity with new columns...\n');
    console.log('Test data:');
    console.log(`  - Name: ${testData.name}`);
    console.log(`  - Importance: ${testData.importance}`);
    console.log(`  - Website: ${testData.website}`);
    console.log(`  - Social Media: ${testData.social_media}`);
    console.log(`  - Relationships: ${testData.relationships}`);
    console.log(`  - Last Interaction: ${testData.last_interaction}`);
    console.log(`  - Interaction Count: ${testData.interaction_count}\n`);

    const sql = `
      INSERT INTO entities (
        id, user_id, name, entity_type, person_type, description,
        company, title, contact_info, notes, tags, metadata,
        importance, website, social_media, relationships,
        last_interaction, interaction_count,
        created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const result = await client.execute(sql, [
      testData.id,
      testData.user_id,
      testData.name,
      testData.entity_type,
      testData.person_type,
      testData.description,
      testData.company,
      testData.title,
      testData.contact_info,
      testData.notes,
      testData.tags,
      testData.metadata,
      testData.importance,
      testData.website,
      testData.social_media,
      testData.relationships,
      testData.last_interaction,
      testData.interaction_count,
      testData.created_at,
      testData.updated_at,
    ]);

    console.log(`✅ Entity created successfully with ID: ${entityId}\n`);

    // Wait a moment for Turso consistency (eventual consistency)
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Verify the entity was created correctly
    console.log('🔍 Verifying entity data...\n');
    console.log(`   Looking for entity with ID: ${entityId} (type: ${typeof entityId})\n`);

    const verifyResult = await client.execute('SELECT * FROM entities WHERE id = ?', [entityId]);

    console.log(`   Query returned ${verifyResult.rows.length} rows`);

    if (verifyResult.rows.length === 0) {
      // Try as string
      const stringResult = await client.execute('SELECT * FROM entities WHERE id = ?', [
        String(entityId),
      ]);
      console.log(`   Query with String(id) returned ${stringResult.rows.length} rows`);

      if (stringResult.rows.length > 0) {
        console.log('   ✅ Found entity using String(id)!');
      } else {
        // Check all entities to see what IDs exist
        const allResult = await client.execute('SELECT id FROM entities ORDER BY id DESC LIMIT 5');
        console.log('   Last 5 entity IDs in database:', allResult.rows.map((r: any) => r.id));
        throw new Error('Entity not found after creation');
      }
    }

    const entity = verifyResult.rows[0] as any;
    console.log(`✅ Entity found with ID: ${entity.id}\n`);

    // Check all new columns
    const checks = [
      { field: 'importance', expected: testData.importance, actual: entity.importance },
      { field: 'website', expected: testData.website, actual: entity.website },
      { field: 'social_media', expected: testData.social_media, actual: entity.social_media },
      { field: 'relationships', expected: testData.relationships, actual: entity.relationships },
      {
        field: 'last_interaction',
        expected: testData.last_interaction,
        actual: entity.last_interaction,
      },
      {
        field: 'interaction_count',
        expected: testData.interaction_count,
        actual: entity.interaction_count,
      },
    ];

    let allPassed = true;
    checks.forEach((check) => {
      const passed = check.actual === check.expected;
      const status = passed ? '✅' : '❌';
      console.log(`${status} ${check.field}: ${check.actual} ${passed ? '' : `(expected: ${check.expected})`}`);
      if (!passed) allPassed = false;
    });

    console.log('');

    // Clean up test entity
    console.log('🧹 Cleaning up test entity...\n');
    await client.execute('DELETE FROM entities WHERE id = ?', [entityId]);
    console.log('✅ Test entity deleted\n');

    if (allPassed) {
      console.log('✨ All tests PASSED! Schema migration successful.\n');
      process.exit(0);
    } else {
      console.error('❌ Some tests FAILED. Check column values above.\n');
      process.exit(1);
    }
  } catch (error: any) {
    console.error('\n❌ Test FAILED:', error.message);

    if (error.message.includes('no such column')) {
      console.error('\n⚠️  Column missing error detected!');
      console.error('   Run: npm run migrate:entities');
      console.error('');
    }

    console.error('\nFull error:', error);
    process.exit(1);
  } finally {
    client.close();
  }
}

// Run test
testEntityCreation();
