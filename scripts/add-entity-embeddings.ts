#!/usr/bin/env node
/**
 * Migration: Add embedding column to entities table for semantic search
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { existsSync } from 'fs';
import { initDatabaseFromEnv } from '../dist/database/index.js';

// Load environment variables
const envLocalPath = resolve(process.cwd(), '.env.local');
const envPath = resolve(process.cwd(), '.env');

if (existsSync(envLocalPath)) {
  config({ path: envLocalPath });
} else if (existsSync(envPath)) {
  config({ path: envPath });
}

async function addEntityEmbeddings() {
  console.log('🔄 Starting entity embeddings migration...\n');

  const db = initDatabaseFromEnv();
  await db.connect();

  try {
    // Check if embedding column already exists
    const checkResult = await db.execute(`
      SELECT COUNT(*) as count
      FROM pragma_table_info('entities')
      WHERE name = 'embedding'
    `);

    const columnExists = (checkResult.rows[0] as any).count > 0;

    if (columnExists) {
      console.log('✅ Embedding column already exists in entities table');
    } else {
      console.log('➕ Adding embedding column to entities table...');
      
      await db.execute(`
        ALTER TABLE entities ADD COLUMN embedding TEXT
      `);

      console.log('✅ Embedding column added successfully');
    }

    // Check statistics
    const statsResult = await db.execute(`
      SELECT 
        COUNT(*) as total,
        COUNT(embedding) as with_embedding
      FROM entities
    `);

    const stats = statsResult.rows[0] as any;
    console.log('\n📊 Entity Statistics:');
    console.log(`   Total entities: ${stats.total}`);
    console.log(`   With embeddings: ${stats.with_embedding}`);
    console.log(`   Without embeddings: ${stats.total - stats.with_embedding}`);

    console.log('\n✅ Migration completed successfully!');
    console.log('\nNext steps:');
    console.log('1. Update entity creation to generate embeddings');
    console.log('2. Run backfill script to generate embeddings for existing entities');
    console.log('3. Rebuild the desktop MCP server: npm run build');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await db.disconnect();
  }
}

// Run migration
addEntityEmbeddings().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
