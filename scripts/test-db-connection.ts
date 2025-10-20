#!/usr/bin/env tsx
/**
 * Test database connection
 */

import { initDatabaseFromEnv } from '../src/database/connection.js';

async function testConnection() {
  console.log('Testing database connection...');
  console.log('TURSO_URL:', process.env.TURSO_URL?.substring(0, 30) + '...');
  console.log('TURSO_AUTH_TOKEN:', process.env.TURSO_AUTH_TOKEN ? 'SET' : 'NOT SET');

  const db = initDatabaseFromEnv();

  try {
    console.log('\nConnecting...');
    await db.connect();
    console.log('✓ Connected!');

    console.log('\nTesting query...');
    const result = await db.execute('SELECT COUNT(*) as count FROM users');
    console.log('✓ Query successful! User count:', result.rows[0]);

    console.log('\nChecking for OAuth tables...');
    const tables = await db.execute(`
      SELECT name FROM sqlite_master
      WHERE type='table' AND name LIKE 'oauth_%'
      ORDER BY name
    `);

    if (tables.rows.length > 0) {
      console.log('Found OAuth tables:');
      tables.rows.forEach((row: any) => console.log('  -', row.name));
    } else {
      console.log('No OAuth tables found yet.');
    }

    await db.disconnect();
    console.log('\n✓ Test completed successfully!');
    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  }
}

testConnection();
