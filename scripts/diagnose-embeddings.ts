#!/usr/bin/env tsx
/**
 * Diagnostic script to analyze embeddings in the database
 * Shows exactly what's stored in the embedding column
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { existsSync } from 'fs';
import { initDatabaseFromEnv } from '../src/database/index.js';

// Load environment variables
const envLocalPath = resolve(process.cwd(), '.env.local');
const envPath = resolve(process.cwd(), '.env');

if (existsSync(envLocalPath)) {
  console.log('Loading environment from .env.local');
  config({ path: envLocalPath });
} else if (existsSync(envPath)) {
  console.log('Loading environment from .env');
  config({ path: envPath });
}

interface EmbeddingDiagnostic {
  id: string;
  title: string;
  embeddingValue: any;
  embeddingType: string;
  embeddingLength: number | null;
  isNull: boolean;
  isEmptyString: boolean;
  isEmptyArray: boolean;
  parsedLength: number | null;
}

async function diagnoseEmbeddings() {
  console.log('\n🔍 Embedding Diagnostics\n');
  console.log('='.repeat(80) + '\n');

  try {
    const db = initDatabaseFromEnv();
    await db.connect();

    console.log('✅ Database connected\n');

    // Get sample of memories
    console.log('📊 Sample Analysis (first 20 memories):\n');

    const sampleResult = await db.execute(`
      SELECT
        id,
        title,
        embedding,
        typeof(embedding) as embedding_type,
        LENGTH(embedding) as embedding_length
      FROM memories
      ORDER BY created_at DESC
      LIMIT 20
    `);

    const diagnostics: EmbeddingDiagnostic[] = [];

    for (const row of sampleResult.rows as any[]) {
      let parsedLength: number | null = null;
      let isEmptyArray = false;

      // Try to parse as JSON
      if (row.embedding) {
        try {
          const parsed = JSON.parse(row.embedding as string);
          if (Array.isArray(parsed)) {
            parsedLength = parsed.length;
            isEmptyArray = parsedLength === 0;
          }
        } catch {
          // Not valid JSON
        }
      }

      const diagnostic: EmbeddingDiagnostic = {
        id: row.id,
        title: row.title || '(no title)',
        embeddingValue: row.embedding,
        embeddingType: row.embedding_type || 'unknown',
        embeddingLength: row.embedding_length || null,
        isNull: row.embedding === null || row.embedding === undefined,
        isEmptyString: row.embedding === '',
        isEmptyArray,
        parsedLength,
      };

      diagnostics.push(diagnostic);

      console.log(`Memory ID: ${diagnostic.id}`);
      console.log(`  Title: ${diagnostic.title.substring(0, 50)}...`);
      console.log(`  Embedding Type: ${diagnostic.embeddingType}`);
      console.log(`  Is NULL: ${diagnostic.isNull}`);
      console.log(`  Is Empty String: ${diagnostic.isEmptyString}`);
      console.log(`  Raw Length: ${diagnostic.embeddingLength}`);
      console.log(`  Is Empty Array: ${diagnostic.isEmptyArray}`);
      console.log(`  Parsed Array Length: ${diagnostic.parsedLength}`);

      // Show first 100 chars of embedding value
      if (diagnostic.embeddingValue) {
        const preview = String(diagnostic.embeddingValue).substring(0, 100);
        console.log(`  Preview: ${preview}...`);
      } else {
        console.log(`  Preview: NULL`);
      }
      console.log('');
    }

    // Statistical summary
    console.log('\n' + '='.repeat(80));
    console.log('📈 Statistical Summary:\n');

    const nullCount = diagnostics.filter(d => d.isNull).length;
    const emptyStringCount = diagnostics.filter(d => d.isEmptyString).length;
    const emptyArrayCount = diagnostics.filter(d => d.isEmptyArray).length;
    const validEmbeddings = diagnostics.filter(
      d => !d.isNull && !d.isEmptyString && !d.isEmptyArray && d.parsedLength && d.parsedLength > 0
    ).length;

    console.log(`Total Sample Size: ${diagnostics.length}`);
    console.log(`NULL embeddings: ${nullCount}`);
    console.log(`Empty String embeddings: ${emptyStringCount}`);
    console.log(`Empty Array embeddings: ${emptyArrayCount}`);
    console.log(`Valid embeddings: ${validEmbeddings}`);

    // Full database counts
    console.log('\n' + '='.repeat(80));
    console.log('📊 Full Database Analysis:\n');

    // Count NULL
    const nullResult = await db.execute(`
      SELECT COUNT(*) as count FROM memories WHERE embedding IS NULL
    `);
    console.log(`NULL embeddings: ${(nullResult.rows[0] as any).count}`);

    // Count empty strings
    const emptyStringResult = await db.execute(`
      SELECT COUNT(*) as count FROM memories WHERE embedding = ''
    `);
    console.log(`Empty string embeddings: ${(emptyStringResult.rows[0] as any).count}`);

    // Count '[]' exactly
    const emptyArrayExactResult = await db.execute(`
      SELECT COUNT(*) as count FROM memories WHERE embedding = '[]'
    `);
    console.log(`Exact '[]' embeddings: ${(emptyArrayExactResult.rows[0] as any).count}`);

    // Try json_array_length = 0 (this might fail on non-JSON)
    try {
      const zeroLengthResult = await db.execute(`
        SELECT COUNT(*) as count FROM memories
        WHERE embedding IS NOT NULL
          AND embedding != ''
          AND json_array_length(embedding) = 0
      `);
      console.log(`Zero-length JSON arrays: ${(zeroLengthResult.rows[0] as any).count}`);
    } catch (error: any) {
      console.log(`Zero-length JSON arrays: ERROR - ${error.message}`);
    }

    // Total memories
    const totalResult = await db.execute(`
      SELECT COUNT(*) as count FROM memories
    `);
    console.log(`Total memories: ${(totalResult.rows[0] as any).count}`);

    // Try to identify memories that SHOULD need embeddings
    console.log('\n' + '='.repeat(80));
    console.log('🔍 Identifying Missing Embeddings:\n');

    // More robust query to find missing embeddings
    const missingResult = await db.execute(`
      SELECT COUNT(*) as count FROM memories
      WHERE embedding IS NULL
         OR embedding = ''
         OR embedding = '[]'
         OR (embedding IS NOT NULL AND LENGTH(TRIM(embedding)) <= 2)
    `);
    console.log(`Memories needing embeddings (robust check): ${(missingResult.rows[0] as any).count}`);

    // Check for valid embeddings (non-empty arrays)
    try {
      const validResult = await db.execute(`
        SELECT COUNT(*) as count FROM memories
        WHERE embedding IS NOT NULL
          AND embedding != ''
          AND embedding != '[]'
          AND json_array_length(embedding) > 0
      `);
      console.log(`Memories with valid embeddings: ${(validResult.rows[0] as any).count}`);
    } catch (error: any) {
      console.log(`Memories with valid embeddings: ERROR - ${error.message}`);
    }

    await db.disconnect();

    console.log('\n' + '='.repeat(80));
    console.log('✅ Diagnostic complete\n');

  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

diagnoseEmbeddings();
