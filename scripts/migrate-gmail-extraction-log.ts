#!/usr/bin/env node
/**
 * Database migration: Add gmail_extraction_log table
 *
 * This migration adds support for tracking Gmail extraction batches by week
 * to prevent duplicate processing and maintain extraction history.
 */

import { createClient } from '@libsql/client';
import * as dotenv from 'dotenv';

dotenv.config();

const MIGRATION_SQL = `
CREATE TABLE IF NOT EXISTS gmail_extraction_log (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  week_identifier TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  emails_processed INTEGER DEFAULT 0,
  memories_created INTEGER DEFAULT 0,
  entities_created INTEGER DEFAULT 0,
  status TEXT DEFAULT 'processing' CHECK(status IN ('processing', 'completed', 'failed')),
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(user_id, week_identifier)
);

CREATE INDEX IF NOT EXISTS idx_gmail_extraction_user_week
  ON gmail_extraction_log(user_id, week_identifier);

CREATE INDEX IF NOT EXISTS idx_gmail_extraction_user_status
  ON gmail_extraction_log(user_id, status);

CREATE INDEX IF NOT EXISTS idx_gmail_extraction_created
  ON gmail_extraction_log(created_at DESC);
`;

async function migrate() {
  const tursoUrl = process.env.TURSO_URL;
  const tursoAuthToken = process.env.TURSO_AUTH_TOKEN;

  if (!tursoUrl || !tursoAuthToken) {
    throw new Error('TURSO_URL and TURSO_AUTH_TOKEN environment variables are required');
  }

  console.log('🔄 Connecting to database...');
  const db = createClient({
    url: tursoUrl,
    authToken: tursoAuthToken,
  });

  try {
    console.log('🔄 Running migration: gmail_extraction_log table...');

    // Execute migration
    const statements = MIGRATION_SQL.split(';').filter(s => s.trim());
    for (const statement of statements) {
      if (statement.trim()) {
        await db.execute(statement);
      }
    }

    console.log('✅ Migration completed successfully!');
    console.log('\nCreated:');
    console.log('  - gmail_extraction_log table');
    console.log('  - idx_gmail_extraction_user_week index');
    console.log('  - idx_gmail_extraction_user_status index');
    console.log('  - idx_gmail_extraction_created index');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  migrate()
    .then(() => {
      console.log('\n✅ All done!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Migration failed:', error);
      process.exit(1);
    });
}

export { migrate };
