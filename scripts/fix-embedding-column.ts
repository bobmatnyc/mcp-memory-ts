#!/usr/bin/env tsx

/**
 * EMERGENCY FIX: Add missing embedding column
 * Resolves the critical schema mismatch preventing memory storage
 */

import { DatabaseConnection } from '../src/database/connection.js';

async function fixEmbeddingColumn() {
  console.log('🚨 EMERGENCY FIX: Adding missing embedding column');
  console.log('=' .repeat(60));

  const db = new DatabaseConnection({
    url: process.env.TURSO_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  try {
    await db.connect();
    console.log('✅ Database connected');

    // Check if embedding column already exists
    console.log('\n🔍 Checking current schema...');
    const columnInfo = await db.execute('PRAGMA table_info(memories)');
    const columns = columnInfo.rows.map((row: any) => row.name);
    
    if (columns.includes('embedding')) {
      console.log('✅ Embedding column already exists');
      return;
    }

    console.log('❌ Embedding column missing - adding now...');

    // Add the embedding column
    await db.execute('ALTER TABLE memories ADD COLUMN embedding TEXT');
    console.log('✅ Added embedding column to memories table');

    // Verify the column was added
    const verifyInfo = await db.execute('PRAGMA table_info(memories)');
    const newColumns = verifyInfo.rows.map((row: any) => row.name);
    
    if (newColumns.includes('embedding')) {
      console.log('✅ Embedding column verified');
    } else {
      throw new Error('Failed to add embedding column');
    }

    // Test that we can now insert a memory with embedding
    console.log('\n🧪 Testing memory insertion with embedding...');
    
    const testMemory = {
      id: 'embedding-test-' + Date.now(),
      title: 'Embedding Test Memory',
      content: 'Testing that embedding column works',
      user_id: 'test-user',
      importance: 0.5,
      tags: '["test", "embedding"]',
      metadata: '{"test": true}',
      entity_ids: '[]',
      is_archived: 0,
      active: 1,
      embedding: JSON.stringify([0.1, 0.2, 0.3]), // Test embedding
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await db.execute(`
      INSERT INTO memories (
        id, title, content, user_id, importance, tags, metadata, 
        entity_ids, is_archived, active, embedding, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      testMemory.id, testMemory.title, testMemory.content, testMemory.user_id,
      testMemory.importance, testMemory.tags, testMemory.metadata, 
      testMemory.entity_ids, testMemory.is_archived, testMemory.active,
      testMemory.embedding, testMemory.created_at, testMemory.updated_at
    ]);

    console.log('✅ Memory insertion with embedding successful');

    // Verify we can retrieve it
    const retrieveResult = await db.execute(
      'SELECT id, title, embedding FROM memories WHERE id = ?',
      [testMemory.id]
    );

    if (retrieveResult.rows.length === 1) {
      console.log('✅ Memory retrieval with embedding successful');
      const retrieved = retrieveResult.rows[0] as any;
      console.log(`   ID: ${retrieved.id}`);
      console.log(`   Title: ${retrieved.title}`);
      console.log(`   Embedding: ${retrieved.embedding ? 'Present' : 'Missing'}`);
    } else {
      throw new Error('Failed to retrieve test memory');
    }

    // Clean up test data
    await db.execute('DELETE FROM memories WHERE id = ?', [testMemory.id]);
    console.log('✅ Test cleanup completed');

    console.log('\n🎉 EMBEDDING COLUMN FIX COMPLETED');
    console.log('✅ Memory storage should now work correctly');

  } catch (error) {
    console.log('💥 FIX FAILED:', error);
    throw error;
  } finally {
    await db.disconnect();
  }
}

// Run the fix
fixEmbeddingColumn().catch((error) => {
  console.error('💥 EMBEDDING COLUMN FIX FAILED:', error);
  process.exit(1);
});
