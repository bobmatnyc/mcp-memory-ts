/**
 * Google Auth CLI Command
 *
 * CLI command for managing Google OAuth connection.
 * Provides status check and disconnect functionality.
 */

import { GoogleAuthService, GOOGLE_SCOPES } from '../../utils/google-auth.js';
import { DatabaseConnection } from '../../database/connection.js';
import { DatabaseOperations } from '../../database/operations.js';
import { colors, icons } from '../colors.js';
import { loadUserConfig } from '../claude-desktop.js';

export interface GoogleAuthCommandOptions {
  userEmail: string;
  action: 'status' | 'disconnect';
}

/**
 * Google Auth Status Command
 */
export async function googleAuthCommand(options: GoogleAuthCommandOptions): Promise<void> {
  console.log(`\n${icons.key} ${colors.title('Google OAuth Management')}`);
  console.log(`${colors.dim('User:')} ${options.userEmail}\n`);

  // Load configuration
  const config = loadUserConfig();
  if (!config) {
    console.error(`${icons.error} Configuration not found. Run "mcp-memory init" first.`);
    process.exit(1);
  }

  // Connect to database
  const dbUrl = process.env.TURSO_URL || config.tursoUrl;
  const authToken = process.env.TURSO_AUTH_TOKEN || config.tursoAuthToken;

  if (!dbUrl || !authToken) {
    console.error(`${icons.error} Database configuration missing.`);
    process.exit(1);
  }

  const db = new DatabaseConnection({ url: dbUrl, authToken });
  await db.connect();

  const dbOps = new DatabaseOperations(db);

  try {
    // Check Google Client credentials
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/auth/google-connect/callback';

    if (!clientId || !clientSecret) {
      console.error(`${icons.error} Google OAuth credentials not configured.`);
      console.error('Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables.');
      process.exit(1);
    }

    // Initialize service
    const googleAuth = new GoogleAuthService(dbOps, clientId, clientSecret, redirectUri);

    if (options.action === 'status') {
      // Check connection status
      const isConnected = await googleAuth.isConnected(options.userEmail);

      if (!isConnected) {
        console.log(`${icons.cross} ${colors.warning('Not connected to Google')}`);
        console.log('');
        console.log('To connect your Google account:');
        console.log(`  1. Visit: ${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/settings`);
        console.log('  2. Click "Connect Google Account"');
        console.log('  3. Grant required permissions');
        process.exit(0);
      }

      console.log(`${icons.success} ${colors.success('Connected to Google')}\n`);

      // Check scopes
      const scopes = [
        { name: 'Contacts', scope: GOOGLE_SCOPES.CONTACTS },
        { name: 'Calendar (read-only)', scope: GOOGLE_SCOPES.CALENDAR_READONLY },
        { name: 'Gmail (read-only)', scope: GOOGLE_SCOPES.GMAIL_READONLY },
      ];

      console.log(`${colors.title('Granted Permissions:')}`);

      for (const { name, scope } of scopes) {
        const hasScope = await googleAuth.hasRequiredScopes(options.userEmail, [scope]);
        const status = hasScope ? `${icons.success} ${colors.success('✓')}` : `${icons.cross} ${colors.dim('✗')}`;
        console.log(`  ${status} ${name}`);
      }

      // Get user metadata for connection time
      let user = await dbOps.getUserByEmail(options.userEmail);
      if (!user) {
        user = await dbOps.getUserById(options.userEmail);
      }

      if (user?.metadata?.googleOAuthConnectedAt) {
        const connectedAt = new Date(user.metadata.googleOAuthConnectedAt as string);
        console.log('');
        console.log(`${colors.dim('Connected since:')} ${connectedAt.toLocaleString()}`);
      }

      console.log('');
      console.log(`${colors.dim('To disconnect:')} mcp-memory google-auth --user-email ${options.userEmail} --action disconnect`);
    } else if (options.action === 'disconnect') {
      // Disconnect from Google
      const isConnected = await googleAuth.isConnected(options.userEmail);

      if (!isConnected) {
        console.log(`${icons.info} Already disconnected from Google`);
        process.exit(0);
      }

      console.log(`${icons.warning} Disconnecting from Google...`);
      console.log('This will:');
      console.log('  • Revoke OAuth access');
      console.log('  • Remove stored tokens');
      console.log('  • Clear sync tokens');
      console.log('');

      const result = await googleAuth.revokeAccess(options.userEmail);

      if (!result.ok) {
        console.error(`${icons.error} Failed to disconnect: ${result.error.message}`);
        process.exit(1);
      }

      console.log(`${icons.success} ${colors.success('Successfully disconnected from Google')}`);
      console.log('');
      console.log('Your data remains in the database.');
      console.log(`To reconnect, visit: ${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/settings`);
    }
  } catch (error) {
    console.error(`\n${icons.error} ${colors.error('Command failed:')}`);
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  } finally {
    await db.disconnect();
  }
}
