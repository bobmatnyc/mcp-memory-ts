#!/usr/bin/env tsx
/**
 * OAuth 2.0 Flow Testing Script
 * Tests the complete OAuth flow from authorization to token usage
 */

import { initDatabaseFromEnv } from '../src/database/connection.js';
import {
  generateClientCredentials,
  hashSecret,
  storeOAuthClient,
  generateAuthorizationCode,
  storeAuthorizationCode,
  validateAuthorizationCode,
  generateAccessToken,
  storeAccessToken,
  validateAccessToken,
} from '../src/utils/oauth.js';

async function testOAuthFlow(): Promise<void> {
  console.log('========================================');
  console.log('  OAuth 2.0 Flow Testing Script');
  console.log('========================================\n');

  let db;

  try {
    // Initialize database
    console.log('1. Initializing database connection...');
    db = initDatabaseFromEnv();
    await db.connect();
    console.log('   ✓ Database connected\n');

    // Create test user
    const testUserId = 'test_user_' + Date.now();
    const testUserEmail = `test${Date.now()}@example.com`;

    console.log('2. Creating test user...');
    await db.execute(
      'INSERT INTO users (id, email, created_at, updated_at) VALUES (?, ?, ?, ?)',
      [testUserId, testUserEmail, new Date().toISOString(), new Date().toISOString()]
    );
    console.log(`   ✓ Test user created: ${testUserEmail}\n`);

    // Generate and store OAuth client
    console.log('3. Generating OAuth client credentials...');
    const { clientId, clientSecret } = generateClientCredentials();
    const clientSecretHash = await hashSecret(clientSecret);
    console.log(`   ✓ Client ID: ${clientId}`);
    console.log(`   ✓ Client Secret: ${clientSecret.substring(0, 20)}...\n`);

    console.log('4. Storing OAuth client...');
    await storeOAuthClient(db, {
      clientId,
      clientSecretHash,
      name: 'Test OAuth Client',
      redirectUris: ['https://example.com/callback', 'http://localhost:3000/callback'],
      allowedScopes: ['memories:read', 'memories:write'],
      createdBy: testUserId,
    });
    console.log('   ✓ Client stored successfully\n');

    // Generate and store authorization code
    console.log('5. Generating authorization code...');
    const authCode = generateAuthorizationCode();
    const redirectUri = 'https://example.com/callback';
    const scope = 'memories:read memories:write';
    const state = 'test_state_123';

    await storeAuthorizationCode(db, {
      code: authCode,
      clientId,
      userId: testUserId,
      redirectUri,
      scope,
      state,
    });
    console.log(`   ✓ Authorization code: ${authCode}\n`);

    // Validate authorization code
    console.log('6. Validating authorization code...');
    const codeValidation = await validateAuthorizationCode(db, authCode, clientId, redirectUri);

    if (!codeValidation.valid) {
      throw new Error('Authorization code validation failed');
    }
    console.log('   ✓ Code validated successfully');
    console.log(`   ✓ User ID: ${codeValidation.userId}`);
    console.log(`   ✓ Scope: ${codeValidation.scope}\n`);

    // Generate and store access token
    console.log('7. Generating access token...');
    const accessToken = generateAccessToken();

    await storeAccessToken(db, {
      token: accessToken,
      clientId,
      userId: testUserId,
      scope,
    });
    console.log(`   ✓ Access token: ${accessToken}\n`);

    // Validate access token
    console.log('8. Validating access token...');
    const tokenValidation = await validateAccessToken(db, accessToken);

    if (!tokenValidation.valid) {
      throw new Error('Access token validation failed');
    }
    console.log('   ✓ Token validated successfully');
    console.log(`   ✓ User ID: ${tokenValidation.userId}`);
    console.log(`   ✓ Client ID: ${tokenValidation.clientId}`);
    console.log(`   ✓ Scope: ${tokenValidation.scope}\n`);

    // Try to reuse authorization code (should fail)
    console.log('9. Testing authorization code reuse (should fail)...');
    const revalidation = await validateAuthorizationCode(db, authCode, clientId, redirectUri);

    if (revalidation.valid) {
      throw new Error('Authorization code was reused - this should not happen!');
    }
    console.log('   ✓ Code reuse prevented successfully\n');

    // Cleanup test data
    console.log('10. Cleaning up test data...');
    await db.execute('DELETE FROM oauth_access_tokens WHERE user_id = ?', [testUserId]);
    await db.execute('DELETE FROM oauth_authorization_codes WHERE user_id = ?', [testUserId]);
    await db.execute('DELETE FROM oauth_clients WHERE created_by = ?', [testUserId]);
    await db.execute('DELETE FROM users WHERE id = ?', [testUserId]);
    console.log('   ✓ Test data cleaned up\n');

    console.log('========================================');
    console.log('✅ All OAuth Flow Tests Passed!');
    console.log('========================================\n');

    console.log('Test Summary:');
    console.log('- Client registration: ✓');
    console.log('- Authorization code generation: ✓');
    console.log('- Authorization code validation: ✓');
    console.log('- Access token generation: ✓');
    console.log('- Access token validation: ✓');
    console.log('- Code reuse prevention: ✓');
    console.log('- Cleanup: ✓\n');

    await db.disconnect();
  } catch (error) {
    console.error('\n❌ OAuth flow test failed:', error);

    // Attempt cleanup
    if (db) {
      try {
        console.log('\nAttempting cleanup...');
        const testUsers = await db.execute(
          "SELECT id FROM users WHERE email LIKE 'test%@example.com'"
        );

        for (const row of testUsers.rows) {
          const userId = (row as any).id;
          await db.execute('DELETE FROM oauth_access_tokens WHERE user_id = ?', [userId]);
          await db.execute('DELETE FROM oauth_authorization_codes WHERE user_id = ?', [userId]);
          await db.execute('DELETE FROM oauth_clients WHERE created_by = ?', [userId]);
          await db.execute('DELETE FROM users WHERE id = ?', [userId]);
        }
        console.log('Cleanup completed');

        await db.disconnect();
      } catch (cleanupError) {
        console.error('Cleanup failed:', cleanupError);
      }
    }

    process.exit(1);
  }
}

// Run tests
testOAuthFlow().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
