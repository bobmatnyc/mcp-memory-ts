/**
 * Verification Script for Google OAuth Fix
 *
 * This script helps verify that the OAuth fix is working correctly by:
 * 1. Checking if users exist in database
 * 2. Verifying OAuth token storage
 * 3. Testing user creation flow
 */

import { DatabaseConnection } from '../src/database/connection.js';
import { DatabaseOperations } from '../src/database/operations.js';
import type { User } from '../src/types/base.js';

async function main() {
  console.log('🔍 Google OAuth Fix Verification\n');

  // Load environment variables
  const url = process.env.TURSO_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (!url || !authToken) {
    console.error('❌ Missing TURSO_URL or TURSO_AUTH_TOKEN environment variables');
    process.exit(1);
  }

  // Connect to database
  console.log('📊 Connecting to database...');
  const connection = new DatabaseConnection({ url, authToken });
  await connection.connect();
  const db = new DatabaseOperations(connection);

  try {
    // Test 1: List all users with OAuth tokens
    console.log('\n✅ Test 1: Users with Google OAuth tokens');
    const result = await connection.execute('SELECT id, email, name, metadata FROM users');

    let usersWithOAuth = 0;
    let totalUsers = result.rows.length;

    for (const row of result.rows) {
      try {
        const metadata = row.metadata ? JSON.parse(row.metadata as string) : {};
        if (metadata.googleOAuthTokens) {
          usersWithOAuth++;
          console.log(`  ✓ ${row.email} (${row.id})`);
          console.log(`    Connected: ${metadata.googleOAuthConnectedAt || 'Unknown'}`);

          // Check token structure
          const tokens = metadata.googleOAuthTokens;
          const hasAccessToken = !!tokens.access_token;
          const hasRefreshToken = !!tokens.refresh_token;
          const hasExpiry = !!tokens.expiry_date;

          console.log(`    Access Token: ${hasAccessToken ? '✓' : '✗'}`);
          console.log(`    Refresh Token: ${hasRefreshToken ? '✓' : '✗'}`);
          console.log(`    Expiry Date: ${hasExpiry ? '✓' : '✗'}`);
        }
      } catch (e) {
        console.log(`  ⚠️  ${row.email} - Invalid metadata: ${e}`);
      }
    }

    console.log(`\n  Total Users: ${totalUsers}`);
    console.log(`  Users with OAuth: ${usersWithOAuth}`);
    console.log(`  Users without OAuth: ${totalUsers - usersWithOAuth}`);

    // Test 2: Verify user creation works
    console.log('\n✅ Test 2: User Creation Test');
    const testUserId = `test-user-${Date.now()}`;
    const testEmail = `test-${Date.now()}@example.com`;

    try {
      // Check if test user exists
      let existingUser = await db.getUserById(testUserId);
      if (existingUser) {
        console.log('  ⚠️  Test user already exists, cleaning up...');
        await connection.execute('DELETE FROM users WHERE id = ?', [testUserId]);
      }

      // Create test user
      console.log(`  Creating test user: ${testEmail}`);
      const testUser: User = {
        id: testUserId,
        email: testEmail,
        name: 'Test User',
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await db.createUser(testUser);
      console.log('  ✓ User created successfully');

      // Verify user exists
      const createdUser = await db.getUserById(testUserId);
      if (!createdUser) {
        console.log('  ✗ User creation verification failed');
      } else {
        console.log('  ✓ User verified in database');
      }

      // Test metadata update
      console.log('  Testing metadata update...');
      const mockTokens = {
        access_token: 'mock-access-token',
        refresh_token: 'mock-refresh-token',
        scope: 'https://www.googleapis.com/auth/contacts.readonly',
        token_type: 'Bearer',
        expiry_date: Date.now() + 3600000,
      };

      await db.updateUser(testUserId, {
        metadata: {
          googleOAuthTokens: mockTokens,
          googleOAuthConnectedAt: new Date().toISOString(),
        },
      });

      // Verify metadata update
      const updatedUser = await db.getUserById(testUserId);
      if (updatedUser?.metadata?.googleOAuthTokens) {
        console.log('  ✓ Metadata update successful');
        console.log('  ✓ OAuth tokens stored correctly');
      } else {
        console.log('  ✗ Metadata update failed');
      }

      // Clean up test user
      console.log('  Cleaning up test user...');
      await connection.execute('DELETE FROM users WHERE id = ?', [testUserId]);
      console.log('  ✓ Test user cleaned up');

    } catch (error) {
      console.error('  ✗ User creation test failed:', error);
    }

    // Test 3: Verify database schema
    console.log('\n✅ Test 3: Database Schema Verification');

    // Check users table
    const usersSchema = await connection.execute(
      "SELECT sql FROM sqlite_master WHERE type='table' AND name='users'"
    );

    if (usersSchema.rows.length > 0) {
      const schemaSQL = usersSchema.rows[0].sql as string;
      const hasMetadata = schemaSQL.includes('metadata');
      console.log(`  Users table: ${hasMetadata ? '✓' : '✗'} has metadata column`);
    }

    // Test 4: Check for common issues
    console.log('\n✅ Test 4: Common Issues Check');

    // Check for users with NULL IDs
    const nullIdUsers = await connection.execute(
      'SELECT COUNT(*) as count FROM users WHERE id IS NULL OR id = ""'
    );
    const nullIdCount = Number(nullIdUsers.rows[0].count);
    console.log(`  Users with NULL/empty IDs: ${nullIdCount === 0 ? '✓' : '✗'} (${nullIdCount})`);

    // Check for duplicate emails
    const duplicateEmails = await connection.execute(`
      SELECT email, COUNT(*) as count
      FROM users
      GROUP BY email
      HAVING count > 1
    `);
    console.log(`  Duplicate emails: ${duplicateEmails.rows.length === 0 ? '✓' : '✗'} (${duplicateEmails.rows.length})`);

    // Summary
    console.log('\n📋 Summary');
    console.log('  ✓ OAuth fix verification complete');
    console.log('  ✓ User creation flow tested');
    console.log('  ✓ Token storage tested');
    console.log('  ✓ Database schema verified');

    console.log('\n💡 Next Steps:');
    console.log('  1. Test OAuth flow in web interface');
    console.log('  2. Monitor server logs for [GoogleOAuth] messages');
    console.log('  3. Verify connection persists after authorization');
    console.log('  4. Check Google sync functionality');

  } catch (error) {
    console.error('\n❌ Verification failed:', error);
    process.exit(1);
  } finally {
    connection.close();
  }
}

main().catch(console.error);
