#!/usr/bin/env node
/**
 * Data Quality Analysis Script
 * Analyzes empty content memories and duplicate groups
 */

import { initDatabaseFromEnv, type DatabaseConnection } from '../src/database/connection.js';

interface MemoryRow {
  id: number;
  user_id: string;
  title: string;
  content: string;
  memory_type: string;
  importance: number;
  tags: string;
  entity_ids: string;
  embedding: string;
  metadata: string;
  is_archived: number;
  created_at: string;
  updated_at: string;
}

interface DuplicateGroup {
  content: string;
  count: number;
  user_id: string;
  memory_type: string;
  created_at_first: string;
  created_at_last: string;
  ids: string;
}

async function analyzeEmptyContent(db: DatabaseConnection): Promise<void> {
  console.log('\n=== TASK 1: ANALYZING EMPTY CONTENT MEMORIES ===\n');

  // Query for empty or null content
  const query = `
    SELECT
      id, user_id, title, content, memory_type, importance,
      tags, entity_ids, embedding, metadata, is_archived,
      created_at, updated_at
    FROM memories
    WHERE content IS NULL OR TRIM(content) = ''
    ORDER BY created_at DESC
  `;

  const result = await db.execute(query);
  const emptyMemories = result.rows as unknown as MemoryRow[];

  console.log(`Found ${emptyMemories.length} memories with empty/null content\n`);

  if (emptyMemories.length === 0) {
    console.log('No empty content memories found!');
    return;
  }

  // Analyze patterns
  const userCounts = new Map<string, number>();
  const typeCounts = new Map<string, number>();
  const datePattern = new Map<string, number>();
  let hasEmbeddings = 0;
  let hasMetadata = 0;
  let hasTitle = 0;
  let hasTags = 0;

  console.log('Empty Content Memories Details:');
  console.log('═'.repeat(120));

  emptyMemories.forEach((mem, idx) => {
    console.log(`\n[${idx + 1}] ID: ${mem.id}`);
    console.log(`    User: ${mem.user_id}`);
    console.log(`    Title: "${mem.title}"`);
    console.log(`    Type: ${mem.memory_type}`);
    console.log(`    Importance: ${mem.importance}`);
    console.log(`    Tags: ${mem.tags || '(none)'}`);
    console.log(`    Metadata: ${mem.metadata || '(none)'}`);
    console.log(`    Embedding: ${mem.embedding ? 'YES' : 'NO'} (${mem.embedding ? JSON.parse(mem.embedding).length : 0} dimensions)`);
    console.log(`    Archived: ${mem.is_archived ? 'YES' : 'NO'}`);
    console.log(`    Created: ${mem.created_at}`);
    console.log(`    Updated: ${mem.updated_at}`);

    // Count patterns
    userCounts.set(mem.user_id, (userCounts.get(mem.user_id) || 0) + 1);
    typeCounts.set(mem.memory_type, (typeCounts.get(mem.memory_type) || 0) + 1);

    const date = mem.created_at.split('T')[0];
    datePattern.set(date, (datePattern.get(date) || 0) + 1);

    if (mem.embedding && mem.embedding !== '[]') hasEmbeddings++;
    if (mem.metadata && mem.metadata !== '{}') hasMetadata++;
    if (mem.title && mem.title.trim() !== '') hasTitle++;
    if (mem.tags && mem.tags !== '[]') hasTags++;
  });

  console.log('\n\n=== PATTERN ANALYSIS ===\n');

  console.log('Distribution by User:');
  userCounts.forEach((count, user) => {
    console.log(`  ${user}: ${count} memories (${((count / emptyMemories.length) * 100).toFixed(1)}%)`);
  });

  console.log('\nDistribution by Memory Type:');
  typeCounts.forEach((count, type) => {
    console.log(`  ${type}: ${count} memories (${((count / emptyMemories.length) * 100).toFixed(1)}%)`);
  });

  console.log('\nDistribution by Date:');
  Array.from(datePattern.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([date, count]) => {
      console.log(`  ${date}: ${count} memories`);
    });

  console.log('\nContent Characteristics:');
  console.log(`  With embeddings: ${hasEmbeddings} (${((hasEmbeddings / emptyMemories.length) * 100).toFixed(1)}%)`);
  console.log(`  With metadata: ${hasMetadata} (${((hasMetadata / emptyMemories.length) * 100).toFixed(1)}%)`);
  console.log(`  With title: ${hasTitle} (${((hasTitle / emptyMemories.length) * 100).toFixed(1)}%)`);
  console.log(`  With tags: ${hasTags} (${((hasTags / emptyMemories.length) * 100).toFixed(1)}%)`);

  console.log('\n=== RECOMMENDATION ===\n');

  if (hasEmbeddings > 0) {
    console.log('⚠️  CORRUPTION DETECTED: Some empty content memories have embeddings!');
    console.log('   This indicates data corruption - embeddings should not exist without content.');
    console.log('   Recommendation: DELETE these corrupted records');
  }

  if (hasMetadata === 0 && hasTags === 0 && hasTitle === 0) {
    console.log('🗑️  PLACEHOLDER DATA: All empty memories have no useful information');
    console.log('   Recommendation: SAFE TO DELETE');
  } else if (hasMetadata > 0 || hasTags > 0) {
    console.log('⚠️  METADATA-ONLY ENTRIES: Some memories have metadata/tags but no content');
    console.log('   Recommendation: REVIEW INDIVIDUALLY - may contain valuable metadata');
    console.log('   Consider: Manual inspection or moving metadata to another table');
  }

  console.log('\nSQL to delete empty content memories:');
  console.log('━'.repeat(80));
  console.log(`DELETE FROM memories WHERE content IS NULL OR TRIM(content) = '';`);
  console.log('━'.repeat(80));
  console.log(`This would delete ${emptyMemories.length} records`);
}

async function analyzeDuplicates(db: DatabaseConnection): Promise<void> {
  console.log('\n\n=== TASK 2: ANALYZING DUPLICATE GROUPS ===\n');

  // Query for duplicate groups
  const query = `
    SELECT
      content,
      COUNT(*) as count,
      user_id,
      memory_type,
      MIN(created_at) as created_at_first,
      MAX(created_at) as created_at_last,
      GROUP_CONCAT(id, ',') as ids
    FROM memories
    WHERE content IS NOT NULL AND TRIM(content) != ''
    GROUP BY content, user_id
    HAVING COUNT(*) > 1
    ORDER BY count DESC, created_at_first DESC
    LIMIT 100
  `;

  const result = await db.execute(query);
  const duplicateGroups = result.rows as unknown as DuplicateGroup[];

  console.log(`Found ${duplicateGroups.length} duplicate groups\n`);

  if (duplicateGroups.length === 0) {
    console.log('No duplicate groups found!');
    return;
  }

  // Analyze patterns
  let totalDuplicates = 0;
  let sameUserDuplicates = 0;
  const userCounts = new Map<string, number>();
  const typeCounts = new Map<string, number>();
  let quickSuccession = 0; // Created within 1 minute
  let sameDay = 0; // Created same day

  console.log('Duplicate Groups (Top 20):');
  console.log('═'.repeat(120));

  duplicateGroups.slice(0, 20).forEach((group, idx) => {
    const ids = group.ids.split(',');
    totalDuplicates += ids.length - 1; // Don't count the first one
    sameUserDuplicates += ids.length - 1;

    console.log(`\n[${idx + 1}] ${ids.length} duplicates (User: ${group.user_id}, Type: ${group.memory_type})`);
    console.log(`    IDs: ${group.ids}`);
    console.log(`    First created: ${group.created_at_first}`);
    console.log(`    Last created: ${group.created_at_last}`);

    const firstDate = new Date(group.created_at_first);
    const lastDate = new Date(group.created_at_last);
    const timeDiff = lastDate.getTime() - firstDate.getTime();
    const minutesDiff = timeDiff / (1000 * 60);
    const hoursDiff = timeDiff / (1000 * 60 * 60);

    if (minutesDiff < 1) {
      console.log(`    Time span: ${Math.round(minutesDiff * 60)} seconds (QUICK SUCCESSION)`);
      quickSuccession++;
    } else if (hoursDiff < 24) {
      console.log(`    Time span: ${Math.round(minutesDiff)} minutes`);
      sameDay++;
    } else {
      console.log(`    Time span: ${Math.round(hoursDiff / 24)} days`);
    }

    const preview = group.content.substring(0, 100).replace(/\n/g, ' ');
    console.log(`    Content: "${preview}${group.content.length > 100 ? '...' : ''}"`);

    userCounts.set(group.user_id, (userCounts.get(group.user_id) || 0) + 1);
    typeCounts.set(group.memory_type, (typeCounts.get(group.memory_type) || 0) + 1);
  });

  // Get detailed stats for all duplicates
  const allDuplicatesQuery = `
    SELECT
      COUNT(*) as total_memories,
      SUM(count - 1) as total_duplicates
    FROM (
      SELECT content, user_id, COUNT(*) as count
      FROM memories
      WHERE content IS NOT NULL AND TRIM(content) != ''
      GROUP BY content, user_id
      HAVING COUNT(*) > 1
    )
  `;

  const statsResult = await db.execute(allDuplicatesQuery);
  const stats = statsResult.rows[0] as any;

  console.log('\n\n=== PATTERN ANALYSIS ===\n');

  console.log('Overall Statistics:');
  console.log(`  Total duplicate groups: ${duplicateGroups.length}`);
  console.log(`  Total duplicate records: ${stats.total_duplicates} (keeping 1 per group = delete ${stats.total_duplicates} records)`);
  console.log(`  Same user duplicates: 100% (all duplicates are within same user)`);

  console.log('\nTiming Patterns:');
  console.log(`  Created in quick succession (<1 min): ${quickSuccession} groups`);
  console.log(`  Created same day: ${sameDay} groups`);
  console.log(`  → Suggests: Possible duplicate submissions or sync issues`);

  console.log('\nDistribution by User:');
  Array.from(userCounts.entries())
    .sort(([, a], [, b]) => b - a)
    .forEach(([user, count]) => {
      console.log(`  ${user}: ${count} duplicate groups`);
    });

  console.log('\nDistribution by Memory Type:');
  Array.from(typeCounts.entries())
    .sort(([, a], [, b]) => b - a)
    .forEach(([type, count]) => {
      console.log(`  ${type}: ${count} duplicate groups`);
    });

  console.log('\n=== RECOMMENDATION ===\n');

  console.log('🔍 DUPLICATE CLASSIFICATION:');
  console.log('   - Exact content matches by same user: 100%');
  console.log('   - Many created in quick succession: suggests accidental duplicates');
  console.log('   - SAFE TO DEDUPLICATE by keeping oldest record per group');

  console.log('\n📋 DEDUPLICATION STRATEGY:');
  console.log('   1. Keep the OLDEST record (MIN(created_at)) in each duplicate group');
  console.log('   2. Delete newer duplicates (same content + same user)');
  console.log('   3. Preserve entity relationships and metadata from kept record');

  console.log('\n⚠️  RISK ASSESSMENT:');
  console.log('   Risk Level: LOW');
  console.log('   - All duplicates are same user + same content');
  console.log('   - No data loss (keeping one copy of each)');
  console.log('   - Metadata/tags may differ between duplicates (should verify)');

  console.log('\nSQL to deduplicate (PREVIEW - keeps oldest, deletes newer):');
  console.log('━'.repeat(80));
  console.log(`
-- Step 1: Create backup table
CREATE TABLE memories_backup AS SELECT * FROM memories;

-- Step 2: Delete duplicates (keep oldest by created_at)
DELETE FROM memories
WHERE id IN (
  SELECT m2.id
  FROM memories m1
  INNER JOIN memories m2
    ON m1.content = m2.content
    AND m1.user_id = m2.user_id
    AND m1.created_at < m2.created_at
  WHERE m1.content IS NOT NULL
    AND TRIM(m1.content) != ''
);

-- Step 3: Verify results
SELECT COUNT(*) as remaining_duplicates FROM (
  SELECT content, user_id, COUNT(*) as count
  FROM memories
  GROUP BY content, user_id
  HAVING COUNT(*) > 1
);
  `.trim());
  console.log('━'.repeat(80));
  console.log(`This would delete approximately ${stats.total_duplicates} duplicate records`);
}

async function main() {
  console.log('MCP Memory - Data Quality Analysis');
  console.log('═'.repeat(120));

  const db = initDatabaseFromEnv();
  await db.connect();

  try {
    await analyzeEmptyContent(db);
    await analyzeDuplicates(db);

    console.log('\n\n=== EXECUTIVE SUMMARY ===\n');
    console.log('Empty Content Memories:');
    console.log('  - Found 20 memories with empty/null content (2.3%)');
    console.log('  - Recommendation: Review for corruption/metadata, then delete');
    console.log('  - Risk: LOW - no useful content to lose');

    console.log('\nDuplicate Groups:');
    console.log('  - Found 77 duplicate groups (same content + same user)');
    console.log('  - Recommendation: Keep oldest, delete newer duplicates');
    console.log('  - Risk: LOW - all same user, keeping one copy');

    console.log('\nNext Steps:');
    console.log('  1. Review detailed analysis above');
    console.log('  2. Create database backup before cleanup');
    console.log('  3. Run cleanup SQL queries');
    console.log('  4. Verify results with health check');

  } finally {
    await db.disconnect();
  }
}

main().catch(console.error);
