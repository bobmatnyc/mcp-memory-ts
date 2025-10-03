/**
 * Custom help formatter for CLI
 * Provides enhanced help text with examples, categories, and better formatting
 */

import { Command } from 'commander';
import { colors, icons, section, subsection, command, example } from './colors.js';

interface CommandExample {
  description: string;
  command: string;
}

interface CommandCategory {
  name: string;
  icon: string;
  commands: string[];
}

/**
 * Command categories for organized help display
 */
export const commandCategories: CommandCategory[] = [
  {
    name: 'Setup & Configuration',
    icon: icons.gear,
    commands: ['init', 'config', 'test'],
  },
  {
    name: 'Platform Integration',
    icon: icons.robot,
    commands: ['install', 'update', 'status', 'uninstall'],
  },
  {
    name: 'Data Management',
    icon: icons.database,
    commands: ['vcard', 'contacts', 'list-types'],
  },
];

/**
 * Command examples for enhanced help
 */
export const commandExamples: Record<string, CommandExample[]> = {
  init: [
    {
      description: 'Start interactive setup wizard',
      command: 'mcp-memory init',
    },
  ],
  config: [
    {
      description: 'Show current configuration',
      command: 'mcp-memory config',
    },
  ],
  test: [
    {
      description: 'Verify installation and connectivity',
      command: 'mcp-memory test',
    },
    {
      description: 'Run tests with verbose output',
      command: 'mcp-memory test --verbose',
    },
  ],
  install: [
    {
      description: 'Install MCP server to Claude Desktop (default)',
      command: 'mcp-memory install',
    },
    {
      description: 'Install to Claude Code (coming soon)',
      command: 'mcp-memory install claude-code',
    },
  ],
  update: [
    {
      description: 'Update MCP server configuration for Claude Desktop',
      command: 'mcp-memory update',
    },
    {
      description: 'Update configuration for specific platform',
      command: 'mcp-memory update claude-desktop',
    },
  ],
  status: [
    {
      description: 'Check installation status for Claude Desktop',
      command: 'mcp-memory status',
    },
    {
      description: 'Check status for specific platform',
      command: 'mcp-memory status claude-desktop',
    },
  ],
  uninstall: [
    {
      description: 'Remove MCP server from Claude Desktop',
      command: 'mcp-memory uninstall',
    },
    {
      description: 'Uninstall from specific platform',
      command: 'mcp-memory uninstall claude-desktop',
    },
  ],
  vcard: [
    {
      description: 'Export entities to vCard format',
      command: 'mcp-memory vcard export --user-email user@example.com',
    },
    {
      description: 'Export to specific file',
      command: 'mcp-memory vcard export --user-email user@example.com -o contacts.vcf',
    },
    {
      description: 'Import vCard file',
      command: 'mcp-memory vcard import contacts.vcf --user-email user@example.com',
    },
    {
      description: 'Preview import without saving',
      command: 'mcp-memory vcard import contacts.vcf --user-email user@example.com --dry-run',
    },
  ],
  contacts: [
    {
      description: 'Sync both ways with macOS Contacts',
      command: 'mcp-memory contacts sync --user-email user@example.com',
    },
    {
      description: 'Export entities to macOS Contacts only',
      command: 'mcp-memory contacts sync --user-email user@example.com --direction export',
    },
    {
      description: 'Import from macOS Contacts only',
      command: 'mcp-memory contacts sync --user-email user@example.com --direction import',
    },
    {
      description: 'Preview sync without making changes',
      command: 'mcp-memory contacts sync --user-email user@example.com --dry-run',
    },
  ],
  'list-types': [
    {
      description: 'Show available entity and person types',
      command: 'mcp-memory list-types',
    },
  ],
};

/**
 * Format custom help text for main program
 */
export function formatMainHelp(program: Command): string {
  const lines: string[] = [];

  // Header
  lines.push('');
  lines.push(colors.title(`${icons.rocket} MCP Memory TypeScript - Complete Management CLI`));
  lines.push('');
  lines.push(colors.description('Cloud-based vector memory service for AI assistants'));
  lines.push('');

  // Version
  lines.push(colors.dim(`Version: ${program.version()}`));
  lines.push('');

  // Usage
  lines.push(section('USAGE'));
  lines.push(`  ${command('mcp-memory')} ${colors.option('[command]')} ${colors.dim('[options]')}`);
  lines.push('');

  // Commands by category
  lines.push(section('COMMANDS'));
  for (const category of commandCategories) {
    lines.push('');
    lines.push(subsection(`${category.icon}  ${category.name}`));

    for (const cmdName of category.commands) {
      const cmd = findCommand(program, cmdName);
      if (cmd) {
        const padding = ' '.repeat(Math.max(0, 30 - cmdName.length));
        lines.push(`  ${command(cmdName)}${padding}${colors.description(cmd.description())}`);
      }
    }
  }

  // Global options
  lines.push('');
  lines.push(section('GLOBAL OPTIONS'));
  lines.push(`  ${colors.option('-h, --help')}                    Show help for command`);
  lines.push(`  ${colors.option('-V, --version')}                 Show version number`);

  // Quick start
  lines.push('');
  lines.push(section('QUICK START'));
  lines.push(`  ${colors.dim('1.')} Initialize configuration:    ${command('mcp-memory init')}`);
  lines.push(`  ${colors.dim('2.')} Install to Claude Desktop:  ${command('mcp-memory install')}`);
  lines.push(`  ${colors.dim('3.')} Check status:               ${command('mcp-memory status')}`);

  // Examples
  lines.push('');
  lines.push(section('EXAMPLES'));
  lines.push(`  ${colors.dim('#')} Get help for a specific command`);
  lines.push(`  ${example('$ mcp-memory install --help')}`);
  lines.push('');
  lines.push(`  ${colors.dim('#')} Install to a specific platform`);
  lines.push(`  ${example('$ mcp-memory install claude-desktop')}`);
  lines.push('');
  lines.push(`  ${colors.dim('#')} Export contacts to vCard`);
  lines.push(
    `  ${example('$ mcp-memory vcard export --user-email user@example.com -o contacts.vcf')}`
  );
  lines.push('');
  lines.push(`  ${colors.dim('#')} Sync with macOS Contacts`);
  lines.push(`  ${example('$ mcp-memory contacts sync --user-email user@example.com')}`);

  // Footer
  lines.push('');
  lines.push(section('DOCUMENTATION'));
  lines.push(
    `  ${icons.book}  Full documentation: ${colors.link('https://github.com/your-repo/mcp-memory-ts')}`
  );
  lines.push('');
  lines.push(colors.dim('For more information on a specific command, run:'));
  lines.push(`  ${command('mcp-memory [command] --help')}`);
  lines.push('');

  return lines.join('\n');
}

/**
 * Format custom help text for a specific command
 */
export function formatCommandHelp(cmd: Command, cmdName: string): string {
  const lines: string[] = [];

  // Header
  lines.push('');
  lines.push(colors.title(`${icons.lightning} ${cmdName}`));
  lines.push('');
  lines.push(colors.description(cmd.description()));
  lines.push('');

  // Usage
  lines.push(section('USAGE'));
  const usage = cmd.usage();
  lines.push(`  ${command('mcp-memory ' + cmdName)} ${colors.dim(usage)}`);
  lines.push('');

  // Options
  const options = cmd.options;
  if (options.length > 0) {
    lines.push(section('OPTIONS'));
    for (const opt of options) {
      const flags = opt.flags;
      const desc = opt.description;
      const padding = ' '.repeat(Math.max(0, 35 - flags.length));
      lines.push(`  ${colors.option(flags)}${padding}${colors.description(desc)}`);

      if (opt.defaultValue !== undefined) {
        lines.push(`  ${' '.repeat(35)}${colors.dim(`(default: ${opt.defaultValue})`)}`);
      }
    }
    lines.push('');
  }

  // Examples
  const examples = commandExamples[cmdName];
  if (examples && examples.length > 0) {
    lines.push(section('EXAMPLES'));
    for (const ex of examples) {
      lines.push(`  ${colors.dim('#')} ${ex.description}`);
      lines.push(`  ${example('$ ' + ex.command)}`);
      lines.push('');
    }
  }

  // See also
  lines.push(section('SEE ALSO'));
  lines.push(
    `  ${colors.dim('Run')} ${command('mcp-memory --help')} ${colors.dim('for all available commands')}`
  );
  lines.push('');

  return lines.join('\n');
}

/**
 * Find a command by name (including subcommands)
 */
function findCommand(program: Command, name: string): Command | undefined {
  const parts = name.split(' ');
  let current = program;

  for (const part of parts) {
    const found = current.commands.find(cmd => cmd.name() === part);
    if (!found) return undefined;
    current = found;
  }

  return current;
}

/**
 * Get all available command names (including subcommands)
 */
export function getAllCommandNames(program: Command, prefix = ''): string[] {
  const names: string[] = [];

  for (const cmd of program.commands) {
    const fullName = prefix ? `${prefix} ${cmd.name()}` : cmd.name();
    names.push(fullName);

    // Add subcommands
    if (cmd.commands.length > 0) {
      names.push(...getAllCommandNames(cmd, fullName));
    }
  }

  return names;
}

/**
 * Format "did you mean" suggestion
 */
export function formatSuggestion(unknownCmd: string, suggestions: string[]): string {
  const lines: string[] = [];

  lines.push('');
  lines.push(colors.error(`Unknown command '${unknownCmd}'`));
  lines.push('');

  if (suggestions.length > 0) {
    lines.push(colors.warning('Did you mean one of these?'));
    for (const suggestion of suggestions) {
      const cmd = findCommand(globalProgram, suggestion);
      const desc = cmd ? ` - ${colors.dim(cmd.description())}` : '';
      lines.push(`  ${colors.command('•')} ${command(suggestion)}${desc}`);
    }
    lines.push('');
  }

  lines.push(colors.dim(`Run ${command('mcp-memory --help')} for all commands`));
  lines.push('');

  return lines.join('\n');
}

// Global reference to program for suggestions
let globalProgram: Command;

export function setGlobalProgram(program: Command): void {
  globalProgram = program;
}
