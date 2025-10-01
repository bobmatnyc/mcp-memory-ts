#!/usr/bin/env tsx
/**
 * Fix memories with empty embeddings by regenerating them
 */

import { initDatabaseFromEnv } from '../src/database/index.js';
import { EmbeddingService } from '../src/utils/embeddings.js';
import { SchemaCompatibility } from '../src/database/compatibility.js';

async function fixEmptyEmbeddings() {
  console.log('Starting empty embeddings fix...\n');

  const db = initDatabaseFromEnv();
  await db.connect();

  // Initialize embedding service
  const embeddings = new EmbeddingService(process.env.OPENAI_API_KEY);

  // Find memories with empty embeddings
  const result = await db.execute(`
    SELECT id, title, content, memory_type, tags
    FROM memories
    WHERE embedding = '[]' OR LENGTH(embedding) < 10
  `);

  const memoriesToFix = result.rows;
  console.log(`Found ${memoriesToFix.length} memories with empty embeddings\n`);

  if (memoriesToFix.length === 0) {
    console.log('No memories need fixing!');
    await db.disconnect();
    return;
  }

  let successful = 0;
  let failed = 0;

  for (const row of memoriesToFix) {
    try {
      console.log(`Processing: ${row.id} - "${row.title}"`);

      // Parse tags
      let tags: string[] = [];
      try {
        if (row.tags) {
          tags = typeof row.tags === 'string' ? JSON.parse(row.tags) : row.tags;
        }
      } catch (e) {
        console.warn(`  Warning: Could not parse tags for ${row.id}`);
      }

      // Create embedding text
      const embeddingText = EmbeddingService.createMemoryEmbeddingText({
        title: row.title,
        content: row.content,
        tags: Array.isArray(tags) ? tags : [],
        memoryType: row.memory_type,
      });

      // Generate embedding
      const embedding = await embeddings.generateEmbedding(embeddingText);

      if (!embedding || embedding.length === 0) {
        console.error(`  ✗ Failed: Received empty embedding`);
        failed++;
        continue;
      }

      // Update database
      await db.execute(
        'UPDATE memories SET embedding = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [JSON.stringify(embedding), row.id]
      );

      console.log(`  ✓ Success: Generated ${embedding.length}-dimension embedding`);
      successful++;

      // Add delay to respect rate limits
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.error(`  ✗ Failed: ${error instanceof Error ? error.message : String(error)}`);
      failed++;
    }
  }

  console.log('\n=== Summary ===');
  console.log(`Total processed: ${memoriesToFix.length}`);
  console.log(`Successful: ${successful}`);
  console.log(`Failed: ${failed}`);

  await db.disconnect();
}

fixEmptyEmbeddings().catch(console.error);
