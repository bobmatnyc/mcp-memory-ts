#!/usr/bin/env tsx

import { DatabaseConnection } from '../src/database/connection.js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.test' });

async function checkAllSchemas() {
  console.log('🔍 CHECKING ALL DATABASE SCHEMAS');
  console.log('='.repeat(50));

  const db = new DatabaseConnection({
    url: process.env.TURSO_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  try {
    await db.connect();

    const tables = ['users', 'memories', 'entities', 'interactions'];

    for (const tableName of tables) {
      console.log(`\n📋 TABLE: ${tableName.toUpperCase()}`);
      console.log('-'.repeat(30));

      try {
        // Get table schema
        const schema = await db.execute('SELECT sql FROM sqlite_master WHERE type="table" AND name=?', [tableName]);
        if (schema.rows.length > 0) {
          console.log('CREATE TABLE STATEMENT:');
          console.log(schema.rows[0]?.sql || 'No schema found');

          // Get column details
          const tableInfo = await db.execute(`PRAGMA table_info(${tableName})`);
          console.log('\nCOLUMNS:');
          tableInfo.rows.forEach((row: any) => {
            console.log(`  ${row.name}: ${row.type} (pk: ${row.pk}, notnull: ${row.notnull}, default: ${row.dflt_value})`);
          });
        } else {
          console.log('❌ Table does not exist');
        }
      } catch (error) {
        console.log('❌ Error:', error);
      }
    }

    await db.disconnect();

  } catch (error) {
    console.log('Error:', error);
  }
}

checkAllSchemas();