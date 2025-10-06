import { DatabaseConnection } from '../../src/database/connection.js';
import type { DatabaseConfig } from '../../src/types/base.js';

/**
 * Create a database connection with user-specific credentials
 * NOTE: This function is no longer used directly in the web app.
 * Database connections are now created per-request using user credentials from Clerk metadata.
 * See lib/auth.ts getMemoryCore() for the new implementation.
 *
 * @param tursoUrl - Turso database URL
 * @param tursoAuthToken - Turso authentication token
 * @returns DatabaseConnection instance
 */
export function createDbConnection(tursoUrl: string, tursoAuthToken: string): DatabaseConnection {
  const dbConfig: DatabaseConfig = {
    url: tursoUrl,
    authToken: tursoAuthToken,
  };

  return new DatabaseConnection(dbConfig);
}
