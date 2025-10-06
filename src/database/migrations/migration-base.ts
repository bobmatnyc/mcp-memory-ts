/**
 * Base Migration Interface
 * All migrations must implement this interface
 */

import { createHash } from 'crypto';
import type { DatabaseConnection } from '../connection.js';

export interface MigrationOptions {
  dryRun?: boolean;
  verbose?: boolean;
  skipVerify?: boolean;
}

export interface MigrationResult {
  success: boolean;
  version: number;
  name: string;
  duration: number;
  error?: string;
}

export interface MigrationRecord {
  version: number;
  name: string;
  description?: string;
  appliedAt: string;
  appliedBy?: string;
  durationMs?: number;
  checksum?: string;
  status: 'applied' | 'rolled_back' | 'failed';
}

export interface VerificationResult {
  passed: boolean;
  message: string;
  details?: Record<string, any>;
}

/**
 * Base migration class
 */
export abstract class Migration {
  abstract readonly version: number;
  abstract readonly name: string;
  abstract readonly description: string;

  /**
   * Apply the migration (upgrade)
   */
  abstract up(db: DatabaseConnection): Promise<void>;

  /**
   * Revert the migration (downgrade)
   */
  abstract down(db: DatabaseConnection): Promise<void>;

  /**
   * Verify the migration was applied correctly
   */
  abstract verify(db: DatabaseConnection): Promise<VerificationResult>;

  /**
   * Get migration checksum for integrity verification
   */
  getChecksum(): string {
    const content = `${this.version}:${this.name}:${this.description}`;
    return createHash('sha256').update(content).digest('hex');
  }

  /**
   * Execute SQL statements with error handling
   */
  protected async executeSql(
    db: DatabaseConnection,
    sql: string | string[],
    description?: string
  ): Promise<void> {
    const statements = Array.isArray(sql) ? sql : [sql];

    for (const statement of statements) {
      try {
        if (description) {
          console.error(`  ${description}`);
        }
        await db.execute(statement);
      } catch (error) {
        console.error(`  ❌ Failed: ${statement.substring(0, 100)}...`);
        throw error;
      }
    }
  }

  /**
   * Check if a table exists
   */
  protected async tableExists(db: DatabaseConnection, tableName: string): Promise<boolean> {
    const result = await db.execute(
      `SELECT COUNT(*) as count FROM sqlite_master WHERE type='table' AND name=?`,
      [tableName]
    );
    return (result.rows[0] as any).count > 0;
  }

  /**
   * Check if an index exists
   */
  protected async indexExists(db: DatabaseConnection, indexName: string): Promise<boolean> {
    const result = await db.execute(
      `SELECT COUNT(*) as count FROM sqlite_master WHERE type='index' AND name=?`,
      [indexName]
    );
    return (result.rows[0] as any).count > 0;
  }

  /**
   * Check if a column exists
   */
  protected async columnExists(
    db: DatabaseConnection,
    tableName: string,
    columnName: string
  ): Promise<boolean> {
    const result = await db.execute(`SELECT COUNT(*) as count FROM pragma_table_info('${tableName}') WHERE name=?`, [
      columnName,
    ]);
    return (result.rows[0] as any).count > 0;
  }

  /**
   * Get table row count
   */
  protected async getRowCount(db: DatabaseConnection, tableName: string): Promise<number> {
    const result = await db.execute(`SELECT COUNT(*) as count FROM ${tableName}`);
    return (result.rows[0] as any).count;
  }
}
