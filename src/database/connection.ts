/**
 * Database connection and configuration for Turso/LibSQL
 */

import { createClient, type Client } from '@libsql/client';
import type { DatabaseConfig } from '../types/base.js';

export class DatabaseConnection {
  private client: Client | null = null;
  private config: DatabaseConfig;

  constructor(config: DatabaseConfig) {
    this.config = config;
  }

  /**
   * Initialize the database connection
   */
  async connect(): Promise<void> {
    if (this.client) {
      return; // Already connected
    }

    try {
      this.client = createClient({
        url: this.config.url,
        authToken: this.config.authToken,
        syncUrl: this.config.syncUrl,
      });

      // Test the connection
      await this.client.execute('SELECT 1');
      console.error('Database connected successfully');
    } catch (error) {
      console.error('Failed to connect to database:', error);
      throw new Error(`Database connection failed: ${error}`);
    }
  }

  /**
   * Get the database client
   */
  getClient(): Client {
    if (!this.client) {
      throw new Error('Database not connected. Call connect() first.');
    }
    return this.client;
  }

  /**
   * Close the database connection
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      this.client.close();
      this.client = null;
      console.error('Database disconnected');
    }
  }

  /**
   * Execute a query with parameters
   */
  async execute(sql: string, params?: any[]): Promise<any> {
    const client = this.getClient();
    try {
      const result = await client.execute({
        sql,
        args: params || [],
      });
      return result;
    } catch (error) {
      console.error('Database query error:', error);
      throw error;
    }
  }

  /**
   * Execute multiple queries in a transaction
   */
  async transaction(queries: Array<{ sql: string; params?: any[] }>): Promise<any[]> {
    const client = this.getClient();
    try {
      const results = await client.batch(
        queries.map(query => ({
          sql: query.sql,
          args: query.params || [],
        }))
      );
      return results;
    } catch (error) {
      console.error('Database transaction error:', error);
      throw error;
    }
  }

  /**
   * Check if the database is connected
   */
  isConnected(): boolean {
    return this.client !== null;
  }

  /**
   * Sync the database (for embedded replicas)
   */
  async sync(): Promise<void> {
    if (this.client && 'sync' in this.client) {
      try {
        await (this.client as any).sync();
        console.error('Database synced successfully');
      } catch (error) {
        console.error('Database sync error:', error);
        throw error;
      }
    }
  }
}

// Singleton instance
let dbInstance: DatabaseConnection | null = null;

/**
 * Get or create the database connection instance
 */
export function getDatabase(config?: DatabaseConfig): DatabaseConnection {
  if (!dbInstance && config) {
    dbInstance = new DatabaseConnection(config);
  }
  
  if (!dbInstance) {
    throw new Error('Database not initialized. Provide config on first call.');
  }
  
  return dbInstance;
}

/**
 * Initialize database from environment variables
 */
export function initDatabaseFromEnv(): DatabaseConnection {
  const config: DatabaseConfig = {
    url: process.env.TURSO_URL || process.env.DATABASE_URL || '',
    authToken: process.env.TURSO_AUTH_TOKEN || process.env.DATABASE_AUTH_TOKEN || '',
    syncUrl: process.env.TURSO_SYNC_URL,
  };

  if (!config.url) {
    throw new Error(
      'Database configuration missing. Set TURSO_URL environment variable.'
    );
  }

  // For local file databases, auth token is not required
  if (!config.url.startsWith('file:') && !config.authToken) {
    throw new Error(
      'Database auth token missing. Set TURSO_AUTH_TOKEN environment variable for remote databases.'
    );
  }

  return getDatabase(config);
}
