#!/usr/bin/env tsx
import { createClient } from '@libsql/client';
import { config } from 'dotenv';
config();

const db = createClient({
  url: process.env.TURSO_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!
});

async function checkSchema() {
  const result = await db.execute(`
    SELECT name FROM pragma_table_info('entities')
  `);

  console.log('Entity table columns:');
  result.rows.forEach((row: any) => console.log('  -', row.name));
}

checkSchema().catch(console.error);