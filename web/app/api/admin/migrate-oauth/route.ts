/**
 * Administrative endpoint to run OAuth database migration
 * This runs on Vercel where Turso access works
 */

import { NextRequest, NextResponse } from 'next/server';
import { initDatabaseFromEnv } from '../../../../../src/database/connection.js';

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
    'CREATE INDEX IF NOT EXISTS idx_oauth_auth_codes_client ON oauth_authorization_codes(client_id)',
    'CREATE INDEX IF NOT EXISTS idx_oauth_auth_codes_user ON oauth_authorization_codes(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_oauth_auth_codes_expires ON oauth_authorization_codes(expires_at)',
    'CREATE INDEX IF NOT EXISTS idx_oauth_auth_codes_used ON oauth_authorization_codes(used)',
  ],
  oauth_access_tokens: [
    'CREATE INDEX IF NOT EXISTS idx_oauth_access_tokens_client ON oauth_access_tokens(client_id)',
    'CREATE INDEX IF NOT EXISTS idx_oauth_access_tokens_user ON oauth_access_tokens(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_oauth_access_tokens_expires ON oauth_access_tokens(expires_at)',
    'CREATE INDEX IF NOT EXISTS idx_oauth_access_tokens_revoked ON oauth_access_tokens(revoked)',
  ],
  oauth_refresh_tokens: [
    'CREATE INDEX IF NOT EXISTS idx_oauth_refresh_tokens_access ON oauth_refresh_tokens(access_token)',
    'CREATE INDEX IF NOT EXISTS idx_oauth_refresh_tokens_client ON oauth_refresh_tokens(client_id)',
    'CREATE INDEX IF NOT EXISTS idx_oauth_refresh_tokens_user ON oauth_refresh_tokens(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_oauth_refresh_tokens_expires ON oauth_refresh_tokens(expires_at)',
  ],
};

export async function POST(req: NextRequest) {
  try {
    // Simple admin auth - check for admin token
    const authHeader = req.headers.get('authorization');
    const adminToken = process.env.ADMIN_TOKEN;

    if (!adminToken || authHeader !== `Bearer ${adminToken}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const db = initDatabaseFromEnv();
    await db.connect();

    const results: string[] = [];

    // Create tables
    for (const [tableName, sql] of Object.entries(CREATE_OAUTH_TABLES)) {
      try {
        await db.execute(sql);
        results.push(`✓ Created table: ${tableName}`);
      } catch (error: any) {
        results.push(`✗ Error creating ${tableName}: ${error.message}`);
      }
    }

    // Create indexes
    for (const [tableName, indexes] of Object.entries(CREATE_OAUTH_INDEXES)) {
      for (const indexSql of indexes) {
        try {
          await db.execute(indexSql);
          const indexName = indexSql.match(/idx_\w+/)?.[0] || 'unknown';
          results.push(`✓ Created index: ${indexName}`);
        } catch (error: any) {
          results.push(`✗ Error creating index: ${error.message}`);
        }
      }
    }

    // Verify tables exist
    const verifyResult = await db.execute(`
      SELECT name FROM sqlite_master
      WHERE type='table' AND name LIKE 'oauth_%'
      ORDER BY name
    `);

    await db.disconnect();

    return NextResponse.json({
      success: true,
      message: 'OAuth migration completed',
      results,
      tables_created: verifyResult.rows.map((row: any) => row.name),
    });
  } catch (error: any) {
    console.error('Migration error:', error);
    return NextResponse.json(
      { error: 'Migration failed', message: error.message },
      { status: 500 }
    );
  }
}
