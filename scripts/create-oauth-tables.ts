#!/usr/bin/env tsx
/**
 * OAuth 2.0 Database Schema Migration
 * Creates tables for OAuth clients, authorization codes, and access tokens
 */

import { initDatabaseFromEnv } from '../src/database/connection.js';

const CREATE_OAUTH_TABLES = {
  oauth_clients: `
    CREATE TABLE IF NOT EXISTS oauth_clients (
      client_id TEXT PRIMARY KEY,
      client_secret_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      redirect_uris TEXT NOT NULL,
      allowed_scopes TEXT NOT NULL,
      created_at TEXT NOT NULL,
      created_by TEXT NOT NULL,
      is_active INTEGER DEFAULT 1,
      metadata TEXT,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
    )
  `,

  oauth_authorization_codes: `
    CREATE TABLE IF NOT EXISTS oauth_authorization_codes (
      code TEXT PRIMARY KEY,
      client_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      redirect_uri TEXT NOT NULL,
      scope TEXT NOT NULL,
      state TEXT,
      code_challenge TEXT,
      code_challenge_method TEXT,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      used INTEGER DEFAULT 0,
      FOREIGN KEY (client_id) REFERENCES oauth_clients(client_id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `,

  oauth_access_tokens: `
    CREATE TABLE IF NOT EXISTS oauth_access_tokens (
      token TEXT PRIMARY KEY,
      client_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      scope TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      revoked INTEGER DEFAULT 0,
      metadata TEXT,
      FOREIGN KEY (client_id) REFERENCES oauth_clients(client_id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `,

  oauth_refresh_tokens: `
    CREATE TABLE IF NOT EXISTS oauth_refresh_tokens (
      token TEXT PRIMARY KEY,
      access_token TEXT NOT NULL,
      client_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      scope TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      revoked INTEGER DEFAULT 0,
      FOREIGN KEY (access_token) REFERENCES oauth_access_tokens(token) ON DELETE CASCADE,
      FOREIGN KEY (client_id) REFERENCES oauth_clients(client_id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `,
};

const CREATE_OAUTH_INDEXES = {
  oauth_clients: [
    'CREATE INDEX IF NOT EXISTS idx_oauth_clients_created_by ON oauth_clients(created_by)',
    'CREATE INDEX IF NOT EXISTS idx_oauth_clients_active ON oauth_clients(is_active)',
  ],
  oauth_authorization_codes: [
    'CREATE INDEX IF NOT EXISTS idx_oauth_codes_client ON oauth_authorization_codes(client_id)',
    'CREATE INDEX IF NOT EXISTS idx_oauth_codes_user ON oauth_authorization_codes(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_oauth_codes_expires ON oauth_authorization_codes(expires_at)',
    'CREATE INDEX IF NOT EXISTS idx_oauth_codes_used ON oauth_authorization_codes(used)',
  ],
  oauth_access_tokens: [
    'CREATE INDEX IF NOT EXISTS idx_oauth_tokens_client ON oauth_access_tokens(client_id)',
    'CREATE INDEX IF NOT EXISTS idx_oauth_tokens_user ON oauth_access_tokens(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_oauth_tokens_expires ON oauth_access_tokens(expires_at)',
    'CREATE INDEX IF NOT EXISTS idx_oauth_tokens_revoked ON oauth_access_tokens(revoked)',
  ],
  oauth_refresh_tokens: [
    'CREATE INDEX IF NOT EXISTS idx_oauth_refresh_access ON oauth_refresh_tokens(access_token)',
    'CREATE INDEX IF NOT EXISTS idx_oauth_refresh_client ON oauth_refresh_tokens(client_id)',
    'CREATE INDEX IF NOT EXISTS idx_oauth_refresh_user ON oauth_refresh_tokens(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_oauth_refresh_expires ON oauth_refresh_tokens(expires_at)',
  ],
};

async function createOAuthTables(dryRun = false): Promise<void> {
  console.log('====================================');
  console.log('OAuth 2.0 Database Schema Migration');
  console.log('====================================\n');

  if (dryRun) {
    console.log('DRY RUN MODE - No changes will be made\n');
  }

  let db;
  try {
    // Initialize database with timeout
    console.log('Initializing database connection...');
    db = initDatabaseFromEnv();

    const connectTimeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Database connection timeout')), 10000)
    );

    await Promise.race([db.connect(), connectTimeout]);

    console.log('Connected to database successfully\n');

    // Create tables
    console.log('Creating OAuth tables...\n');
    for (const [tableName, sql] of Object.entries(CREATE_OAUTH_TABLES)) {
      console.log(`Creating table: ${tableName}`);
      if (!dryRun) {
        await db.execute(sql);
        console.log(`✓ Created ${tableName}`);
      } else {
        console.log(`[DRY RUN] Would create ${tableName}`);
        console.log(sql);
      }
      console.log('');
    }

    // Create indexes
    console.log('\nCreating OAuth indexes...\n');
    for (const [tableName, indexes] of Object.entries(CREATE_OAUTH_INDEXES)) {
      console.log(`Creating indexes for: ${tableName}`);
      for (const indexSql of indexes) {
        if (!dryRun) {
          await db.execute(indexSql);
        }
        const indexName = indexSql.match(/idx_\w+/)?.[0] || 'unknown';
        console.log(`  ${dryRun ? '[DRY RUN] Would create' : '✓ Created'} ${indexName}`);
      }
      console.log('');
    }

    if (!dryRun) {
      console.log('\n✅ OAuth schema migration completed successfully');
    } else {
      console.log('\n✅ Dry run completed - no changes made');
    }

    // Show table stats
    console.log('\nDatabase table summary:');
    const tables = await db.execute(`
      SELECT name FROM sqlite_master
      WHERE type='table' AND name LIKE 'oauth_%'
      ORDER BY name
    `);

    if (tables.rows.length > 0) {
      console.log('\nOAuth tables:');
      for (const row of tables.rows) {
        const tableName = (row as any).name;
        console.log(`  - ${tableName}`);
      }
    } else if (!dryRun) {
      console.log('  No OAuth tables found (migration may have failed)');
    }

    if (db) {
      await db.disconnect();
    }
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    if (db) {
      try {
        await db.disconnect();
      } catch (disconnectError) {
        console.error('Error disconnecting:', disconnectError);
      }
    }
    throw error;
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run') || args.includes('-d');

// Run migration
createOAuthTables(dryRun).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
