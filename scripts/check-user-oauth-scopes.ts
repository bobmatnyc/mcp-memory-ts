#!/usr/bin/env node
/**
 * Check User OAuth Scopes
 *
 * Investigates what OAuth scopes are stored for a user to debug "Permission denied" errors
 */

import { initDatabaseFromEnv } from '../src/database/connection.js';
import { DatabaseOperations } from '../src/database/operations.js';

async function checkUserOAuthScopes() {
  const db = initDatabaseFromEnv();
  await db.connect();
  const ops = new DatabaseOperations(db);

  try {
    // Get all users
    const result = await db.execute('SELECT * FROM users');

    console.log('\n=== User OAuth Scopes Analysis ===\n');

    for (const row of result.rows) {
      const user = row as any;
      console.log(`User: ${user.email} (ID: ${user.id})`);
      console.log(`  Active: ${user.is_active}`);
      console.log(`  Created: ${user.created_at}`);

      if (user.metadata) {
        try {
          const metadata = typeof user.metadata === 'string'
            ? JSON.parse(user.metadata)
            : user.metadata;

          if (metadata.googleOAuthTokens) {
            const tokens = metadata.googleOAuthTokens;
            console.log('\n  Google OAuth Tokens:');
            console.log(`    Has access_token: ${!!tokens.access_token}`);
            console.log(`    Has refresh_token: ${!!tokens.refresh_token}`);
            console.log(`    Token type: ${tokens.token_type}`);
            console.log(`    Expiry date: ${new Date(tokens.expiry_date).toISOString()}`);
            console.log(`    Expired: ${tokens.expiry_date < Date.now()}`);

            // Parse scopes
            const scopes = tokens.scope ? tokens.scope.split(' ').filter((s: string) => s.length > 0) : [];
            console.log(`\n  Granted Scopes (${scopes.length}):`);
            scopes.forEach((scope: string) => {
              console.log(`    - ${scope}`);
            });

            // Check for required scopes
            console.log('\n  Required Scopes Check:');
            const requiredScopes = {
              'Contacts': 'https://www.googleapis.com/auth/contacts',
              'Calendar (readonly)': 'https://www.googleapis.com/auth/calendar.readonly',
              'Gmail (readonly)': 'https://www.googleapis.com/auth/gmail.readonly',
            };

            for (const [name, scope] of Object.entries(requiredScopes)) {
              const hasScope = scopes.includes(scope);
              console.log(`    ${name}: ${hasScope ? '✓' : '✗'} ${hasScope ? 'GRANTED' : 'MISSING'}`);
            }

            // Check for sync tokens
            if (metadata.googleContactsSyncToken) {
              console.log('\n  Google Contacts Sync Token: Present');
            } else {
              console.log('\n  Google Contacts Sync Token: Not set (first sync)');
            }

            if (metadata.googleCalendarSyncToken) {
              console.log('  Google Calendar Sync Token: Present');
            } else {
              console.log('  Google Calendar Sync Token: Not set (first sync)');
            }
          } else {
            console.log('\n  No Google OAuth tokens found');
          }
        } catch (parseError) {
          console.log(`  Error parsing metadata: ${parseError}`);
        }
      } else {
        console.log('  No metadata');
      }

      console.log('\n' + '='.repeat(70) + '\n');
    }

    console.log('Analysis complete!\n');

  } catch (error) {
    console.error('Error checking user OAuth scopes:', error);
    throw error;
  }
}

checkUserOAuthScopes()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
  });
