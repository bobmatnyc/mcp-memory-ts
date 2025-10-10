/**
 * Google Contacts Sync CLI Command
 *
 * CLI command for syncing contacts with Google Contacts.
 * Supports incremental sync, LLM deduplication, and dry-run mode.
 */

import { GoogleContactsSyncService } from '../../services/google-contacts-sync.js';
import { GoogleAuthService, GOOGLE_SCOPES } from '../../utils/google-auth.js';
import { DatabaseConnection } from '../../database/connection.js';
import { DatabaseOperations } from '../../database/operations.js';
import { colors, icons } from '../colors.js';
import { loadUserConfig } from '../claude-desktop.js';

export interface GoogleContactsSyncCommandOptions {
  userEmail: string;
  direction: 'export' | 'import' | 'both';
  dryRun?: boolean;
  forceFull?: boolean;
  noLlm?: boolean;
  threshold?: number;
}

/**
 * Google Contacts Sync Command
 */
export async function googleContactsSyncCommand(
  options: GoogleContactsSyncCommandOptions
): Promise<void> {
  console.log(`\n${icons.cloud} ${colors.title('Google Contacts Sync')}`);
  console.log(`${colors.dim('User:')} ${options.userEmail}`);
  console.log(`${colors.dim('Direction:')} ${options.direction}`);
  console.log(`${colors.dim('Mode:')} ${options.dryRun ? 'DRY RUN' : 'EXECUTE'}\n`);

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
    console.error('Set TURSO_URL and TURSO_AUTH_TOKEN environment variables.');
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

    // Initialize services
    const googleAuth = new GoogleAuthService(dbOps, clientId, clientSecret, redirectUri);
    const syncService = new GoogleContactsSyncService(dbOps, googleAuth);

    // Check if user is connected to Google
    const isConnected = await googleAuth.isConnected(options.userEmail);
    if (!isConnected) {
      console.error(`${icons.error} Google account not connected.`);
      console.error('Connect your Google account via the web interface first.');
      console.error(`Visit: ${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/settings`);
      process.exit(1);
    }

    // Verify required scopes
    const hasScopes = await googleAuth.hasRequiredScopes(options.userEmail, [
      GOOGLE_SCOPES.CONTACTS,
    ]);

    if (!hasScopes) {
      console.error(`${icons.error} Missing required Google Contacts permission.`);
      console.error('Reconnect your Google account with Contacts access.');
      process.exit(1);
    }

    console.log(`${icons.success} Google account connected\n`);

    // Run sync
    const result = await syncService.sync({
      userId: options.userEmail,
      direction: options.direction,
      dryRun: options.dryRun,
      forceFull: options.forceFull,
      enableLLMDedup: !options.noLlm,
      deduplicationThreshold: options.threshold,
    });

    // Print results
    console.log(`\n${colors.title('=== Sync Results ===')}`);
    console.log(`${colors.dim('Imported:')} ${result.imported}`);
    console.log(`${colors.dim('Exported:')} ${result.exported}`);
    console.log(`${colors.dim('Updated:')} ${result.updated}`);
    console.log(`${colors.dim('Duplicates found:')} ${result.duplicatesFound}`);
    console.log(`${colors.dim('Merged:')} ${result.merged}`);

    if (result.errors.length > 0) {
      console.log(`\n${colors.warning('Errors:')}`);
      result.errors.slice(0, 10).forEach(err => {
        console.log(`  ${colors.error('•')} ${err}`);
      });
      if (result.errors.length > 10) {
        console.log(`  ${colors.dim(`... and ${result.errors.length - 10} more`)}`);
      }
    }

    if (result.success) {
      console.log(`\n${icons.success} ${colors.success('Sync completed successfully!')}`);
    } else {
      console.log(`\n${icons.error} ${colors.error('Sync completed with errors')}`);
      process.exit(1);
    }
  } catch (error) {
    console.error(`\n${icons.error} ${colors.error('Sync failed:')}`);
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  } finally {
    await db.disconnect();
  }
}
