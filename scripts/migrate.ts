#!/usr/bin/env tsx
/**
 * Migration CLI Tool
 * Apply, rollback, and verify database migrations
 */

import { createClient } from '@libsql/client';
import { config } from 'dotenv';
import { createMigrationRunner } from '../src/database/migrations/index.js';

// Load environment variables
config();

const TURSO_URL = process.env.TURSO_URL;
const TURSO_AUTH_TOKEN = process.env.TURSO_AUTH_TOKEN;

if (!TURSO_URL || !TURSO_AUTH_TOKEN) {
  console.error('❌ Missing required environment variables: TURSO_URL, TURSO_AUTH_TOKEN');
  process.exit(1);
}

// Parse command line arguments
const command = process.argv[2];
const arg = process.argv[3];
const dryRun = process.argv.includes('--dry-run');

const USAGE = `
Migration CLI Tool

Usage:
  npm run migrate <command> [options]

Commands:
  status              Show migration status
  up                  Apply all pending migrations
  down [count]        Rollback last [count] migrations (default: 1)
  to <version>        Migrate to specific version
  verify              Verify all applied migrations
  help                Show this help message

Options:
  --dry-run           Preview changes without applying them

Examples:
  npm run migrate status
  npm run migrate up
  npm run migrate up --dry-run
  npm run migrate down 2
  npm run migrate to 5
  npm run migrate verify
`;

async function main() {
  // Create database connection
  const db = createClient({
    url: TURSO_URL!,
    authToken: TURSO_AUTH_TOKEN!,
  });

  // Create migration runner
  const runner = createMigrationRunner(db);
  await runner.initialize();

  switch (command) {
    case 'status':
      await showStatus(runner);
      break;

    case 'up':
      await migrateUp(runner, { dryRun });
      break;

    case 'down':
      const count = arg ? parseInt(arg, 10) : 1;
      await migrateDown(runner, count, { dryRun });
      break;

    case 'to':
      if (!arg) {
        console.error('❌ Please specify target version');
        console.error('   Example: npm run migrate to 5');
        process.exit(1);
      }
      const version = parseInt(arg, 10);
      await migrateTo(runner, version, { dryRun });
      break;

    case 'verify':
      await verify(runner);
      break;

    case 'help':
    case '--help':
    case '-h':
      console.log(USAGE);
      break;

    default:
      console.error('❌ Unknown command:', command);
      console.log(USAGE);
      process.exit(1);
  }
}

async function showStatus(runner: ReturnType<typeof createMigrationRunner>) {
  console.error('\n📊 Migration Status\n');

  const currentVersion = await runner.getCurrentVersion();
  const available = runner.getAvailableMigrations();
  const applied = await runner.getAppliedMigrations();
  const pending = await runner.getPendingMigrations();

  console.error(`Current Version: ${currentVersion}`);
  console.error(`Available Migrations: ${available.length}`);
  console.error(`Applied Migrations: ${applied.length}`);
  console.error(`Pending Migrations: ${pending.length}\n`);

  if (applied.length > 0) {
    console.error('📋 Applied Migrations:');
    for (const migration of applied) {
      const status = migration.status === 'applied' ? '✅' : migration.status === 'rolled_back' ? '🔄' : '❌';
      console.error(
        `   ${status} v${migration.version}: ${migration.name} (${migration.appliedAt})`
      );
    }
    console.error('');
  }

  if (pending.length > 0) {
    console.error('⏳ Pending Migrations:');
    for (const migration of pending) {
      console.error(`   ⏳ v${migration.version}: ${migration.name}`);
      console.error(`      ${migration.description}`);
    }
    console.error('');
  } else {
    console.error('✅ Database is up to date\n');
  }
}

async function migrateUp(
  runner: ReturnType<typeof createMigrationRunner>,
  options: { dryRun?: boolean }
) {
  console.error('\n📦 Applying Migrations\n');

  if (options.dryRun) {
    console.error('🔍 DRY RUN MODE - No changes will be applied\n');
  }

  const results = await runner.migrateUp(options);

  if (results.length === 0) {
    return;
  }

  console.error('\n📊 Migration Summary:');
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  console.error(`   ✅ Successful: ${successful}`);
  console.error(`   ❌ Failed: ${failed}`);
  console.error(`   ⏱️  Total Time: ${results.reduce((sum, r) => sum + r.duration, 0)}ms\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

async function migrateDown(
  runner: ReturnType<typeof createMigrationRunner>,
  count: number,
  options: { dryRun?: boolean }
) {
  console.error(`\n🔄 Rolling Back ${count} Migration(s)\n`);

  if (options.dryRun) {
    console.error('🔍 DRY RUN MODE - No changes will be applied\n');
  }

  const results = await runner.migrateDown(count, options);

  if (results.length === 0) {
    return;
  }

  console.error('\n📊 Rollback Summary:');
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  console.error(`   ✅ Successful: ${successful}`);
  console.error(`   ❌ Failed: ${failed}`);
  console.error(`   ⏱️  Total Time: ${results.reduce((sum, r) => sum + r.duration, 0)}ms\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

async function migrateTo(
  runner: ReturnType<typeof createMigrationRunner>,
  version: number,
  options: { dryRun?: boolean }
) {
  const currentVersion = await runner.getCurrentVersion();
  const direction = version > currentVersion ? 'up' : 'down';

  console.error(`\n📦 Migrating ${direction} to version ${version}\n`);

  if (options.dryRun) {
    console.error('🔍 DRY RUN MODE - No changes will be applied\n');
  }

  const results = await runner.migrateTo(version, options);

  if (results.length === 0) {
    return;
  }

  console.error('\n📊 Migration Summary:');
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  console.error(`   ✅ Successful: ${successful}`);
  console.error(`   ❌ Failed: ${failed}`);
  console.error(`   ⏱️  Total Time: ${results.reduce((sum, r) => sum + r.duration, 0)}ms\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

async function verify(runner: ReturnType<typeof createMigrationRunner>) {
  console.error('\n🔍 Verifying Migrations\n');

  const { passed, results } = await runner.verify();

  console.error('\n📊 Verification Summary:');
  const passedCount = results.filter(r => r.passed).length;
  const failedCount = results.filter(r => !r.passed).length;

  console.error(`   ✅ Passed: ${passedCount}`);
  console.error(`   ❌ Failed: ${failedCount}\n`);

  if (!passed) {
    console.error('❌ Verification failed\n');
    process.exit(1);
  } else {
    console.error('✅ All migrations verified successfully\n');
  }
}

// Run main function
main().catch(error => {
  console.error('❌ Migration failed:', error);
  process.exit(1);
});
