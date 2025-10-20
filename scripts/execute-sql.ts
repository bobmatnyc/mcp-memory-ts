#!/usr/bin/env tsx
/**
 * Execute SQL from stdin using libsql client
 */

import { createClient } from '@libsql/client';
import * as fs from 'fs';

async function executeSql() {
  const dbUrl = process.env.TURSO_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  const sqlFile = process.argv[2];

  if (!dbUrl || !authToken) {
    console.error('❌ Missing TURSO_URL or TURSO_AUTH_TOKEN');
    process.exit(1);
  }

  if (!sqlFile) {
    console.error('❌ Usage: tsx execute-sql.ts <sql-file>');
    process.exit(1);
  }

  try {
    const client = createClient({ url: dbUrl, authToken });
    const sql = fs.readFileSync(sqlFile, 'utf-8');

    // Remove comments and split into statements
    const cleanedSql = sql
      .split('\n')
      .filter(line => !line.trim().startsWith('--'))
      .join('\n');

    const statements = cleanedSql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    console.log(`Executing ${statements.length} SQL statements...\n`);

    for (const stmt of statements) {
      await client.execute(stmt);
      const match = stmt.match(/CREATE\s+(TABLE|INDEX)\s+IF\s+NOT\s+EXISTS\s+(\w+)/i);
      if (match) {
        console.log(`✓ ${match[1]}: ${match[2]}`);
      }
    }

    client.close();
    console.log('\n✓ Complete!');
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

executeSql();
