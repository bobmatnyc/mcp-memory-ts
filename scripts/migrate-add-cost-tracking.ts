#!/usr/bin/env tsx
/**
 * Migration script to add cost tracking table
 */

import { config } from 'dotenv';
import { initDatabaseFromEnv } from '../src/database/index.js';
import { CREATE_TABLES, CREATE_INDEXES } from '../src/database/schema.js';

config();

async function migrate() {
  console.log('🔄 Running migration: Add cost tracking table\n');

  try {
    const db = initDatabaseFromEnv();
    await db.connect();

    // Create api_usage_tracking table
    console.log('Creating api_usage_tracking table...');
    await db.execute(CREATE_TABLES.api_usage_tracking);
    console.log('✅ Table created\n');

    // Create indexes
    console.log('Creating indexes...');
    for (const indexSql of CREATE_INDEXES.api_usage_tracking) {
      await db.execute(indexSql);
    }
    console.log('✅ Indexes created\n');

    // Verify table exists
    const result = await db.execute(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='api_usage_tracking'"
    );

    if (result.rows.length > 0) {
      console.log('✅ Migration completed successfully!\n');
      console.log('Cost tracking is now enabled.');
    } else {
      console.log('⚠️  Table was created but verification failed.');
    }

    await db.disconnect();
  } catch (error: any) {
    if (error.message && error.message.includes('already exists')) {
      console.log('✅ Table already exists - no migration needed.\n');
    } else {
      console.error('❌ Migration failed:', error);
      process.exit(1);
    }
  }
}

migrate();
