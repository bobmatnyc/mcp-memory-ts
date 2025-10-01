#!/usr/bin/env tsx

/**
 * Simplified Turso database test that works with the actual schema
 */

import { DatabaseConnection } from '../src/database/connection.js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.test' });

class TursoDbTest {
  private db!: DatabaseConnection;
  private testUser1Id!: string;
  private testUser2Id!: string;

  async run() {
    console.log('🚀 TURSO DATABASE FUNCTIONALITY TEST');
    console.log('='.repeat(50));

    try {
      await this.setupConnection();
      await this.testConnection();
      await this.testUserCRUD();
      await this.testMemoryCRUD();
      await this.testEntityCRUD();
      await this.testInteractionCRUD();
      await this.testVectorEmbeddings();
      await this.testMultiUserIsolation();
      await this.cleanupTestData();

      console.log('\n✅ ALL TURSO DATABASE TESTS PASSED!');
    } catch (error) {
      console.error('\n❌ DATABASE TEST FAILED:', error);
      process.exit(1);
    } finally {
      await this.cleanup();
    }
  }

  private async setupConnection() {
    console.log('\n🔌 Setting up Turso connection...');

    this.db = new DatabaseConnection({
      url: process.env.TURSO_URL!,
      authToken: process.env.TURSO_AUTH_TOKEN!,
    });

    await this.db.connect();
    console.log('✓ Connected to Turso database');
  }

  private async testConnection() {
    console.log('\n🔍 Testing basic connection...');

    const result = await this.db.execute('SELECT 1 as test');
    if (result.rows[0]?.test !== 1) {
      throw new Error('Failed basic SQL query');
    }

    console.log('✓ Basic SQL query successful');
  }

  private async testUserCRUD() {
    console.log('\n👤 Testing User CRUD operations...');

    // Clean up any existing test data
    await this.cleanupTestData();

    const timestamp = Date.now();

    // CREATE - Insert test user
    const userId = `test-user-${timestamp}`;
    const userEmail = `test-${timestamp}@example.com`;

    await this.db.execute(`
      INSERT INTO users (id, email, name, organization, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [userId, userEmail, 'Test User', 'Test Org', new Date().toISOString(), new Date().toISOString()]);

    this.testUser1Id = userId;
    console.log('✓ User created');

    // READ - Get user by email
    const userResult = await this.db.execute('SELECT * FROM users WHERE email = ?', [userEmail]);
    if (userResult.rows.length === 0) {
      throw new Error('Failed to retrieve user');
    }
    console.log('✓ User retrieved');

    // UPDATE - Update user name
    await this.db.execute('UPDATE users SET name = ?, updated_at = ? WHERE id = ?',
      ['Updated Test User', new Date().toISOString(), userId]);

    const updatedUser = await this.db.execute('SELECT * FROM users WHERE id = ?', [userId]);
    if ((updatedUser.rows[0] as any).name !== 'Updated Test User') {
      throw new Error('Failed to update user');
    }
    console.log('✓ User updated');
  }

  private async testMemoryCRUD() {
    console.log('\n🧠 Testing Memory CRUD operations...');

    const memoryId = crypto.randomUUID();

    // CREATE - Insert memory
    await this.db.execute(`
      INSERT INTO memories (id, user_id, title, content, memory_type, importance, tags, created_at, updated_at, active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      memoryId,
      this.testUser1Id,
      'Test Memory',
      'This is a test memory for database verification',
      'memory',
      0.8,
      JSON.stringify(['test', 'database']),
      new Date().toISOString(),
      new Date().toISOString(),
      true
    ]);
    console.log('✓ Memory created');

    // READ - Get memory
    const memoryResult = await this.db.execute('SELECT * FROM memories WHERE id = ?', [memoryId]);
    if (memoryResult.rows.length === 0) {
      throw new Error('Failed to retrieve memory');
    }
    console.log('✓ Memory retrieved');

    // UPDATE - Update memory
    await this.db.execute('UPDATE memories SET title = ?, updated_at = ? WHERE id = ?',
      ['Updated Test Memory', new Date().toISOString(), memoryId]);
    console.log('✓ Memory updated');

    // READ by user ID (test user isolation)
    const userMemories = await this.db.execute('SELECT * FROM memories WHERE user_id = ?', [this.testUser1Id]);
    if (userMemories.rows.length === 0) {
      throw new Error('Failed to retrieve memories by user ID');
    }
    console.log('✓ Memories retrieved by user ID');
  }

  private async testEntityCRUD() {
    console.log('\n🏢 Testing Entity CRUD operations...');

    const entityId = crypto.randomUUID();

    // CREATE - Insert entity (using actual schema columns)
    await this.db.execute(`
      INSERT INTO entities (id, user_id, entity_type, name, description, company, title, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      entityId,
      this.testUser1Id,
      'organization',
      'Test Company',
      'A test organization',
      'Test Company Ltd',
      'Test Title',
      new Date().toISOString(),
      new Date().toISOString()
    ]);
    console.log('✓ Entity created');

    // READ - Get entity
    const entityResult = await this.db.execute('SELECT * FROM entities WHERE id = ?', [entityId]);
    if (entityResult.rows.length === 0) {
      throw new Error('Failed to retrieve entity');
    }
    console.log('✓ Entity retrieved');

    // READ by user ID
    const userEntities = await this.db.execute('SELECT * FROM entities WHERE user_id = ?', [this.testUser1Id]);
    if (userEntities.rows.length === 0) {
      throw new Error('Failed to retrieve entities by user ID');
    }
    console.log('✓ Entities retrieved by user ID');
  }

  private async testInteractionCRUD() {
    console.log('\n💬 Testing Interaction CRUD operations...');

    const interactionId = crypto.randomUUID();

    // CREATE - Insert interaction (using actual schema columns)
    await this.db.execute(`
      INSERT INTO interactions (id, user_id, user_input, assistant_response, created_at)
      VALUES (?, ?, ?, ?, ?)
    `, [
      interactionId,
      this.testUser1Id,
      'Test user input',
      'Test assistant response',
      new Date().toISOString()
    ]);
    console.log('✓ Interaction created');

    // READ - Get interaction
    const interactionResult = await this.db.execute('SELECT * FROM interactions WHERE id = ?', [interactionId]);
    if (interactionResult.rows.length === 0) {
      throw new Error('Failed to retrieve interaction');
    }
    console.log('✓ Interaction retrieved');
  }

  private async testVectorEmbeddings() {
    console.log('\n🔢 Testing Vector Embeddings...');

    const memoryId = crypto.randomUUID();
    const testEmbedding = Array.from({ length: 1536 }, (_, i) => Math.random());

    // CREATE memory with embedding
    await this.db.execute(`
      INSERT INTO memories (id, user_id, title, content, embedding, created_at, updated_at, active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      memoryId,
      this.testUser1Id,
      'Memory with Embedding',
      'This memory has vector embeddings',
      JSON.stringify(testEmbedding),
      new Date().toISOString(),
      new Date().toISOString(),
      true
    ]);
    console.log('✓ Memory with embedding created');

    // READ and verify embedding
    const embeddingResult = await this.db.execute('SELECT embedding FROM memories WHERE id = ?', [memoryId]);
    const storedEmbedding = JSON.parse((embeddingResult.rows[0] as any).embedding);

    if (!Array.isArray(storedEmbedding) || storedEmbedding.length !== 1536) {
      throw new Error('Embedding not stored properly');
    }
    console.log('✓ Vector embedding stored and retrieved successfully');
  }

  private async testMultiUserIsolation() {
    console.log('\n🔒 Testing Multi-User Isolation...');

    // Create second user
    const timestamp2 = Date.now() + 1;
    const user2Id = `test-user-${timestamp2}`;
    const user2Email = `test-${timestamp2}@example.com`;

    await this.db.execute(`
      INSERT INTO users (id, email, name, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `, [user2Id, user2Email, 'Test User 2', new Date().toISOString(), new Date().toISOString()]);

    this.testUser2Id = user2Id;
    console.log('✓ Second user created');

    // Create memory for second user
    const user2MemoryId = crypto.randomUUID();
    await this.db.execute(`
      INSERT INTO memories (id, user_id, title, content, created_at, updated_at, active)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      user2MemoryId,
      user2Id,
      'User 2 Memory',
      'This memory belongs to user 2',
      new Date().toISOString(),
      new Date().toISOString(),
      true
    ]);
    console.log('✓ Memory created for user 2');

    // Verify user isolation
    const user1Memories = await this.db.execute('SELECT * FROM memories WHERE user_id = ?', [this.testUser1Id]);
    const user2Memories = await this.db.execute('SELECT * FROM memories WHERE user_id = ?', [user2Id]);

    const user1HasUser2Memory = user1Memories.rows.some((row: any) => row.title === 'User 2 Memory');
    const user2HasOwnMemory = user2Memories.rows.some((row: any) => row.title === 'User 2 Memory');

    if (user1HasUser2Memory) {
      throw new Error('User isolation failed: User 1 can see User 2 memories');
    }

    if (!user2HasOwnMemory) {
      throw new Error('User 2 cannot see their own memory');
    }

    console.log('✓ Multi-user isolation verified');
    console.log(`  User 1 memories: ${user1Memories.rows.length}`);
    console.log(`  User 2 memories: ${user2Memories.rows.length}`);
  }

  private async cleanupTestData() {
    console.log('\n🧹 Cleaning up test data...');

    try {
      if (this.testUser1Id && this.testUser2Id) {
        await this.db.execute('DELETE FROM interactions WHERE user_id IN (?, ?)', [this.testUser1Id, this.testUser2Id]);
        await this.db.execute('DELETE FROM memories WHERE user_id IN (?, ?)', [this.testUser1Id, this.testUser2Id]);
        await this.db.execute('DELETE FROM entities WHERE user_id IN (?, ?)', [this.testUser1Id, this.testUser2Id]);
        await this.db.execute('DELETE FROM users WHERE id IN (?, ?)', [this.testUser1Id, this.testUser2Id]);
      } else if (this.testUser1Id) {
        await this.db.execute('DELETE FROM interactions WHERE user_id = ?', [this.testUser1Id]);
        await this.db.execute('DELETE FROM memories WHERE user_id = ?', [this.testUser1Id]);
        await this.db.execute('DELETE FROM entities WHERE user_id = ?', [this.testUser1Id]);
        await this.db.execute('DELETE FROM users WHERE id = ?', [this.testUser1Id]);
      }

      // Also clean up any existing test data by pattern
      await this.db.execute('DELETE FROM interactions WHERE user_id LIKE ?', ['test-user-%']);
      await this.db.execute('DELETE FROM memories WHERE user_id LIKE ?', ['test-user-%']);
      await this.db.execute('DELETE FROM entities WHERE user_id LIKE ?', ['test-user-%']);
      await this.db.execute('DELETE FROM users WHERE id LIKE ?', ['test-user-%']);

      console.log('✓ Test data cleaned up');
    } catch (error) {
      console.log('ℹ️  Cleanup note:', error instanceof Error ? error.message : error);
    }
  }

  private async cleanup() {
    console.log('\n🔌 Disconnecting...');
    try {
      await this.db.disconnect();
      console.log('✓ Database disconnected');
    } catch (error) {
      console.log('⚠️  Error disconnecting:', error);
    }
  }
}

// Run the test
const test = new TursoDbTest();
test.run().catch(console.error);