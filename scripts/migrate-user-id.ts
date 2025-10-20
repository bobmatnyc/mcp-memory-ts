import { createClient } from '@libsql/client';
import * as dotenv from 'dotenv';

dotenv.config();

const client = createClient({
  url: process.env.TURSO_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

async function migrate() {
  const OLD_ID = '34183aef-dce1-4e2a-8b97-2dac8d0e1f75';
  const NEW_ID = 'user_33ZB97Sz4n775IAjl8pY5YZHqYd';
  
  console.log('Starting migration...');
  console.log(`OLD_ID: ${OLD_ID}`);
  console.log(`NEW_ID: ${NEW_ID}\n`);
  
  try {
    // Update related tables first (foreign keys)
    console.log('Updating memories...');
    const memoriesResult = await client.execute({
      sql: 'UPDATE memories SET user_id = ? WHERE user_id = ?',
      args: [NEW_ID, OLD_ID]
    });
    console.log(`✅ Updated ${memoriesResult.rowsAffected} memories`);
    
    console.log('Updating entities...');
    const entitiesResult = await client.execute({
      sql: 'UPDATE entities SET user_id = ? WHERE user_id = ?',
      args: [NEW_ID, OLD_ID]
    });
    console.log(`✅ Updated ${entitiesResult.rowsAffected} entities`);
    
    console.log('Updating interactions...');
    const interactionsResult = await client.execute({
      sql: 'UPDATE interactions SET user_id = ? WHERE user_id = ?',
      args: [NEW_ID, OLD_ID]
    });
    console.log(`✅ Updated ${interactionsResult.rowsAffected} interactions`);
    
    // Update users table last
    console.log('Updating users table...');
    const usersResult = await client.execute({
      sql: 'UPDATE users SET id = ? WHERE id = ?',
      args: [NEW_ID, OLD_ID]
    });
    console.log(`✅ Updated ${usersResult.rowsAffected} user record`);
    
    console.log('\n✅ Migration complete');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

migrate().catch(console.error);
