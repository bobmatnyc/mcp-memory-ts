#!/usr/bin/env node
/**
 * Debug script to inspect raw database values
 */

import { createClient } from '@libsql/client';

const TURSO_URL = process.env.TURSO_URL!;
const TURSO_AUTH_TOKEN = process.env.TURSO_AUTH_TOKEN!;

const db = createClient({
  url: TURSO_URL,
  authToken: TURSO_AUTH_TOKEN,
});

async function debugDatabase() {
  console.log('=== DATABASE SCHEMA DEBUG ===\n');

  // Get schema info for memories table
  console.log('MEMORIES TABLE SCHEMA:');
  const schemaResult = await db.execute(`
    SELECT name, type FROM pragma_table_info('memories')
  `);
  console.log(schemaResult.rows);
  console.log('\n');

  // Get raw memory data
  console.log('RAW MEMORY DATA (first 5):');
  const rawMemories = await db.execute(`
    SELECT id, user_id, title, content, memory_type, importance,
           metadata, is_archived, active, created_at, updated_at
    FROM memories
    WHERE user_id = '34183aef-dce1-4e2a-8b97-2dac8d0e1f75'
    LIMIT 5
  `);

  for (const row of rawMemories.rows) {
    console.log('\n--- Memory Record ---');
    console.log('ID:', row.id);
    console.log('Title:', row.title);
    console.log('Content:', row.content);
    console.log('memory_type (raw):', row.memory_type, '(type:', typeof row.memory_type, ')');
    console.log('importance (raw):', row.importance, '(type:', typeof row.importance, ')');
    console.log('metadata (raw):', row.metadata, '(type:', typeof row.metadata, ')');
    console.log('is_archived:', row.is_archived);
    console.log('active:', row.active);
    console.log('created_at:', row.created_at);
    console.log('updated_at:', row.updated_at);
  }

  // Check if there are any triggers or defaults
  console.log('\n\nTRIGGERS ON MEMORIES TABLE:');
  const triggers = await db.execute(`
    SELECT name, sql FROM sqlite_master
    WHERE type = 'trigger' AND tbl_name = 'memories'
  `);
  console.log(triggers.rows);

  // Check table creation SQL
  console.log('\n\nMEMORIES TABLE CREATE SQL:');
  const createSql = await db.execute(`
    SELECT sql FROM sqlite_master
    WHERE type = 'table' AND name = 'memories'
  `);
  console.log(createSql.rows[0]?.sql);

  // Test multi-word search
  console.log('\n\n=== TESTING MULTI-WORD SEARCH ===\n');

  // Single word search
  console.log('Test 1: Single word "test"');
  const singleWord = await db.execute(`
    SELECT COUNT(*) as count FROM memories
    WHERE user_id = '34183aef-dce1-4e2a-8b97-2dac8d0e1f75'
    AND is_archived = 0
    AND (title LIKE ? OR content LIKE ?)
  `, ['%test%', '%test%']);
  console.log('Results:', singleWord.rows[0].count);

  // Multi-word search (current implementation)
  console.log('\nTest 2: Multi-word "memory system test" (exact phrase)');
  const multiWord = await db.execute(`
    SELECT COUNT(*) as count FROM memories
    WHERE user_id = '34183aef-dce1-4e2a-8b97-2dac8d0e1f75'
    AND is_archived = 0
    AND (title LIKE ? OR content LIKE ?)
  `, ['%memory system test%', '%memory system test%']);
  console.log('Results:', multiWord.rows[0].count);

  // Test with OR logic for each word
  console.log('\nTest 3: Multi-word with OR logic');
  const words = ['memory', 'system', 'test'];
  const conditions = words.map(() => '(title LIKE ? OR content LIKE ?)').join(' AND ');
  const params = words.flatMap(w => [`%${w}%`, `%${w}%`]);

  const orLogic = await db.execute(`
    SELECT COUNT(*) as count FROM memories
    WHERE user_id = '34183aef-dce1-4e2a-8b97-2dac8d0e1f75'
    AND is_archived = 0
    AND ${conditions}
  `, params);
  console.log('Results:', orLogic.rows[0].count);

  // Test with any word match
  console.log('\nTest 4: Any word match (OR between words)');
  const orConditions = words.map(() => '(title LIKE ? OR content LIKE ?)').join(' OR ');
  const orParams = words.flatMap(w => [`%${w}%`, `%${w}%`]);

  const anyWord = await db.execute(`
    SELECT COUNT(*) as count FROM memories
    WHERE user_id = '34183aef-dce1-4e2a-8b97-2dac8d0e1f75'
    AND is_archived = 0
    AND (${orConditions})
  `, orParams);
  console.log('Results:', anyWord.rows[0].count);

  await db.close();
}

debugDatabase().catch(console.error);