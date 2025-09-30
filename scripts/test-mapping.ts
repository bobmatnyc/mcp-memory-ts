#!/usr/bin/env node
/**
 * Test the mapping functions to see where corruption occurs
 */

import { createClient } from '@libsql/client';
import { SchemaCompatibility } from '../src/database/compatibility.js';

const TURSO_URL = process.env.TURSO_URL!;
const TURSO_AUTH_TOKEN = process.env.TURSO_AUTH_TOKEN!;

const db = createClient({
  url: TURSO_URL,
  authToken: TURSO_AUTH_TOKEN,
});

async function testMapping() {
  console.log('=== TESTING MAPPING FUNCTIONS ===\n');

  // Get a raw memory from database
  const result = await db.execute(`
    SELECT * FROM memories
    WHERE user_id = '34183aef-dce1-4e2a-8b97-2dac8d0e1f75'
    LIMIT 1
  `);

  const rawRow = result.rows[0];
  console.log('RAW DATABASE ROW:');
  console.log(JSON.stringify(rawRow, null, 2));
  console.log('\n');

  // Apply mapping function
  console.log('AFTER SchemaCompatibility.mapMemoryFromDatabase():');
  const mapped = SchemaCompatibility.mapMemoryFromDatabase(rawRow as any);
  console.log(JSON.stringify(mapped, null, 2));
  console.log('\n');

  // Check specific fields
  console.log('FIELD COMPARISON:');
  console.log('memory_type (raw):', rawRow.memory_type, '(type:', typeof rawRow.memory_type, ')');
  console.log('memoryType (mapped):', mapped.memoryType, '(type:', typeof mapped.memoryType, ')');
  console.log('');
  console.log('importance (raw):', rawRow.importance, '(type:', typeof rawRow.importance, ')');
  console.log('importance (mapped):', mapped.importance, '(type:', typeof mapped.importance, ')');
  console.log('');
  console.log('metadata (raw):', rawRow.metadata, '(type:', typeof rawRow.metadata, ')');
  console.log('metadata (mapped):', mapped.metadata, '(type:', typeof mapped.metadata, ')');
  console.log('');
  console.log('created_at (raw):', rawRow.created_at, '(type:', typeof rawRow.created_at, ')');
  console.log('createdAt (mapped):', mapped.createdAt, '(type:', typeof mapped.createdAt, ')');

  await db.close();
}

testMapping().catch(console.error);