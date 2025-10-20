#!/usr/bin/env tsx
/**
 * Register Claude.AI as OAuth client (non-interactive)
 */

import { createClient } from '@libsql/client';
import { generateClientCredentials, hashSecret } from '../src/utils/oauth.js';

async function registerClient() {
  console.log('========================================');
  console.log('  Claude.AI OAuth Client Registration  ');
  console.log('========================================\n');

  const dbUrl = process.env.TURSO_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  const userEmail = process.env.DEFAULT_USER_EMAIL;

  if (!dbUrl || !authToken || !userEmail) {
    console.error('❌ Missing required environment variables');
    console.error('Required: TURSO_URL, TURSO_AUTH_TOKEN, DEFAULT_USER_EMAIL');
    process.exit(1);
  }

  try {
    const client = createClient({ url: dbUrl, authToken });

    // Get user ID from email
    console.log(`Looking up user: ${userEmail}...`);
    const userResult = await client.execute({
      sql: 'SELECT id FROM users WHERE email = ?',
      args: [userEmail],
    });

    if (userResult.rows.length === 0) {
      console.error(`❌ User not found: ${userEmail}`);
      process.exit(1);
    }

    const userId = userResult.rows[0].id as string;
    console.log(`✓ Found user ID: ${userId}\n`);

    // Client configuration
    const clientName = 'Claude.AI Custom Connector';
    const redirectUris = [
      'https://claude.ai/oauth/callback',
      'https://claude.ai/callback'
    ];
    const allowedScopes = [
      'memories:read',
      'memories:write',
      'entities:read',
      'entities:write'
    ];

    console.log('Client Configuration:');
    console.log(`  Name: ${clientName}`);
    console.log(`  Redirect URIs: ${redirectUris.join(', ')}`);
    console.log(`  Scopes: ${allowedScopes.join(', ')}`);
    console.log('');

    // Generate credentials
    console.log('Generating credentials...');
    const { clientId, clientSecret } = await generateClientCredentials();
    const secretHash = await hashSecret(clientSecret);
    console.log(`✓ Generated client ID: ${clientId}\n`);

    // Store in database
    console.log('Storing client in database...');
    await client.execute({
      sql: `INSERT INTO oauth_clients (
        client_id,
        client_secret_hash,
        name,
        redirect_uris,
        allowed_scopes,
        created_at,
        created_by,
        is_active,
        metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        clientId,
        secretHash,
        clientName,
        JSON.stringify(redirectUris),
        JSON.stringify(allowedScopes),
        new Date().toISOString(),
        userId,
        1,
        JSON.stringify({ description: 'Claude.AI MCP custom connector integration' })
      ],
    });

    console.log('✓ Client registered successfully!\n');

    console.log('========================================');
    console.log('     SAVE THESE CREDENTIALS NOW!      ');
    console.log('========================================\n');
    console.log(`Client ID:     ${clientId}`);
    console.log(`Client Secret: ${clientSecret}`);
    console.log('');
    console.log('⚠️  The client secret will NOT be shown again!');
    console.log('   Save it in a secure location immediately.');
    console.log('');
    console.log('========================================');
    console.log('  Next Steps - Configure Claude.AI    ');
    console.log('========================================\n');
    console.log('1. Open Claude.AI Settings → Custom Connectors');
    console.log('2. Add new connector with these values:\n');
    console.log('   Name: MCP Memory TypeScript');
    console.log('   Authorization URL: https://ai-memory.app/api/oauth/authorize');
    console.log('   Token URL: https://ai-memory.app/api/oauth/token');
    console.log(`   Client ID: ${clientId}`);
    console.log(`   Client Secret: ${clientSecret}`);
    console.log('   Scopes: memories:read memories:write entities:read entities:write');
    console.log('   MCP Endpoint: https://ai-memory.app/api/mcp');
    console.log('');
    console.log('See docs/oauth-implementation/CLAUDE_AI_CONNECTOR_CONFIG.md');
    console.log('for detailed configuration instructions.');
    console.log('');

    client.close();
    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ Registration failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

registerClient();
