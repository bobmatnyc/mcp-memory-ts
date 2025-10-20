import { createClient } from '@libsql/client';
import * as dotenv from 'dotenv';

dotenv.config();

const client = createClient({
  url: process.env.TURSO_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

async function rollback() {
  console.log('=== ROLLBACK INSTRUCTIONS ===\n');
  console.log('To rollback the user ID migration, restore from backup tables:\n');
  console.log('1. DROP TABLE users;');
  console.log('2. ALTER TABLE users_backup_clerk_id RENAME TO users;');
  console.log('3. DROP TABLE memories;');
  console.log('4. ALTER TABLE memories_backup_clerk_id RENAME TO memories;');
  console.log('5. DROP TABLE entities;');
  console.log('6. ALTER TABLE entities_backup_clerk_id RENAME TO entities;');
  console.log('7. DROP TABLE interactions;');
  console.log('8. ALTER TABLE interactions_backup_clerk_id RENAME TO interactions;\n');

  console.log('WARNING: This will restore the old UUID-based user ID.');
  console.log('Only perform rollback if the migration caused issues.\n');

  // List backup tables
  const tables = await client.execute(
    "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%backup_clerk_id%'"
  );

  console.log('Available backup tables:');
  tables.rows.forEach(row => console.log(`  - ${(row as any).name}`));
}

rollback().catch(console.error);
