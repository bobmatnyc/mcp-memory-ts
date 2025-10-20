#!/usr/bin/env node
/**
 * Check Google OAuth Connected Users
 *
 * Lists all users who have connected their Google account and shows
 * their OAuth token status.
 */

import { DatabaseConnection } from '../src/database/connection.js';
import dotenv from 'dotenv';

dotenv.config();

async function checkGoogleOAuthUsers() {
  const db = new DatabaseConnection({
    url: process.env.TURSO_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN!,
  });

  try {
    await db.connect();
    console.log('Connected to database\n');

    // Get all users
    const result = await db.execute('SELECT id, email, name, metadata FROM users');
    console.log(`Total users in database: ${result.rows.length}\n`);

    if (result.rows.length === 0) {
      console.log('No users found in database');
      return;
    }

    console.log('Checking for Google OAuth connections...\n');
    console.log('='.repeat(80));

    let connectedCount = 0;

    for (const row of result.rows as any[]) {
      let metadata: any = {};
      if (row.metadata) {
        try {
          metadata = typeof row.metadata === 'string'
            ? JSON.parse(row.metadata)
            : row.metadata;
        } catch (error) {
          console.log(`⚠️  User ${row.email}: Invalid metadata format`);
          continue;
        }
      }

      const googleTokens = metadata.googleOAuthTokens;

      if (googleTokens && googleTokens.access_token) {
        connectedCount++;
        console.log(`\n✓ ${row.email} (${row.name || 'No name'})`);
        console.log(`  User ID: ${row.id}`);
        console.log(`  Access Token: ${googleTokens.access_token.substring(0, 20)}...`);
        console.log(`  Refresh Token: ${googleTokens.refresh_token ? 'Present' : 'Missing'}`);
        console.log(`  Scopes: ${googleTokens.scope || 'None'}`);

        if (googleTokens.expiry_date) {
          const expiryDate = new Date(googleTokens.expiry_date);
          const now = new Date();
          const isExpired = expiryDate < now;

          console.log(`  Expiry: ${expiryDate.toISOString()} ${isExpired ? '(EXPIRED)' : '(Valid)'}`);
        }

        if (metadata.googleOAuthConnectedAt) {
          console.log(`  Connected At: ${metadata.googleOAuthConnectedAt}`);
        }
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log(`\nSummary: ${connectedCount} of ${result.rows.length} users have Google OAuth connected`);

    if (connectedCount === 0) {
      console.log('\nNo users have connected Google OAuth yet.');
      console.log('To connect:');
      console.log('  1. Start web server: cd web && npm run dev');
      console.log('  2. Visit settings page');
      console.log('  3. Click "Connect Google Account"');
    } else {
      console.log('\nYou can test Gmail extraction with these users.');
      console.log('Use DEFAULT_USER_EMAIL in .env to specify which user to test with.');
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

checkGoogleOAuthUsers().catch(console.error);
