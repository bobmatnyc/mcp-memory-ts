#!/usr/bin/env node
/**
 * Google Integrations Database Migration
 *
 * Creates calendar_events table and indexes for Google Calendar sync.
 * Supports dry-run mode to preview changes.
 */

import { DatabaseConnection } from '../src/database/connection.js';

interface MigrationOptions {
  dryRun?: boolean;
}

/**
 * Run Google integrations database migration
 */
async function migrateGoogleIntegrations(options: MigrationOptions = {}): Promise<void> {
  const { dryRun = false } = options;

  console.log('🔄 Google Integrations Database Migration');
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'EXECUTE'}\n`);

  const db = DatabaseConnection.getInstance();
  await db.connect();

  try {
    // Check if table already exists
    const existingTables = await db.execute(`
      SELECT name FROM sqlite_master
      WHERE type='table' AND name='calendar_events'
    `);

    if (existingTables.rows && existingTables.rows.length > 0) {
      console.log('⚠️  calendar_events table already exists');
      console.log('Migration not needed - skipping');
      return;
    }

    if (dryRun) {
      console.log('📋 Migration Plan:');
      console.log('');
      console.log('1. Create calendar_events table');
      console.log('   - Columns: id, user_id, week_identifier, event_id, summary, description');
      console.log('   - Columns: start_time, end_time, location, attendees, recurrence');
      console.log('   - Columns: is_recurring, recurring_event_id, status, metadata');
      console.log('   - Columns: created_at, updated_at');
      console.log('   - Constraint: UNIQUE(user_id, event_id, week_identifier)');
      console.log('');
      console.log('2. Create indexes:');
      console.log('   - idx_calendar_events_user_week (user_id, week_identifier)');
      console.log('   - idx_calendar_events_user_time (user_id, start_time DESC)');
      console.log('   - idx_calendar_events_user_event (user_id, event_id)');
      console.log('');
      console.log('✅ Dry run complete - no changes made');
      return;
    }

    console.log('📊 Creating calendar_events table...');

    // Create calendar_events table
    await db.execute(`
      CREATE TABLE IF NOT EXISTS calendar_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        week_identifier TEXT NOT NULL,
        event_id TEXT NOT NULL,
        summary TEXT NOT NULL,
        description TEXT,
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        location TEXT,
        attendees TEXT,
        recurrence TEXT,
        is_recurring INTEGER DEFAULT 0,
        recurring_event_id TEXT,
        status TEXT DEFAULT 'confirmed',
        metadata TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(user_id, event_id, week_identifier)
      )
    `);

    console.log('✅ calendar_events table created');

    console.log('📊 Creating indexes...');

    // Create indexes for efficient queries
    await db.execute(`
      CREATE INDEX IF NOT EXISTS idx_calendar_events_user_week
      ON calendar_events(user_id, week_identifier)
    `);
    console.log('✅ idx_calendar_events_user_week created');

    await db.execute(`
      CREATE INDEX IF NOT EXISTS idx_calendar_events_user_time
      ON calendar_events(user_id, start_time DESC)
    `);
    console.log('✅ idx_calendar_events_user_time created');

    await db.execute(`
      CREATE INDEX IF NOT EXISTS idx_calendar_events_user_event
      ON calendar_events(user_id, event_id)
    `);
    console.log('✅ idx_calendar_events_user_event created');

    console.log('');
    console.log('✅ Migration completed successfully!');
    console.log('');
    console.log('📋 Summary:');
    console.log('  - calendar_events table created');
    console.log('  - 3 indexes created for query optimization');
    console.log('  - Ready for Google Calendar sync');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await db.disconnect();
  }
}

// CLI execution
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run') || args.includes('-d');

migrateGoogleIntegrations({ dryRun })
  .then(() => {
    process.exit(0);
  })
  .catch(error => {
    console.error('Migration error:', error);
    process.exit(1);
  });

export { migrateGoogleIntegrations };
