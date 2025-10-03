#!/usr/bin/env tsx
/**
 * Test script to verify user isolation security fixes
 *
 * This tests that:
 * 1. getEntityById requires userId and enforces isolation
 * 2. getMemoryById requires userId and enforces isolation
 * 3. Users cannot access other users' data by ID
 */

import 'dotenv/config';
import { DatabaseConnection } from '../src/database/connection.js';
import { DatabaseOperations } from '../src/database/operations.js';
import { createUser, createEntity, createMemory } from '../src/models/index.js';
import { EntityType, MemoryType, ImportanceLevel } from '../src/types/enums.js';

async function main() {
  console.log('\n🔒 User Isolation Security Test\n');
  console.log('=' .repeat(60));

  if (!process.env.TURSO_URL || !process.env.TURSO_AUTH_TOKEN) {
    console.error('❌ Error: TURSO_URL and TURSO_AUTH_TOKEN must be set');
    process.exit(1);
  }

  const db = new DatabaseConnection({
    url: process.env.TURSO_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  await db.connect();
  console.log('✓ Database connected\n');

  const dbOps = new DatabaseOperations(db as any);

  try {
    // Create two test users
    console.log('Creating test users...');
    const userA = createUser({
      email: `user-a-${Date.now()}@test.com`,
      name: 'User A',
      isActive: true,
    });

    const userB = createUser({
      email: `user-b-${Date.now()}@test.com`,
      name: 'User B',
      isActive: true,
    });

    await dbOps.createUser(userA);
    await dbOps.createUser(userB);
    console.log(`✓ Created User A: ${userA.id}`);
    console.log(`✓ Created User B: ${userB.id}\n`);

    // Test 1: Entity Isolation
    console.log('TEST 1: Entity Isolation');
    console.log('-'.repeat(60));

    const entityA = createEntity({
      userId: userA.id,
      name: 'User A Entity',
      entityType: EntityType.PERSON,
      description: 'This belongs to User A',
      importance: ImportanceLevel.HIGH,
    });

    const createdEntity = await dbOps.createEntity(entityA);
    console.log(`✓ User A created entity: ${createdEntity.id}`);

    // User A should be able to retrieve their own entity
    const entityForUserA = await dbOps.getEntityById(createdEntity.id!, userA.id);
    if (entityForUserA && entityForUserA.name === 'User A Entity') {
      console.log('✓ User A can retrieve their own entity');
    } else {
      console.error('❌ FAIL: User A cannot retrieve their own entity');
      process.exit(1);
    }

    // User B should NOT be able to retrieve User A's entity
    const entityForUserB = await dbOps.getEntityById(createdEntity.id!, userB.id);
    if (entityForUserB === null) {
      console.log('✓ User B CANNOT retrieve User A\'s entity (isolation working)');
    } else {
      console.error('❌ CRITICAL SECURITY FAILURE: User B can access User A\'s entity!');
      process.exit(1);
    }

    console.log();

    // Test 2: Memory Isolation
    console.log('TEST 2: Memory Isolation');
    console.log('-'.repeat(60));

    const memoryA = createMemory({
      userId: userA.id,
      title: 'User A Memory',
      content: 'This is private data for User A',
      memoryType: MemoryType.MEMORY,
      importance: 0.8, // High importance (0.0 - 1.0 scale)
    });

    const createdMemory = await dbOps.createMemory(memoryA);
    console.log(`✓ User A created memory: ${createdMemory.id}`);

    // User A should be able to retrieve their own memory
    const memoryForUserA = await dbOps.getMemoryById(createdMemory.id!, userA.id);
    if (memoryForUserA && memoryForUserA.title === 'User A Memory') {
      console.log('✓ User A can retrieve their own memory');
    } else {
      console.error('❌ FAIL: User A cannot retrieve their own memory');
      process.exit(1);
    }

    // User B should NOT be able to retrieve User A's memory
    const memoryForUserB = await dbOps.getMemoryById(createdMemory.id!, userB.id);
    if (memoryForUserB === null) {
      console.log('✓ User B CANNOT retrieve User A\'s memory (isolation working)');
    } else {
      console.error('❌ CRITICAL SECURITY FAILURE: User B can access User A\'s memory!');
      process.exit(1);
    }

    console.log();

    // Test 3: Update Entity with User Validation
    console.log('TEST 3: Update Entity with User Validation');
    console.log('-'.repeat(60));

    // User A should be able to update their own entity
    const updatedEntityA = await dbOps.updateEntity(
      createdEntity.id!,
      { name: 'Updated Entity Name' },
      userA.id
    );
    if (updatedEntityA && updatedEntityA.name === 'Updated Entity Name') {
      console.log('✓ User A can update their own entity');
    } else {
      console.error('❌ FAIL: User A cannot update their own entity');
      process.exit(1);
    }

    // User B should NOT be able to update User A's entity
    const updatedEntityB = await dbOps.updateEntity(
      createdEntity.id!,
      { name: 'Hacked by User B' },
      userB.id
    );
    if (updatedEntityB === null) {
      console.log('✓ User B CANNOT update User A\'s entity (isolation working)');
    } else {
      console.error('❌ CRITICAL SECURITY FAILURE: User B can update User A\'s entity!');
      process.exit(1);
    }

    console.log();

    // Cleanup
    console.log('Cleaning up test data...');
    await dbOps.deleteUser(userA.id);
    await dbOps.deleteUser(userB.id);
    console.log('✓ Test data cleaned up\n');

    console.log('=' .repeat(60));
    console.log('✅ ALL SECURITY TESTS PASSED');
    console.log('=' .repeat(60));
    console.log('\nUser isolation is properly enforced:');
    console.log('  - getEntityById requires userId and checks user_id');
    console.log('  - getMemoryById requires userId and checks user_id');
    console.log('  - updateEntity requires userId and checks user_id');
    console.log('\nCross-user data access is prevented! 🔒\n');

  } catch (error) {
    console.error('\n❌ Test failed with error:', error);
    process.exit(1);
  } finally {
    await db.disconnect();
  }
}

main();
