#!/usr/bin/env tsx
/**
 * Database Investigation Tool - Memory User Association Issues
 *
 * This script helps investigate memory user association problems by:
 * 1. Listing all users in the database
 * 2. Showing memories for each user
 * 3. Identifying orphaned or duplicate memories
 * 4. Checking for user isolation issues
 *
 * Usage:
 *   npx tsx tools/investigate-memory-users.ts
 *   npx tsx tools/investigate-memory-users.ts --user bob@matsuoka.com
 */

import { createClient } from '@libsql/client';

const TURSO_URL = process.env.TURSO_URL!;
const TURSO_AUTH_TOKEN = process.env.TURSO_AUTH_TOKEN!;

if (!TURSO_URL || !TURSO_AUTH_TOKEN) {
  console.error('❌ Error: TURSO_URL and TURSO_AUTH_TOKEN must be set');
  process.exit(1);
}

const db = createClient({
  url: TURSO_URL,
  authToken: TURSO_AUTH_TOKEN,
});

interface InvestigationOptions {
  targetUser?: string;
  showOrphaned?: boolean;
  showDuplicates?: boolean;
}

async function investigateDatabase(options: InvestigationOptions = {}) {
  console.log('🔍 MCP MEMORY DATABASE INVESTIGATION');
  console.log('=' .repeat(60));
  console.log(`Database: ${TURSO_URL.replace(/\/\/.*@/, '//***@')}`);
  console.log('');

  try {
    // 1. List all users
    console.log('👥 USERS IN DATABASE:');
    console.log('-'.repeat(60));
    const usersResult = await db.execute(
      'SELECT id, email, name, is_active, created_at FROM users ORDER BY created_at DESC'
    );

    if (usersResult.rows.length === 0) {
      console.log('⚠️  No users found in database!');
      return;
    }

    const users = usersResult.rows as any[];
    users.forEach((user, i) => {
      console.log(`${i + 1}. User ID: ${user.id}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Name: ${user.name || 'N/A'}`);
      console.log(`   Active: ${user.is_active ? 'Yes' : 'No'}`);
      console.log(`   Created: ${user.created_at}`);
      console.log('');
    });

    // 2. Check memories for each user
    console.log('\n📝 MEMORIES PER USER:');
    console.log('-'.repeat(60));

    for (const user of users) {
      const memoriesResult = await db.execute(
        'SELECT COUNT(*) as count FROM memories WHERE user_id = ?',
        [user.id]
      );
      const count = (memoriesResult.rows[0] as any).count;

      const archivedResult = await db.execute(
        'SELECT COUNT(*) as count FROM memories WHERE user_id = ? AND is_archived = 1',
        [user.id]
      );
      const archivedCount = (archivedResult.rows[0] as any).count;

      console.log(`User: ${user.email} (${user.id})`);
      console.log(`  Total memories: ${count}`);
      console.log(`  Archived: ${archivedCount}`);
      console.log(`  Active: ${count - archivedCount}`);
      console.log('');
    }

    // 3. Check for orphaned memories (user_id is NULL or doesn't exist in users table)
    console.log('\n🔓 ORPHANED MEMORIES CHECK:');
    console.log('-'.repeat(60));

    const orphanedNullResult = await db.execute(
      'SELECT COUNT(*) as count FROM memories WHERE user_id IS NULL'
    );
    const orphanedNullCount = (orphanedNullResult.rows[0] as any).count;

    const orphanedInvalidResult = await db.execute(`
      SELECT COUNT(*) as count
      FROM memories m
      WHERE m.user_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = m.user_id)
    `);
    const orphanedInvalidCount = (orphanedInvalidResult.rows[0] as any).count;

    console.log(`Memories with NULL user_id: ${orphanedNullCount}`);
    console.log(`Memories with invalid user_id: ${orphanedInvalidCount}`);

    if (orphanedNullCount > 0) {
      console.log('\n⚠️  Found memories with NULL user_id:');
      const orphanedResult = await db.execute(
        'SELECT id, title, content, created_at FROM memories WHERE user_id IS NULL LIMIT 10'
      );
      orphanedResult.rows.forEach((row: any, i) => {
        console.log(`  ${i + 1}. ID: ${row.id} | Title: ${row.title}`);
        console.log(`     Content: ${row.content?.substring(0, 60)}...`);
        console.log(`     Created: ${row.created_at}`);
      });
    }

    if (orphanedInvalidCount > 0) {
      console.log('\n⚠️  Found memories with invalid user_id:');
      const invalidResult = await db.execute(`
        SELECT m.id, m.user_id, m.title, m.content, m.created_at
        FROM memories m
        WHERE m.user_id IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = m.user_id)
        LIMIT 10
      `);
      invalidResult.rows.forEach((row: any, i) => {
        console.log(`  ${i + 1}. ID: ${row.id} | Invalid user_id: ${row.user_id}`);
        console.log(`     Title: ${row.title}`);
        console.log(`     Content: ${row.content?.substring(0, 60)}...`);
      });
    }

    // 4. Check for duplicate memories (same title/content for same user)
    console.log('\n📋 DUPLICATE MEMORIES CHECK:');
    console.log('-'.repeat(60));

    const duplicatesResult = await db.execute(`
      SELECT user_id, title, content, COUNT(*) as count
      FROM memories
      GROUP BY user_id, title, content
      HAVING COUNT(*) > 1
    `);

    if (duplicatesResult.rows.length === 0) {
      console.log('✅ No duplicate memories found');
    } else {
      console.log(`⚠️  Found ${duplicatesResult.rows.length} sets of duplicate memories:`);
      duplicatesResult.rows.forEach((row: any, i) => {
        console.log(`  ${i + 1}. User: ${row.user_id} | Count: ${row.count}`);
        console.log(`     Title: ${row.title}`);
        console.log(`     Content: ${row.content?.substring(0, 60)}...`);
      });
    }

    // 5. If specific user requested, show detailed info
    if (options.targetUser) {
      console.log(`\n🎯 DETAILED INFO FOR: ${options.targetUser}`);
      console.log('-'.repeat(60));

      const userResult = await db.execute(
        'SELECT * FROM users WHERE email = ?',
        [options.targetUser]
      );

      if (userResult.rows.length === 0) {
        console.log(`❌ User not found: ${options.targetUser}`);
      } else {
        const user = userResult.rows[0] as any;
        console.log('User Details:');
        console.log(`  ID: ${user.id}`);
        console.log(`  Email: ${user.email}`);
        console.log(`  Name: ${user.name || 'N/A'}`);
        console.log(`  Active: ${user.is_active ? 'Yes' : 'No'}`);
        console.log(`  Created: ${user.created_at}`);
        console.log('');

        // Get all memories for this user
        const userMemoriesResult = await db.execute(
          `SELECT id, title, content, memory_type, importance, is_archived, created_at
           FROM memories
           WHERE user_id = ?
           ORDER BY created_at DESC`,
          [user.id]
        );

        console.log(`Memories (${userMemoriesResult.rows.length}):`);
        if (userMemoriesResult.rows.length === 0) {
          console.log('  No memories found for this user');
        } else {
          userMemoriesResult.rows.forEach((mem: any, i) => {
            console.log(`  ${i + 1}. [${mem.memory_type}] ${mem.title}`);
            console.log(`     ID: ${mem.id} | Importance: ${mem.importance} | Archived: ${mem.is_archived ? 'Yes' : 'No'}`);
            console.log(`     Content: ${mem.content?.substring(0, 80)}...`);
            console.log(`     Created: ${mem.created_at}`);
            console.log('');
          });
        }

        // Get entities for this user
        const entitiesResult = await db.execute(
          `SELECT id, name, entity_type, person_type, contact_info, created_at
           FROM entities
           WHERE user_id = ?
           ORDER BY created_at DESC`,
          [user.id]
        );

        console.log(`Entities (${entitiesResult.rows.length}):`);
        if (entitiesResult.rows.length === 0) {
          console.log('  No entities found for this user');
        } else {
          entitiesResult.rows.forEach((ent: any, i) => {
            console.log(`  ${i + 1}. [${ent.entity_type}] ${ent.name}`);
            console.log(`     ID: ${ent.id} | Type: ${ent.person_type || 'N/A'} | Contact: ${ent.contact_info || 'N/A'}`);
            console.log(`     Created: ${ent.created_at}`);
            console.log('');
          });
        }
      }
    }

    // 6. Database statistics
    console.log('\n📊 DATABASE STATISTICS:');
    console.log('-'.repeat(60));

    const statsQueries = [
      { name: 'Total Users', query: 'SELECT COUNT(*) as count FROM users' },
      { name: 'Active Users', query: 'SELECT COUNT(*) as count FROM users WHERE is_active = 1' },
      { name: 'Total Memories', query: 'SELECT COUNT(*) as count FROM memories' },
      { name: 'Active Memories', query: 'SELECT COUNT(*) as count FROM memories WHERE is_archived = 0' },
      { name: 'Archived Memories', query: 'SELECT COUNT(*) as count FROM memories WHERE is_archived = 1' },
      { name: 'Total Entities', query: 'SELECT COUNT(*) as count FROM entities' },
      { name: 'Total Interactions', query: 'SELECT COUNT(*) as count FROM interactions' },
    ];

    for (const stat of statsQueries) {
      const result = await db.execute(stat.query);
      const count = (result.rows[0] as any).count;
      console.log(`${stat.name}: ${count}`);
    }

    console.log('\n✅ Investigation complete!');

  } catch (error) {
    console.error('❌ Investigation error:', error);
    throw error;
  } finally {
    await db.close();
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const options: InvestigationOptions = {};

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--user' && args[i + 1]) {
    options.targetUser = args[i + 1];
    i++;
  }
}

// Run investigation
investigateDatabase(options).catch(console.error);
