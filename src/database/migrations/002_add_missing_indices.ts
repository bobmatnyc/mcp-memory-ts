/**
 * Migration 002: Add Missing Performance Indices
 * Adds optimized composite indices for common query patterns
 */

import type { DatabaseConnection } from '../connection.js';
import { Migration, type VerificationResult } from './migration-base.js';

export class Migration002AddMissingIndices extends Migration {
  readonly version = 2;
  readonly name = '002_add_missing_indices';
  readonly description = 'Add composite indices for entities.created_at and memories.updated_at queries';

  async up(db: DatabaseConnection): Promise<void> {
    console.error('📊 Adding missing performance indices...');

    // Add entity created_at index for ORDER BY created_at queries
    await this.executeSql(
      db,
      'CREATE INDEX IF NOT EXISTS idx_entities_user_created ON entities(user_id, created_at DESC)',
      '  ✓ Index: idx_entities_user_created'
    );

    // Add memory updated_at index for ORDER BY updated_at queries
    await this.executeSql(
      db,
      'CREATE INDEX IF NOT EXISTS idx_memories_user_updated ON memories(user_id, updated_at DESC)',
      '  ✓ Index: idx_memories_user_updated'
    );

    console.error('✅ Performance indices added successfully');
  }

  async down(db: DatabaseConnection): Promise<void> {
    console.error('🗑️  Removing performance indices...');

    await this.executeSql(
      db,
      'DROP INDEX IF EXISTS idx_entities_user_created',
      '  ✓ Dropped: idx_entities_user_created'
    );

    await this.executeSql(
      db,
      'DROP INDEX IF EXISTS idx_memories_user_updated',
      '  ✓ Dropped: idx_memories_user_updated'
    );

    console.error('✅ Performance indices removed');
  }

  async verify(db: DatabaseConnection): Promise<VerificationResult> {
    try {
      const entitiesIndexExists = await this.indexExists(db, 'idx_entities_user_created');
      const memoriesIndexExists = await this.indexExists(db, 'idx_memories_user_updated');

      if (!entitiesIndexExists || !memoriesIndexExists) {
        return {
          passed: false,
          message: 'One or more performance indices missing',
          details: {
            idx_entities_user_created: entitiesIndexExists,
            idx_memories_user_updated: memoriesIndexExists,
          },
        };
      }

      return {
        passed: true,
        message: 'Performance indices verified successfully',
        details: {
          indices_added: 2,
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
