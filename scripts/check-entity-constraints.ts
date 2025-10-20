#!/usr/bin/env tsx
import { createClient } from '@libsql/client';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const db = createClient({
  url: process.env.TURSO_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

async function checkConstraints() {
  // Check for entity-related tables
  const tables = await db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%entity%'");
  console.log('Entity-related tables:');
  tables.rows.forEach(row => console.log('  -', row.name));

  // Check for foreign key constraints
  const fkCheck = await db.execute("PRAGMA foreign_key_list(entities)");
  console.log('\nForeign keys on entities table:');
  if (fkCheck.rows.length === 0) {
    console.log('  None');
  } else {
    fkCheck.rows.forEach(row => console.log('  -', JSON.stringify(row)));
  }

  // Check entity_relationships if it exists
  try {
    const relCount = await db.execute("SELECT COUNT(*) as count FROM entity_relationships");
    console.log('\nEntity relationships count:', relCount.rows[0].count);

    // Check which entities have relationships
    const relCheck = await db.execute(`
      SELECT entity_id, related_entity_id, COUNT(*) as count
      FROM entity_relationships
      GROUP BY entity_id, related_entity_id
      LIMIT 10
    `);
    console.log('\nSample relationships:');
    relCheck.rows.forEach(row => console.log('  -', JSON.stringify(row)));
  } catch (e) {
    console.log('\nNo entity_relationships table');
  }

  // Check interactions table references
  try {
    const intCheck = await db.execute("PRAGMA foreign_key_list(interactions)");
    console.log('\nForeign keys on interactions table:');
    if (intCheck.rows.length === 0) {
      console.log('  None');
    } else {
      intCheck.rows.forEach(row => console.log('  -', JSON.stringify(row)));
    }

    const intCount = await db.execute("SELECT COUNT(*) as count FROM interactions WHERE entities IS NOT NULL AND entities != '[]'");
    console.log('\nInteractions with entities:', intCount.rows[0].count);
  } catch (e) {
    console.log('\nError checking interactions:', e.message);
  }
}

checkConstraints().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
