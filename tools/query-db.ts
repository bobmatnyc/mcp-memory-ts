#!/usr/bin/env tsx
/**
 * Simple Database Query Tool
 *
 * This script allows you to run custom SQL queries against the database
 *
 * Usage:
 *   npx tsx tools/query-db.ts "SELECT * FROM users"
 *   npx tsx tools/query-db.ts "SELECT * FROM memories WHERE user_id = ?" user-id-here
 */

import { createClient } from '@libsql/client';

const TURSO_URL = process.env.TURSO_URL!;
const TURSO_AUTH_TOKEN = process.env.TURSO_AUTH_TOKEN!;

if (!TURSO_URL || !TURSO_AUTH_TOKEN) {
  console.error('❌ Error: TURSO_URL and TURSO_AUTH_TOKEN must be set');
  process.exit(1);
}

const db = createClient({
  url: TURSO_URL,
  authToken: TURSO_AUTH_TOKEN,
});

async function runQuery() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('Usage: npx tsx tools/query-db.ts "SQL QUERY" [param1] [param2] ...');
    console.log('');
    console.log('Examples:');
    console.log('  npx tsx tools/query-db.ts "SELECT * FROM users"');
    console.log('  npx tsx tools/query-db.ts "SELECT * FROM memories WHERE user_id = ?" user-id');
    console.log('  npx tsx tools/query-db.ts "SELECT COUNT(*) as count FROM memories"');
    console.log('');
    console.log('Common queries:');
    console.log('  - List users: "SELECT id, email, name FROM users"');
    console.log('  - Count memories: "SELECT user_id, COUNT(*) FROM memories GROUP BY user_id"');
    console.log('  - Find user: "SELECT * FROM users WHERE email = ?" email@example.com');
    console.log('  - User memories: "SELECT * FROM memories WHERE user_id = ?" user-id');
    process.exit(1);
  }

  const query = args[0];
  const params = args.slice(1);

  console.log('🔍 Executing query:');
  console.log(`   ${query}`);
  if (params.length > 0) {
    console.log(`   Params: ${params.join(', ')}`);
  }
  console.log('');

  try {
    const result = await db.execute(query, params);

    console.log(`✅ Query executed successfully`);
    console.log(`   Rows returned: ${result.rows.length}`);
    console.log('');

    if (result.rows.length > 0) {
      // Display as table
      console.log('Results:');
      console.log('-'.repeat(80));

      // Get column names from first row
      const firstRow = result.rows[0] as any;
      const columns = Object.keys(firstRow);

      // Print header
      console.log(columns.join(' | '));
      console.log('-'.repeat(80));

      // Print rows
      result.rows.forEach((row: any) => {
        const values = columns.map(col => {
          const val = row[col];
          if (val === null || val === undefined) return 'NULL';
          if (typeof val === 'string' && val.length > 50) {
            return val.substring(0, 47) + '...';
          }
          return String(val);
        });
        console.log(values.join(' | '));
      });

      console.log('-'.repeat(80));
      console.log(`Total: ${result.rows.length} rows`);
    } else {
      console.log('No rows returned');
    }

  } catch (error) {
    console.error('❌ Query error:', error);
    process.exit(1);
  } finally {
    await db.close();
  }
}

runQuery();
