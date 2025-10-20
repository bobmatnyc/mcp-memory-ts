#!/usr/bin/env node
/**
 * Verify Entity References Health Check
 *
 * Quick health check to verify all entity_ids in memories reference valid entities.
 * Run this periodically to ensure data integrity.
 *
 * Usage:
 *   npx tsx scripts/verify-entity-references.ts
 */

import { config } from 'dotenv';
import { createClient } from '@libsql/client';

config();

const db = createClient({
  url: process.env.TURSO_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

async function verifyEntityReferences() {
  console.log('🔍 Entity References Health Check\n');
  console.log('='.repeat(60));

  try {
    // Get all memories with entity_ids
    const memoriesResult = await db.execute(
      `SELECT id, entity_ids, user_id
       FROM memories
       WHERE entity_ids IS NOT NULL
         AND entity_ids != ''
         AND entity_ids != '[]'`
    );
    const memories = memoriesResult.rows as any[];

    console.log(`\n📊 Memories with entity_ids: ${memories.length}`);

    if (memories.length === 0) {
      console.log('✅ No entity references to verify - all clean!\n');
      console.log('='.repeat(60));
      console.log('Status: ✅ HEALTHY');
      console.log('Broken References: 0');
      console.log('Action Required: None');
      console.log('='.repeat(60));
      return;
    }

    // Get all existing entity IDs
    const entitiesResult = await db.execute('SELECT id FROM entities');
    const entityIds = new Set(entitiesResult.rows.map((row: any) => row.id));

    console.log(`📊 Total entities: ${entityIds.size}\n`);

    // Verify each memory's entity references
    let brokenCount = 0;
    let validCount = 0;
    const brokenMemories: any[] = [];

    for (const memory of memories) {
      let entityIdArray: string[] = [];

      try {
        if (memory.entity_ids.startsWith('[')) {
          entityIdArray = JSON.parse(memory.entity_ids);
        } else {
          entityIdArray = memory.entity_ids.split(',').map((id: string) => id.trim());
        }
      } catch (e) {
        console.log(`⚠️  Invalid JSON in memory ${memory.id}`);
        brokenCount++;
        continue;
      }

      const missingIds = entityIdArray.filter(id => !entityIds.has(id));

      if (missingIds.length > 0) {
        brokenCount++;
        brokenMemories.push({
          memoryId: memory.id,
          missingIds: missingIds,
        });
      } else {
        validCount++;
      }
    }

    console.log('='.repeat(60));
    console.log('Results:');
    console.log('='.repeat(60));
    console.log(`✅ Valid references: ${validCount}`);
    console.log(`❌ Broken references: ${brokenCount}\n`);

    if (brokenCount === 0) {
      console.log('='.repeat(60));
      console.log('Status: ✅ HEALTHY');
      console.log('All entity references are valid!');
      console.log('Action Required: None');
      console.log('='.repeat(60));
    } else {
      console.log('='.repeat(60));
      console.log('Status: ⚠️  ISSUES DETECTED');
      console.log(`Found ${brokenCount} memories with broken entity references`);
      console.log('\nBroken Memory IDs:');
      brokenMemories.slice(0, 10).forEach(m => {
        console.log(`  ${m.memoryId}: missing ${m.missingIds.join(', ')}`);
      });
      if (brokenMemories.length > 10) {
        console.log(`  ... and ${brokenMemories.length - 10} more`);
      }
      console.log('\nAction Required:');
      console.log('  1. Review the broken references');
      console.log('  2. Run cleanup script to fix');
      console.log('  3. Consider adding foreign key constraints');
      console.log('='.repeat(60));
    }

    // Additional statistics
    console.log('\nDatabase Statistics:');
    console.log('='.repeat(60));

    const totalMemories = await db.execute('SELECT COUNT(*) as count FROM memories');
    const memoryCount = (totalMemories.rows[0] as any).count;

    console.log(`Total memories: ${memoryCount}`);
    console.log(`Memories with entity_ids: ${memories.length} (${((memories.length / memoryCount) * 100).toFixed(1)}%)`);
    console.log(`Valid entity references: ${validCount}`);
    console.log(`Broken entity references: ${brokenCount}`);
    console.log('='.repeat(60));

    if (brokenCount > 0) {
      process.exit(1);
    }

  } catch (error) {
    console.error('\n❌ Error during verification:', error);
    throw error;
  } finally {
    db.close();
  }
}

// Run verification
verifyEntityReferences()
  .then(() => {
    console.log('\n✅ Verification complete\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Verification failed:', error);
    process.exit(1);
  });
