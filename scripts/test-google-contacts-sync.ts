#!/usr/bin/env node
/**
 * Test Google Contacts Sync
 *
 * Directly test the Google Contacts sync to capture the actual API error
 */

import { initDatabaseFromEnv } from '../src/database/connection.js';
import { DatabaseOperations } from '../src/database/operations.js';
import { GoogleAuthService } from '../src/utils/google-auth.js';
import { GoogleContactsSyncService } from '../src/services/google-contacts-sync.js';

async function testGoogleContactsSync() {
  const db = initDatabaseFromEnv();
  await db.connect();
  const ops = new DatabaseOperations(db);

  try {
    const userEmail = 'bob@matsuoka.com';

    console.log('\n=== Testing Google Contacts Sync ===\n');
    console.log(`User: ${userEmail}`);

    // Get user
    const user = await ops.getUserByEmail(userEmail);
    if (!user) {
      console.error('User not found');
      process.exit(1);
    }

    console.log('User found:', user.id);

    // Initialize Google Auth Service
    const googleAuth = new GoogleAuthService(
      ops,
      process.env.GOOGLE_CLIENT_ID!,
      process.env.GOOGLE_CLIENT_SECRET!,
      `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3002'}/api/auth/google-connect/callback`
    );

    // Check connection
    const isConnected = await googleAuth.isConnected(userEmail);
    console.log('Google connected:', isConnected);

    if (!isConnected) {
      console.error('User is not connected to Google');
      process.exit(1);
    }

    // Check scopes
    const scopes = await googleAuth.getUserScopes(userEmail);
    console.log('User scopes:', scopes);

    // Initialize sync service
    const syncService = new GoogleContactsSyncService(ops, googleAuth);

    // Attempt sync (import only, dry run)
    console.log('\n📥 Starting sync test (import, dry run)...\n');

    const result = await syncService.sync({
      userId: userEmail,
      direction: 'import',
      dryRun: true,
      forceFull: true, // Force full sync to bypass token issues
      enableLLMDedup: false, // Disable LLM to speed up test
    });

    console.log('\n✅ Sync completed successfully!');
    console.log('Result:', JSON.stringify(result, null, 2));

  } catch (error) {
    console.error('\n❌ Sync failed with error:');
    console.error('Error:', error);

    if (error instanceof Error) {
      console.error('Message:', error.message);
      console.error('Stack:', error.stack);
    }

    process.exit(1);
  }
}

testGoogleContactsSync()
  .then(() => {
    console.log('\n✅ Test completed successfully\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  });
