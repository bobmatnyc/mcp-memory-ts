#!/usr/bin/env tsx
/**
 * Backfill embeddings for all memories missing them
 * This script processes memories in batches to avoid rate limits and provides progress feedback
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { existsSync } from 'fs';
import { initDatabaseFromEnv } from '../src/database/index.js';
import { MemoryCore } from '../src/core/index.js';
import { EmbeddingService } from '../src/utils/embeddings.js';
import { parseArgs } from 'util';

// Load environment variables from .env.local if it exists, otherwise fall back to .env
const envLocalPath = resolve(process.cwd(), '.env.local');
const envPath = resolve(process.cwd(), '.env');

if (existsSync(envLocalPath)) {
  console.log('Loading environment from .env.local');
  config({ path: envLocalPath });
} else if (existsSync(envPath)) {
  console.log('Loading environment from .env');
  config({ path: envPath });
}

// Parse command line arguments
const { values: args } = parseArgs({
  options: {
    'batch-size': {
      type: 'string',
      short: 'b',
      default: '10',
    },
    'user-email': {
      type: 'string',
      short: 'u',
      default: 'test@example.com',
    },
    'delay-ms': {
      type: 'string',
      short: 'd',
      default: '1000',
    },
    help: {
      type: 'boolean',
      short: 'h',
      default: false,
    },
  },
  allowPositionals: false,
});

if (args.help) {
  console.log(`
Usage: npm run backfill-embeddings [options]

Options:
  -b, --batch-size <number>    Number of memories to process per batch (default: 10)
  -u, --user-email <email>     User email for authentication (default: test@example.com)
  -d, --delay-ms <number>      Delay between batches in milliseconds (default: 1000)
  -h, --help                   Show this help message

Examples:
  npm run backfill-embeddings
  npm run backfill-embeddings -- --batch-size 20 --delay-ms 2000
  npm run backfill-embeddings -- --user-email user@example.com --batch-size 5
  `);
  process.exit(0);
}

const BATCH_SIZE = parseInt(args['batch-size'] as string, 10);
const USER_EMAIL = args['user-email'] as string;
const DELAY_MS = parseInt(args['delay-ms'] as string, 10);

interface BackfillStats {
  total: number;
  processed: number;
  succeeded: number;
  failed: number;
  batches: number;
  failedMemoryIds: string[];
}

async function getMissingEmbeddingsCount(db: any): Promise<number> {
  const result = await db.execute(`
    SELECT COUNT(*) as count
    FROM memories
    WHERE embedding IS NULL
       OR embedding = '[]'
       OR json_array_length(embedding) = 0
  `);

  return (result.rows[0] as any).count;
}

async function getMissingEmbeddingsIds(db: any, limit: number, offset: number): Promise<string[]> {
  // WORKAROUND: Turso driver returns null for "SELECT id" alone
  // Must select additional column to get valid ID values
  const result = await db.execute(
    `
    SELECT id, title
    FROM memories
    WHERE embedding IS NULL
       OR embedding = '[]'
       OR json_array_length(embedding) = 0
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `,
    [limit, offset]
  );

  return (result.rows as any[]).map(row => row.id).filter(id => id !== null && id !== undefined);
}

async function processBatch(
  db: any,
  embeddings: EmbeddingService,
  memoryIds: string[],
  maxRetries: number = 3
): Promise<{ succeeded: string[]; failed: string[] }> {
  const succeeded: string[] = [];
  const failed: string[] = [];

  // Fetch memories from database
  const placeholders = memoryIds.map(() => '?').join(',');
  const result = await db.execute(
    `SELECT id, title, content, memory_type, tags
     FROM memories
     WHERE id IN (${placeholders})`,
    memoryIds
  );

  const memories = result.rows as any[];

  // Process each memory with retry logic
  for (const memory of memories) {
    let attempts = 0;
    let success = false;

    while (attempts < maxRetries && !success) {
      try {
        // Create embedding text
        const parts = [memory.title, memory.content, memory.memory_type];

        // Add tags if present
        if (memory.tags) {
          try {
            const tags = typeof memory.tags === 'string' ? JSON.parse(memory.tags) : memory.tags;
            if (Array.isArray(tags) && tags.length > 0) {
              parts.push(`Tags: ${tags.join(', ')}`);
            }
          } catch {
            // Ignore parsing errors
          }
        }

        const embeddingText = parts.filter(Boolean).join(' ');

        // Generate embedding
        const embedding = await embeddings.generateEmbedding(embeddingText);

        if (embedding && embedding.length > 0) {
          // Update memory with new embedding
          await db.execute('UPDATE memories SET embedding = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [
            JSON.stringify(embedding),
            memory.id,
          ]);

          succeeded.push(memory.id);
          success = true;
        } else {
          console.error(`  ⚠️  No embedding generated for memory ${memory.id}`);
          failed.push(memory.id);
          break; // Don't retry if no API key
        }
      } catch (error: any) {
        attempts++;

        if (attempts >= maxRetries) {
          console.error(`  ❌ Failed to update memory ${memory.id} after ${attempts} attempts: ${error.message}`);
          failed.push(memory.id);
        } else {
          // Exponential backoff
          const delay = 1000 * Math.pow(2, attempts - 1);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
  }

  return { succeeded, failed };
}

async function backfillEmbeddings() {
  console.log('\n🚀 Starting embedding backfill...\n');

  // Verify OpenAI API key is loaded
  if (!process.env.OPENAI_API_KEY) {
    console.error('❌ OPENAI_API_KEY not found in environment');
    console.error('Make sure .env.local or .env contains OPENAI_API_KEY');
    process.exit(1);
  }

  console.log('✅ OpenAI API key found');
  console.log(`📧 User email: ${USER_EMAIL}`);
  console.log(`📦 Batch size: ${BATCH_SIZE}`);
  console.log(`⏱️  Delay between batches: ${DELAY_MS}ms\n`);

  const stats: BackfillStats = {
    total: 0,
    processed: 0,
    succeeded: 0,
    failed: 0,
    batches: 0,
    failedMemoryIds: [],
  };

  try {
    // Initialize database and services
    const db = initDatabaseFromEnv();
    await db.connect();

    const embeddings = new EmbeddingService(process.env.OPENAI_API_KEY);

    console.log('✅ Database connected\n');

    // Get count of missing embeddings
    stats.total = await getMissingEmbeddingsCount(db);

    if (stats.total === 0) {
      console.log('✅ No memories need embedding backfill!');
      await db.disconnect();
      return;
    }

    console.log(`📊 Found ${stats.total} memories without embeddings\n`);

    const totalBatches = Math.ceil(stats.total / BATCH_SIZE);

    // Process in batches
    for (let offset = 0; offset < stats.total; offset += BATCH_SIZE) {
      stats.batches++;

      const batchNum = stats.batches;
      const memoryIds = await getMissingEmbeddingsIds(db, BATCH_SIZE, offset);

      console.log(`🔄 Processing batch ${batchNum}/${totalBatches} (${memoryIds.length} memories)...`);

      try {
        const batchResult = await processBatch(db, embeddings, memoryIds);

        stats.succeeded += batchResult.succeeded.length;
        stats.failed += batchResult.failed.length;
        stats.processed += memoryIds.length;
        stats.failedMemoryIds.push(...batchResult.failed);

        console.log(`   ✓ Generated ${batchResult.succeeded.length} embeddings`);

        if (batchResult.failed.length > 0) {
          console.log(`   ⚠️  Failed: ${batchResult.failed.length}`);
        }
      } catch (error: any) {
        console.error(`   ❌ Batch processing error: ${error.message}`);
        stats.failed += memoryIds.length;
        stats.processed += memoryIds.length;
        stats.failedMemoryIds.push(...memoryIds);
      }

      // Rate limiting between batches
      if (offset + BATCH_SIZE < stats.total) {
        await new Promise(resolve => setTimeout(resolve, DELAY_MS));
      }
    }

    // Disconnect from database
    await db.disconnect();

    // Final statistics
    const coverage = stats.total > 0 ? Math.round((stats.succeeded / stats.total) * 100) : 100;

    console.log('\n' + '='.repeat(60));
    console.log('✅ Backfill complete!\n');
    console.log(`📊 Final Statistics:`);
    console.log(`   Total memories: ${stats.total}`);
    console.log(`   Successfully generated: ${stats.succeeded}`);
    console.log(`   Failed: ${stats.failed}`);
    console.log(`   Coverage: ${coverage}%`);
    console.log(`   Batches processed: ${stats.batches}`);

    if (stats.failedMemoryIds.length > 0) {
      console.log(`\n⚠️  Failed memory IDs (${stats.failedMemoryIds.length}):`);
      stats.failedMemoryIds.slice(0, 10).forEach(id => console.log(`   - ${id}`));
      if (stats.failedMemoryIds.length > 10) {
        console.log(`   ... and ${stats.failedMemoryIds.length - 10} more`);
      }
    }

    console.log('='.repeat(60) + '\n');

    // Exit with error code if any failures
    if (stats.failed > 0) {
      console.error(`⚠️  Warning: ${stats.failed} memories failed to process`);
      process.exit(1);
    }
  } catch (error: any) {
    console.error('\n❌ Fatal error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the backfill
backfillEmbeddings();
