#!/usr/bin/env tsx

import { DatabaseConnection } from '../src/database/connection.js';

async function checkUsers() {
  console.log('👥 CHECKING USERS TABLE');
  console.log('='.repeat(40));

  const db = new DatabaseConnection({
    url: process.env.TURSO_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  try {
    await db.connect();
    
    // Check all users
    const users = await db.execute('SELECT id, email, name, created_at FROM users ORDER BY created_at DESC');
    console.log(`Found ${users.rows.length} users:`);
    users.rows.forEach((row: any, i) => {
      console.log(`  ${i+1}. ID: ${row.id}`);
      console.log(`     Email: ${row.email}`);
      console.log(`     Name: ${row.name}`);
      console.log(`     Created: ${row.created_at}`);
      console.log('');
    });

    // Check for test@example.com specifically
    const testUser = await db.execute('SELECT * FROM users WHERE email = ?', ['test@example.com']);
    console.log(`\ntest@example.com user: ${testUser.rows.length > 0 ? 'EXISTS' : 'NOT FOUND'}`);
    if (testUser.rows.length > 0) {
      const user = testUser.rows[0] as any;
      console.log(`  ID: ${user.id}`);
      console.log(`  Email: ${user.email}`);

      // Check memories for this user
      const memories = await db.execute('SELECT id, title, content FROM memories WHERE user_id = ? AND active = 1 ORDER BY created_at DESC', [user.id]);
      console.log(`  Memories: ${memories.rows.length}`);
      memories.rows.forEach((row: any, i) => {
        console.log(`    ${i+1}. ID: ${row.id}, Title: ${row.title}`);
        console.log(`       Content: ${row.content?.substring(0, 50)}...`);
      });
    }

    await db.disconnect();

  } catch (error) {
    console.log('Error:', error);
  }
}

checkUsers();
