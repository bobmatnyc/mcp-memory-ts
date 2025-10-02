/**
 * Database schema initialization and migration
 */

import type { DatabaseConnection } from './connection.js';

export const SCHEMA_VERSION = 1;

/**
 * SQL statements for creating tables
 */
export const CREATE_TABLES = {
  users: `
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT,
      organization TEXT,
      api_key_hash TEXT,
      oauth_provider TEXT,
      oauth_id TEXT,
      is_active BOOLEAN DEFAULT 1,
      metadata TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `,

  entities: `
    CREATE TABLE IF NOT EXISTS entities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT,
      name TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      person_type TEXT,
      description TEXT,
      company TEXT,
      title TEXT,
      email TEXT,
      phone TEXT,
      address TEXT,
      website TEXT,
      social_media TEXT,
      notes TEXT,
      importance INTEGER DEFAULT 2,
      tags TEXT,
      relationships TEXT,
      last_interaction TEXT,
      interaction_count INTEGER DEFAULT 0,
      metadata TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `,

  memories: `
    CREATE TABLE IF NOT EXISTS memories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      memory_type TEXT NOT NULL,
      importance INTEGER DEFAULT 2,
      tags TEXT,
      entity_ids TEXT,
      embedding TEXT,
      metadata TEXT,
      is_archived BOOLEAN DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `,

  interactions: `
    CREATE TABLE IF NOT EXISTS interactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT,
      user_prompt TEXT NOT NULL,
      assistant_response TEXT NOT NULL,
      context TEXT,
      feedback TEXT,
      sentiment TEXT,
      metadata TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `,

  schema_version: `
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    )
  `,

  api_usage_tracking: `
    CREATE TABLE IF NOT EXISTS api_usage_tracking (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      api_provider TEXT NOT NULL CHECK(api_provider IN ('openai', 'openrouter')),
      model TEXT NOT NULL,
      tokens_used INTEGER NOT NULL DEFAULT 0,
      cost_usd REAL NOT NULL,
      operation_type TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      date TEXT NOT NULL,
      metadata TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `,
};

/**
 * SQL statements for creating indexes
 * OPTIMIZED: Reduced from 23 to 11 indexes by removing redundant single-column indexes
 * and using composite indexes that cover multiple query patterns
 */
export const CREATE_INDEXES = {
  users: [
    'CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)',
    'CREATE INDEX IF NOT EXISTS idx_users_api_key_hash ON users(api_key_hash)',
  ],
  entities: [
    // Composite indexes cover most query patterns
    'CREATE INDEX IF NOT EXISTS idx_entities_user_type ON entities(user_id, entity_type)',
    'CREATE INDEX IF NOT EXISTS idx_entities_user_importance ON entities(user_id, importance DESC)',
  ],
  memories: [
    // Composite indexes optimized for common queries
    'CREATE INDEX IF NOT EXISTS idx_memories_user_type ON memories(user_id, memory_type)',
    'CREATE INDEX IF NOT EXISTS idx_memories_user_importance ON memories(user_id, importance DESC)',
    'CREATE INDEX IF NOT EXISTS idx_memories_user_archived ON memories(user_id, is_archived)',
    'CREATE INDEX IF NOT EXISTS idx_memories_created ON memories(created_at DESC)',
  ],
  interactions: [
    // Composite index for date-based queries
    'CREATE INDEX IF NOT EXISTS idx_interactions_user_date ON interactions(user_id, DATE(created_at))',
  ],
  api_usage_tracking: [
    // Single comprehensive composite index covers all query patterns
    'CREATE INDEX IF NOT EXISTS idx_usage_user_provider_date ON api_usage_tracking(user_id, api_provider, date)',
  ],
};

/**
 * Full-text search virtual tables
 */
export const CREATE_FTS_TABLES = {
  memories_fts: `
    CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(
      title, content, tags,
      content='memories',
      content_rowid='id'
    )
  `,
  entities_fts: `
    CREATE VIRTUAL TABLE IF NOT EXISTS entities_fts USING fts5(
      name, description, notes, tags,
      content='entities',
      content_rowid='id'
    )
  `,
};

/**
 * FTS triggers to keep search tables in sync
 */
export const CREATE_FTS_TRIGGERS = {
  memories: [
    `CREATE TRIGGER IF NOT EXISTS memories_fts_insert AFTER INSERT ON memories BEGIN
      INSERT INTO memories_fts(rowid, title, content, tags) 
      VALUES (new.id, new.title, new.content, new.tags);
    END`,
    `CREATE TRIGGER IF NOT EXISTS memories_fts_delete AFTER DELETE ON memories BEGIN
      DELETE FROM memories_fts WHERE rowid = old.id;
    END`,
    `CREATE TRIGGER IF NOT EXISTS memories_fts_update AFTER UPDATE ON memories BEGIN
      DELETE FROM memories_fts WHERE rowid = old.id;
      INSERT INTO memories_fts(rowid, title, content, tags) 
      VALUES (new.id, new.title, new.content, new.tags);
    END`,
  ],
  entities: [
    `CREATE TRIGGER IF NOT EXISTS entities_fts_insert AFTER INSERT ON entities BEGIN
      INSERT INTO entities_fts(rowid, name, description, notes, tags) 
      VALUES (new.id, new.name, new.description, new.notes, new.tags);
    END`,
    `CREATE TRIGGER IF NOT EXISTS entities_fts_delete AFTER DELETE ON entities BEGIN
      DELETE FROM entities_fts WHERE rowid = old.id;
    END`,
    `CREATE TRIGGER IF NOT EXISTS entities_fts_update AFTER UPDATE ON entities BEGIN
      DELETE FROM entities_fts WHERE rowid = old.id;
      INSERT INTO entities_fts(rowid, name, description, notes, tags) 
      VALUES (new.id, new.name, new.description, new.notes, new.tags);
    END`,
  ],
};

/**
 * Initialize the database schema
 */
export async function initializeSchema(db: DatabaseConnection): Promise<void> {
  console.error('Initializing database schema...');

  try {
    // Check current schema version
    const currentVersion = await getCurrentSchemaVersion(db);

    if (currentVersion >= SCHEMA_VERSION) {
      console.error(`Schema is up to date (version ${currentVersion})`);
      return;
    }

    // Create tables
    for (const [tableName, sql] of Object.entries(CREATE_TABLES)) {
      console.error(`Creating table: ${tableName}`);
      await db.execute(sql);
    }

    // Create indexes
    for (const [tableName, indexes] of Object.entries(CREATE_INDEXES)) {
      console.error(`Creating indexes for: ${tableName}`);
      for (const indexSql of indexes) {
        await db.execute(indexSql);
      }
    }

    // Create FTS tables
    for (const [tableName, sql] of Object.entries(CREATE_FTS_TABLES)) {
      console.error(`Creating FTS table: ${tableName}`);
      await db.execute(sql);
    }

    // Create FTS triggers
    for (const [tableName, triggers] of Object.entries(CREATE_FTS_TRIGGERS)) {
      console.error(`Creating FTS triggers for: ${tableName}`);
      for (const triggerSql of triggers) {
        await db.execute(triggerSql);
      }
    }

    // Update schema version
    await db.execute('INSERT OR REPLACE INTO schema_version (version, applied_at) VALUES (?, ?)', [
      SCHEMA_VERSION,
      new Date().toISOString(),
    ]);

    console.error(`Schema initialized successfully (version ${SCHEMA_VERSION})`);
  } catch (error) {
    console.error('Failed to initialize schema:', error);
    throw error;
  }
}

/**
 * Get the current schema version
 */
async function getCurrentSchemaVersion(db: DatabaseConnection): Promise<number> {
  try {
    const result = await db.execute(
      'SELECT version FROM schema_version ORDER BY version DESC LIMIT 1'
    );
    return result.rows.length > 0 ? (result.rows[0] as any).version : 0;
  } catch {
    // Table doesn't exist yet
    return 0;
  }
}

/**
 * Drop all tables (for testing/reset)
 */
export async function dropAllTables(db: DatabaseConnection): Promise<void> {
  console.error('Dropping all tables...');

  const tables = [
    'memories_fts',
    'entities_fts',
    'interactions',
    'memories',
    'entities',
    'api_usage_tracking',
    'users',
    'schema_version',
  ];

  for (const table of tables) {
    try {
      await db.execute(`DROP TABLE IF EXISTS ${table}`);
      console.error(`Dropped table: ${table}`);
    } catch (error) {
      console.error(`Failed to drop table ${table}:`, error);
    }
  }
}
