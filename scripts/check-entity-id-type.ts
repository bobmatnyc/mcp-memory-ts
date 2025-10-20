/**
 * Check entity ID type in database
 */

import { createClient } from '@libsql/client';
import * as dotenv from 'dotenv';

dotenv.config();

async function checkEntityIdType() {
  const client = createClient({
    url: process.env.TURSO_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN!,
  });

  try {
    console.log('\n📊 Checking Entity ID Type\n');

    // Get table schema
    const schemaResult = await client.execute('PRAGMA table_info(entities)');
    const idColumn = schemaResult.rows.find((r: any) => r.name === 'id');

    console.log('ID Column Definition:');
    console.log(JSON.stringify(idColumn, null, 2));

    // Get sample IDs
    const samplesResult = await client.execute(
      'SELECT id, name FROM entities ORDER BY created_at DESC LIMIT 5'
    );

    console.log('\nSample IDs from database:');
    samplesResult.rows.forEach((row: any) => {
      console.log(`  - ID: ${row.id} (type: ${typeof row.id})`);
      console.log(`    Name: ${row.name}`);
    });
  } catch (error) {
    console.error('Error:', error);
  } finally {
    client.close();
  }
}

checkEntityIdType();
