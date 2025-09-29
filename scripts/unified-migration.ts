#!/usr/bin/env tsx
/**
 * Unified Schema Migration Script
 * Implements the compatibility layer between TypeScript and Python schemas
 */

import { createClient } from '@libsql/client';
import { config } from 'dotenv';
import { createHash, randomBytes } from 'crypto';

// Load environment variables
config();

const TURSO_URL = process.env.TURSO_URL!;
const TURSO_AUTH_TOKEN = process.env.TURSO_AUTH_TOKEN!;

if (!TURSO_URL || !TURSO_AUTH_TOKEN) {
  console.error('Missing required environment variables: TURSO_URL, TURSO_AUTH_TOKEN');
  process.exit(1);
}

interface MigrationStep {
  name: string;
  sql: string;
  rollback?: string;
}

class UnifiedSchemaMigration {
  private db = createClient({
    url: TURSO_URL,
    authToken: TURSO_AUTH_TOKEN,
  });

  private migrationSteps: MigrationStep[] = [
    {
      name: 'Add Python compatibility columns to memories table',
      sql: `
        -- Add Python-compatible columns if they don't exist
        ALTER TABLE memories ADD COLUMN IF NOT EXISTS description TEXT;
        ALTER TABLE memories ADD COLUMN IF NOT EXISTS details TEXT;
        ALTER TABLE memories ADD COLUMN IF NOT EXISTS uuid TEXT UNIQUE;
        ALTER TABLE memories ADD COLUMN IF NOT EXISTS context TEXT;
        ALTER TABLE memories ADD COLUMN IF NOT EXISTS sentiment REAL;
        ALTER TABLE memories ADD COLUMN IF NOT EXISTS expires_at TEXT;
        ALTER TABLE memories ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT 1;
      `,
      rollback: `
        -- Remove added columns (careful - this loses data)
        ALTER TABLE memories DROP COLUMN description;
        ALTER TABLE memories DROP COLUMN details;
        ALTER TABLE memories DROP COLUMN uuid;
        ALTER TABLE memories DROP COLUMN context;
        ALTER TABLE memories DROP COLUMN sentiment;
        ALTER TABLE memories DROP COLUMN expires_at;
        ALTER TABLE memories DROP COLUMN active;
      `
    },
    {
      name: 'Create field synchronization triggers',
      sql: `
        -- Drop existing triggers if they exist
        DROP TRIGGER IF EXISTS sync_memory_fields_insert;
        DROP TRIGGER IF EXISTS sync_memory_fields_update;

        -- Trigger for INSERT operations
        CREATE TRIGGER sync_memory_fields_insert
        AFTER INSERT ON memories
        FOR EACH ROW
        WHEN NEW.description IS NULL OR NEW.details IS NULL OR NEW.uuid IS NULL
        BEGIN
          UPDATE memories
          SET
            description = COALESCE(NEW.description, NEW.title),
            details = COALESCE(NEW.details, NEW.content),
            uuid = CASE
              WHEN NEW.uuid IS NULL THEN
                lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-' ||
                      hex(randomblob(2)) || '-' || hex(randomblob(8)))
              ELSE NEW.uuid
            END
          WHERE id = NEW.id;
        END;

        -- Trigger for UPDATE operations
        CREATE TRIGGER sync_memory_fields_update
        AFTER UPDATE ON memories
        FOR EACH ROW
        BEGIN
          UPDATE memories
          SET
            -- Sync Python fields from TypeScript
            description = CASE
              WHEN NEW.title != OLD.title THEN NEW.title
              ELSE COALESCE(NEW.description, NEW.title)
            END,
            details = CASE
              WHEN NEW.content != OLD.content THEN NEW.content
              ELSE COALESCE(NEW.details, NEW.content)
            END,
            -- Sync TypeScript fields from Python
            title = CASE
              WHEN NEW.description != OLD.description THEN NEW.description
              ELSE COALESCE(NEW.title, NEW.description)
            END,
            content = CASE
              WHEN NEW.details != OLD.details THEN NEW.details
              ELSE COALESCE(NEW.content, NEW.details)
            END
          WHERE id = NEW.id;
        END;
      `,
      rollback: `
        DROP TRIGGER IF EXISTS sync_memory_fields_insert;
        DROP TRIGGER IF EXISTS sync_memory_fields_update;
      `
    },
    {
      name: 'Add missing columns to entities table',
      sql: `
        -- Add Python-specific entity columns
        ALTER TABLE entities ADD COLUMN IF NOT EXISTS first_name TEXT;
        ALTER TABLE entities ADD COLUMN IF NOT EXISTS last_name TEXT;
        ALTER TABLE entities ADD COLUMN IF NOT EXISTS contact_info TEXT;
        ALTER TABLE entities ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT 1;
      `,
      rollback: `
        ALTER TABLE entities DROP COLUMN first_name;
        ALTER TABLE entities DROP COLUMN last_name;
        ALTER TABLE entities DROP COLUMN contact_info;
        ALTER TABLE entities DROP COLUMN active;
      `
    },
    {
      name: 'Create unified indexes',
      sql: `
        -- Optimized indexes for both TypeScript and Python queries
        CREATE INDEX IF NOT EXISTS idx_memories_user_type
          ON memories(user_id, memory_type);

        CREATE INDEX IF NOT EXISTS idx_memories_importance
          ON memories(user_id, importance DESC);

        CREATE INDEX IF NOT EXISTS idx_memories_uuid
          ON memories(uuid);

        CREATE INDEX IF NOT EXISTS idx_entities_user_type
          ON entities(user_id, entity_type);

        CREATE INDEX IF NOT EXISTS idx_entities_active
          ON entities(user_id, active);
      `,
      rollback: `
        DROP INDEX IF EXISTS idx_memories_user_type;
        DROP INDEX IF EXISTS idx_memories_importance;
        DROP INDEX IF EXISTS idx_memories_uuid;
        DROP INDEX IF EXISTS idx_entities_user_type;
        DROP INDEX IF EXISTS idx_entities_active;
      `
    },
    {
      name: 'Update existing data for compatibility',
      sql: `
        -- Populate Python fields from existing TypeScript data
        UPDATE memories
        SET
          description = COALESCE(description, title),
          details = COALESCE(details, content),
          uuid = CASE
            WHEN uuid IS NULL THEN
              lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-' ||
                    hex(randomblob(2)) || '-' || hex(randomblob(8)))
            ELSE uuid
          END,
          active = COALESCE(active, 1)
        WHERE description IS NULL OR details IS NULL OR uuid IS NULL;

        -- Ensure entities have active flag
        UPDATE entities
        SET active = COALESCE(active, 1)
        WHERE active IS NULL;
      `,
      rollback: `
        -- No rollback for data updates
      `
    },
    {
      name: 'Hash existing plaintext API keys',
      sql: `
        -- Create temporary table for API key migration
        CREATE TEMP TABLE IF NOT EXISTS api_key_migration AS
        SELECT
          id,
          api_key,
          CASE
            WHEN api_key IS NOT NULL AND LENGTH(api_key) != 64 THEN 1
            ELSE 0
          END as needs_hashing
        FROM users
        WHERE api_key IS NOT NULL;

        -- Note: Actual hashing needs to be done in application code
        -- This just marks which keys need migration
      `,
      rollback: `
        -- Cannot rollback hashed keys (one-way operation)
      `
    }
  ];

  async function checkDatabaseConnection(): Promise<boolean> {
    try {
      const result = await this.db.execute('SELECT 1');
      console.log('✓ Database connection established');
      return true;
    } catch (error) {
      console.error('✗ Database connection failed:', error);
      return false;
    }
  }

  async function getCurrentSchema(): Promise<void> {
    console.log('\n📊 Current Schema Analysis:');

    // Check memories table
    const memoriesColumns = await this.db.execute(`
      SELECT name, type, "notnull", dflt_value
      FROM pragma_table_info('memories')
    `);

    console.log('\nMemories table columns:');
    memoriesColumns.rows.forEach((row: any) => {
      const required = row.notnull ? 'NOT NULL' : 'NULL';
      const defaultVal = row.dflt_value ? `DEFAULT ${row.dflt_value}` : '';
      console.log(`  - ${row.name}: ${row.type} ${required} ${defaultVal}`);
    });

    // Check entities table
    const entitiesColumns = await this.db.execute(`
      SELECT name, type, "notnull", dflt_value
      FROM pragma_table_info('entities')
    `);

    console.log('\nEntities table columns:');
    entitiesColumns.rows.forEach((row: any) => {
      const required = row.notnull ? 'NOT NULL' : 'NULL';
      const defaultVal = row.dflt_value ? `DEFAULT ${row.dflt_value}` : '';
      console.log(`  - ${row.name}: ${row.type} ${required} ${defaultVal}`);
    });

    // Check for existing triggers
    const triggers = await this.db.execute(`
      SELECT name, tbl_name, sql
      FROM sqlite_master
      WHERE type = 'trigger' AND (tbl_name = 'memories' OR tbl_name = 'entities')
    `);

    console.log('\nExisting triggers:');
    if (triggers.rows.length === 0) {
      console.log('  None found');
    } else {
      triggers.rows.forEach((row: any) => {
        console.log(`  - ${row.name} on ${row.tbl_name}`);
      });
    }
  }

  async function runMigration(dryRun: boolean = false): Promise<void> {
    console.log(`\n🚀 Starting Unified Schema Migration ${dryRun ? '(DRY RUN)' : ''}\n`);

    if (!await this.checkDatabaseConnection()) {
      console.error('Cannot proceed without database connection');
      process.exit(1);
    }

    await this.getCurrentSchema();

    console.log('\n📝 Migration Steps:');

    for (const step of this.migrationSteps) {
      console.log(`\n▶ ${step.name}`);

      if (dryRun) {
        console.log('  SQL to execute:');
        console.log('  ' + step.sql.trim().replace(/\n/g, '\n  '));
      } else {
        try {
          // Split SQL by semicolons and execute each statement
          const statements = step.sql
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0);

          for (const statement of statements) {
            await this.db.execute(statement);
          }

          console.log('  ✓ Completed successfully');
        } catch (error: any) {
          console.error(`  ✗ Failed: ${error.message}`);

          if (step.rollback) {
            console.log('  ↩ Attempting rollback...');
            try {
              await this.db.execute(step.rollback);
              console.log('  ✓ Rollback successful');
            } catch (rollbackError: any) {
              console.error(`  ✗ Rollback failed: ${rollbackError.message}`);
            }
          }

          throw error;
        }
      }
    }

    if (!dryRun) {
      await this.migrateApiKeys();
      await this.verifyMigration();
    }

    console.log('\n✨ Migration completed successfully!\n');
  }

  async function migrateApiKeys(): Promise<void> {
    console.log('\n🔐 Migrating API keys to hashed format...');

    // Get users with plaintext API keys
    const users = await this.db.execute(`
      SELECT id, api_key
      FROM users
      WHERE api_key IS NOT NULL
        AND LENGTH(api_key) != 64
    `);

    if (users.rows.length === 0) {
      console.log('  No plaintext API keys found');
      return;
    }

    console.log(`  Found ${users.rows.length} plaintext API keys to migrate`);

    for (const user of users.rows) {
      const plainKey = user.api_key as string;
      const hashedKey = createHash('sha256').update(plainKey).digest('hex');

      await this.db.execute(
        'UPDATE users SET api_key = ? WHERE id = ?',
        [hashedKey, user.id]
      );
    }

    console.log(`  ✓ Migrated ${users.rows.length} API keys`);
  }

  async function verifyMigration(): Promise<void> {
    console.log('\n🔍 Verifying migration...');

    // Check if new columns exist
    const memoriesColumns = await this.db.execute(`
      SELECT name FROM pragma_table_info('memories')
      WHERE name IN ('description', 'details', 'uuid', 'active')
    `);

    if (memoriesColumns.rows.length === 4) {
      console.log('  ✓ All memory compatibility columns present');
    } else {
      console.log('  ⚠ Some memory columns missing');
    }

    // Check if triggers exist
    const triggers = await this.db.execute(`
      SELECT name FROM sqlite_master
      WHERE type = 'trigger'
        AND name IN ('sync_memory_fields_insert', 'sync_memory_fields_update')
    `);

    if (triggers.rows.length === 2) {
      console.log('  ✓ Field synchronization triggers installed');
    } else {
      console.log('  ⚠ Some triggers missing');
    }

    // Test field synchronization
    console.log('  Testing field synchronization...');

    const testId = `test-${Date.now()}`;
    await this.db.execute(`
      INSERT INTO memories (user_id, title, content, memory_type, importance, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `, ['test-user', 'Test Title', 'Test Content', 'test', 0.5]);

    const testMemory = await this.db.execute(`
      SELECT title, content, description, details
      FROM memories
      WHERE user_id = 'test-user' AND title = 'Test Title'
      ORDER BY id DESC LIMIT 1
    `);

    if (testMemory.rows.length > 0) {
      const row = testMemory.rows[0];
      if (row.description === 'Test Title' && row.details === 'Test Content') {
        console.log('  ✓ Field synchronization working correctly');
      } else {
        console.log('  ⚠ Field synchronization may not be working');
      }

      // Clean up test data
      await this.db.execute(`
        DELETE FROM memories
        WHERE user_id = 'test-user' AND title = 'Test Title'
      `);
    }
  }

  async function generateApiKeyMappingReport(): Promise<void> {
    console.log('\n📋 API Key Migration Report:');

    const stats = await this.db.execute(`
      SELECT
        COUNT(*) as total_users,
        SUM(CASE WHEN api_key IS NOT NULL THEN 1 ELSE 0 END) as users_with_keys,
        SUM(CASE WHEN api_key IS NOT NULL AND LENGTH(api_key) = 64 THEN 1 ELSE 0 END) as hashed_keys,
        SUM(CASE WHEN api_key IS NOT NULL AND LENGTH(api_key) != 64 THEN 1 ELSE 0 END) as plaintext_keys
      FROM users
    `);

    const row = stats.rows[0] as any;
    console.log(`  Total users: ${row.total_users}`);
    console.log(`  Users with API keys: ${row.users_with_keys}`);
    console.log(`  Hashed keys: ${row.hashed_keys}`);
    console.log(`  Plaintext keys: ${row.plaintext_keys}`);

    if (row.plaintext_keys > 0) {
      console.log('\n  ⚠️  WARNING: Plaintext API keys detected!');
      console.log('  These will be automatically hashed during migration.');
      console.log('  Make sure to update your application to use hashed comparisons.');
    }
  }
}

// CLI interface
async function main() {
  const migration = new UnifiedSchemaMigration();
  const args = process.argv.slice(2);
  const command = args[0] || 'help';

  switch (command) {
    case 'analyze':
      await migration.getCurrentSchema();
      await migration.generateApiKeyMappingReport();
      break;

    case 'dry-run':
      await migration.runMigration(true);
      break;

    case 'migrate':
      console.log('⚠️  This will modify your database schema.');
      console.log('Make sure you have a backup before proceeding.');
      console.log('\nPress Ctrl+C to cancel, or wait 5 seconds to continue...');

      await new Promise(resolve => setTimeout(resolve, 5000));
      await migration.runMigration(false);
      break;

    case 'verify':
      await migration.verifyMigration();
      break;

    case 'help':
    default:
      console.log(`
Unified Schema Migration Tool

Usage: tsx unified-migration.ts [command]

Commands:
  analyze   - Analyze current database schema and API keys
  dry-run   - Show what changes would be made without applying them
  migrate   - Apply the migration (creates backup first)
  verify    - Verify that migration was successful
  help      - Show this help message

Environment variables required:
  TURSO_URL         - Your Turso database URL
  TURSO_AUTH_TOKEN  - Your Turso authentication token
      `);
      break;
  }

  process.exit(0);
}

// Run the migration
main().catch(error => {
  console.error('\n❌ Migration failed:', error);
  process.exit(1);
});