#!/usr/bin/env tsx
/**
 * Regenerate embeddings for memories that don't have them
 * Usage: OPENAI_API_KEY=sk-... tsx scripts/regenerate-embeddings.ts
 */

import { initDatabaseFromEnv } from '../src/database/index.js';
import { EmbeddingService } from '../src/utils/embeddings.js';

async function regenerateEmbeddings() {
  if (!process.env.OPENAI_API_KEY) {
    console.error('❌ OPENAI_API_KEY environment variable is required');
    process.exit(1);
  }

  console.log('🔄 Regenerating embeddings for memories without them...\n');

  const db = initDatabaseFromEnv();
  await db.connect();

  const embeddings = new EmbeddingService(process.env.OPENAI_API_KEY);

  try {
    // Get memories without proper embeddings
    const result = await db.execute(`
      SELECT id, title, content, memory_type, tags, user_id,
             embedding,
             CASE
               WHEN embedding IS NULL THEN 'null'
               WHEN embedding = '[]' THEN 'empty'
               WHEN json_array_length(embedding) = 0 THEN 'empty'
               ELSE 'valid'
             END as embedding_status
      FROM memories
      WHERE embedding IS NULL
         OR embedding = '[]'
         OR json_array_length(embedding) = 0
      ORDER BY created_at DESC
      LIMIT 100
    `);

    const memories = result.rows as any[];
    console.log(`Found ${memories.length} memories without proper embeddings\n`);

    if (memories.length === 0) {
      console.log('✅ All memories already have embeddings!');
      await db.disconnect();
      return;
    }

    let updated = 0;
    let failed = 0;

    for (const memory of memories) {
      try {
        // Create embedding text
        const embeddingText = [
          memory.title,
          memory.content,
          memory.memory_type,
          memory.tags ? `Tags: ${memory.tags}` : '',
        ].filter(Boolean).join(' ');

        console.log(`Processing: ${memory.title} (${memory.id.substring(0, 8)}...)`);

        // Generate embedding
        const embedding = await embeddings.generateEmbedding(embeddingText);

        if (embedding && embedding.length > 0) {
          // Update memory with new embedding
          await db.execute(
            'UPDATE memories SET embedding = ? WHERE id = ?',
            [JSON.stringify(embedding), memory.id]
          );

          console.log(`  ✅ Updated with ${embedding.length}-dimensional embedding`);
          updated++;
        } else {
          console.log(`  ⚠️  No embedding generated`);
          failed++;
        }

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        console.error(`  ❌ Error: ${error}`);
        failed++;
      }
    }

    // Show statistics
    console.log('\n📊 Results:');
    console.log(`   • Updated: ${updated} memories`);
    console.log(`   • Failed: ${failed} memories`);

    // Get new statistics
    const stats = await db.execute(`
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN embedding IS NOT NULL AND json_array_length(embedding) > 0 THEN 1 END) as with_embeddings
      FROM memories
    `);

    const statsRow = stats.rows[0] as any;
    const percentage = ((statsRow.with_embeddings / statsRow.total) * 100).toFixed(1);

    console.log(`\n📈 Overall Statistics:`);
    console.log(`   • Total memories: ${statsRow.total}`);
    console.log(`   • With embeddings: ${statsRow.with_embeddings} (${percentage}%)`);

    await db.disconnect();
    console.log('\n✅ Done!');

  } catch (error) {
    console.error('❌ Fatal error:', error);
    await db.disconnect();
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  regenerateEmbeddings().catch(console.error);
}

export { regenerateEmbeddings };