/**
 * Check actual entity table schema
 */

import { createClient } from '@libsql/client';
import * as dotenv from 'dotenv';

dotenv.config();

async function checkSchema() {
  const tursoUrl = process.env.TURSO_URL;
  const tursoAuthToken = process.env.TURSO_AUTH_TOKEN;

  if (!tursoUrl || !tursoAuthToken) {
    throw new Error('Missing credentials');
  }

  const db = createClient({
    url: tursoUrl,
    authToken: tursoAuthToken,
  });

  console.log('🔍 Checking actual entity table schema...\n');

  // Get table schema
  const schemaResult = await db.execute(`PRAGMA table_info(entities)`);

  console.log('ENTITIES TABLE COLUMNS:');
  console.log('═════════════════════════════════════════════════════════════');
  schemaResult.rows.forEach((row: any) => {
    console.log(`Column: ${row.name}`);
    console.log(`  Type: ${row.type}`);
    console.log(`  Not Null: ${row.notnull === 1}`);
    console.log(`  Default: ${row.dflt_value || 'NULL'}`);
    console.log(`  Primary Key: ${row.pk === 1}`);
    console.log('');
  });

  // Sample an entity to see actual data structure
  const sampleResult = await db.execute(`SELECT * FROM entities LIMIT 1`);

  if (sampleResult.rows.length > 0) {
    console.log('\nSAMPLE ENTITY:');
    console.log('═════════════════════════════════════════════════════════════');
    const sample = sampleResult.rows[0] as any;
    for (const [key, value] of Object.entries(sample)) {
      const displayValue = typeof value === 'string' && value.length > 100
        ? value.substring(0, 100) + '...'
        : value;
      console.log(`${key}: ${displayValue}`);
    }
  }

  // Count entities
  const countResult = await db.execute(`SELECT COUNT(*) as count FROM entities`);
  console.log(`\nTotal entities: ${(countResult.rows[0] as any).count}`);
}

checkSchema().catch(console.error);
