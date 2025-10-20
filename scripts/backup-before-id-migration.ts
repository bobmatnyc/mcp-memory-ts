import { createClient } from '@libsql/client';
import * as dotenv from 'dotenv';

dotenv.config();

const client = createClient({
  url: process.env.TURSO_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

async function backup() {
  console.log('Creating backup tables...');
  
  try {
    await client.execute('CREATE TABLE users_backup_clerk_id AS SELECT * FROM users');
    console.log('✅ users_backup_clerk_id created');
    
    await client.execute('CREATE TABLE memories_backup_clerk_id AS SELECT * FROM memories');
    console.log('✅ memories_backup_clerk_id created');
    
    await client.execute('CREATE TABLE entities_backup_clerk_id AS SELECT * FROM entities');
    console.log('✅ entities_backup_clerk_id created');
    
    await client.execute('CREATE TABLE interactions_backup_clerk_id AS SELECT * FROM interactions');
    console.log('✅ interactions_backup_clerk_id created');
    
    console.log('\n✅ All backup tables created successfully');
  } catch (error) {
    console.error('❌ Backup failed:', error);
    throw error;
  }
}

backup().catch(console.error);
