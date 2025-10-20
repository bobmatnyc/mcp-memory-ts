#!/usr/bin/env tsx
/**
 * Direct OAuth migration using libsql client
 * Bypasses the connection timeout issue by using direct client creation
 */

import { createClient } from '@libsql/client';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function runMigration() {
  console.log('====================================');
  console.log('OAuth 2.0 Database Migration (Direct)');
  console.log('====================================\n');

  const dbUrl = process.env.TURSO_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (!dbUrl || !authToken) {
    console.error('❌ Missing TURSO_URL or TURSO_AUTH_TOKEN environment variables');
    process.exit(1);
  }

  console.log('Database URL:', dbUrl.substring(0, 30) + '...');
  console.log('Auth Token:', authToken ? 'SET' : 'NOT SET');
  console.log('');

  try {
    // Create client directly
    console.log('Creating database client...');
    const client = createClient({
      url: dbUrl,
      authToken: authToken,
    });

    console.log('✓ Client created\n');

    // Read SQL file
    const sqlPath = path.join(__dirname, 'oauth-migration.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf-8');

    // Split into individual statements
    const statements = sqlContent
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    console.log(`Found ${statements.length} SQL statements to execute\n`);

    // Execute each statement
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      const statementType = stmt.match(/CREATE\s+(TABLE|INDEX)/i)?.[0] || 'STATEMENT';
      const tableName = stmt.match(/(?:TABLE|INDEX)\s+IF\s+NOT\s+EXISTS\s+(\w+)/i)?.[1] || 'unknown';

      try {
        await client.execute(stmt);
        console.log(`✓ ${statementType}: ${tableName}`);
        successCount++;
      } catch (error: any) {
        console.error(`✗ ${statementType}: ${tableName} - ${error.message}`);
        errorCount++;
      }
    }

    console.log('\n====================================');
    console.log(`Migration Summary:`);
    console.log(`  Successful: ${successCount}`);
    console.log(`  Failed: ${errorCount}`);
    console.log('====================================\n');

    // Verify tables were created
    console.log('Verifying OAuth tables...\n');
    const result = await client.execute(`
      SELECT name FROM sqlite_master
      WHERE type='table' AND name LIKE 'oauth_%'
      ORDER BY name
    `);

    if (result.rows.length > 0) {
      console.log('✓ OAuth tables created:');
      result.rows.forEach((row: any) => {
        console.log(`  - ${row.name}`);
      });
    } else {
      console.log('⚠️  No OAuth tables found');
    }

    client.close();
    console.log('\n✓ Migration completed successfully!');
    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ Migration failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

runMigration();
