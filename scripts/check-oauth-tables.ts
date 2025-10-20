#!/usr/bin/env tsx
/**
 * Check if OAuth tables exist in database
 */

import { createClient } from '@libsql/client';

async function checkTables() {
  const dbUrl = process.env.TURSO_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (!dbUrl || !authToken) {
    console.error('❌ Missing environment variables');
    process.exit(1);
  }

  try {
    const client = createClient({ url: dbUrl, authToken });

    console.log('Checking for OAuth tables...\n');

    const result = await client.execute(`
      SELECT name FROM sqlite_master
      WHERE type='table' AND name LIKE 'oauth_%'
      ORDER BY name
    `);

    if (result.rows.length > 0) {
      console.log('✓ Found OAuth tables:');
      result.rows.forEach((row: any) => {
        console.log(`  - ${row.name}`);
      });
      console.log(`\nTotal: ${result.rows.length} tables`);
    } else {
      console.log('⚠️  No OAuth tables found');
    }

    // Check indexes
    const indexes = await client.execute(`
      SELECT name FROM sqlite_master
      WHERE type='index' AND name LIKE 'idx_oauth%'
      ORDER BY name
    `);

    if (indexes.rows.length > 0) {
      console.log('\n✓ Found OAuth indexes:');
      indexes.rows.forEach((row: any) => {
        console.log(`  - ${row.name}`);
      });
      console.log(`\nTotal: ${indexes.rows.length} indexes`);
    }

    client.close();
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkTables();
