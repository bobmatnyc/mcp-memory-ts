/**
 * Migration 001: Initial Schema
 * Represents the current production schema (v1.3.0)
 */

import type { DatabaseConnection } from '../connection.js';
import { Migration, type VerificationResult } from './migration-base.js';
import { CREATE_TABLES, CREATE_INDEXES, CREATE_FTS_TABLES, CREATE_FTS_TRIGGERS } from '../schema.js';

export class Migration001InitialSchema extends Migration {
  readonly version = 1;
  readonly name = '001_initial_schema';
  readonly description = 'Initial database schema with users, entities, memories, interactions, and API usage tracking';

  async up(db: DatabaseConnection): Promise<void> {
    console.error('📦 Creating initial schema...');

    // Create all tables
    console.error('  Creating tables...');
    for (const [tableName, sql] of Object.entries(CREATE_TABLES)) {
      await this.executeSql(db, sql, `  ✓ Table: ${tableName}`);
    }

    // Create all indexes
    console.error('  Creating indexes...');
    for (const [tableName, indexes] of Object.entries(CREATE_INDEXES)) {
      for (const indexSql of indexes) {
        await this.executeSql(db, indexSql);
      }
      console.error(`  ✓ Indexes for: ${tableName}`);
    }

    // Create FTS tables
    console.error('  Creating full-text search tables...');
    for (const [tableName, sql] of Object.entries(CREATE_FTS_TABLES)) {
      await this.executeSql(db, sql, `  ✓ FTS table: ${tableName}`);
    }

    // Create FTS triggers
    console.error('  Creating FTS triggers...');
    for (const [tableName, triggers] of Object.entries(CREATE_FTS_TRIGGERS)) {
      for (const triggerSql of triggers) {
        await this.executeSql(db, triggerSql);
      }
      console.error(`  ✓ Triggers for: ${tableName}`);
    }

    console.error('✅ Initial schema created successfully');
  }

  async down(db: DatabaseConnection): Promise<void> {
    console.error('🗑️  Rolling back initial schema...');

    const tables = [
      'memories_fts',
      'entities_fts',
      'interactions',
      'memories',
      'entities',
      'api_usage_tracking',
      'users',
    ];

    for (const table of tables) {
      await this.executeSql(db, `DROP TABLE IF EXISTS ${table}`, `  ✓ Dropped: ${table}`);
    }

    console.error('✅ Initial schema rolled back');
  }

  async verify(db: DatabaseConnection): Promise<VerificationResult> {
    try {
      // Verify all tables exist
      const expectedTables = ['users', 'entities', 'memories', 'interactions', 'api_usage_tracking', 'schema_version'];

      for (const table of expectedTables) {
        if (!(await this.tableExists(db, table))) {
          return {
            passed: false,
            message: `Table ${table} does not exist`,
          };
        }
      }

      // Verify key indexes exist
      const expectedIndexes = [
        'idx_users_email',
        'idx_users_api_key_hash',
        'idx_entities_user_type',
        'idx_memories_user_type',
        'idx_memories_user_archived',
        'idx_usage_user_provider_date',
      ];

      for (const index of expectedIndexes) {
        if (!(await this.indexExists(db, index))) {
          return {
            passed: false,
            message: `Index ${index} does not exist`,
          };
        }
      }

      // Verify FTS tables exist
      const ftsTableExists = await this.tableExists(db, 'memories_fts');
      if (!ftsTableExists) {
        return {
          passed: false,
          message: 'FTS tables do not exist',
        };
      }

      return {
        passed: true,
        message: 'Initial schema verified successfully',
        details: {
          tables: expectedTables.length,
          indexes: expectedIndexes.length,
          fts_tables: 2,
        },
      };
    } catch (error) {
      return {
        passed: false,
        message: `Verification failed: ${error}`,
      };
    }
  }
}
