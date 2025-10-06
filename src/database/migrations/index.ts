/**
 * Migration Runner and Registry
 * Manages database schema migrations with transaction safety and verification
 */

import type { DatabaseConnection } from '../connection.js';
import {
  Migration,
  type MigrationOptions,
  type MigrationResult,
  type MigrationRecord,
  type VerificationResult,
} from './migration-base.js';

// Import all migrations
import { Migration001InitialSchema } from './001_initial_schema.js';
import { Migration002AddMissingIndices } from './002_add_missing_indices.js';

/**
 * Registry of all available migrations
 * Add new migrations here in chronological order
 */
const MIGRATIONS: Migration[] = [new Migration001InitialSchema(), new Migration002AddMissingIndices()];

/**
 * Enhanced migration tracking table schema
 */
const CREATE_MIGRATION_TABLE = `
  CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    applied_at TEXT NOT NULL,
    applied_by TEXT,
    duration_ms INTEGER,
    checksum TEXT,
    status TEXT NOT NULL DEFAULT 'applied'
  )
`;

/**
 * Migration Runner
 * Handles applying, rolling back, and verifying migrations
 */
export class MigrationRunner {
  constructor(private db: DatabaseConnection) {}

  /**
   * Initialize migration system
   */
  async initialize(): Promise<void> {
    // Ensure migration tracking table exists
    await this.db.execute(CREATE_MIGRATION_TABLE);

    // Migrate from old schema_version table if it exists
    await this.migrateFromLegacySchemaVersion();
  }

  /**
   * Get all available migrations
   */
  getAvailableMigrations(): Migration[] {
    return MIGRATIONS.sort((a, b) => a.version - b.version);
  }

  /**
   * Get applied migrations
   */
  async getAppliedMigrations(): Promise<MigrationRecord[]> {
    const result = await this.db.execute(
      'SELECT * FROM schema_migrations ORDER BY version ASC'
    );
    return result.rows.map((row: any) => ({
      version: row.version,
      name: row.name,
      description: row.description,
      appliedAt: row.applied_at,
      appliedBy: row.applied_by,
      durationMs: row.duration_ms,
      checksum: row.checksum,
      status: row.status,
    }));
  }

  /**
   * Get pending migrations
   */
  async getPendingMigrations(): Promise<Migration[]> {
    const applied = await this.getAppliedMigrations();
    const appliedVersions = new Set(applied.map(m => m.version));

    return this.getAvailableMigrations().filter(m => !appliedVersions.has(m.version));
  }

  /**
   * Get current schema version
   */
  async getCurrentVersion(): Promise<number> {
    const applied = await this.getAppliedMigrations();
    return applied.length > 0 ? Math.max(...applied.map(m => m.version)) : 0;
  }

  /**
   * Apply all pending migrations
   */
  async migrateUp(options: MigrationOptions = {}): Promise<MigrationResult[]> {
    const pending = await this.getPendingMigrations();

    if (pending.length === 0) {
      console.error('✅ No pending migrations');
      return [];
    }

    console.error(`📦 Found ${pending.length} pending migration(s)`);

    const results: MigrationResult[] = [];

    for (const migration of pending) {
      const result = await this.applyMigration(migration, options);
      results.push(result);

      if (!result.success) {
        console.error(`❌ Migration ${migration.version} failed, stopping`);
        break;
      }
    }

    return results;
  }

  /**
   * Rollback migrations
   */
  async migrateDown(count: number = 1, options: MigrationOptions = {}): Promise<MigrationResult[]> {
    const applied = await this.getAppliedMigrations();
    const toRollback = applied
      .filter(m => m.status === 'applied')
      .sort((a, b) => b.version - a.version)
      .slice(0, count);

    if (toRollback.length === 0) {
      console.error('✅ No migrations to rollback');
      return [];
    }

    console.error(`🔄 Rolling back ${toRollback.length} migration(s)`);

    const results: MigrationResult[] = [];

    for (const record of toRollback) {
      const migration = this.getAvailableMigrations().find(m => m.version === record.version);
      if (!migration) {
        console.error(`❌ Migration ${record.version} not found in registry`);
        continue;
      }

      const result = await this.rollbackMigration(migration, options);
      results.push(result);

      if (!result.success) {
        console.error(`❌ Rollback of migration ${migration.version} failed, stopping`);
        break;
      }
    }

    return results;
  }

  /**
   * Migrate to specific version
   */
  async migrateTo(targetVersion: number, options: MigrationOptions = {}): Promise<MigrationResult[]> {
    const currentVersion = await this.getCurrentVersion();

    if (targetVersion === currentVersion) {
      console.error(`✅ Already at version ${targetVersion}`);
      return [];
    }

    if (targetVersion > currentVersion) {
      // Migrate up
      const pending = await this.getPendingMigrations();
      const toApply = pending.filter(m => m.version <= targetVersion);
      console.error(`📦 Migrating up to version ${targetVersion}`);

      const results: MigrationResult[] = [];
      for (const migration of toApply) {
        const result = await this.applyMigration(migration, options);
        results.push(result);
        if (!result.success) break;
      }
      return results;
    } else {
      // Migrate down
      const applied = await this.getAppliedMigrations();
      const toRollback = applied
        .filter(m => m.version > targetVersion && m.status === 'applied')
        .sort((a, b) => b.version - a.version);

      console.error(`🔄 Migrating down to version ${targetVersion}`);

      const results: MigrationResult[] = [];
      for (const record of toRollback) {
        const migration = this.getAvailableMigrations().find(m => m.version === record.version);
        if (!migration) continue;

        const result = await this.rollbackMigration(migration, options);
        results.push(result);
        if (!result.success) break;
      }
      return results;
    }
  }

  /**
   * Verify all applied migrations
   */
  async verify(): Promise<{ passed: boolean; results: VerificationResult[] }> {
    const applied = await this.getAppliedMigrations();
    const results: VerificationResult[] = [];

    console.error(`🔍 Verifying ${applied.length} migration(s)...`);

    for (const record of applied) {
      const migration = this.getAvailableMigrations().find(m => m.version === record.version);
      if (!migration) {
        results.push({
          passed: false,
          message: `Migration ${record.version} not found in registry`,
        });
        continue;
      }

      const result = await migration.verify(this.db);
      results.push(result);

      if (result.passed) {
        console.error(`  ✅ Migration ${migration.version}: ${result.message}`);
      } else {
        console.error(`  ❌ Migration ${migration.version}: ${result.message}`);
      }
    }

    const allPassed = results.every(r => r.passed);
    return { passed: allPassed, results };
  }

  /**
   * Apply a single migration
   */
  private async applyMigration(
    migration: Migration,
    options: MigrationOptions = {}
  ): Promise<MigrationResult> {
    const startTime = Date.now();

    console.error(`\n📦 Applying migration ${migration.version}: ${migration.name}`);
    console.error(`   ${migration.description}`);

    if (options.dryRun) {
      console.error('   🔍 DRY RUN MODE - No changes will be applied');
      return {
        success: true,
        version: migration.version,
        name: migration.name,
        duration: 0,
      };
    }

    try {
      // Apply migration (wrapped in transaction by LibSQL)
      await migration.up(this.db);

      // Verify migration unless skipped
      if (!options.skipVerify) {
        const verifyResult = await migration.verify(this.db);
        if (!verifyResult.passed) {
          throw new Error(`Migration verification failed: ${verifyResult.message}`);
        }
        console.error(`   ✅ Verification passed`);
      }

      // Record migration
      const duration = Date.now() - startTime;
      await this.recordMigration(migration, duration, 'applied');

      console.error(`   ✅ Migration ${migration.version} completed in ${duration}ms`);

      return {
        success: true,
        version: migration.version,
        name: migration.name,
        duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      console.error(`   ❌ Migration ${migration.version} failed: ${errorMessage}`);

      // Record failed migration
      try {
        await this.recordMigration(migration, duration, 'failed');
      } catch {
        // Ignore errors recording failed migration
      }

      return {
        success: false,
        version: migration.version,
        name: migration.name,
        duration,
        error: errorMessage,
      };
    }
  }

  /**
   * Rollback a single migration
   */
  private async rollbackMigration(
    migration: Migration,
    options: MigrationOptions = {}
  ): Promise<MigrationResult> {
    const startTime = Date.now();

    console.error(`\n🔄 Rolling back migration ${migration.version}: ${migration.name}`);

    if (options.dryRun) {
      console.error('   🔍 DRY RUN MODE - No changes will be applied');
      return {
        success: true,
        version: migration.version,
        name: migration.name,
        duration: 0,
      };
    }

    try {
      await migration.down(this.db);

      const duration = Date.now() - startTime;

      // Update migration record
      await this.db.execute('UPDATE schema_migrations SET status = ? WHERE version = ?', [
        'rolled_back',
        migration.version,
      ]);

      console.error(`   ✅ Rollback completed in ${duration}ms`);

      return {
        success: true,
        version: migration.version,
        name: migration.name,
        duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      console.error(`   ❌ Rollback failed: ${errorMessage}`);

      return {
        success: false,
        version: migration.version,
        name: migration.name,
        duration,
        error: errorMessage,
      };
    }
  }

  /**
   * Record migration in database
   */
  private async recordMigration(
    migration: Migration,
    duration: number,
    status: 'applied' | 'failed'
  ): Promise<void> {
    await this.db.execute(
      `INSERT OR REPLACE INTO schema_migrations
       (version, name, description, applied_at, applied_by, duration_ms, checksum, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        migration.version,
        migration.name,
        migration.description,
        new Date().toISOString(),
        'system',
        duration,
        migration.getChecksum(),
        status,
      ]
    );
  }

  /**
   * Migrate from legacy schema_version table
   */
  private async migrateFromLegacySchemaVersion(): Promise<void> {
    try {
      // Check if old schema_version table exists
      const result = await this.db.execute(
        `SELECT COUNT(*) as count FROM sqlite_master WHERE type='table' AND name='schema_version'`
      );

      if ((result.rows[0] as any).count === 0) {
        return; // No legacy table
      }

      // Get version from old table
      const versionResult = await this.db.execute(
        'SELECT version FROM schema_version ORDER BY version DESC LIMIT 1'
      );

      if (versionResult.rows.length === 0) {
        return; // No version recorded
      }

      const legacyVersion = (versionResult.rows[0] as any).version;

      // Check if already migrated
      const migratedResult = await this.db.execute(
        'SELECT COUNT(*) as count FROM schema_migrations WHERE version = ?',
        [legacyVersion]
      );

      if ((migratedResult.rows[0] as any).count > 0) {
        return; // Already migrated
      }

      // Migrate to new format
      console.error(`📦 Migrating from legacy schema_version table (v${legacyVersion})`);

      await this.db.execute(
        `INSERT INTO schema_migrations (version, name, description, applied_at, status)
         VALUES (?, ?, ?, ?, ?)`,
        [
          legacyVersion,
          '001_initial_schema',
          'Migrated from legacy schema_version table',
          new Date().toISOString(),
          'applied',
        ]
      );

      console.error(`✅ Legacy migration record created`);
    } catch (error) {
      console.error(`Warning: Could not migrate from legacy schema_version:`, error);
    }
  }
}

/**
 * Export migration runner factory
 */
export function createMigrationRunner(db: DatabaseConnection): MigrationRunner {
  return new MigrationRunner(db);
}

/**
 * Export all migrations
 */
export { MIGRATIONS };
export * from './migration-base.js';
