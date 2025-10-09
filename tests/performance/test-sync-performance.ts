#!/usr/bin/env node
/**
 * Quick performance test for sync operations
 */

import { DatabaseConnection } from './src/database/connection.js';
import { DatabaseOperations } from './src/database/operations.js';
import { EntityType } from './src/types/enums.js';

async function testSyncPerformance() {
  const dbUrl = process.env.TURSO_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  const userEmail = 'bob@matsuoka.com';

  if (!dbUrl || !authToken) {
    console.error('Missing TURSO_URL or TURSO_AUTH_TOKEN');
    process.exit(1);
  }

  const db = new DatabaseConnection({ url: dbUrl, authToken });
  await db.connect();
  console.log('Connected to database');

  const dbOps = new DatabaseOperations(db);

  try {
    // Test 1: Get user
    console.time('Get user');
    const user = await dbOps.getUserByEmail(userEmail);
    console.timeEnd('Get user');

    if (!user) {
      console.error('User not found');
      process.exit(1);
    }
    console.log(`User: ${user.email} (${user.id})`);

    // Test 2: Get all entities
    console.time('Get all entities');
    const allEntities = await dbOps.getEntitiesByUserId(user.id, 10000);
    console.timeEnd('Get all entities');
    console.log(`Total entities: ${allEntities.length}`);

    // Test 3: Filter by entity type
    console.time('Filter PERSON entities');
    const peopleEntities = allEntities.filter(e => e.entityType === EntityType.PERSON);
    console.timeEnd('Filter PERSON entities');
    console.log(`PERSON entities: ${peopleEntities.length}`);

    // Test 4: Sample first 10 entities
    console.log('\nFirst 10 PERSON entities:');
    peopleEntities.slice(0, 10).forEach((entity, i) => {
      console.log(`  ${i + 1}. ${entity.name} (${entity.email || 'no email'})`);
    });

  } finally {
    await db.disconnect();
    console.log('\nDisconnected');
  }
}

testSyncPerformance().catch(console.error);
