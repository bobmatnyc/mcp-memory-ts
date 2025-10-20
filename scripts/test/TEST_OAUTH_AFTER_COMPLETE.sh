#!/bin/bash
# Test OAuth Token Storage After Completing OAuth Flow
# Run this AFTER you complete the Google OAuth flow in the browser

cd "$(dirname "$0")"

echo "========================================"
echo "  POST-OAUTH VERIFICATION"
echo "========================================"
echo ""
echo "Checking if Google OAuth tokens were stored..."
echo ""

npx tsx << 'EOF'
import { createClient } from '@libsql/client';
import * as dotenv from 'dotenv';

dotenv.config();

const client = createClient({
  url: process.env.TURSO_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

async function check() {
  const CLERK_ID = 'user_33ZB97Sz4n775IAjl8pY5YZHqYd';

  const user = await client.execute({
    sql: 'SELECT id, email, metadata FROM users WHERE id = ?',
    args: [CLERK_ID]
  });

  if (user.rows.length === 0) {
    console.log('❌ User not found in database');
    await client.close();
    process.exit(1);
  }

  console.log('✅ User found');
  console.log('   ID:', user.rows[0].id);
  console.log('   Email:', user.rows[0].email);
  console.log('');

  const metadata = user.rows[0].metadata;
  if (!metadata) {
    console.log('❌ No metadata found');
    console.log('');
    console.log('This means OAuth callback did not store tokens.');
    console.log('Please check:');
    console.log('1. Did OAuth flow complete successfully?');
    console.log('2. Did you see ?google_connected=true in the URL?');
    console.log('3. Check PM2 logs: pm2 logs mcp-memory-web-3002');
    await client.close();
    process.exit(1);
  }

  try {
    const parsed = JSON.parse(metadata as string);

    if (parsed.googleOAuthTokens) {
      console.log('✅✅✅ SUCCESS! Google OAuth tokens stored!');
      console.log('');
      console.log('Token details:');
      console.log('   Connected at:', parsed.googleOAuthConnectedAt);
      console.log('   Has access_token:', !!parsed.googleOAuthTokens.access_token ? '✓' : '✗');
      console.log('   Has refresh_token:', !!parsed.googleOAuthTokens.refresh_token ? '✓' : '✗');
      console.log('   Token type:', parsed.googleOAuthTokens.token_type || 'N/A');
      console.log('   Scope:', parsed.googleOAuthTokens.scope || 'N/A');
      console.log('');
      console.log('🎉 OAuth integration is working!');
      console.log('');
      console.log('Next steps:');
      console.log('1. Test Google Contacts sync:');
      console.log('   mcp-memory google contacts-sync --user-email bob@matsuoka.com --direction import --dry-run');
      console.log('');
      console.log('2. Test Google Calendar sync:');
      console.log('   mcp-memory google calendar-sync --user-email bob@matsuoka.com');
    } else {
      console.log('❌ No Google OAuth tokens in metadata');
      console.log('');
      console.log('Metadata keys found:', Object.keys(parsed).join(', '));
      console.log('');
      console.log('OAuth callback may have encountered an error.');
      console.log('Check logs: pm2 logs mcp-memory-web-3002');
    }
  } catch (e) {
    console.log('❌ Failed to parse metadata:', e);
  }

  await client.close();
}

check();
EOF
