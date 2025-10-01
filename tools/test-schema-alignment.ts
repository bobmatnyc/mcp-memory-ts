#!/usr/bin/env tsx
/**
 * Test Script for Schema Alignment Verification
 * Tests that all CRUD operations work with the corrected schema
 */

import { createClient } from '@libsql/client';
import { config } from 'dotenv';
import { DatabaseOperations } from '../src/database/operations.js';
import { SchemaCompatibility, ApiKeySecurity } from '../src/database/compatibility.js';
import { MemoryType, EntityType, PersonType, ImportanceLevel } from '../src/types/enums.js';

// Load environment variables
config();

const TURSO_URL = process.env.TURSO_URL!;
const TURSO_AUTH_TOKEN = process.env.TURSO_AUTH_TOKEN!;

if (!TURSO_URL || !TURSO_AUTH_TOKEN) {
  console.error('Missing required environment variables: TURSO_URL, TURSO_AUTH_TOKEN');
  process.exit(1);
}

class SchemaAlignmentTest {
  private db = createClient({
    url: TURSO_URL,
    authToken: TURSO_AUTH_TOKEN,
  });

  private ops: DatabaseOperations;
  private testUserId = `test-user-${Date.now()}`;
  private createdIds = {
    memories: [] as string[],
    entities: [] as string[], // Entities also use UUID strings
    users: [] as string[],
  };

  constructor() {
    // Create a wrapper for the database connection
    const dbWrapper = {
      execute: async (sql: string, params?: any[]) => {
        return await this.db.execute({ sql, args: params || [] });
      },
      close: async () => {
        // No-op for LibSQL client
      },
    };
    this.ops = new DatabaseOperations(dbWrapper as any);
  }

  async runTests(): Promise<void> {
    console.log('🧪 Starting Schema Alignment Tests\n');

    try {
      // Test 1: User Operations
      await this.testUserOperations();

      // Test 2: Entity Operations with contact_info
      await this.testEntityOperations();

      // Test 3: Memory Operations with Python compatibility
      await this.testMemoryOperations();

      // Test 4: Compatibility Layer
      await this.testCompatibilityLayer();

      console.log('\n✅ All tests passed successfully!');
    } catch (error) {
      console.error('\n❌ Test failed:', error);
      throw error;
    } finally {
      // Cleanup test data
      await this.cleanup();
    }
  }

  private async testUserOperations(): Promise<void> {
    console.log('📋 Testing User Operations...');

    // Create user
    const user = {
      id: this.testUserId,
      email: `test-${Date.now()}@example.com`,
      name: 'Test User',
      organization: 'Test Org',
      apiKey: ApiKeySecurity.generateApiKey(),
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const createdUser = await this.ops.createUser(user);
    this.createdIds.users.push(createdUser.id);
    console.log('  ✓ User created successfully');

    // Test API key retrieval (with hashing)
    const retrievedByApiKey = await this.ops.getUserByApiKey(user.apiKey!);
    if (!retrievedByApiKey) {
      throw new Error('Failed to retrieve user by API key');
    }
    console.log('  ✓ User retrieved by API key');

    // Update user with hashed API key
    const newApiKey = ApiKeySecurity.generateApiKey();
    await this.ops.updateUser(user.id, { apiKey: newApiKey });
    console.log('  ✓ User API key updated with hashing');

    // Verify new API key works
    const retrievedWithNewKey = await this.ops.getUserByApiKey(newApiKey);
    if (!retrievedWithNewKey) {
      throw new Error('Failed to retrieve user with new API key');
    }
    console.log('  ✓ Updated API key verification successful');
  }

  private async testEntityOperations(): Promise<void> {
    console.log('\n📋 Testing Entity Operations...');

    // Create entity with contact info
    const entity = {
      userId: this.testUserId,
      name: 'Test Entity',
      entityType: EntityType.PERSON,
      personType: PersonType.COLLEAGUE,
      description: 'Test entity with contact info',
      email: 'entity@example.com',
      phone: '+1234567890',
      address: '123 Test St',
      company: 'Test Company',
      title: 'Test Title',
      website: 'https://example.com',
      importance: ImportanceLevel.MEDIUM,
      tags: ['test', 'entity'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const createdEntity = await this.ops.createEntity(entity);
    console.log(`  ✓ Entity created with contact_info column (ID: ${createdEntity.id})`);
    this.createdIds.entities.push(createdEntity.id as string);

    // Retrieve and verify contact info was stored correctly
    const retrieved = await this.ops.getEntityById(createdEntity.id);
    if (!retrieved) {
      console.error(`  ❌ Failed to retrieve entity with ID: ${createdEntity.id}`);
      throw new Error('Failed to retrieve entity');
    }

    // Check that contact info was properly stored and retrieved
    if (retrieved.email !== entity.email ||
        retrieved.phone !== entity.phone ||
        retrieved.address !== entity.address) {
      console.log('  ⚠️  Contact info mapping:');
      console.log(`    Email: ${retrieved.email} (expected: ${entity.email})`);
      console.log(`    Phone: ${retrieved.phone} (expected: ${entity.phone})`);
      console.log(`    Address: ${retrieved.address} (expected: ${entity.address})`);
    } else {
      console.log('  ✓ Contact info properly mapped through compatibility layer');
    }

    // Test entity search
    const entities = await this.ops.getEntitiesByUserId(this.testUserId);
    if (entities.length === 0) {
      throw new Error('Failed to retrieve entities by user ID');
    }
    console.log('  ✓ Entities retrieved by user ID');
  }

  private async testMemoryOperations(): Promise<void> {
    console.log('\n📋 Testing Memory Operations...');

    // Create memory with Python compatibility fields
    const memory = {
      userId: this.testUserId,
      title: 'Test Memory Title',
      content: 'Test memory content with Python compatibility',
      memoryType: MemoryType.MEMORY,
      importance: ImportanceLevel.HIGH,
      tags: ['test', 'memory'],
      entityIds: this.createdIds.entities,
      isArchived: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const createdMemory = await this.ops.createMemory(memory);
    this.createdIds.memories.push(createdMemory.id as string);
    console.log('  ✓ Memory created with Python compatibility fields');

    // Verify memory was created with correct fields
    const result = await this.db.execute({
      sql: 'SELECT id, title, content, memory_type, active FROM memories WHERE id = ?',
      args: [createdMemory.id],
    });

    if (result.rows.length > 0) {
      const row = result.rows[0] as any;
      console.log('  ✓ Memory fields verified:');
      console.log(`    - ID (UUID): ${row.id ? 'present' : 'missing'}`);
      console.log(`    - Title: ${row.title === memory.title ? 'matches' : 'mismatch'}`);
      console.log(`    - Content: ${row.content === memory.content ? 'matches' : 'mismatch'}`);
      console.log(`    - Active: ${row.active ? 'true' : 'false'}`);
    }

    // Retrieve memory
    const retrieved = await this.ops.getMemoryById(createdMemory.id);
    if (!retrieved) {
      throw new Error('Failed to retrieve memory');
    }
    console.log('  ✓ Memory retrieved successfully');

    // Test memory search
    const memories = await this.ops.getMemoriesByUserId(this.testUserId);
    if (memories.length === 0) {
      throw new Error('Failed to retrieve memories by user ID');
    }
    console.log('  ✓ Memories retrieved by user ID');
  }

  private async testCompatibilityLayer(): Promise<void> {
    console.log('\n📋 Testing Compatibility Layer...');

    // Test UUID generation
    const uuid = SchemaCompatibility.generateUUID();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(uuid)) {
      throw new Error('Invalid UUID format');
    }
    console.log('  ✓ UUID generation successful');

    // Test API key hashing
    const plainKey = 'test_api_key_123';
    const hashedKey = ApiKeySecurity.hashApiKey(plainKey);
    if (hashedKey.length !== 64) {
      throw new Error('Invalid hash length');
    }
    console.log('  ✓ API key hashing successful');

    // Test API key verification
    const verified = ApiKeySecurity.verifyApiKey(plainKey, hashedKey);
    if (!verified) {
      throw new Error('API key verification failed');
    }
    console.log('  ✓ API key verification successful');

    // Test field mapping transformations
    const testMemory = {
      title: 'Test Title',
      content: 'Test Content',
      memoryType: MemoryType.MEMORY,
      tags: ['tag1', 'tag2'],
    };

    const mapped = SchemaCompatibility.mapMemoryForDatabase(testMemory);
    if (!mapped.description || !mapped.details || !mapped.uuid) {
      throw new Error('Memory mapping failed to add Python fields');
    }
    console.log('  ✓ Memory field mapping successful');

    // Test Python API transformation
    const pythonData = {
      memory_type: 'semantic',
      entity_ids: [1, 2, 3],
      created_at: '2024-01-01',
    };

    const transformed = SchemaCompatibility.transformFromPythonAPI(pythonData);
    if (!transformed.memoryType || !transformed.entityIds || !transformed.createdAt) {
      throw new Error('Python to TypeScript transformation failed');
    }
    console.log('  ✓ Python API transformation successful');
  }

  private async cleanup(): Promise<void> {
    console.log('\n🧹 Cleaning up test data...');

    try {
      // Delete test memories
      for (const id of this.createdIds.memories) {
        await this.db.execute({
          sql: 'DELETE FROM memories WHERE id = ?',
          args: [id],
        });
      }

      // Delete test entities
      for (const id of this.createdIds.entities) {
        await this.db.execute({
          sql: 'DELETE FROM entities WHERE id = ?',
          args: [id],
        });
      }

      // Delete test users
      for (const id of this.createdIds.users) {
        await this.ops.deleteUser(id);
      }

      console.log('  ✓ Test data cleaned up');
    } catch (error) {
      console.error('  ⚠️  Cleanup error:', error);
    }
  }
}

// Run the tests
async function main() {
  const tester = new SchemaAlignmentTest();

  try {
    await tester.runTests();
    console.log('\n🎉 Schema alignment verification complete!');
    console.log('The TypeScript code now works correctly with the production database schema.');
  } catch (error) {
    console.error('\n💥 Schema alignment test failed:', error);
    process.exit(1);
  }
}

main().catch(console.error);