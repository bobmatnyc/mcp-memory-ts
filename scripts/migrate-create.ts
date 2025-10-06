#!/usr/bin/env tsx
/**
 * Migration Generator
 * Create a new migration file from template
 */

import { writeFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

const migrationName = process.argv[2];

if (!migrationName) {
  console.error('❌ Please provide a migration name');
  console.error('   Example: npm run migrate:create add_user_preferences');
  process.exit(1);
}

// Get next version number
const migrationsDir = join(process.cwd(), 'src', 'database', 'migrations');
const existingMigrations = readdirSync(migrationsDir)
  .filter((f: string) => f.match(/^\d{3}_.*\.ts$/))
  .map((f: string) => parseInt(f.substring(0, 3), 10));

const nextVersion = existingMigrations.length > 0 ? Math.max(...existingMigrations) + 1 : 1;
const versionStr = String(nextVersion).padStart(3, '0');
const className = migrationName
  .split('_')
  .map(word => word.charAt(0).toUpperCase() + word.slice(1))
  .join('');

const fileName = `${versionStr}_${migrationName}.ts`;
const filePath = join(migrationsDir, fileName);

if (existsSync(filePath)) {
  console.error(`❌ Migration already exists: ${fileName}`);
  process.exit(1);
}

const template = `/**
 * Migration ${versionStr}: ${migrationName.replace(/_/g, ' ')}
 *
 * Description: TODO - Add description
 *
 * IMPORTANT:
 * - Test with --dry-run first
 * - Implement rollback in down()
 * - Add verification in verify()
 */

import type { DatabaseConnection } from '../connection.js';
import { Migration, type VerificationResult } from './migration-base.js';

export class Migration${versionStr}${className} extends Migration {
  readonly version = ${nextVersion};
  readonly name = '${versionStr}_${migrationName}';
  readonly description = 'TODO: Add description';

  async up(db: DatabaseConnection): Promise<void> {
    console.error('📦 Applying ${migrationName}...');

    // TODO: Implement migration
    // Example:
    // await this.executeSql(
    //   db,
    //   'CREATE INDEX IF NOT EXISTS idx_name ON table(column)',
    //   '  ✓ Created index: idx_name'
    // );

    console.error('✅ ${migrationName} completed');
  }

  async down(db: DatabaseConnection): Promise<void> {
    console.error('🔄 Rolling back ${migrationName}...');

    // TODO: Implement rollback
    // Example:
    // await this.executeSql(
    //   db,
    //   'DROP INDEX IF EXISTS idx_name',
    //   '  ✓ Dropped index: idx_name'
    // );

    console.error('✅ ${migrationName} rolled back');
  }

  async verify(db: DatabaseConnection): Promise<VerificationResult> {
    try {
      // TODO: Implement verification
      // Example:
      // const exists = await this.indexExists(db, 'idx_name');
      // if (!exists) {
      //   return {
      //     passed: false,
      //     message: 'Index idx_name does not exist',
      //   };
      // }

      return {
        passed: true,
        message: '${migrationName} verified successfully',
      };
    } catch (error) {
      return {
        passed: false,
        message: \`Verification failed: \${error}\`,
      };
    }
  }
}
`;

writeFileSync(filePath, template);

console.error(`\n✅ Created migration: ${fileName}\n`);
console.error('Next steps:');
console.error(`  1. Edit ${filePath}`);
console.error('  2. Implement up(), down(), and verify() methods');
console.error(`  3. Add to src/database/migrations/index.ts:`);
console.error(`     import { Migration${versionStr}${className} } from './${fileName.replace('.ts', '.js')}';`);
console.error(`     const MIGRATIONS: Migration[] = [..., new Migration${versionStr}${className}()];`);
console.error('  4. Test with: npm run migrate up --dry-run');
console.error('  5. Apply with: npm run migrate up\n');
