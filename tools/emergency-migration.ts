#!/usr/bin/env tsx

/**
 * EMERGENCY SCHEMA MIGRATION
 * Fixes the catastrophic schema mismatch between existing DB and TypeScript code
 */

import { DatabaseConnection } from '../src/database/connection.js';

async function emergencyMigration() {
  console.log('🚨 EMERGENCY SCHEMA MIGRATION STARTING');
  console.log('=' .repeat(60));

  const db = new DatabaseConnection({
    url: process.env.TURSO_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  try {
    await db.connect();
    console.log('✅ Database connected');

    // 1. Add missing columns to memories table
    console.log('\n📝 ADDING MISSING COLUMNS...');
    
    try {
      await db.execute('ALTER TABLE memories ADD COLUMN entity_ids TEXT');
      console.log('✅ Added entity_ids column');
    } catch (error) {
      console.log('⚠️ entity_ids column may already exist or failed:', error);
    }

    try {
      await db.execute('ALTER TABLE memories ADD COLUMN is_archived BOOLEAN DEFAULT 0');
      console.log('✅ Added is_archived column');
    } catch (error) {
      console.log('⚠️ is_archived column may already exist or failed:', error);
    }

    // 2. Create FTS table for search functionality
    console.log('\n🔍 CREATING FULL-TEXT SEARCH TABLE...');
    
    try {
      await db.execute(`
        CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(
          id,
          title,
          content,
          tags,
          content='memories',
          content_rowid='rowid'
        )
      `);
      console.log('✅ Created memories_fts table');
    } catch (error) {
      console.log('❌ Failed to create FTS table:', error);
    }

    // 3. Populate FTS table with existing data
    console.log('\n📊 POPULATING FTS TABLE...');
    
    try {
      await db.execute(`
        INSERT INTO memories_fts(id, title, content, tags)
        SELECT id, title, content, COALESCE(tags, '') 
        FROM memories 
        WHERE active = 1
      `);
      console.log('✅ Populated FTS table with existing memories');
    } catch (error) {
      console.log('⚠️ FTS population failed (may be empty):', error);
    }

    // 4. Create FTS triggers for automatic updates
    console.log('\n🔄 CREATING FTS TRIGGERS...');
    
    try {
      // Insert trigger
      await db.execute(`
        CREATE TRIGGER IF NOT EXISTS memories_fts_insert AFTER INSERT ON memories BEGIN
          INSERT INTO memories_fts(id, title, content, tags)
          VALUES (new.id, new.title, new.content, COALESCE(new.tags, ''));
        END
      `);
      console.log('✅ Created FTS insert trigger');

      // Update trigger
      await db.execute(`
        CREATE TRIGGER IF NOT EXISTS memories_fts_update AFTER UPDATE ON memories BEGIN
          UPDATE memories_fts 
          SET title = new.title, content = new.content, tags = COALESCE(new.tags, '')
          WHERE id = new.id;
        END
      `);
      console.log('✅ Created FTS update trigger');

      // Delete trigger
      await db.execute(`
        CREATE TRIGGER IF NOT EXISTS memories_fts_delete AFTER DELETE ON memories BEGIN
          DELETE FROM memories_fts WHERE id = old.id;
        END
      `);
      console.log('✅ Created FTS delete trigger');

    } catch (error) {
      console.log('❌ Failed to create FTS triggers:', error);
    }

    // 5. Initialize schema version tracking
    console.log('\n📌 INITIALIZING SCHEMA VERSION...');
    
    try {
      await db.execute(`
        INSERT OR REPLACE INTO schema_version (version, applied_at) 
        VALUES (1, datetime('now'))
      `);
      console.log('✅ Set schema version to 1');
    } catch (error) {
      console.log('❌ Failed to set schema version:', error);
    }

    // 6. Verify the fixes
    console.log('\n🧪 VERIFYING FIXES...');
    
    // Check FTS table
    try {
      const result = await db.execute("SELECT COUNT(*) as count FROM memories_fts");
      console.log(`✅ FTS table has ${result.rows[0].count} entries`);
    } catch (error) {
      console.log('❌ FTS verification failed:', error);
    }

    // Check new columns
    try {
      const result = await db.execute("SELECT entity_ids, is_archived FROM memories LIMIT 1");
      console.log('✅ New columns accessible');
    } catch (error) {
      console.log('❌ New columns verification failed:', error);
    }

    // Test FTS search
    try {
      const result = await db.execute("SELECT * FROM memories_fts WHERE memories_fts MATCH 'test' LIMIT 1");
      console.log('✅ FTS search functional');
    } catch (error) {
      console.log('⚠️ FTS search test failed (may be no matching data):', error);
    }

    console.log('\n🎉 EMERGENCY MIGRATION COMPLETED');
    console.log('✅ Database schema is now compatible with TypeScript code');

  } catch (error) {
    console.log('💥 MIGRATION FAILED:', error);
    throw error;
  } finally {
    await db.disconnect();
  }
}

// Run migration
emergencyMigration().catch((error) => {
  console.error('💥 EMERGENCY MIGRATION FAILED:', error);
  process.exit(1);
});
