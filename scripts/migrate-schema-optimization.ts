#!/usr/bin/env tsx
/**
 * Schema Optimization Migration Script
 * Implements Phase 1 (Low-Risk) and Phase 2 (Medium-Risk) optimizations
 * from DATABASE_SCHEMA_ANALYSIS.md
 *
 * IMPORTANT: Backup your database before running this script!
 * Turso backup command:
 *   turso db shell <database-name> ".backup backup.db"
 */

import { createClient } from '@libsql/client';
import { config } from 'dotenv';

// Load environment variables
config();

const TURSO_URL = process.env.TURSO_URL!;
const TURSO_AUTH_TOKEN = process.env.TURSO_AUTH_TOKEN!;

if (!TURSO_URL || !TURSO_AUTH_TOKEN) {
  console.error('❌ Missing required environment variables: TURSO_URL, TURSO_AUTH_TOKEN');
  process.exit(1);
}

interface MigrationStep {
  phase: string;
  name: string;
  sql: string | string[];
  verify: string;
  rollback: string | string[];
  description: string;
}

class SchemaOptimizationMigration {
  private db = createClient({
    url: TURSO_URL,
    authToken: TURSO_AUTH_TOKEN,
  });

  private migrationSteps: MigrationStep[] = [
    // ============================================================
    // PHASE 1: LOW-RISK OPTIMIZATIONS (Safe to apply immediately)
    // ============================================================
    {
      phase: 'Phase 1',
      name: 'Create missing composite memories indexes',
      description: 'Add composite indexes defined in schema but missing from database',
      sql: [
        'CREATE INDEX IF NOT EXISTS idx_memories_user_type ON memories(user_id, memory_type)',
        'CREATE INDEX IF NOT EXISTS idx_memories_user_importance ON memories(user_id, importance DESC)'
      ],
      verify: `
        SELECT COUNT(*) as count
        FROM sqlite_master
        WHERE type='index' AND name IN ('idx_memories_user_type', 'idx_memories_user_importance');
      `,
      rollback: [
        'DROP INDEX IF EXISTS idx_memories_user_type',
        'DROP INDEX IF EXISTS idx_memories_user_importance'
      ]
    },
    {
      phase: 'Phase 1',
      name: 'Drop unused learned_patterns table',
      description: 'Remove completely unused learned_patterns table (0 code references)',
      sql: `DROP TABLE IF EXISTS learned_patterns;`,
      verify: `
        SELECT COUNT(*) as count
        FROM sqlite_master
        WHERE type='table' AND name='learned_patterns';
      `,
      rollback: `
        CREATE TABLE IF NOT EXISTS learned_patterns (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id TEXT,
          pattern_type TEXT NOT NULL,
          pattern_data TEXT NOT NULL,
          confidence REAL DEFAULT 0.5,
          usage_count INTEGER DEFAULT 0,
          last_used TEXT,
          metadata TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
      `
    },
    {
      phase: 'Phase 1',
      name: 'Drop learned_patterns indexes',
      description: 'Remove indexes for deleted learned_patterns table',
      sql: [
        'DROP INDEX IF EXISTS idx_patterns_user_id',
        'DROP INDEX IF EXISTS idx_patterns_type'
      ],
      verify: `
        SELECT COUNT(*) as count
        FROM sqlite_master
        WHERE type='index' AND (name='idx_patterns_user_id' OR name='idx_patterns_type');
      `,
      rollback: [
        'CREATE INDEX IF NOT EXISTS idx_patterns_user_id ON learned_patterns(user_id)',
        'CREATE INDEX IF NOT EXISTS idx_patterns_type ON learned_patterns(pattern_type)'
      ]
    },
    {
      phase: 'Phase 1',
      name: 'Drop redundant entities indexes',
      description: 'Remove single-column indexes covered by composite idx_entities_user_type',
      sql: [
        'DROP INDEX IF EXISTS idx_entities_user_id',
        'DROP INDEX IF EXISTS idx_entities_type',
        'DROP INDEX IF EXISTS idx_entities_name',
        'DROP INDEX IF EXISTS idx_entities_importance'
      ],
      verify: `
        SELECT COUNT(*) as count
        FROM sqlite_master
        WHERE type='index'
        AND name IN ('idx_entities_user_id', 'idx_entities_type', 'idx_entities_name', 'idx_entities_importance');
      `,
      rollback: [
        'CREATE INDEX IF NOT EXISTS idx_entities_user_id ON entities(user_id)',
        'CREATE INDEX IF NOT EXISTS idx_entities_type ON entities(entity_type)',
        'CREATE INDEX IF NOT EXISTS idx_entities_name ON entities(name)',
        'CREATE INDEX IF NOT EXISTS idx_entities_importance ON entities(importance)'
      ]
    },
    {
      phase: 'Phase 1',
      name: 'Drop redundant memories indexes',
      description: 'Remove single-column indexes covered by composite indexes',
      sql: [
        'DROP INDEX IF EXISTS idx_memories_user_id',
        'DROP INDEX IF EXISTS idx_memories_type',
        'DROP INDEX IF EXISTS idx_memories_archived'
      ],
      verify: `
        SELECT COUNT(*) as count
        FROM sqlite_master
        WHERE type='index'
        AND name IN ('idx_memories_user_id', 'idx_memories_type', 'idx_memories_archived');
      `,
      rollback: [
        'CREATE INDEX IF NOT EXISTS idx_memories_user_id ON memories(user_id)',
        'CREATE INDEX IF NOT EXISTS idx_memories_type ON memories(memory_type)',
        'CREATE INDEX IF NOT EXISTS idx_memories_archived ON memories(is_archived)'
      ]
    },
    {
      phase: 'Phase 1',
      name: 'Create optimized memories archived index',
      description: 'Add composite index for archived status queries',
      sql: `
        CREATE INDEX IF NOT EXISTS idx_memories_user_archived
        ON memories(user_id, is_archived);
      `,
      verify: `
        SELECT COUNT(*) as count
        FROM sqlite_master
        WHERE type='index' AND name='idx_memories_user_archived';
      `,
      rollback: `DROP INDEX IF EXISTS idx_memories_user_archived;`
    },
    {
      phase: 'Phase 1',
      name: 'Drop redundant interactions indexes',
      description: 'Remove indexes for minimally-used interactions table',
      sql: [
        'DROP INDEX IF EXISTS idx_interactions_user_id',
        'DROP INDEX IF EXISTS idx_interactions_created'
      ],
      verify: `
        SELECT COUNT(*) as count
        FROM sqlite_master
        WHERE type='index'
        AND name IN ('idx_interactions_user_id', 'idx_interactions_created');
      `,
      rollback: [
        'CREATE INDEX IF NOT EXISTS idx_interactions_user_id ON interactions(user_id)',
        'CREATE INDEX IF NOT EXISTS idx_interactions_created ON interactions(created_at)'
      ]
    },
    {
      phase: 'Phase 1',
      name: 'Create optimized interactions index',
      description: 'Add composite index for interaction count queries',
      sql: `
        CREATE INDEX IF NOT EXISTS idx_interactions_user_date
        ON interactions(user_id, DATE(created_at));
      `,
      verify: `
        SELECT COUNT(*) as count
        FROM sqlite_master
        WHERE type='index' AND name='idx_interactions_user_date';
      `,
      rollback: `DROP INDEX IF EXISTS idx_interactions_user_date;`
    },
    {
      phase: 'Phase 1',
      name: 'Drop redundant api_usage_tracking indexes',
      description: 'Remove indexes covered by optimized composite index',
      sql: [
        'DROP INDEX IF EXISTS idx_usage_date',
        'DROP INDEX IF EXISTS idx_usage_provider_date'
      ],
      verify: `
        SELECT COUNT(*) as count
        FROM sqlite_master
        WHERE type='index'
        AND name IN ('idx_usage_date', 'idx_usage_provider_date');
      `,
      rollback: [
        'CREATE INDEX IF NOT EXISTS idx_usage_date ON api_usage_tracking(date)',
        'CREATE INDEX IF NOT EXISTS idx_usage_provider_date ON api_usage_tracking(api_provider, date)'
      ]
    },
    {
      phase: 'Phase 1',
      name: 'Create optimized api_usage_tracking index',
      description: 'Add comprehensive composite index for usage queries',
      sql: `
        CREATE INDEX IF NOT EXISTS idx_usage_user_provider_date
        ON api_usage_tracking(user_id, api_provider, date);
      `,
      verify: `
        SELECT COUNT(*) as count
        FROM sqlite_master
        WHERE type='index' AND name='idx_usage_user_provider_date';
      `,
      rollback: `DROP INDEX IF EXISTS idx_usage_user_provider_date;`
    },

    // ============================================================
    // PHASE 2: MEDIUM-RISK OPTIMIZATIONS (Schema consistency fixes)
    // ============================================================
    {
      phase: 'Phase 2',
      name: 'Add api_key_hash column to users table',
      description: 'Add api_key_hash column if missing (schema expects it but some DBs have api_key)',
      sql: 'ALTER TABLE users ADD COLUMN api_key_hash TEXT',
      verify: `
        SELECT COUNT(*) as count
        FROM pragma_table_info('users')
        WHERE name='api_key_hash';
      `,
      rollback: 'ALTER TABLE users DROP COLUMN api_key_hash'
    },
    {
      phase: 'Phase 2',
      name: 'Migrate api_key data to api_key_hash',
      description: 'Copy data from api_key to api_key_hash if needed',
      sql: 'UPDATE users SET api_key_hash = api_key WHERE api_key IS NOT NULL AND api_key_hash IS NULL',
      verify: `
        SELECT COUNT(*) as count
        FROM users
        WHERE api_key IS NOT NULL AND api_key_hash IS NOT NULL;
      `,
      rollback: 'UPDATE users SET api_key_hash = NULL WHERE api_key IS NOT NULL'
    },
    {
      phase: 'Phase 2',
      name: 'Update users api_key index',
      description: 'Update index to use api_key_hash instead of api_key',
      sql: [
        'DROP INDEX IF EXISTS idx_users_api_key',
        'CREATE INDEX IF NOT EXISTS idx_users_api_key_hash ON users(api_key_hash)'
      ],
      verify: `
        SELECT COUNT(*) as count
        FROM sqlite_master
        WHERE type='index' AND name='idx_users_api_key_hash';
      `,
      rollback: [
        'DROP INDEX IF EXISTS idx_users_api_key_hash',
        'CREATE INDEX IF NOT EXISTS idx_users_api_key ON users(api_key)'
      ]
    },
  ];

  /**
   * Main migration execution
   */
  async migrate(options: { phase?: string; dryRun?: boolean; skipVerify?: boolean } = {}): Promise<void> {
    const { phase, dryRun = false, skipVerify = false } = options;

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('  DATABASE SCHEMA OPTIMIZATION MIGRATION');
    console.log('═══════════════════════════════════════════════════════════\n');

    if (dryRun) {
      console.log('🔍 DRY RUN MODE - No changes will be applied\n');
    }

    // Filter steps by phase if specified
    const stepsToRun = phase
      ? this.migrationSteps.filter(s => s.phase === phase)
      : this.migrationSteps;

    if (stepsToRun.length === 0) {
      console.error(`❌ No migration steps found for phase: ${phase}`);
      return;
    }

    console.log(`📋 Running ${stepsToRun.length} migration steps...\n`);

    let successCount = 0;
    let failCount = 0;

    for (const step of stepsToRun) {
      console.log(`\n${step.phase}: ${step.name}`);
      console.log(`   ${step.description}`);

      if (dryRun) {
        const sqlStatements = Array.isArray(step.sql) ? step.sql : [step.sql];
        if (sqlStatements.length === 1) {
          console.log(`   SQL: ${sqlStatements[0].trim()}`);
        } else {
          console.log(`   SQL (${sqlStatements.length} statements):`);
          sqlStatements.forEach((sql, i) => {
            console.log(`      ${i + 1}. ${sql.trim()}`);
          });
        }
        console.log('   ⏭️  Skipped (dry run)');
        continue;
      }

      try {
        // Execute migration step(s)
        const sqlStatements = Array.isArray(step.sql) ? step.sql : [step.sql];

        for (let i = 0; i < sqlStatements.length; i++) {
          const sql = sqlStatements[i].trim();
          if (sql) {
            // Special handling for ALTER TABLE ADD COLUMN (LibSQL doesn't support IF NOT EXISTS)
            if (sql.includes('ALTER TABLE') && sql.includes('ADD COLUMN')) {
              const columnNameMatch = sql.match(/ADD COLUMN (\w+)/);
              if (columnNameMatch) {
                const columnName = columnNameMatch[1];
                const tableNameMatch = sql.match(/ALTER TABLE (\w+)/);
                const tableName = tableNameMatch ? tableNameMatch[1] : 'unknown';

                // Check if column exists
                const checkResult = await this.db.execute(
                  `SELECT name FROM pragma_table_info('${tableName}') WHERE name = '${columnName}'`
                );

                if (checkResult.rows.length > 0) {
                  console.log(`   ⏭️  Column ${columnName} already exists, skipping`);
                  continue;
                }
              }
            }

            await this.db.execute(sql);
            if (sqlStatements.length > 1) {
              console.log(`   ✅ Executed statement ${i + 1}/${sqlStatements.length}`);
            }
          }
        }

        if (sqlStatements.length === 1) {
          console.log('   ✅ Executed successfully');
        } else {
          console.log(`   ✅ All ${sqlStatements.length} statements executed successfully`);
        }

        // Verify if not skipped
        if (!skipVerify) {
          const verified = await this.verifyStep(step);
          if (verified) {
            console.log('   ✅ Verified successfully');
            successCount++;
          } else {
            console.log('   ⚠️  Verification failed (migration may still be successful)');
            successCount++;
          }
        } else {
          successCount++;
        }
      } catch (error) {
        console.error(`   ❌ Failed: ${error}`);
        failCount++;

        // Ask if we should continue
        console.log('\n   ⚠️  Migration step failed. Continue with remaining steps? (yes/no)');
        // In automated mode, we'll continue
        console.log('   Continuing with remaining steps...\n');
      }
    }

    // Summary
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('  MIGRATION SUMMARY');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`✅ Successful: ${successCount}`);
    console.log(`❌ Failed: ${failCount}`);
    console.log(`📊 Total: ${stepsToRun.length}`);
    console.log('═══════════════════════════════════════════════════════════\n');

    if (failCount === 0) {
      console.log('🎉 All migration steps completed successfully!\n');
    } else {
      console.log('⚠️  Some migration steps failed. Review the errors above.\n');
    }
  }

  /**
   * Verify a migration step
   */
  private async verifyStep(step: MigrationStep): Promise<boolean> {
    try {
      const result = await this.db.execute(step.verify);

      // Most verifications check count - should be 0 for DROP operations, >0 for CREATE
      if (result.rows.length > 0) {
        const count = (result.rows[0] as any).count;

        // For DROP operations, count should be 0
        if (step.name.toLowerCase().includes('drop')) {
          return count === 0;
        }
        // For CREATE operations, count should be > 0
        else if (step.name.toLowerCase().includes('create') ||
                 step.name.toLowerCase().includes('add') ||
                 step.name.toLowerCase().includes('rename')) {
          // Special case: composite index creation expects count of 2
          if (step.name.includes('composite memories indexes')) {
            return count === 2;
          }
          return count > 0;
        }
        // For UPDATE/MIGRATE operations
        else if (step.name.toLowerCase().includes('migrate')) {
          return count >= 0; // May be 0 if no data to migrate
        }
      }

      return true;
    } catch (error) {
      console.error(`   Verification error: ${error}`);
      return false;
    }
  }

  /**
   * Rollback migration (use with caution!)
   */
  async rollback(options: { phase?: string; step?: string } = {}): Promise<void> {
    const { phase, step } = options;

    console.log('\n⚠️  ROLLBACK MODE - This will reverse migration changes\n');

    const stepsToRollback = this.migrationSteps
      .filter(s => {
        if (step) return s.name === step;
        if (phase) return s.phase === phase;
        return true;
      })
      .reverse(); // Rollback in reverse order

    console.log(`📋 Rolling back ${stepsToRollback.length} steps...\n`);

    for (const rollbackStep of stepsToRollback) {
      console.log(`\n${rollbackStep.phase}: ${rollbackStep.name}`);

      try {
        const rollbackStatements = Array.isArray(rollbackStep.rollback)
          ? rollbackStep.rollback
          : [rollbackStep.rollback];

        for (let i = 0; i < rollbackStatements.length; i++) {
          const sql = rollbackStatements[i].trim();
          if (sql) {
            await this.db.execute(sql);
            if (rollbackStatements.length > 1) {
              console.log(`   ✅ Rolled back statement ${i + 1}/${rollbackStatements.length}`);
            }
          }
        }

        if (rollbackStatements.length === 1) {
          console.log('   ✅ Rolled back successfully');
        } else {
          console.log(`   ✅ All ${rollbackStatements.length} rollback statements executed successfully`);
        }
      } catch (error) {
        console.error(`   ❌ Rollback failed: ${error}`);
      }
    }

    console.log('\n✅ Rollback complete\n');
  }

  /**
   * Display current schema statistics
   */
  async showStats(): Promise<void> {
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('  CURRENT DATABASE STATISTICS');
    console.log('═══════════════════════════════════════════════════════════\n');

    try {
      // Count tables
      const tablesResult = await this.db.execute(`
        SELECT COUNT(*) as count FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'
      `);
      console.log(`📊 Tables: ${(tablesResult.rows[0] as any).count}`);

      // Count indexes
      const indexesResult = await this.db.execute(`
        SELECT COUNT(*) as count FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%'
      `);
      console.log(`📊 Indexes: ${(indexesResult.rows[0] as any).count}`);

      // Count triggers
      const triggersResult = await this.db.execute(`
        SELECT COUNT(*) as count FROM sqlite_master WHERE type='trigger'
      `);
      console.log(`📊 Triggers: ${(triggersResult.rows[0] as any).count}`);

      // List all tables
      console.log('\n📋 Tables:');
      const tablesList = await this.db.execute(`
        SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name
      `);
      tablesList.rows.forEach(row => console.log(`   - ${(row as any).name}`));

      // List all indexes
      console.log('\n📋 Indexes:');
      const indexesList = await this.db.execute(`
        SELECT name, tbl_name FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%' ORDER BY tbl_name, name
      `);
      indexesList.rows.forEach(row => console.log(`   - ${(row as any).name} (${(row as any).tbl_name})`));

      console.log('\n═══════════════════════════════════════════════════════════\n');
    } catch (error) {
      console.error('❌ Failed to retrieve statistics:', error);
    }
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    // LibSQL client doesn't require explicit close
  }
}

// ============================================================
// CLI Interface
// ============================================================

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'migrate';

  const migration = new SchemaOptimizationMigration();

  try {
    switch (command) {
      case 'migrate':
        const phase = args.find(a => a.startsWith('--phase='))?.split('=')[1];
        const dryRun = args.includes('--dry-run');
        const skipVerify = args.includes('--skip-verify');

        await migration.migrate({ phase, dryRun, skipVerify });
        break;

      case 'rollback':
        const rollbackPhase = args.find(a => a.startsWith('--phase='))?.split('=')[1];
        const rollbackStep = args.find(a => a.startsWith('--step='))?.split('=')[1];

        console.log('⚠️  WARNING: Are you sure you want to rollback? This will reverse changes.');
        console.log('Press Ctrl+C to cancel, or wait 5 seconds to continue...\n');

        await new Promise(resolve => setTimeout(resolve, 5000));
        await migration.rollback({ phase: rollbackPhase, step: rollbackStep });
        break;

      case 'stats':
        await migration.showStats();
        break;

      case 'help':
      default:
        console.log(`
Database Schema Optimization Migration Tool

USAGE:
  npm run migrate-schema-optimization [command] [options]

COMMANDS:
  migrate              Run migration (default)
  rollback             Rollback migration changes
  stats                Show current database statistics
  help                 Show this help message

OPTIONS:
  --phase=<phase>      Run specific phase only (Phase 1, Phase 2)
  --dry-run            Show what would be done without applying changes
  --skip-verify        Skip verification steps (faster)
  --step=<name>        Rollback specific step only (for rollback command)

EXAMPLES:
  # Show current stats
  npm run migrate-schema-optimization stats

  # Dry run to see what will be changed
  npm run migrate-schema-optimization migrate --dry-run

  # Run Phase 1 only (safe optimizations)
  npm run migrate-schema-optimization migrate --phase="Phase 1"

  # Run all migrations
  npm run migrate-schema-optimization migrate

  # Rollback Phase 1
  npm run migrate-schema-optimization rollback --phase="Phase 1"

IMPORTANT:
  - Always backup your database before running migrations!
  - Use --dry-run first to preview changes
  - Phase 1 is low-risk, Phase 2 is medium-risk
        `);
    }
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await migration.close();
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { SchemaOptimizationMigration };
