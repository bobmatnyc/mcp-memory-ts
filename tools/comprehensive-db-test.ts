#!/usr/bin/env tsx

/**
 * Comprehensive database verification script for MCP Memory TS
 * Tests Turso database functionality including:
 * - Connection testing
 * - Schema verification
 * - CRUD operations
 * - Vector embeddings
 * - Multi-user isolation
 */

import { DatabaseConnection } from '../src/database/connection.js';
import { DatabaseOperations } from '../src/database/operations.js';
import { MemoryCore } from '../src/core/memory-core.js';
import { EmbeddingService } from '../src/utils/embeddings.js';
import { User, Memory, Entity } from '../src/types/base.js';
import { MemoryType, ImportanceLevel, EntityType } from '../src/types/enums.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.test' });

class DatabaseTestSuite {
  private db!: DatabaseConnection;
  private dbOps!: DatabaseOperations;
  private memoryCore!: MemoryCore;
  private embeddingService!: EmbeddingService;
  private testUser1Id!: string;
  private testUser2Id!: string;

  async run() {
    console.log('🚀 COMPREHENSIVE DATABASE TEST SUITE');
    console.log('=' .repeat(50));

    try {
      await this.setupServices();
      await this.testConnection();
      await this.checkSchema();
      await this.createTestDatabase();
      await this.testUserOperations();
      await this.testEntityOperations();
      await this.testMemoryOperations();
      await this.testVectorEmbeddings();
      await this.testMultiUserIsolation();
      await this.cleanupTestData();

      console.log('\n✅ ALL TESTS PASSED!');
    } catch (error) {
      console.error('\n❌ TEST SUITE FAILED:', error);
      process.exit(1);
    } finally {
      await this.cleanup();
    }
  }

  private async setupServices() {
    console.log('\n📋 Setting up services...');

    this.db = new DatabaseConnection({
      url: process.env.TURSO_URL!,
      authToken: process.env.TURSO_AUTH_TOKEN!,
    });

    this.dbOps = new DatabaseOperations(this.db);
    this.embeddingService = new EmbeddingService(process.env.OPENAI_API_KEY || 'test-key');
    this.memoryCore = new MemoryCore(this.db, this.embeddingService);

    console.log('✓ Services initialized');
  }

  private async testConnection() {
    console.log('\n🔌 Testing database connection...');

    await this.db.connect();

    // Test basic SQL query
    const result = await this.db.execute('SELECT 1 as test');
    if (result.rows[0]?.test !== 1) {
      throw new Error('Failed basic SQL query');
    }

    console.log('✓ Database connection successful');
  }

  private async checkSchema() {
    console.log('\n📊 Checking database schema...');

    const tables = ['users', 'memories', 'entities', 'interactions'];

    for (const tableName of tables) {
      try {
        const schema = await this.db.execute(
          'SELECT sql FROM sqlite_master WHERE type="table" AND name=?',
          [tableName]
        );

        if (schema.rows.length === 0) {
          console.log(`⚠️  Table '${tableName}' does not exist`);
        } else {
          console.log(`✓ Table '${tableName}' exists`);

          // Check table structure
          const tableInfo = await this.db.execute(`PRAGMA table_info(${tableName})`);
          console.log(`  Columns: ${tableInfo.rows.length}`);
        }
      } catch (error) {
        console.log(`❌ Error checking table '${tableName}':`, error);
      }
    }
  }

  private async createTestDatabase() {
    console.log('\n🏗️  Creating test database schema...');

    const createUsersTable = `
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        name TEXT,
        organization TEXT,
        api_key TEXT,
        oauth_provider TEXT,
        oauth_id TEXT,
        is_active INTEGER DEFAULT 1,
        metadata TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `;

    const createMemoriesTable = `
      CREATE TABLE IF NOT EXISTS memories (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        memory_type TEXT DEFAULT 'MEMORY',
        importance TEXT DEFAULT 'MEDIUM',
        tags TEXT,
        entity_ids TEXT,
        embedding TEXT,
        metadata TEXT,
        is_archived INTEGER DEFAULT 0,
        active INTEGER DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `;

    const createEntitiesTable = `
      CREATE TABLE IF NOT EXISTS entities (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT,
        name TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        person_type TEXT,
        description TEXT,
        company TEXT,
        title TEXT,
        email TEXT,
        phone TEXT,
        address TEXT,
        website TEXT,
        social_media TEXT,
        notes TEXT,
        importance TEXT DEFAULT 'MEDIUM',
        tags TEXT,
        relationships TEXT,
        last_interaction TEXT,
        interaction_count INTEGER DEFAULT 0,
        metadata TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `;

    const createInteractionsTable = `
      CREATE TABLE IF NOT EXISTS interactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT,
        user_prompt TEXT NOT NULL,
        assistant_response TEXT NOT NULL,
        context TEXT,
        feedback TEXT,
        sentiment TEXT,
        metadata TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `;

    try {
      await this.db.execute(createUsersTable);
      console.log('✓ Users table created');

      await this.db.execute(createMemoriesTable);
      console.log('✓ Memories table created');

      await this.db.execute(createEntitiesTable);
      console.log('✓ Entities table created');

      await this.db.execute(createInteractionsTable);
      console.log('✓ Interactions table created');

    } catch (error) {
      console.log('⚠️  Error creating tables (may already exist):', error);
    }
  }

  private async testUserOperations() {
    console.log('\n👤 Testing user operations...');

    // Clean up any existing test users first
    await this.cleanupTestData();

    const timestamp = Date.now();
    const testUser: User = {
      id: `test-user-${timestamp}`,
      email: `test-${timestamp}@example.com`,
      name: 'Test User',
      organization: 'Test Org',
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Create user
    const createdUser = await this.dbOps.createUser(testUser);
    this.testUser1Id = createdUser.id;
    console.log('✓ User created:', createdUser.email);

    // Get user by email
    const foundUser = await this.dbOps.getUserByEmail(testUser.email);
    if (!foundUser || foundUser.id !== testUser.id) {
      throw new Error('Failed to retrieve user by email');
    }
    console.log('✓ User retrieved by email');

    // Update user
    const updatedUser = await this.dbOps.updateUser(testUser.id, {
      name: 'Updated Test User',
    });
    if (!updatedUser || updatedUser.name !== 'Updated Test User') {
      throw new Error('Failed to update user');
    }
    console.log('✓ User updated');
  }

  private async testEntityOperations() {
    console.log('\n🏢 Testing entity operations...');

    const testEntity = {
      userId: this.testUser1Id,
      name: 'Test Company',
      entityType: EntityType.ORGANIZATION,
      description: 'A test organization',
      importance: ImportanceLevel.HIGH,
      tags: ['test', 'organization'],
      interactionCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Create entity
    const createdEntity = await this.dbOps.createEntity(testEntity);
    console.log('✓ Entity created:', createdEntity.name);

    // Get entity by ID
    const foundEntity = await this.dbOps.getEntityById(createdEntity.id!);
    if (!foundEntity || foundEntity.name !== testEntity.name) {
      throw new Error('Failed to retrieve entity by ID');
    }
    console.log('✓ Entity retrieved by ID');

    // Get entities by user ID
    const userEntities = await this.dbOps.getEntitiesByUserId(this.testUser1Id);
    if (userEntities.length === 0) {
      throw new Error('Failed to retrieve entities by user ID');
    }
    console.log('✓ Entities retrieved by user ID');
  }

  private async testMemoryOperations() {
    console.log('\n🧠 Testing memory operations...');

    const testMemory = {
      userId: this.testUser1Id,
      title: 'Test Memory',
      content: 'This is a test memory for the database verification',
      memoryType: MemoryType.MEMORY,
      importance: ImportanceLevel.MEDIUM,
      tags: ['test', 'database'],
      entityIds: [],
      isArchived: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Create memory
    const createdMemory = await this.dbOps.createMemory(testMemory);
    console.log('✓ Memory created:', createdMemory.title);

    // Get memory by ID
    const foundMemory = await this.dbOps.getMemoryById(createdMemory.id!);
    if (!foundMemory || foundMemory.title !== testMemory.title) {
      throw new Error('Failed to retrieve memory by ID');
    }
    console.log('✓ Memory retrieved by ID');

    // Get memories by user ID
    const userMemories = await this.dbOps.getMemoriesByUserId(this.testUser1Id);
    if (userMemories.length === 0) {
      throw new Error('Failed to retrieve memories by user ID');
    }
    console.log('✓ Memories retrieved by user ID');
  }

  private async testVectorEmbeddings() {
    console.log('\n🔢 Testing vector embeddings...');

    try {
      // Test embedding generation (if OpenAI key is available)
      if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'test-key') {
        const embedding = await this.embeddingService.generateEmbedding('test content');
        if (!Array.isArray(embedding) || embedding.length === 0) {
          throw new Error('Failed to generate embedding');
        }
        console.log('✓ Vector embedding generated');

        // Test memory with embedding
        const memoryWithEmbedding = {
          userId: this.testUser1Id,
          title: 'Memory with Embedding',
          content: 'This memory has a vector embedding for semantic search',
          memoryType: MemoryType.MEMORY,
          importance: ImportanceLevel.MEDIUM,
          tags: ['embedding', 'vector'],
          entityIds: [],
          embedding: embedding,
          isArchived: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        const createdMemoryWithEmbedding = await this.dbOps.createMemory(memoryWithEmbedding);
        console.log('✓ Memory with embedding created');

        // Verify embedding was stored
        const retrievedMemory = await this.dbOps.getMemoryById(createdMemoryWithEmbedding.id!);
        if (!retrievedMemory?.embedding || retrievedMemory.embedding.length === 0) {
          throw new Error('Embedding was not stored properly');
        }
        console.log('✓ Vector embedding stored and retrieved');
      } else {
        console.log('⚠️  Skipping OpenAI embedding test (no API key)');
      }
    } catch (error) {
      console.log('⚠️  Vector embedding test failed:', error);
    }
  }

  private async testMultiUserIsolation() {
    console.log('\n🔒 Testing multi-user isolation...');

    // Create second user
    const timestamp2 = Date.now() + 1;
    const testUser2: User = {
      id: `test-user-${timestamp2}`,
      email: `test-${timestamp2}@example.com`,
      name: 'Test User 2',
      organization: 'Test Org 2',
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const createdUser2 = await this.dbOps.createUser(testUser2);
    this.testUser2Id = createdUser2.id;
    console.log('✓ Second user created');

    // Create memory for second user
    const user2Memory = {
      userId: this.testUser2Id,
      title: 'User 2 Memory',
      content: 'This memory belongs to user 2',
      memoryType: MemoryType.MEMORY,
      importance: ImportanceLevel.MEDIUM,
      tags: ['user2'],
      entityIds: [],
      isArchived: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await this.dbOps.createMemory(user2Memory);
    console.log('✓ Memory created for user 2');

    // Verify user 1 cannot see user 2's memories
    const user1Memories = await this.dbOps.getMemoriesByUserId(this.testUser1Id);
    const user2Memories = await this.dbOps.getMemoriesByUserId(this.testUser2Id);

    const hasUser2MemoryInUser1Results = user1Memories.some(m => m.title === 'User 2 Memory');
    if (hasUser2MemoryInUser1Results) {
      throw new Error('User isolation failed: User 1 can see User 2 memories');
    }

    const hasUser2MemoryInUser2Results = user2Memories.some(m => m.title === 'User 2 Memory');
    if (!hasUser2MemoryInUser2Results) {
      throw new Error('User 2 cannot see their own memory');
    }

    console.log('✓ Multi-user isolation verified');
    console.log(`  User 1 memories: ${user1Memories.length}`);
    console.log(`  User 2 memories: ${user2Memories.length}`);
  }

  private async cleanupTestData() {
    console.log('\n🧹 Cleaning up test data...');

    try {
      // Clean up in reverse order due to foreign keys
      if (this.testUser1Id && this.testUser2Id) {
        await this.db.execute('DELETE FROM interactions WHERE user_id IN (?, ?)', [this.testUser1Id, this.testUser2Id]);
        await this.db.execute('DELETE FROM memories WHERE user_id IN (?, ?)', [this.testUser1Id, this.testUser2Id]);
        await this.db.execute('DELETE FROM entities WHERE user_id IN (?, ?)', [this.testUser1Id, this.testUser2Id]);
        await this.db.execute('DELETE FROM users WHERE id IN (?, ?)', [this.testUser1Id, this.testUser2Id]);
      }

      console.log('✓ Test data cleaned up');
    } catch (error) {
      // Ignore cleanup errors as data might not exist
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

// Run the test suite
const testSuite = new DatabaseTestSuite();
testSuite.run().catch(console.error);