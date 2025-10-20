#!/usr/bin/env tsx
/**
 * Verification Script: Google OAuth Improvements
 *
 * Verifies that all OAuth improvements are properly implemented:
 * 1. Enhanced error logging
 * 2. Token refresh synchronization
 * 3. API timeout protection
 * 4. Scope validation
 * 5. Type system updates
 */

import * as fs from 'fs';
import * as path from 'path';

interface CheckResult {
  name: string;
  passed: boolean;
  details: string;
}

const results: CheckResult[] = [];

function check(name: string, condition: boolean, details: string) {
  results.push({ name, passed: condition, details });
  console.log(condition ? '✅' : '❌', name);
  if (!condition) {
    console.log('   ', details);
  }
}

function fileContains(filePath: string, searchString: string): boolean {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return content.includes(searchString);
  } catch (error) {
    return false;
  }
}

function fileExists(filePath: string): boolean {
  return fs.existsSync(filePath);
}

console.log('\n🔍 Verifying Google OAuth Improvements...\n');

// Check 1: Enhanced Error Logging in google-contacts-sync.ts
console.log('📝 Check 1: Enhanced Error Logging');
const syncServicePath = 'src/services/google-contacts-sync.ts';
check(
  'google-contacts-sync.ts exists',
  fileExists(syncServicePath),
  'File not found'
);
check(
  'Contains enhanced API call logging',
  fileContains(syncServicePath, '[GoogleContactsSync] API call completed:'),
  'Missing enhanced logging'
);
check(
  'Contains formatSyncError method',
  fileContains(syncServicePath, 'private formatSyncError(error: any): string'),
  'Missing formatSyncError method'
);
check(
  'Has user-friendly error messages',
  fileContains(syncServicePath, 'Authentication expired. Please reconnect your Google account.'),
  'Missing user-friendly error messages'
);

// Check 2: Token Refresh Synchronization in google-auth.ts
console.log('\n🔄 Check 2: Token Refresh Synchronization');
const googleAuthPath = 'src/utils/google-auth.ts';
check(
  'google-auth.ts exists',
  fileExists(googleAuthPath),
  'File not found'
);
check(
  'Has tokenRefreshPromises map',
  fileContains(googleAuthPath, 'private tokenRefreshPromises: Map<string, Promise<void>>'),
  'Missing tokenRefreshPromises map'
);
check(
  'Waits for existing refresh',
  fileContains(googleAuthPath, 'Waiting for existing token refresh to complete'),
  'Missing synchronization logic'
);
check(
  'Has getUserScopes method',
  fileContains(googleAuthPath, 'async getUserScopes(userId: string): Promise<string[] | null>'),
  'Missing getUserScopes method'
);
check(
  'Properly cleans up promises',
  fileContains(googleAuthPath, 'this.tokenRefreshPromises.delete(userId)'),
  'Missing cleanup logic'
);

// Check 3: API Timeout Protection in google-people-client.ts
console.log('\n⏱️  Check 3: API Timeout Protection');
const peopleClientPath = 'src/integrations/google-people-client.ts';
check(
  'google-people-client.ts exists',
  fileExists(peopleClientPath),
  'File not found'
);
check(
  'Has API_TIMEOUT_MS constant',
  fileContains(peopleClientPath, 'private readonly API_TIMEOUT_MS = 30000'),
  'Missing timeout constant'
);
check(
  'Has callWithTimeout method',
  fileContains(peopleClientPath, 'private async callWithTimeout<T>(promise: Promise<T>'),
  'Missing callWithTimeout method'
);
check(
  'Uses timeout in getAllContacts',
  fileContains(peopleClientPath, 'await this.callWithTimeout('),
  'Not using timeout wrapper'
);
check(
  'Has enhanced error logging',
  fileContains(peopleClientPath, '[GooglePeopleClient] Raw error details:'),
  'Missing enhanced error logging'
);
check(
  'Logs performance metrics',
  fileContains(peopleClientPath, 'durationMs:'),
  'Missing performance metrics'
);

// Check 4: Scope Validation in sync route
console.log('\n🔐 Check 4: Scope Validation');
const syncRoutePath = 'web/app/api/google/contacts/sync/route.ts';
check(
  'sync route exists',
  fileExists(syncRoutePath),
  'File not found'
);
check(
  'Calls getUserScopes',
  fileContains(syncRoutePath, 'await googleAuth.getUserScopes(userEmail)'),
  'Not validating scopes'
);
check(
  'Checks for contacts scope',
  fileContains(syncRoutePath, "userScopes?.includes('https://www.googleapis.com/auth/contacts')"),
  'Not checking contacts scope'
);
check(
  'Returns requiresReconnect flag',
  fileContains(syncRoutePath, 'requiresReconnect: true'),
  'Missing reconnect flag'
);
check(
  'Has sync timeout',
  fileContains(syncRoutePath, 'SYNC_TIMEOUT_MS = 60000'),
  'Missing sync timeout'
);
check(
  'Uses Promise.race for timeout',
  fileContains(syncRoutePath, 'await Promise.race([syncPromise, timeoutPromise])'),
  'Not using timeout race'
);

// Check 5: Type System Updates
console.log('\n📦 Check 5: Type System Updates');
const googleTypesPath = 'src/types/google.ts';
check(
  'google.ts types exist',
  fileExists(googleTypesPath),
  'File not found'
);
check(
  'SyncError has statusCode field',
  fileContains(googleTypesPath, 'statusCode?: number'),
  'Missing statusCode in SyncError'
);
check(
  'All error types have statusCode',
  fileContains(googleTypesPath, "type: 'AUTH_ERROR'; message: string; statusCode?: number"),
  'Not all error types have statusCode'
);

// Check 6: Documentation
console.log('\n📚 Check 6: Documentation');
check(
  'Fix report exists',
  fileExists('GOOGLE_OAUTH_FIX_REPORT.md'),
  'Missing fix report'
);
check(
  'Test checklist exists',
  fileExists('GOOGLE_OAUTH_TEST_CHECKLIST.md'),
  'Missing test checklist'
);
check(
  'Summary exists',
  fileExists('OAUTH_FIX_SUMMARY.md'),
  'Missing summary'
);

// Summary
console.log('\n' + '='.repeat(60));
const totalChecks = results.length;
const passedChecks = results.filter(r => r.passed).length;
const failedChecks = totalChecks - passedChecks;

console.log(`\n📊 Summary: ${passedChecks}/${totalChecks} checks passed`);

if (failedChecks > 0) {
  console.log(`\n❌ ${failedChecks} check(s) failed:\n`);
  results
    .filter(r => !r.passed)
    .forEach(r => {
      console.log(`  • ${r.name}: ${r.details}`);
    });
  console.log('\n');
  process.exit(1);
} else {
  console.log('\n✅ All OAuth improvements verified successfully!\n');
  console.log('Next steps:');
  console.log('  1. Build: npm run build');
  console.log('  2. Start web server: ./START_WEB_SERVER.sh');
  console.log('  3. Follow: GOOGLE_OAUTH_TEST_CHECKLIST.md');
  console.log('  4. Test with real Google OAuth flow\n');
  process.exit(0);
}
