#!/usr/bin/env node
/**
 * MCP Memory CLI - Complete Management Tool
 */

import { Command } from 'commander';
import * as dotenv from 'dotenv';
import didYouMean from 'didyoumean2';
import { exportVCard } from './commands/export.js';
import { importVCard } from './commands/import.js';
import { runTests } from './commands/test.js';
import { EntityType, PersonType, ImportanceLevel } from '../types/enums.js';
import type { VCardVersion } from '../vcard/types.js';
import { runInitWizard, showConfig } from './init.js';
import {
  installClaudeDesktop,
  updateClaudeDesktop,
  statusClaudeDesktop,
  uninstallClaudeDesktop,
} from './claude-desktop.js';
import {
  formatMainHelp,
  formatCommandHelp,
  formatSuggestion,
  getAllCommandNames,
  setGlobalProgram,
} from './help.js';
import { colors, error as errorMsg, success as successMsg } from './colors.js';
import packageJson from '../../package.json' with { type: 'json' };

// Load environment variables
dotenv.config();

const program = new Command();

// Configure custom help formatter
program
  .name('mcp-memory')
  .description('MCP Memory TypeScript - Complete Management CLI')
  .version(packageJson.version)
  .showSuggestionAfterError(false) // Disable default suggestions
  .exitOverride() // Allow us to catch errors
  .configureHelp({
    formatHelp: cmd => {
      // Check if this is the main program or a subcommand
      if (!cmd.parent) {
        return formatMainHelp(cmd);
      }
      // Get full command name (including parent commands)
      const cmdNames: string[] = [];
      let current: Command | null = cmd;
      while (current && current.name()) {
        cmdNames.unshift(current.name());
        current = current.parent as Command | null;
      }
      const fullName = cmdNames.slice(1).join(' '); // Skip 'mcp-memory'
      return formatCommandHelp(cmd, fullName || cmd.name());
    },
  })
  .showHelpAfterError(false);

// Export command
program
  .command('export-vcard')
  .description('Export entities to vCard format')
  .requiredOption('--user-email <email>', 'User email or ID')
  .option('-o, --output <file>', 'Output file path', 'entities.vcf')
  .option('-t, --entity-type <type>', 'Filter by entity type', EntityType.PERSON)
  .option('-f, --format <version>', 'vCard version (3.0 or 4.0)', '4.0')
  .option('-a, --all', 'Export all entity types', false)
  .action(async options => {
    try {
      await exportVCard({
        userId: options.userEmail,
        outputPath: options.output,
        entityType: options.entityType as EntityType,
        version: options.format as VCardVersion,
        includeAllTypes: options.all,
      });
    } catch (error) {
      console.error(errorMsg(`Export failed: ${error}`));
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
        console.error(errorMsg('Importance must be between 1 and 4'));
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
      console.error(errorMsg(`Import failed: ${error}`));
      process.exit(1);
    }
  });

// List entity types command
program
  .command('list-types')
  .description('List available entity and person types')
  .action(() => {
    console.log(colors.title('\n📋 Entity Types'));
    for (const [key, value] of Object.entries(EntityType)) {
      console.log(`  ${colors.parameter(key)}: ${colors.dim(value)}`);
    }

    console.log(colors.title('\n👥 Person Types'));
    for (const [key, value] of Object.entries(PersonType)) {
      console.log(`  ${colors.parameter(key)}: ${colors.dim(value)}`);
    }

    console.log(colors.title('\n⭐ Importance Levels'));
    console.log(`  ${colors.parameter('1')}: ${colors.dim('LOW')}`);
    console.log(`  ${colors.parameter('2')}: ${colors.dim('MEDIUM')}`);
    console.log(`  ${colors.parameter('3')}: ${colors.dim('HIGH')}`);
    console.log(`  ${colors.parameter('4')}: ${colors.dim('CRITICAL')}`);
    console.log('');
  });

// Initialization command
program
  .command('init')
  .description('Initialize user configuration with interactive wizard')
  .action(async () => {
    try {
      await runInitWizard();
    } catch (error) {
      console.error(errorMsg(`Initialization failed: ${error}`));
      process.exit(1);
    }
  });

// Show configuration
program
  .command('config')
  .description('Show current configuration (without sensitive data)')
  .action(async () => {
    try {
      await showConfig();
    } catch (error) {
      console.error(errorMsg(`Error: ${error}`));
      process.exit(1);
    }
  });

// Test command
program
  .command('test')
  .description('Verify installation and connectivity')
  .option('-v, --verbose', 'Show detailed test information')
  .action(async options => {
    try {
      const success = await runTests({ verbose: options.verbose });
      process.exit(success ? 0 : 1);
    } catch (error) {
      console.error(errorMsg(`Test failed: ${error}`));
      process.exit(1);
    }
  });

// Claude Desktop management commands
const claudeDesktop = program
  .command('claude-desktop')
  .description('Manage Claude Desktop MCP server integration');

claudeDesktop
  .command('install')
  .description('Install MCP memory server in Claude Desktop')
  .action(async () => {
    try {
      await installClaudeDesktop();
    } catch (error) {
      console.error(errorMsg(`Installation failed: ${error}`));
      process.exit(1);
    }
  });

claudeDesktop
  .command('update')
  .description('Update MCP memory server configuration')
  .action(async () => {
    try {
      await updateClaudeDesktop();
    } catch (error) {
      console.error(errorMsg(`Update failed: ${error}`));
      process.exit(1);
    }
  });

claudeDesktop
  .command('status')
  .description('Check MCP memory server installation status')
  .action(async () => {
    try {
      await statusClaudeDesktop();
    } catch (error) {
      console.error(errorMsg(`Status check failed: ${error}`));
      process.exit(1);
    }
  });

claudeDesktop
  .command('uninstall')
  .description('Remove MCP memory server from Claude Desktop')
  .action(async () => {
    try {
      await uninstallClaudeDesktop();
    } catch (error) {
      console.error(errorMsg(`Uninstall failed: ${error}`));
      process.exit(1);
    }
  });

// Set global program reference for help system
setGlobalProgram(program);

// Handle unknown commands with suggestions
program.on('command:*', operands => {
  const unknownCommand = operands[0];
  const availableCommands = getAllCommandNames(program);

  // Use didyoumean to find similar commands
  const result = didYouMean(unknownCommand, availableCommands, {
    threshold: 0.4,
  });

  const suggestions = result ? [result] : [];
  console.log(formatSuggestion(unknownCommand, suggestions));
  process.exit(1);
});

// Parse command line arguments
const args = process.argv;

// Check if no command provided or if --help/-h is provided at main level
if (args.length === 2 || (args.length === 3 && (args[2] === '--help' || args[2] === '-h'))) {
  console.log(formatMainHelp(program));
  process.exit(0);
}

try {
  program.parse();
} catch (err: any) {
  // Handle Commander.js errors
  if (err.code === 'commander.unknownCommand') {
    const unknownCommand = err.message.match(/'([^']+)'/)?.[1] || 'unknown';
    const availableCommands = getAllCommandNames(program);

    // Use didyoumean to find similar commands
    const result = didYouMean(unknownCommand, availableCommands, {
      threshold: 0.4,
    });

    const suggestions = result ? [result] : [];
    console.log(formatSuggestion(unknownCommand, suggestions));
    process.exit(1);
  } else if (
    err.code === 'commander.version' ||
    err.code === 'commander.help' ||
    err.code === 'commander.helpDisplayed'
  ) {
    // Version or help was requested and displayed successfully
    process.exit(0);
  } else if (err.code) {
    // Other Commander errors - only show if not help-related
    if (!err.message.includes('outputHelp')) {
      console.error(errorMsg(err.message));
    }
    process.exit(err.exitCode || 1);
  } else if (err instanceof Error) {
    // General errors
    console.error(errorMsg(err.message));
    process.exit(1);
  } else {
    throw err;
  }
}
