# Database Investigation Tools

This directory contains tools for investigating and debugging the MCP Memory database.

## Quick Start

All tools require the following environment variables:
```bash
TURSO_URL=libsql://your-database.turso.io
TURSO_AUTH_TOKEN=your-auth-token
```

These are automatically loaded from `.env` file in the project root.

---

## Investigation Tools

### 1. 🔍 `investigate-memory-users.ts` - Full Database Investigation

Comprehensive tool that checks:
- All users and their memory counts
- Orphaned memories (NULL or invalid user_id)
- Duplicate memories
- Detailed user information
- Database statistics

**Usage:**
```bash
# Full investigation
npx tsx tools/investigate-memory-users.ts

# Investigate specific user
npx tsx tools/investigate-memory-users.ts --user bob@matsuoka.com

# Save output to file
npx tsx tools/investigate-memory-users.ts --user bob@matsuoka.com > investigation.log
```

**What it checks:**
- ✅ User existence and status
- ✅ Memory counts (total, active, archived)
- ✅ Orphaned records (NULL user_id)
- ✅ Invalid user references
- ✅ Duplicate detection
- ✅ Entity associations
- ✅ Database health statistics

---

### 2. 📊 `query-db.ts` - Custom SQL Query Runner

Simple tool to run any SQL query against the database.

**Usage:**
```bash
# Basic query
npx tsx tools/query-db.ts "SELECT * FROM users"

# Parameterized query
npx tsx tools/query-db.ts "SELECT * FROM memories WHERE user_id = ?" user-id-here

# Count query
npx tsx tools/query-db.ts "SELECT COUNT(*) as count FROM memories"
```

**Common Queries:**

```bash
# List all users
npx tsx tools/query-db.ts "SELECT id, email, name FROM users"

# Count memories per user
npx tsx tools/query-db.ts "SELECT user_id, COUNT(*) FROM memories GROUP BY user_id"

# Find user by email
npx tsx tools/query-db.ts "SELECT * FROM users WHERE email = ?" bob@matsuoka.com

# Get user's memories
npx tsx tools/query-db.ts "SELECT id, title, memory_type, created_at FROM memories WHERE user_id = ? ORDER BY created_at DESC" 34183aef-dce1-4e2a-8b97-2dac8d0e1f75

# Check for orphaned memories
npx tsx tools/query-db.ts "SELECT COUNT(*) FROM memories WHERE user_id IS NULL"

# Find duplicates
npx tsx tools/query-db.ts "SELECT user_id, title, COUNT(*) as count FROM memories GROUP BY user_id, title, content HAVING count > 1"

# Check schema
npx tsx tools/query-db.ts "SELECT name, type FROM pragma_table_info('memories')"
```

---

### 3. 👥 `check-users.ts` - User Table Check

Check all users in the database and their associated memories.

**Usage:**
```bash
npx tsx tools/check-users.ts
```

---

### 4. 🔬 `debug-database.ts` - Schema and Data Debug

Detailed debugging tool for schema and raw data inspection.

**Usage:**
```bash
npx tsx tools/debug-database.ts
```

**What it shows:**
- Table schemas
- Raw data samples
- Trigger definitions
- Table creation SQL

---

### 5. 📋 `check-schema.ts` - Schema Verification

Verify database schema structure.

**Usage:**
```bash
npx tsx tools/check-schema.ts
```

---

## Common Investigation Scenarios

### Check if a user exists
```bash
npx tsx tools/query-db.ts "SELECT * FROM users WHERE email = ?" bob@matsuoka.com
```

### Find all memories for a user
```bash
# First, get user ID
npx tsx tools/query-db.ts "SELECT id FROM users WHERE email = ?" bob@matsuoka.com

# Then get memories
npx tsx tools/query-db.ts "SELECT * FROM memories WHERE user_id = ?" <user-id>
```

### Check for data integrity issues
```bash
# Run full investigation
npx tsx tools/investigate-memory-users.ts

# Check orphaned memories
npx tsx tools/query-db.ts "SELECT COUNT(*) FROM memories WHERE user_id IS NULL"

# Check invalid user references
npx tsx tools/query-db.ts "SELECT COUNT(*) FROM memories m WHERE m.user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = m.user_id)"
```

### Find duplicate memories
```bash
npx tsx tools/query-db.ts "SELECT user_id, title, content, COUNT(*) as duplicates FROM memories GROUP BY user_id, title, content HAVING duplicates > 1"
```

### Get database statistics
```bash
npx tsx tools/query-db.ts "SELECT 'Users' as table_name, COUNT(*) as count FROM users UNION ALL SELECT 'Memories', COUNT(*) FROM memories UNION ALL SELECT 'Entities', COUNT(*) FROM entities"
```

---

## Cleanup Operations

### Delete orphaned memories
```bash
# Review first
npx tsx tools/query-db.ts "SELECT id, title FROM memories WHERE user_id IS NULL"

# Then delete
npx tsx tools/query-db.ts "DELETE FROM memories WHERE user_id IS NULL"
```

### Delete memories with invalid user_id
```bash
# Review first
npx tsx tools/query-db.ts "SELECT id, title, user_id FROM memories WHERE user_id NOT IN (SELECT id FROM users)"

# Then delete
npx tsx tools/query-db.ts "DELETE FROM memories WHERE user_id IS NOT NULL AND user_id NOT IN (SELECT id FROM users)"
```

### Remove duplicate memories (keep oldest)
```bash
# This is complex - use with caution!
# Recommended: Use the investigation tool to identify duplicates first
npx tsx tools/investigate-memory-users.ts --user bob@matsuoka.com
```

---

## Database Connection

### Using TypeScript/Node.js

```typescript
import { createClient } from '@libsql/client';

const db = createClient({
  url: process.env.TURSO_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!
});

// Execute query
const result = await db.execute('SELECT * FROM users');
console.log(result.rows);

// Parameterized query
const user = await db.execute(
  'SELECT * FROM users WHERE email = ?',
  ['bob@matsuoka.com']
);

// Close connection
await db.close();
```

### Using DatabaseConnection class

```typescript
import { DatabaseConnection } from '../src/database/connection.js';

const db = new DatabaseConnection({
  url: process.env.TURSO_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!
});

await db.connect();
const result = await db.execute('SELECT * FROM users');
await db.disconnect();
```

---

## Table Schemas

### Users Table
```sql
CREATE TABLE users (
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
```

### Memories Table
```sql
CREATE TABLE memories (
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
```

### Entities Table
```sql
CREATE TABLE entities (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  tags TEXT,
  metadata TEXT,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  active BOOLEAN DEFAULT 1,
  person_type TEXT,
  first_name TEXT,
  last_name TEXT,
  company TEXT,
  title TEXT,
  contact_info TEXT,
  birthday DATE,
  notes TEXT,
  macos_contact_id TEXT,
  project_info TEXT,
  client_id TEXT,
  team_member_ids TEXT,
  org_info TEXT,
  user_id TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
)
```

---

## Troubleshooting

### Connection Error
```bash
# Verify environment variables
echo $TURSO_URL
echo $TURSO_AUTH_TOKEN

# Check .env file
cat ../.env | grep TURSO
```

### No Results Found
```bash
# Check if table exists
npx tsx tools/query-db.ts "SELECT name FROM sqlite_master WHERE type='table'"

# Check table content
npx tsx tools/query-db.ts "SELECT COUNT(*) FROM users"
```

### Permission Denied
```bash
# Verify auth token is valid
# Check Turso dashboard for token permissions
```

---

## Safety Notes

⚠️ **Important:**
- Always review queries before executing DELETE or UPDATE
- Use `SELECT` to verify affected records first
- Keep backups before making changes
- Test in development environment first
- The investigation tools are read-only and safe to run

✅ **Safe to Run:**
- `investigate-memory-users.ts` (read-only)
- `query-db.ts` with SELECT queries
- `check-users.ts` (read-only)
- `debug-database.ts` (read-only)

⚠️ **Use with Caution:**
- DELETE queries
- UPDATE queries
- Schema modifications

---

## Related Documentation

- [DATABASE_INVESTIGATION_REPORT.md](../DATABASE_INVESTIGATION_REPORT.md) - Full investigation findings
- [CLAUDE.md](../CLAUDE.md) - Project documentation
- [src/database/schema.ts](../src/database/schema.ts) - Schema definitions
- [src/database/operations.ts](../src/database/operations.ts) - Database operations

---

**Last Updated:** October 7, 2025
