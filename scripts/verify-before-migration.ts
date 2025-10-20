import { createClient } from '@libsql/client';
import * as dotenv from 'dotenv';

dotenv.config();

const client = createClient({
  url: process.env.TURSO_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

async function verify() {
  const OLD_ID = '34183aef-dce1-4e2a-8b97-2dac8d0e1f75';
  
  console.log('=== BEFORE MIGRATION ===\n');
  
  const user = await client.execute({
    sql: 'SELECT id, email FROM users WHERE id = ?',
    args: [OLD_ID]
  });
  console.log('User:', user.rows);
  
  const memories = await client.execute({
    sql: 'SELECT COUNT(*) as count FROM memories WHERE user_id = ?',
    args: [OLD_ID]
  });
  console.log('Memories count:', memories.rows[0]);
  
  const entities = await client.execute({
    sql: 'SELECT COUNT(*) as count FROM entities WHERE user_id = ?',
    args: [OLD_ID]
  });
  console.log('Entities count:', entities.rows[0]);
  
  const interactions = await client.execute({
    sql: 'SELECT COUNT(*) as count FROM interactions WHERE user_id = ?',
    args: [OLD_ID]
  });
  console.log('Interactions count:', interactions.rows[0]);
}

verify().catch(console.error);
