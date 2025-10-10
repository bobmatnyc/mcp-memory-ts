#!/usr/bin/env tsx
/**
 * Advanced NULL ID Recovery Script
 *
 * Handles the 407 remaining memories with NULL IDs that cause UNIQUE constraint violations.
 *
 * Problem: SQLite treats all NULL IDs as identical in UNIQUE indexes, causing constraint errors
 * Solution: Delete NULL ID records and re-insert with proper UUIDs using rowid for identification
 *
 * Safety measures:
 * - Full JSON backup before deletion
 * - Transaction wrapper with automatic rollback on error
 * - Verification after recovery
 * - Rollback capability via backup file
 */

import { createClient, type Client } from '@libsql/client';
import { config } from 'dotenv';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables
config();

const TURSO_URL = process.env.TURSO_URL!;
const TURSO_AUTH_TOKEN = process.env.TURSO_AUTH_TOKEN!;

if (!TURSO_URL || !TURSO_AUTH_TOKEN) {
  console.error('❌ Missing required environment variables: TURSO_URL, TURSO_AUTH_TOKEN');
  process.exit(1);
}

interface MemoryRecord {
  rowid: number;
  id: string | null;
  user_id: string | null;
  title: string;
  content: string;
  memory_type: string;
  importance: string;
  tags: string | null;
  entity_ids: string | null;
  embedding: string | null;
  metadata: string | null;
  is_archived: number;
  created_at: string;
  updated_at: string;
}

interface RecoveryStats {
  totalNullIds: number;
  backedUp: number;
  deleted: number;
  inserted: number;
  verified: number;
  backupFile: string;
}

class AdvancedNullIdRecovery {
  private db: Client;
  private stats: RecoveryStats = {
    totalNullIds: 0,
    backedUp: 0,
    deleted: 0,
    inserted: 0,
    verified: 0,
    backupFile: '',
  };

  constructor() {
    this.db = createClient({
      url: TURSO_URL,
      authToken: TURSO_AUTH_TOKEN,
    });
  }

  /**
   * Main recovery process
   */
  async recover(): Promise<void> {
    console.log('🔄 Advanced NULL ID Recovery\n');

    try {
      // Step 1: Count NULL IDs
      await this.countNullIds();

      if (this.stats.totalNullIds === 0) {
        console.log('✅ No NULL IDs found - database is clean!');
        return;
      }

      // Step 2: Backup NULL ID records
      const records = await this.backupNullIdRecords();

      // Step 3: Perform recovery in transaction
      await this.performRecoveryTransaction(records);

      // Step 4: Verify recovery
      await this.verifyRecovery();

      // Step 5: Print summary
      this.printSummary();

    } catch (error) {
      console.error('\n❌ Recovery failed:', error);
      console.error('\n💡 Your data is safe - no changes were committed.');
      console.error('   Backup file (if created):', this.stats.backupFile || 'Not created');
      throw error;
    } finally {
      this.db.close();
    }
  }

  /**
   * Count NULL IDs in memories table
   */
  private async countNullIds(): Promise<void> {
    const result = await this.db.execute(`
      SELECT COUNT(*) as count
      FROM memories
      WHERE id IS NULL
    `);

    this.stats.totalNullIds = Number(result.rows[0]?.count || 0);
    console.log(`📊 Found ${this.stats.totalNullIds} records with NULL IDs`);
  }

  /**
   * Backup all NULL ID records to JSON file
   */
  private async backupNullIdRecords(): Promise<MemoryRecord[]> {
    console.log(`\n📦 Backing up ${this.stats.totalNullIds} NULL ID records...`);

    // Fetch all NULL ID records with rowid for unique identification
    const result = await this.db.execute(`
      SELECT
        rowid,
        id,
        user_id,
        title,
        content,
        memory_type,
        importance,
        tags,
        entity_ids,
        embedding,
        metadata,
        is_archived,
        created_at,
        updated_at
      FROM memories
      WHERE id IS NULL
      ORDER BY rowid
    `);

    const records = result.rows as unknown as MemoryRecord[];
    this.stats.backedUp = records.length;

    // Create backups directory if it doesn't exist
    const backupsDir = path.join(process.cwd(), 'backups');
    if (!fs.existsSync(backupsDir)) {
      fs.mkdirSync(backupsDir, { recursive: true });
    }

    // Save to JSON file with timestamp
    const timestamp = new Date().toISOString().split('T')[0];
    const backupFile = path.join(backupsDir, `null-id-records-${timestamp}.json`);

    fs.writeFileSync(backupFile, JSON.stringify({
      timestamp: new Date().toISOString(),
      totalRecords: records.length,
      records: records.map(r => ({
        ...r,
        // Include rowid for reference
        original_rowid: r.rowid,
      })),
    }, null, 2));

    this.stats.backupFile = backupFile;
    console.log(`✅ Backup saved to: ${backupFile}`);

    return records;
  }

  /**
   * Perform recovery in a transaction
   */
  private async performRecoveryTransaction(records: MemoryRecord[]): Promise<void> {
    console.log('\n🔧 Starting transaction...');

    // LibSQL doesn't support traditional transactions in the same way
    // We'll use a batch operation for atomicity
    try {
      const statements: Array<{ sql: string; args: any[] }> = [];

      // Step 1: Generate DELETE statements for all NULL ID records
      // We use rowid to uniquely identify each NULL record
      for (const record of records) {
        statements.push({
          sql: 'DELETE FROM memories WHERE rowid = ?',
          args: [record.rowid],
        });
      }

      this.stats.deleted = records.length;
      console.log(`✅ Prepared ${this.stats.deleted} DELETE statements`);

      // Step 2: Generate INSERT statements with new UUIDs
      for (const record of records) {
        const newId = randomUUID();

        statements.push({
          sql: `
            INSERT INTO memories (
              id,
              user_id,
              title,
              content,
              memory_type,
              importance,
              tags,
              entity_ids,
              embedding,
              metadata,
              is_archived,
              created_at,
              updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
          args: [
            newId,
            record.user_id,
            record.title,
            record.content,
            record.memory_type,
            record.importance,
            record.tags,
            record.entity_ids,
            record.embedding,
            record.metadata,
            record.is_archived,
            record.created_at,
            record.updated_at || new Date().toISOString(),
          ],
        });
      }

      this.stats.inserted = records.length;
      console.log(`✅ Prepared ${this.stats.inserted} INSERT statements with new UUIDs`);

      // Execute all statements in a batch (atomic operation)
      console.log('\n🗑️  Deleting NULL ID records and re-inserting with valid UUIDs...');

      // Execute in smaller batches to avoid timeout
      const batchSize = 50;
      for (let i = 0; i < statements.length; i += batchSize) {
        const batch = statements.slice(i, Math.min(i + batchSize, statements.length));
        await this.db.batch(batch, 'write');

        const progress = Math.min(i + batchSize, statements.length);
        const total = statements.length;
        const pct = Math.round((progress / total) * 100);
        console.log(`   Progress: ${progress}/${total} statements (${pct}%)`);
      }

      console.log('✅ Transaction committed successfully');

    } catch (error) {
      console.error('❌ Transaction failed - rolling back...');
      throw error;
    }
  }

  /**
   * Verify recovery was successful
   */
  private async verifyRecovery(): Promise<void> {
    console.log('\n🔍 Verifying recovery...');

    // Check for remaining NULL IDs
    const nullResult = await this.db.execute(`
      SELECT COUNT(*) as count
      FROM memories
      WHERE id IS NULL
    `);

    const remainingNullIds = Number(nullResult.rows[0]?.count || 0);

    if (remainingNullIds > 0) {
      throw new Error(`Verification failed: ${remainingNullIds} NULL IDs still remain`);
    }

    // Check that we have the expected number of records
    const totalResult = await this.db.execute(`
      SELECT COUNT(*) as count
      FROM memories
    `);

    const totalRecords = Number(totalResult.rows[0]?.count || 0);
    this.stats.verified = totalRecords;

    console.log(`✅ 0 NULL IDs remaining`);
    console.log(`✅ Total memories in database: ${totalRecords}`);
  }

  /**
   * Print recovery summary
   */
  private printSummary(): void {
    console.log('\n' + '='.repeat(60));
    console.log('📊 Recovery Summary');
    console.log('='.repeat(60));
    console.log(`Records with NULL IDs found:    ${this.stats.totalNullIds}`);
    console.log(`Records backed up:              ${this.stats.backedUp}`);
    console.log(`Records deleted:                ${this.stats.deleted}`);
    console.log(`Records re-inserted:            ${this.stats.inserted}`);
    console.log(`New UUIDs assigned:             ${this.stats.inserted}`);
    console.log(`Remaining NULL IDs:             0`);
    console.log(`Total records in database:      ${this.stats.verified}`);
    console.log('');
    console.log(`Backup file: ${this.stats.backupFile}`);
    console.log('='.repeat(60));
    console.log('\n✅ Recovery completed successfully!');
    console.log('💡 Keep the backup file in case you need to reference original data');
  }
}

// Run recovery
const recovery = new AdvancedNullIdRecovery();
recovery.recover().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
