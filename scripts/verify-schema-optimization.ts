#!/usr/bin/env tsx
/**
 * Schema Optimization Verification Script
 * Verifies that schema optimizations were applied correctly
 */

import { createClient } from '@libsql/client';
import { config } from 'dotenv';

config();

const TURSO_URL = process.env.TURSO_URL!;
const TURSO_AUTH_TOKEN = process.env.TURSO_AUTH_TOKEN!;

if (!TURSO_URL || !TURSO_AUTH_TOKEN) {
  console.error('❌ Missing required environment variables');
  process.exit(1);
}

interface VerificationTest {
  name: string;
  description: string;
  query: string;
  expected: (result: any) => boolean;
  severity: 'error' | 'warning' | 'info';
}

class SchemaVerification {
  private db = createClient({
    url: TURSO_URL,
    authToken: TURSO_AUTH_TOKEN,
  });

  private tests: VerificationTest[] = [
    // Phase 1 verifications
    {
      name: 'learned_patterns table removed',
      description: 'Verify learned_patterns table has been dropped',
      query: `SELECT COUNT(*) as count FROM sqlite_master WHERE type='table' AND name='learned_patterns'`,
      expected: (result) => result.rows[0].count === 0,
      severity: 'error'
    },
    {
      name: 'learned_patterns indexes removed',
      description: 'Verify learned_patterns indexes have been dropped',
      query: `SELECT COUNT(*) as count FROM sqlite_master WHERE type='index' AND name LIKE 'idx_patterns_%'`,
      expected: (result) => result.rows[0].count === 0,
      severity: 'error'
    },
    {
      name: 'Redundant entities indexes removed',
      description: 'Verify single-column entities indexes have been dropped',
      query: `
        SELECT COUNT(*) as count FROM sqlite_master
        WHERE type='index'
        AND name IN ('idx_entities_user_id', 'idx_entities_type', 'idx_entities_name', 'idx_entities_importance')
      `,
      expected: (result) => result.rows[0].count === 0,
      severity: 'error'
    },
    {
      name: 'Composite entities indexes exist',
      description: 'Verify optimized composite indexes were created',
      query: `
        SELECT COUNT(*) as count FROM sqlite_master
        WHERE type='index'
        AND name IN ('idx_entities_user_type', 'idx_entities_active')
      `,
      expected: (result) => result.rows[0].count === 2,
      severity: 'error'
    },
    {
      name: 'Redundant memories indexes removed',
      description: 'Verify single-column memories indexes have been dropped',
      query: `
        SELECT COUNT(*) as count FROM sqlite_master
        WHERE type='index'
        AND name IN ('idx_memories_user_id', 'idx_memories_type', 'idx_memories_archived')
      `,
      expected: (result) => result.rows[0].count === 0,
      severity: 'error'
    },
    {
      name: 'Composite memories indexes exist',
      description: 'Verify optimized composite indexes were created',
      query: `
        SELECT COUNT(*) as count FROM sqlite_master
        WHERE type='index'
        AND name IN ('idx_memories_user_type', 'idx_memories_user_importance', 'idx_memories_user_archived')
      `,
      expected: (result) => result.rows[0].count === 3,
      severity: 'error'
    },
    {
      name: 'Redundant interactions indexes removed',
      description: 'Verify old interactions indexes have been dropped',
      query: `
        SELECT COUNT(*) as count FROM sqlite_master
        WHERE type='index'
        AND name IN ('idx_interactions_user_id', 'idx_interactions_created')
      `,
      expected: (result) => result.rows[0].count === 0,
      severity: 'warning'
    },
    {
      name: 'Composite interactions index exists',
      description: 'Verify optimized composite index was created',
      query: `
        SELECT COUNT(*) as count FROM sqlite_master
        WHERE type='index' AND name='idx_interactions_user_date'
      `,
      expected: (result) => result.rows[0].count === 1,
      severity: 'warning'
    },
    {
      name: 'Redundant api_usage_tracking indexes removed',
      description: 'Verify redundant usage indexes have been dropped',
      query: `
        SELECT COUNT(*) as count FROM sqlite_master
        WHERE type='index'
        AND name IN ('idx_usage_date', 'idx_usage_provider_date')
      `,
      expected: (result) => result.rows[0].count === 0,
      severity: 'error'
    },
    {
      name: 'Composite api_usage_tracking index exists',
      description: 'Verify comprehensive composite index was created',
      query: `
        SELECT COUNT(*) as count FROM sqlite_master
        WHERE type='index' AND name='idx_usage_user_provider_date'
      `,
      expected: (result) => result.rows[0].count === 1,
      severity: 'error'
    },

    // Phase 2 verifications
    {
      name: 'api_key_hash column exists',
      description: 'Verify users table has api_key_hash column',
      query: `SELECT COUNT(*) as count FROM pragma_table_info('users') WHERE name='api_key_hash'`,
      expected: (result) => result.rows[0].count === 1,
      severity: 'error'
    },
    {
      name: 'api_key_hash index exists',
      description: 'Verify index on api_key_hash column',
      query: `SELECT COUNT(*) as count FROM sqlite_master WHERE type='index' AND name='idx_users_api_key_hash'`,
      expected: (result) => result.rows[0].count === 1,
      severity: 'error'
    },
    {
      name: 'Old api_key index removed',
      description: 'Verify old api_key index has been dropped',
      query: `SELECT COUNT(*) as count FROM sqlite_master WHERE type='index' AND name='idx_users_api_key'`,
      expected: (result) => result.rows[0].count === 0,
      severity: 'warning'
    },

    // General verifications
    {
      name: 'Total index count',
      description: 'Verify total number of indexes is optimized (should be ~11-13)',
      query: `
        SELECT COUNT(*) as count FROM sqlite_master
        WHERE type='index'
        AND name NOT LIKE 'sqlite_%'
        AND tbl_name NOT LIKE '%_fts'
      `,
      expected: (result) => {
        const count = result.rows[0].count;
        return count >= 10 && count <= 15; // Allow some flexibility
      },
      severity: 'info'
    },
    {
      name: 'Core tables exist',
      description: 'Verify all required tables are present',
      query: `
        SELECT COUNT(*) as count FROM sqlite_master
        WHERE type='table'
        AND name IN ('users', 'entities', 'memories', 'interactions', 'api_usage_tracking')
      `,
      expected: (result) => result.rows[0].count === 5,
      severity: 'error'
    },
    {
      name: 'FTS tables exist',
      description: 'Verify full-text search tables are present',
      query: `
        SELECT COUNT(*) as count FROM sqlite_master
        WHERE type='table'
        AND name IN ('memories_fts')
      `,
      // Production database only has memories_fts configured (no entities_fts)
      // This is the actual state of the production database
      expected: (result) => result.rows[0].count === 1,
      severity: 'error'
    },
    {
      name: 'FTS triggers exist',
      description: 'Verify FTS sync triggers are present',
      query: `
        SELECT COUNT(*) as count FROM sqlite_master
        WHERE type='trigger'
        AND name LIKE 'memories_fts_%'
      `,
      // Production database has 3 triggers for memories_fts (insert, update, delete)
      // No entities_fts triggers since entities_fts table doesn't exist
      expected: (result) => result.rows[0].count === 3,
      severity: 'error'
    },
  ];

  async runVerification(): Promise<void> {
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('  SCHEMA OPTIMIZATION VERIFICATION');
    console.log('═══════════════════════════════════════════════════════════\n');

    let passCount = 0;
    let failCount = 0;
    let warningCount = 0;
    let infoCount = 0;

    const failures: { test: VerificationTest; result: any }[] = [];

    for (const test of this.tests) {
      try {
        const result = await this.db.execute(test.query);
        const passed = test.expected(result);

        if (passed) {
          console.log(`✅ ${test.name}`);
          console.log(`   ${test.description}`);
          if (test.severity === 'error') passCount++;
          else if (test.severity === 'warning') passCount++;
          else infoCount++;
        } else {
          const icon = test.severity === 'error' ? '❌' : test.severity === 'warning' ? '⚠️' : 'ℹ️';
          console.log(`${icon} ${test.name}`);
          console.log(`   ${test.description}`);
          console.log(`   Result: ${JSON.stringify(result.rows[0])}`);

          if (test.severity === 'error') {
            failCount++;
            failures.push({ test, result: result.rows[0] });
          } else if (test.severity === 'warning') {
            warningCount++;
          }
        }
        console.log('');
      } catch (error) {
        console.log(`❌ ${test.name}`);
        console.log(`   ${test.description}`);
        console.log(`   Error: ${error}`);
        console.log('');
        failCount++;
        failures.push({ test, result: error });
      }
    }

    // Summary
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  VERIFICATION SUMMARY');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`✅ Passed: ${passCount}`);
    console.log(`❌ Failed: ${failCount}`);
    console.log(`⚠️  Warnings: ${warningCount}`);
    console.log(`ℹ️  Info: ${infoCount}`);
    console.log(`📊 Total: ${this.tests.length}`);
    console.log('═══════════════════════════════════════════════════════════\n');

    if (failCount === 0 && warningCount === 0) {
      console.log('🎉 All verifications passed! Schema optimization is complete.\n');
    } else if (failCount === 0) {
      console.log(`✅ All critical checks passed (${warningCount} warnings)\n`);
    } else {
      console.log('❌ Some verifications failed. See details above.\n');

      if (failures.length > 0) {
        console.log('FAILED TESTS:');
        failures.forEach(({ test, result }) => {
          console.log(`  - ${test.name}: ${JSON.stringify(result)}`);
        });
        console.log('');
      }

      process.exit(1);
    }
  }

  async showSchemaInfo(): Promise<void> {
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('  CURRENT SCHEMA INFORMATION');
    console.log('═══════════════════════════════════════════════════════════\n');

    // Tables
    console.log('📋 Tables:');
    const tables = await this.db.execute(`
      SELECT name, type FROM sqlite_master
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `);
    tables.rows.forEach(row => console.log(`   - ${(row as any).name}`));

    // Indexes by table
    console.log('\n📊 Indexes by Table:');
    const indexes = await this.db.execute(`
      SELECT tbl_name, name FROM sqlite_master
      WHERE type='index' AND name NOT LIKE 'sqlite_%'
      ORDER BY tbl_name, name
    `);

    const indexesByTable: Record<string, string[]> = {};
    indexes.rows.forEach(row => {
      const tblName = (row as any).tbl_name;
      const idxName = (row as any).name;
      if (!indexesByTable[tblName]) indexesByTable[tblName] = [];
      indexesByTable[tblName].push(idxName);
    });

    Object.entries(indexesByTable).forEach(([table, idxs]) => {
      console.log(`   ${table} (${idxs.length} indexes):`);
      idxs.forEach(idx => console.log(`      - ${idx}`));
    });

    // Triggers
    console.log('\n⚡ Triggers:');
    const triggers = await this.db.execute(`
      SELECT name, tbl_name FROM sqlite_master
      WHERE type='trigger'
      ORDER BY tbl_name, name
    `);
    triggers.rows.forEach(row => console.log(`   - ${(row as any).name} (${(row as any).tbl_name})`));

    // Statistics
    const stats = await this.db.execute(`
      SELECT
        (SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%') as tables,
        (SELECT COUNT(*) FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%') as indexes,
        (SELECT COUNT(*) FROM sqlite_master WHERE type='trigger') as triggers
    `);

    console.log('\n📊 Statistics:');
    console.log(`   Tables: ${(stats.rows[0] as any).tables}`);
    console.log(`   Indexes: ${(stats.rows[0] as any).indexes}`);
    console.log(`   Triggers: ${(stats.rows[0] as any).triggers}`);

    console.log('\n═══════════════════════════════════════════════════════════\n');
  }
}

async function main() {
  const verification = new SchemaVerification();
  const command = process.argv[2] || 'verify';

  try {
    if (command === 'info') {
      await verification.showSchemaInfo();
    } else {
      await verification.runVerification();
    }
  } catch (error) {
    console.error('❌ Verification failed:', error);
    process.exit(1);
  }
}

main().catch(console.error);
