#!/usr/bin/env tsx
/**
 * Comprehensive NULL ID Checker
 *
 * Quick script to check for NULL IDs across all critical tables
 */

import { createClient } from '@libsql/client';
import { config } from 'dotenv';

config();

const db = createClient({
  url: process.env.TURSO_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!
});

async function checkNullIds() {
  try {
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('🔍 MCP Memory - Comprehensive NULL ID Check');
    console.log('═══════════════════════════════════════════════════════\n');

    // Check entities
    const entitiesResult = await db.execute(
      'SELECT COUNT(*) as count FROM entities WHERE id IS NULL'
    );
    const entitiesCount = Number(entitiesResult.rows[0].count);

    // Check memories
    const memoriesResult = await db.execute(
      'SELECT COUNT(*) as count FROM memories WHERE id IS NULL'
    );
    const memoriesCount = Number(memoriesResult.rows[0].count);

    // Check interactions
    const interactionsResult = await db.execute(
      'SELECT COUNT(*) as count FROM interactions WHERE id IS NULL'
    );
    const interactionsCount = Number(interactionsResult.rows[0].count);

    const totalNulls = entitiesCount + memoriesCount + interactionsCount;

    console.log('📊 NULL ID Status:');
    console.log('───────────────────────────────────────────────────────');
    console.log(
      `Entities:      ${entitiesCount.toString().padStart(5)} NULL IDs ${entitiesCount === 0 ? '✅' : '❌'}`
    );
    console.log(
      `Memories:      ${memoriesCount.toString().padStart(5)} NULL IDs ${memoriesCount === 0 ? '✅' : '❌'}`
    );
    console.log(
      `Interactions:  ${interactionsCount.toString().padStart(5)} NULL IDs ${interactionsCount === 0 ? '✅' : '❌'}`
    );
    console.log('───────────────────────────────────────────────────────');
    console.log(`Total:         ${totalNulls.toString().padStart(5)} NULL IDs\n`);

    // Get totals
    const entitiesTotal = await db.execute('SELECT COUNT(*) as count FROM entities');
    const memoriesTotal = await db.execute('SELECT COUNT(*) as count FROM memories');
    const interactionsTotal = await db.execute('SELECT COUNT(*) as count FROM interactions');

    console.log('📈 Database Statistics:');
    console.log('───────────────────────────────────────────────────────');
    console.log(`Total entities:      ${entitiesTotal.rows[0].count.toString().padStart(5)}`);
    console.log(`Total memories:      ${memoriesTotal.rows[0].count.toString().padStart(5)}`);
    console.log(`Total interactions:  ${interactionsTotal.rows[0].count.toString().padStart(5)}`);
    console.log('───────────────────────────────────────────────────────\n');

    if (totalNulls === 0) {
      console.log('✅ PERFECT! No NULL IDs found in any table!');
      console.log('🎉 Database is production ready!\n');
    } else {
      console.log(`⚠️  WARNING: Found ${totalNulls} total NULL IDs!`);
      console.log('\nRecommended Actions:');
      if (entitiesCount > 0) {
        console.log('  - Run: npx tsx scripts/fix-null-ids-entities.ts');
      }
      if (memoriesCount > 0) {
        console.log('  - Run: npx tsx scripts/fix-null-ids-v2.ts');
      }
      if (interactionsCount > 0) {
        console.log('  - Check interactions table manually');
      }
      console.log('');
    }

    // Sample NULL records if any exist
    if (totalNulls > 0) {
      console.log('🔍 Sample NULL ID Records:');
      console.log('───────────────────────────────────────────────────────');

      if (entitiesCount > 0) {
        const samples = await db.execute(
          'SELECT rowid, name, entity_type FROM entities WHERE id IS NULL LIMIT 3'
        );
        console.log('\nEntities:');
        samples.rows.forEach(row => {
          console.log(`  ROWID ${row.rowid}: ${row.name} (${row.entity_type})`);
        });
      }

      if (memoriesCount > 0) {
        const samples = await db.execute(
          'SELECT rowid, title, memory_type FROM memories WHERE id IS NULL LIMIT 3'
        );
        console.log('\nMemories:');
        samples.rows.forEach(row => {
          console.log(`  ROWID ${row.rowid}: ${row.title} (${row.memory_type})`);
        });
      }

      if (interactionsCount > 0) {
        const samples = await db.execute(
          'SELECT rowid, title FROM interactions WHERE id IS NULL LIMIT 3'
        );
        console.log('\nInteractions:');
        samples.rows.forEach(row => {
          console.log(`  ROWID ${row.rowid}: ${row.title}`);
        });
      }
      console.log('');
    }

    console.log('═══════════════════════════════════════════════════════\n');
    process.exit(totalNulls === 0 ? 0 : 1);
  } catch (error: any) {
    console.error('\n❌ Error checking NULL IDs:', error.message);
    process.exit(1);
  }
}

checkNullIds();
