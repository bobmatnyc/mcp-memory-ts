#!/usr/bin/env tsx

/**
 * EMERGENCY DIAGNOSIS: Find why retrieval is broken
 */

import { DatabaseConnection } from '../src/database/connection.js';

async function emergencyDiagnosis() {
  console.log('🚨 EMERGENCY DIAGNOSIS: RETRIEVAL FAILURE');
  console.log('='.repeat(60));

  const db = new DatabaseConnection({
    url: process.env.TURSO_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  try {
    await db.connect();
    
    // 1. Check recent memories
    console.log('📊 RECENT MEMORIES:');
    const recent = await db.execute('SELECT id, title, content, user_id, active FROM memories ORDER BY created_at DESC LIMIT 5');
    recent.rows.forEach((row: any, i) => {
      console.log(`  ${i+1}. ID: ${row.id}, Title: ${row.title}, User: ${row.user_id}, Active: ${row.active}`);
      console.log(`     Content: ${row.content?.substring(0, 50)}...`);
    });

    // 2. Check user_id distribution
    console.log('\n👥 USER DISTRIBUTION:');
    const users = await db.execute('SELECT user_id, COUNT(*) as count FROM memories GROUP BY user_id');
    users.rows.forEach((row: any) => {
      console.log(`  User: ${row.user_id} - ${row.count} memories`);
    });

    // 3. Check active status
    console.log('\n🔄 ACTIVE STATUS:');
    const activeStatus = await db.execute('SELECT active, COUNT(*) as count FROM memories GROUP BY active');
    activeStatus.rows.forEach((row: any) => {
      console.log(`  Active: ${row.active} - ${row.count} memories`);
    });

    // 4. Check FTS table
    console.log('\n🔍 FTS TABLE:');
    const ftsCount = await db.execute('SELECT COUNT(*) as count FROM memories_fts');
    console.log(`  FTS entries: ${ftsCount.rows[0].count}`);

    // 5. Check what user our service is using
    console.log('\n🔧 SERVICE CONFIGURATION:');
    console.log(`  DEFAULT_USER_EMAIL: ${process.env.DEFAULT_USER_EMAIL}`);

    // 6. Test search query that our service would use
    console.log('\n🧪 TESTING SERVICE SEARCH LOGIC:');
    const testUserId = 'test@example.com'; // What our service uses
    
    // Test 1: Direct memory search for our test user
    const userMemories = await db.execute(
      'SELECT COUNT(*) as count FROM memories WHERE user_id = ? AND active = 1',
      [testUserId]
    );
    console.log(`  Memories for ${testUserId}: ${userMemories.rows[0].count}`);

    // Test 2: FTS search
    try {
      const ftsSearch = await db.execute(
        "SELECT * FROM memories_fts WHERE memories_fts MATCH 'test' LIMIT 3"
      );
      console.log(`  FTS search results: ${ftsSearch.rows.length}`);
    } catch (error) {
      console.log(`  FTS search failed: ${error}`);
    }

    // Test 3: Check if our service user has any memories
    const serviceUserMemories = await db.execute(
      'SELECT id, title, content FROM memories WHERE user_id = ? ORDER BY created_at DESC LIMIT 3',
      [testUserId]
    );
    console.log(`  Service user memories: ${serviceUserMemories.rows.length}`);
    serviceUserMemories.rows.forEach((row: any, i) => {
      console.log(`    ${i+1}. ID: ${row.id}, Title: ${row.title}`);
    });

    // 7. Check memory types
    console.log('\n📋 MEMORY TYPES:');
    const types = await db.execute('SELECT memory_type, COUNT(*) as count FROM memories GROUP BY memory_type');
    types.rows.forEach((row: any) => {
      console.log(`  Type: ${row.memory_type} - ${row.count} memories`);
    });

    // 8. Check if there's a user mismatch issue
    console.log('\n🔍 POTENTIAL USER MISMATCH:');
    const allUsers = await db.execute('SELECT DISTINCT user_id FROM memories ORDER BY user_id');
    console.log('  All user_ids in database:');
    allUsers.rows.forEach((row: any) => {
      console.log(`    - ${row.user_id}`);
    });

    await db.disconnect();

  } catch (error) {
    console.log('💥 DIAGNOSIS FAILED:', error);
  }
}

emergencyDiagnosis();
