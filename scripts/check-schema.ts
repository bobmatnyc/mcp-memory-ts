#!/usr/bin/env tsx

import { DatabaseConnection } from '../src/database/connection.js';

async function checkSchema() {
  console.log('🔍 CHECKING DATABASE SCHEMA');
  console.log('='.repeat(40));

  const db = new DatabaseConnection({
    url: process.env.TURSO_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  try {
    await db.connect();
    
    // Check memories table schema
    const schema = await db.execute('SELECT sql FROM sqlite_master WHERE type="table" AND name="memories"');
    console.log('ACTUAL MEMORIES TABLE SCHEMA:');
    console.log(schema.rows[0]?.sql || 'Table not found');
    
    // Check if ID column has autoincrement
    const tableInfo = await db.execute('PRAGMA table_info(memories)');
    console.log('\nCOLUMN DETAILS:');
    tableInfo.rows.forEach((row: any) => {
      console.log(`  ${row.name}: ${row.type} (pk: ${row.pk}, notnull: ${row.notnull})`);
    });

    await db.disconnect();

  } catch (error) {
    console.log('Error:', error);
  }
}

checkSchema();
