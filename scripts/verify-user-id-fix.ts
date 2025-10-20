#!/usr/bin/env tsx
/**
 * Verify NULL user_id Fix in Entities Table
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { existsSync } from 'fs';
import { initDatabaseFromEnv } from '../src/database/index.js';

const envLocalPath = resolve(process.cwd(), '.env.local');
const envPath = resolve(process.cwd(), '.env');

if (existsSync(envLocalPath)) {
  config({ path: envLocalPath });
} else if (existsSync(envPath)) {
  config({ path: envPath });
}

const TARGET_USER_ID = '34183aef-dce1-4e2a-8b97-2dac8d0e1f75';

async function verify() {
  console.log('\n🔍 Verifying NULL user_id Fix...\n');

  const db = initDatabaseFromEnv();
  await db.connect();

  try {
    // Check NULL count
    const nullResult = await db.execute(
      `SELECT COUNT(*) as count FROM entities WHERE user_id IS NULL`
    );
    const nullCount = Number(nullResult.rows[0]?.count || 0);

    // Check Bob's count
    const bobResult = await db.execute(
      `SELECT COUNT(*) as count FROM entities WHERE user_id = ?`,
      [TARGET_USER_ID]
    );
    const bobCount = Number(bobResult.rows[0]?.count || 0);

    // Check total
    const totalResult = await db.execute(
      `SELECT COUNT(*) as count FROM entities`
    );
    const totalCount = Number(totalResult.rows[0]?.count || 0);

    // Check backup
    const backupResult = await db.execute(
      `SELECT COUNT(*) as count FROM entities_backup_20251014`
    );
    const backupCount = Number(backupResult.rows[0]?.count || 0);

    console.log('═══════════════════════════════════════════════════════');
    console.log('✅ Verification Results');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`Backup table count:        ${backupCount}`);
    console.log(`Total entities:            ${totalCount}`);
    console.log(`Entities with NULL user_id: ${nullCount} ${nullCount === 0 ? '✅' : '❌'}`);
    console.log(`Bob's entities:            ${bobCount} ${bobCount === 3638 ? '✅' : '⚠️'}`);
    console.log('═══════════════════════════════════════════════════════\n');

    if (nullCount === 0 && bobCount === 3638) {
      console.log('✅ Security fix verified successfully!\n');
    } else {
      console.log('⚠️  Verification found issues. Please investigate.\n');
    }

  } catch (error: any) {
    console.error('❌ Verification failed:', error.message);
    process.exit(1);
  } finally {
    await db.disconnect();
  }
}

verify().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
