import { createClient } from '@libsql/client';
import * as dotenv from 'dotenv';

dotenv.config();

const client = createClient({
  url: process.env.TURSO_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

async function verify() {
  const OLD_ID = '34183aef-dce1-4e2a-8b97-2dac8d0e1f75';
  const NEW_ID = 'user_33ZB97Sz4n775IAjl8pY5YZHqYd';
  
  console.log('=== AFTER MIGRATION ===\n');
  
  // Check new ID
  const user = await client.execute({
    sql: 'SELECT id, email, metadata FROM users WHERE id = ?',
    args: [NEW_ID]
  });
  console.log('User with NEW ID:', user.rows);
  
  const memories = await client.execute({
    sql: 'SELECT COUNT(*) as count FROM memories WHERE user_id = ?',
    args: [NEW_ID]
  });
  console.log('Memories with NEW ID:', memories.rows[0]);
  
  const entities = await client.execute({
    sql: 'SELECT COUNT(*) as count FROM entities WHERE user_id = ?',
    args: [NEW_ID]
  });
  console.log('Entities with NEW ID:', entities.rows[0]);
  
  const interactions = await client.execute({
    sql: 'SELECT COUNT(*) as count FROM interactions WHERE user_id = ?',
    args: [NEW_ID]
  });
  console.log('Interactions with NEW ID:', interactions.rows[0]);
  
  const usage = await client.execute({
    sql: 'SELECT COUNT(*) as count FROM api_usage_tracking WHERE user_id = ?',
    args: [NEW_ID]
  });
  console.log('API usage records with NEW ID:', usage.rows[0]);
  
  // Check for orphaned records (should be 0)
  console.log('\n=== CHECKING FOR ORPHANED RECORDS ===\n');
  
  const orphanedMemories = await client.execute({
    sql: 'SELECT COUNT(*) as count FROM memories WHERE user_id = ?',
    args: [OLD_ID]
  });
  console.log('Orphaned memories (should be 0):', orphanedMemories.rows[0]);
  
  const orphanedEntities = await client.execute({
    sql: 'SELECT COUNT(*) as count FROM entities WHERE user_id = ?',
    args: [OLD_ID]
  });
  console.log('Orphaned entities (should be 0):', orphanedEntities.rows[0]);
  
  const orphanedInteractions = await client.execute({
    sql: 'SELECT COUNT(*) as count FROM interactions WHERE user_id = ?',
    args: [OLD_ID]
  });
  console.log('Orphaned interactions (should be 0):', orphanedInteractions.rows[0]);
  
  const orphanedUsage = await client.execute({
    sql: 'SELECT COUNT(*) as count FROM api_usage_tracking WHERE user_id = ?',
    args: [OLD_ID]
  });
  console.log('Orphaned usage records (should be 0):', orphanedUsage.rows[0]);
  
  const orphanedUser = await client.execute({
    sql: 'SELECT COUNT(*) as count FROM users WHERE id = ?',
    args: [OLD_ID]
  });
  console.log('Old user record (should be 0):', orphanedUser.rows[0]);
  
  // Summary
  console.log('\n=== MIGRATION SUMMARY ===\n');
  const totalNew = (memories.rows[0] as any).count + (entities.rows[0] as any).count + 
                   (interactions.rows[0] as any).count + (usage.rows[0] as any).count;
  const totalOrphaned = (orphanedMemories.rows[0] as any).count + 
                       (orphanedEntities.rows[0] as any).count + 
                       (orphanedInteractions.rows[0] as any).count +
                       (orphanedUsage.rows[0] as any).count;
  
  console.log(`Total records with NEW ID: ${totalNew}`);
  console.log(`Total orphaned records with OLD ID: ${totalOrphaned}`);
  console.log(`User record migrated: ${user.rows.length > 0 ? 'YES' : 'NO'}`);
  
  if (totalOrphaned === 0 && user.rows.length > 0) {
    console.log('\n✅ MIGRATION SUCCESSFUL - No data loss detected');
  } else {
    console.log('\n⚠️  WARNING - Check orphaned records or missing user');
  }
}

verify().catch(console.error);
