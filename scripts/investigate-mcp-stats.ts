/**
 * Investigate why MCP stats show 0 entities
 * Compare database counts with MCP tool results
 */

import { createClient } from '@libsql/client';
import * as dotenv from 'dotenv';

dotenv.config();

async function investigateMcpStats() {
  console.log('🔍 Investigating MCP Stats Discrepancy\n');

  const tursoUrl = process.env.TURSO_URL;
  const tursoAuthToken = process.env.TURSO_AUTH_TOKEN;
  const defaultUserEmail = process.env.DEFAULT_USER_EMAIL || 'bob@matsuoka.com';

  if (!tursoUrl || !tursoAuthToken) {
    throw new Error('Missing credentials');
  }

  const db = createClient({
    url: tursoUrl,
    authToken: tursoAuthToken,
  });

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('                MCP STATS INVESTIGATION');
  console.log('═══════════════════════════════════════════════════════════════\n');

  console.log(`Default User Email: ${defaultUserEmail}\n`);

  // 1. Find user_id for default email
  console.log('1. Looking up user_id for default email...');
  const userResult = await db.execute(`
    SELECT id, email, name FROM users WHERE email = ?
  `, [defaultUserEmail]);

  if (userResult.rows.length === 0) {
    console.log(`❌ No user found with email: ${defaultUserEmail}\n`);
  } else {
    const user = userResult.rows[0] as any;
    console.log(`✅ Found user:`);
    console.log(`   ID: ${user.id}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Name: ${user.name || 'N/A'}\n`);

    // 2. Count entities for this user
    console.log('2. Counting entities for this user...');
    const entityCountResult = await db.execute(`
      SELECT COUNT(*) as count FROM entities WHERE user_id = ?
    `, [user.id]);
    console.log(`   Entities for ${user.email}: ${(entityCountResult.rows[0] as any).count}\n`);

    // 3. Count memories for this user
    console.log('3. Counting memories for this user...');
    const memoryCountResult = await db.execute(`
      SELECT COUNT(*) as count FROM memories WHERE user_id = ?
    `, [user.id]);
    console.log(`   Memories for ${user.email}: ${(memoryCountResult.rows[0] as any).count}\n`);

    // 4. Check memory-entity associations for this user
    console.log('4. Checking memory-entity associations...');
    const memoriesWithEntitiesResult = await db.execute(`
      SELECT COUNT(*) as count
      FROM memories
      WHERE user_id = ?
        AND entity_ids IS NOT NULL
        AND entity_ids != ''
        AND entity_ids != '[]'
    `, [user.id]);
    console.log(`   Memories with entity_ids: ${(memoriesWithEntitiesResult.rows[0] as any).count}\n`);

    // 5. Sample memories with entity_ids
    console.log('5. Sampling memories with entity associations...');
    const sampleMemoriesResult = await db.execute(`
      SELECT id, title, entity_ids
      FROM memories
      WHERE user_id = ?
        AND entity_ids IS NOT NULL
        AND entity_ids != ''
        AND entity_ids != '[]'
      LIMIT 5
    `, [user.id]);

    if (sampleMemoriesResult.rows.length > 0) {
      console.log('   Sample memories with entity_ids:');
      sampleMemoriesResult.rows.forEach((row: any) => {
        console.log(`     Memory ${row.id}: "${row.title}"`);
        console.log(`       entity_ids: ${row.entity_ids}`);
        try {
          const entityIds = JSON.parse(row.entity_ids);
          console.log(`       Parsed: ${JSON.stringify(entityIds)}`);
        } catch (e) {
          console.log(`       ERROR parsing: ${e.message}`);
        }
      });
    } else {
      console.log('   ⚠️  No memories found with entity associations for this user\n');
    }

    // 6. Check if entity IDs in memories exist in entities table
    console.log('\n6. Verifying entity IDs in memories exist in entities table...');
    const allMemoriesWithEntitiesResult = await db.execute(`
      SELECT id, entity_ids
      FROM memories
      WHERE user_id = ?
        AND entity_ids IS NOT NULL
        AND entity_ids != ''
        AND entity_ids != '[]'
    `, [user.id]);

    let validEntityRefs = 0;
    let invalidEntityRefs = 0;
    const missingEntityIds = new Set<string>();

    for (const memory of allMemoriesWithEntitiesResult.rows as any[]) {
      try {
        const entityIds = JSON.parse(memory.entity_ids);
        if (Array.isArray(entityIds)) {
          for (const entityId of entityIds) {
            const checkResult = await db.execute(`
              SELECT id FROM entities WHERE id = ?
            `, [String(entityId)]);

            if (checkResult.rows.length > 0) {
              validEntityRefs++;
            } else {
              invalidEntityRefs++;
              missingEntityIds.add(String(entityId));
            }
          }
        }
      } catch (e) {
        // Invalid JSON
      }
    }

    console.log(`   Valid entity references: ${validEntityRefs}`);
    console.log(`   Invalid entity references: ${invalidEntityRefs}`);
    if (missingEntityIds.size > 0) {
      console.log(`   Missing entity IDs (first 10):`);
      Array.from(missingEntityIds).slice(0, 10).forEach(id => {
        console.log(`     - ${id}`);
      });
    }
  }

  // 7. Overall database stats
  console.log('\n7. Overall Database Statistics...');
  console.log('─────────────────────────────────────────────────────────────');

  const totalUsersResult = await db.execute('SELECT COUNT(*) as count FROM users');
  console.log(`Total Users: ${(totalUsersResult.rows[0] as any).count}`);

  const totalEntitiesResult = await db.execute('SELECT COUNT(*) as count FROM entities');
  console.log(`Total Entities: ${(totalEntitiesResult.rows[0] as any).count}`);

  const totalMemoriesResult = await db.execute('SELECT COUNT(*) as count FROM memories');
  console.log(`Total Memories: ${(totalMemoriesResult.rows[0] as any).count}`);

  const entitiesWithNullUserResult = await db.execute(`
    SELECT COUNT(*) as count FROM entities WHERE user_id IS NULL
  `);
  console.log(`Entities with NULL user_id: ${(entitiesWithNullUserResult.rows[0] as any).count}`);

  const memoriesWithNullUserResult = await db.execute(`
    SELECT COUNT(*) as count FROM memories WHERE user_id IS NULL
  `);
  console.log(`Memories with NULL user_id: ${(memoriesWithNullUserResult.rows[0] as any).count}`);

  // 8. Check users table
  console.log('\n8. All Users in Database...');
  console.log('─────────────────────────────────────────────────────────────');
  const allUsersResult = await db.execute('SELECT id, email, name FROM users');
  allUsersResult.rows.forEach((user: any) => {
    console.log(`User: ${user.email}`);
    console.log(`  ID: ${user.id}`);
    console.log(`  Name: ${user.name || 'N/A'}`);
  });

  // 9. Entity distribution by user
  console.log('\n9. Entity Distribution by User...');
  console.log('─────────────────────────────────────────────────────────────');
  const entityDistributionResult = await db.execute(`
    SELECT
      user_id,
      COUNT(*) as count,
      entity_type
    FROM entities
    GROUP BY user_id, entity_type
    ORDER BY count DESC
  `);

  const userEntityMap = new Map<string, Map<string, number>>();
  entityDistributionResult.rows.forEach((row: any) => {
    const userId = row.user_id || 'NULL';
    if (!userEntityMap.has(userId)) {
      userEntityMap.set(userId, new Map());
    }
    userEntityMap.get(userId)!.set(row.entity_type, row.count);
  });

  userEntityMap.forEach((typeCounts, userId) => {
    const total = Array.from(typeCounts.values()).reduce((a, b) => a + b, 0);
    console.log(`User ID: ${userId} (${total} total entities)`);
    typeCounts.forEach((count, type) => {
      console.log(`  ${type}: ${count}`);
    });
  });

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('\n💡 ANALYSIS SUMMARY');
  console.log('─────────────────────────────────────────────────────────────');

  if (userResult.rows.length === 0) {
    console.log('🔴 The DEFAULT_USER_EMAIL is not in the users table!');
    console.log('   This explains why MCP stats shows 0 entities.');
    console.log('   MCP tools filter by user_id from the email lookup.\n');
    console.log('✅ SOLUTION: Create a user record with the default email OR update DEFAULT_USER_EMAIL');
  } else {
    const user = userResult.rows[0] as any;
    const entityCount = (await db.execute(`SELECT COUNT(*) as count FROM entities WHERE user_id = ?`, [user.id])).rows[0] as any;

    if (entityCount.count === 0) {
      console.log('⚠️  User exists but has 0 entities assigned to them.');
      console.log(`   All entities belong to other users or have NULL user_id.`);
      console.log(`\n✅ SOLUTION: Assign entities to user ${user.email} OR fix NULL user_id entities`);
    } else {
      console.log('✅ User exists and has entities assigned.');
      console.log(`   MCP stats should show ${entityCount.count} entities for this user.`);
      console.log(`\n⚠️  If MCP still shows 0, check the stats calculation logic.`);
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════════\n');
}

investigateMcpStats().catch(console.error);
