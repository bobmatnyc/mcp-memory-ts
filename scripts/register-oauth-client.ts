#!/usr/bin/env tsx
/**
 * OAuth Client Registration Script
 * Interactive CLI tool to register OAuth clients (e.g., Claude.AI)
 */

import readline from 'readline';
import { initDatabaseFromEnv } from '../src/database/connection.js';
import {
  generateClientCredentials,
  hashSecret,
  storeOAuthClient,
} from '../src/utils/oauth.js';

// Create readline interface for interactive prompts
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(prompt: string): Promise<string> {
  return new Promise(resolve => {
    rl.question(prompt, answer => {
      resolve(answer.trim());
    });
  });
}

function parseArrayInput(input: string): string[] {
  return input
    .split(',')
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

async function registerClient(): Promise<void> {
  console.log('========================================');
  console.log('  OAuth 2.0 Client Registration Tool  ');
  console.log('========================================\n');

  try {
    // Get client information
    const name = await question('Client name (e.g., "Claude.AI Custom Connector"): ');
    if (!name) {
      throw new Error('Client name is required');
    }

    const redirectUrisInput = await question(
      'Redirect URIs (comma-separated, e.g., "https://claude.ai/oauth/callback"): '
    );
    const redirectUris = parseArrayInput(redirectUrisInput);
    if (redirectUris.length === 0) {
      throw new Error('At least one redirect URI is required');
    }

    const scopesInput = await question(
      'Allowed scopes (comma-separated, default: "memories:read,memories:write"): '
    );
    const allowedScopes =
      parseArrayInput(scopesInput).length > 0
        ? parseArrayInput(scopesInput)
        : ['memories:read', 'memories:write'];

    const createdBy = await question('Created by user ID (Clerk user ID): ');
    if (!createdBy) {
      throw new Error('User ID is required');
    }

    console.log('\n----------------------------------------');
    console.log('Client Configuration:');
    console.log('----------------------------------------');
    console.log(`Name: ${name}`);
    console.log(`Redirect URIs:\n  - ${redirectUris.join('\n  - ')}`);
    console.log(`Allowed Scopes: ${allowedScopes.join(', ')}`);
    console.log(`Created By: ${createdBy}`);
    console.log('----------------------------------------\n');

    const confirm = await question('Confirm registration? (yes/no): ');
    if (confirm.toLowerCase() !== 'yes' && confirm.toLowerCase() !== 'y') {
      console.log('Registration cancelled.');
      rl.close();
      return;
    }

    // Generate credentials
    console.log('\nGenerating client credentials...');
    const { clientId, clientSecret } = generateClientCredentials();

    console.log('Hashing client secret...');
    const clientSecretHash = await hashSecret(clientSecret);

    // Connect to database
    console.log('Connecting to database...');
    const db = initDatabaseFromEnv();
    await db.connect();

    // Store client
    console.log('Storing OAuth client...');
    await storeOAuthClient(db, {
      clientId,
      clientSecretHash,
      name,
      redirectUris,
      allowedScopes,
      createdBy,
      metadata: {
        registeredAt: new Date().toISOString(),
        registeredVia: 'cli',
      },
    });

    await db.disconnect();

    console.log('\n========================================');
    console.log('✅ OAuth Client Registered Successfully!');
    console.log('========================================\n');

    console.log('IMPORTANT: Store these credentials securely!');
    console.log('The client secret will NOT be shown again.\n');

    console.log('----------------------------------------');
    console.log('Client Credentials:');
    console.log('----------------------------------------');
    console.log(`Client ID:     ${clientId}`);
    console.log(`Client Secret: ${clientSecret}`);
    console.log('----------------------------------------\n');

    console.log('Configuration for Claude.AI Custom Connector:');
    console.log('----------------------------------------');
    console.log('Authorization URL: https://your-domain.com/api/oauth/authorize');
    console.log('Token URL:         https://your-domain.com/api/oauth/token');
    console.log(`Client ID:         ${clientId}`);
    console.log(`Client Secret:     ${clientSecret}`);
    console.log(`Scopes:            ${allowedScopes.join(' ')}`);
    console.log('----------------------------------------\n');

    console.log('Save these credentials now! Press Enter to exit...');
    await question('');

    rl.close();
  } catch (error) {
    console.error('\n❌ Registration failed:', error);
    rl.close();
    process.exit(1);
  }
}

// Handle Ctrl+C gracefully
rl.on('SIGINT', () => {
  console.log('\n\nRegistration cancelled.');
  rl.close();
  process.exit(0);
});

// Run registration
registerClient().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
