#!/usr/bin/env node
/**
 * MCP Memory CLI - vCard Import/Export Tool
 */

import { Command } from 'commander';
import * as dotenv from 'dotenv';
import { exportVCard } from './commands/export.js';
import { importVCard } from './commands/import.js';
import { EntityType, PersonType, ImportanceLevel } from '../types/enums.js';
import type { VCardVersion } from '../vcard/types.js';

// Load environment variables
dotenv.config();

const program = new Command();

program
  .name('mcp-memory-cli')
  .description('MCP Memory TypeScript - vCard Import/Export CLI')
  .version('1.1.2');

// Export command
program
  .command('export-vcard')
  .description('Export entities to vCard format')
  .requiredOption('--user-email <email>', 'User email or ID')
  .option('-o, --output <file>', 'Output file path', 'entities.vcf')
  .option('-t, --entity-type <type>', 'Filter by entity type', EntityType.PERSON)
  .option('-f, --format <version>', 'vCard version (3.0 or 4.0)', '4.0')
  .option('-a, --all', 'Export all entity types', false)
  .action(async (options) => {
    try {
      await exportVCard({
        userId: options.userEmail,
        outputPath: options.output,
        entityType: options.entityType as EntityType,
        version: options.format as VCardVersion,
        includeAllTypes: options.all,
      });
    } catch (error) {
      console.error('\n❌ Export failed:', error);
      process.exit(1);
    }
  });

// Import command
program
  .command('import-vcard')
  .description('Import vCard file to create entities')
  .argument('<file>', 'vCard file to import')
  .requiredOption('--user-email <email>', 'User email or ID')
  .option('-t, --entity-type <type>', 'Set entity type', EntityType.PERSON)
  .option('-p, --person-type <type>', 'Set person type')
  .option('-i, --importance <level>', 'Set importance level (1-4)', '2')
  .option('--tags <tags>', 'Add tags (comma-separated)')
  .option('--dry-run', 'Preview without saving', false)
  .option('--merge', 'Merge with existing by name/email', false)
  .action(async (file, options) => {
    try {
      const tags = options.tags ? options.tags.split(',').map((t: string) => t.trim()) : [];
      const importance = parseInt(options.importance, 10) as ImportanceLevel;

      if (isNaN(importance) || importance < 1 || importance > 4) {
        console.error('❌ Error: Importance must be between 1 and 4');
        process.exit(1);
      }

      const result = await importVCard({
        userId: options.userEmail,
        inputPath: file,
        entityType: options.entityType as EntityType,
        personType: options.personType as PersonType | undefined,
        importance,
        tags,
        dryRun: options.dryRun,
        merge: options.merge,
      });

      if (!result.success) {
        process.exit(1);
      }
    } catch (error) {
      console.error('\n❌ Import failed:', error);
      process.exit(1);
    }
  });

// List entity types command
program
  .command('list-types')
  .description('List available entity and person types')
  .action(() => {
    console.log('\n=== Entity Types ===');
    for (const [key, value] of Object.entries(EntityType)) {
      console.log(`  ${key}: ${value}`);
    }

    console.log('\n=== Person Types ===');
    for (const [key, value] of Object.entries(PersonType)) {
      console.log(`  ${key}: ${value}`);
    }

    console.log('\n=== Importance Levels ===');
    console.log('  1: LOW');
    console.log('  2: MEDIUM');
    console.log('  3: HIGH');
    console.log('  4: CRITICAL');
  });

program.parse();
