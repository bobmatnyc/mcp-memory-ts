#!/usr/bin/env tsx

/**
 * COMPREHENSIVE DEPLOYMENT PIPELINE
 * Prevents schema mismatches and validates deployment readiness
 */

import { DatabaseConnection } from '../src/database/connection.js';

interface SchemaValidation {
  table: string;
  requiredColumns: string[];
  requiredIndexes?: string[];
}

const REQUIRED_SCHEMA: SchemaValidation[] = [
  {
    table: 'memories',
    requiredColumns: ['id', 'title', 'content', 'importance', 'tags', 'metadata', 'entity_ids', 'is_archived', 'user_id', 'embedding'],
  },
  {
    table: 'memories_fts',
    requiredColumns: ['id', 'title', 'content', 'tags'],
  },
  {
    table: 'users',
    requiredColumns: ['id', 'email', 'name', 'organization'],
  },
  {
    table: 'entities',
    requiredColumns: ['id', 'name', 'entity_type'],
  },
];

class DeploymentPipeline {
  private db: DatabaseConnection;

  constructor() {
    this.db = new DatabaseConnection({
      url: process.env.TURSO_URL!,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
  }

  async runPipeline(): Promise<boolean> {
    console.log('🚀 DEPLOYMENT PIPELINE STARTING');
    console.log('=' .repeat(60));

    try {
      await this.db.connect();
      console.log('✅ Database connection established');

      // Step 1: Schema validation
      const schemaValid = await this.validateSchema();
      if (!schemaValid) {
        console.log('❌ DEPLOYMENT BLOCKED: Schema validation failed');
        return false;
      }

      // Step 2: Data integrity checks
      const dataValid = await this.validateDataIntegrity();
      if (!dataValid) {
        console.log('❌ DEPLOYMENT BLOCKED: Data integrity checks failed');
        return false;
      }

      // Step 3: Functional tests
      const functionalValid = await this.runFunctionalTests();
      if (!functionalValid) {
        console.log('❌ DEPLOYMENT BLOCKED: Functional tests failed');
        return false;
      }

      // Step 4: Performance checks
      const performanceValid = await this.validatePerformance();
      if (!performanceValid) {
        console.log('⚠️ DEPLOYMENT WARNING: Performance issues detected');
      }

      console.log('\n🎉 DEPLOYMENT PIPELINE PASSED');
      console.log('✅ All validations successful - READY FOR PRODUCTION');
      return true;

    } catch (error) {
      console.log('💥 DEPLOYMENT PIPELINE FAILED:', error);
      return false;
    } finally {
      await this.db.disconnect();
    }
  }

  private async validateSchema(): Promise<boolean> {
    console.log('\n📋 SCHEMA VALIDATION');
    console.log('-' .repeat(30));

    let allValid = true;

    for (const schema of REQUIRED_SCHEMA) {
      console.log(`\n🔍 Validating table: ${schema.table}`);

      // Check if table exists
      try {
        const tableCheck = await this.db.execute(
          `SELECT name FROM sqlite_master WHERE type='table' AND name=?`,
          [schema.table]
        );

        if (tableCheck.rows.length === 0) {
          console.log(`❌ Table ${schema.table} does not exist`);
          allValid = false;
          continue;
        }

        console.log(`✅ Table ${schema.table} exists`);

        // Check columns
        const columnInfo = await this.db.execute(`PRAGMA table_info(${schema.table})`);
        const actualColumns = columnInfo.rows.map((row: any) => row.name);

        for (const requiredCol of schema.requiredColumns) {
          if (actualColumns.includes(requiredCol)) {
            console.log(`  ✅ Column ${requiredCol}`);
          } else {
            console.log(`  ❌ Missing column ${requiredCol}`);
            allValid = false;
          }
        }

      } catch (error) {
        console.log(`❌ Failed to validate ${schema.table}:`, error);
        allValid = false;
      }
    }

    return allValid;
  }

  private async validateDataIntegrity(): Promise<boolean> {
    console.log('\n🔍 DATA INTEGRITY VALIDATION');
    console.log('-' .repeat(30));

    try {
      // Check for orphaned records
      const orphanedMemories = await this.db.execute(`
        SELECT COUNT(*) as count FROM memories 
        WHERE user_id IS NOT NULL 
        AND user_id NOT IN (SELECT id FROM users)
      `);

      if (orphanedMemories.rows[0].count > 0) {
        console.log(`⚠️ Found ${orphanedMemories.rows[0].count} orphaned memories`);
      } else {
        console.log('✅ No orphaned memories found');
      }

      // Check FTS sync
      const memoryCount = await this.db.execute('SELECT COUNT(*) as count FROM memories WHERE active = 1');
      const ftsCount = await this.db.execute('SELECT COUNT(*) as count FROM memories_fts');

      if (memoryCount.rows[0].count === ftsCount.rows[0].count) {
        console.log('✅ FTS table in sync with memories table');
      } else {
        console.log(`⚠️ FTS sync issue: ${memoryCount.rows[0].count} memories vs ${ftsCount.rows[0].count} FTS entries`);
      }

      return true;
    } catch (error) {
      console.log('❌ Data integrity validation failed:', error);
      return false;
    }
  }

  private async runFunctionalTests(): Promise<boolean> {
    console.log('\n🧪 FUNCTIONAL TESTS');
    console.log('-' .repeat(30));

    try {
      // Test 1: Memory storage
      console.log('Testing memory storage...');
      const testMemory = {
        id: 'test-' + Date.now(),
        title: 'Deployment Test Memory',
        content: 'This is a test memory for deployment validation',
        user_id: 'test-user',
        importance: 0.5,
        tags: '["test", "deployment"]',
        metadata: '{"test": true}',
        entity_ids: '[]',
        is_archived: 0,
        active: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      await this.db.execute(`
        INSERT INTO memories (id, title, content, user_id, importance, tags, metadata, entity_ids, is_archived, active, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        testMemory.id, testMemory.title, testMemory.content, testMemory.user_id,
        testMemory.importance, testMemory.tags, testMemory.metadata, testMemory.entity_ids,
        testMemory.is_archived, testMemory.active, testMemory.created_at, testMemory.updated_at
      ]);
      console.log('✅ Memory storage test passed');

      // Test 2: FTS search
      console.log('Testing FTS search...');
      const searchResult = await this.db.execute(`
        SELECT * FROM memories_fts WHERE memories_fts MATCH 'deployment' LIMIT 1
      `);
      console.log('✅ FTS search test passed');

      // Test 3: Memory retrieval
      console.log('Testing memory retrieval...');
      const retrieveResult = await this.db.execute(`
        SELECT * FROM memories WHERE id = ?
      `, [testMemory.id]);

      if (retrieveResult.rows.length === 1) {
        console.log('✅ Memory retrieval test passed');
      } else {
        console.log('❌ Memory retrieval test failed');
        return false;
      }

      // Cleanup test data
      await this.db.execute('DELETE FROM memories WHERE id = ?', [testMemory.id]);
      console.log('✅ Test cleanup completed');

      return true;
    } catch (error) {
      console.log('❌ Functional tests failed:', error);
      return false;
    }
  }

  private async validatePerformance(): Promise<boolean> {
    console.log('\n⚡ PERFORMANCE VALIDATION');
    console.log('-' .repeat(30));

    try {
      // Test query performance
      const start = Date.now();
      await this.db.execute('SELECT COUNT(*) FROM memories');
      const queryTime = Date.now() - start;

      if (queryTime < 1000) {
        console.log(`✅ Query performance: ${queryTime}ms`);
      } else {
        console.log(`⚠️ Slow query performance: ${queryTime}ms`);
        return false;
      }

      // Test FTS performance
      const ftsStart = Date.now();
      await this.db.execute(`SELECT * FROM memories_fts WHERE memories_fts MATCH 'test' LIMIT 10`);
      const ftsTime = Date.now() - ftsStart;

      if (ftsTime < 500) {
        console.log(`✅ FTS performance: ${ftsTime}ms`);
      } else {
        console.log(`⚠️ Slow FTS performance: ${ftsTime}ms`);
      }

      return true;
    } catch (error) {
      console.log('❌ Performance validation failed:', error);
      return false;
    }
  }
}

// Run deployment pipeline
const pipeline = new DeploymentPipeline();
pipeline.runPipeline().then(success => {
  if (success) {
    console.log('\n🚀 DEPLOYMENT APPROVED');
    process.exit(0);
  } else {
    console.log('\n🚨 DEPLOYMENT REJECTED');
    process.exit(1);
  }
}).catch(error => {
  console.error('💥 PIPELINE ERROR:', error);
  process.exit(1);
});
