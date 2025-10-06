/**
 * Claude Desktop Integration CLI
 * Manages MCP server installation and configuration for Claude Desktop
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { homedir } from 'os';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { colors, icons, success, error, warning, info, section, keyValue } from './colors.js';
import type { UserConfig } from '../types/sync-config.js';

// ESM-compatible __dirname replacement
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface ClaudeDesktopConfig {
  mcpServers: {
    [key: string]: {
      command: string;
      args: string[];
      env?: Record<string, string>;
    };
  };
}

const CONFIG_DIR = join(homedir(), '.mcp-memory');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');
const CLAUDE_DESKTOP_CONFIG = join(
  homedir(),
  'Library/Application Support/Claude/claude_desktop_config.json'
);
const BACKUP_SUFFIX = '.backup';

/**
 * Load user configuration from ~/.mcp-memory/config.json
 */
export function loadUserConfig(): UserConfig | null {
  if (!existsSync(CONFIG_FILE)) {
    return null;
  }

  try {
    const data = readFileSync(CONFIG_FILE, 'utf8');
    return JSON.parse(data) as UserConfig;
  } catch (err) {
    console.error(error(`Error reading config file: ${err}`));
    return null;
  }
}

/**
 * Load user configuration and set environment variables
 * This should be called early in CLI startup to make config available to all commands
 */
export function loadConfigToEnv(): void {
  const config = loadUserConfig();
  if (!config) {
    // No config file found - this is OK, user might be using .env or system env vars
    return;
  }

  // Set environment variables from config if not already set
  // Existing env vars take precedence over config file
  if (!process.env.TURSO_URL && config.tursoUrl) {
    process.env.TURSO_URL = config.tursoUrl;
  }
  if (!process.env.TURSO_AUTH_TOKEN && config.tursoAuthToken) {
    process.env.TURSO_AUTH_TOKEN = config.tursoAuthToken;
  }
  if (!process.env.OPENAI_API_KEY && config.openaiApiKey) {
    process.env.OPENAI_API_KEY = config.openaiApiKey;
  }
  if (!process.env.DEFAULT_USER_EMAIL && config.userEmail) {
    process.env.DEFAULT_USER_EMAIL = config.userEmail;
  }
}

/**
 * Save user configuration to ~/.mcp-memory/config.json
 */
export function saveUserConfig(config: UserConfig): boolean {
  try {
    if (!existsSync(CONFIG_DIR)) {
      mkdirSync(CONFIG_DIR, { recursive: true });
    }

    writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
    console.log(success(`Configuration saved to ${CONFIG_FILE}`));
    return true;
  } catch (err) {
    console.error(error(`Error saving config: ${err}`));
    return false;
  }
}

/**
 * Load Claude Desktop configuration
 */
function loadClaudeDesktopConfig(): ClaudeDesktopConfig | null {
  if (!existsSync(CLAUDE_DESKTOP_CONFIG)) {
    console.log(warning('Claude Desktop config not found'));
    return null;
  }

  try {
    const data = readFileSync(CLAUDE_DESKTOP_CONFIG, 'utf8');
    return JSON.parse(data) as ClaudeDesktopConfig;
  } catch (err) {
    console.error(error(`Error reading Claude Desktop config: ${err}`));
    return null;
  }
}

/**
 * Save Claude Desktop configuration with backup
 */
function saveClaudeDesktopConfig(config: ClaudeDesktopConfig): boolean {
  try {
    // Create backup of existing config
    if (existsSync(CLAUDE_DESKTOP_CONFIG)) {
      const backupPath = CLAUDE_DESKTOP_CONFIG + BACKUP_SUFFIX;
      const existing = readFileSync(CLAUDE_DESKTOP_CONFIG, 'utf8');
      writeFileSync(backupPath, existing, 'utf8');
      console.log(info(`Backed up existing config to ${backupPath}`));
    }

    // Write new config
    writeFileSync(CLAUDE_DESKTOP_CONFIG, JSON.stringify(config, null, 2), 'utf8');
    console.log(success('Claude Desktop config updated'));
    return true;
  } catch (err) {
    console.error(error(`Error saving Claude Desktop config: ${err}`));
    return false;
  }
}

/**
 * Get the path to the compiled MCP server
 */
function getMcpServerPath(): string {
  // Try global npm installation first
  try {
    const { execSync } = require('child_process');
    const npmRoot = execSync('npm root -g', { encoding: 'utf-8' }).trim();
    const globalPath = join(npmRoot, 'mcp-memory-ts', 'dist', 'desktop-mcp-server.js');

    if (existsSync(globalPath)) {
      return globalPath;
    }
  } catch (error) {
    // Fall back to local development path if npm command fails
  }

  // For local development - try to find the dist directory relative to this file
  const projectRoot = resolve(__dirname, '../..');
  const serverPath = join(projectRoot, 'dist', 'desktop-mcp-server.js');

  if (!existsSync(serverPath)) {
    throw new Error(`MCP server not found. Tried:
  - Global: $(npm root -g)/mcp-memory-ts/dist/desktop-mcp-server.js
  - Local: ${serverPath}

Run 'npm run build-full' first, or install globally with 'npm install -g mcp-memory-ts'`);
  }

  return serverPath;
}

/**
 * Install MCP memory server in Claude Desktop
 */
export async function installClaudeDesktop(): Promise<void> {
  console.log(colors.title(`\n${icons.gear} Installing MCP Memory Server for Claude Desktop...\n`));

  // Load user config
  const userConfig = loadUserConfig();
  if (!userConfig) {
    console.error(error('User configuration not found. Run "mcp-memory init" first.'));
    process.exit(1);
  }

  // Get MCP server path
  let serverPath: string;
  try {
    serverPath = getMcpServerPath();
  } catch (err) {
    console.error(error(`${err}`));
    process.exit(1);
  }

  // Load or create Claude Desktop config
  let claudeConfig = loadClaudeDesktopConfig();
  if (!claudeConfig) {
    claudeConfig = { mcpServers: {} };
  }

  // Add/update mcp-memory-ts entry
  claudeConfig.mcpServers['mcp-memory-ts'] = {
    command: 'node',
    args: [serverPath],
    env: {
      TURSO_URL: userConfig.tursoUrl,
      TURSO_AUTH_TOKEN: userConfig.tursoAuthToken,
      OPENAI_API_KEY: userConfig.openaiApiKey,
      DEFAULT_USER_EMAIL: userConfig.userEmail,
      LOG_LEVEL: 'INFO',
    },
  };

  // Save config
  if (saveClaudeDesktopConfig(claudeConfig)) {
    console.log(success('\nMCP Memory Server installed successfully!'));
    console.log(section(`${icons.pencil} Configuration:`));
    console.log(`   ${keyValue('User', userConfig.userEmail)}`);
    console.log(`   ${keyValue('Server', serverPath)}`);
    console.log(`   ${keyValue('Database', userConfig.tursoUrl)}`);
    console.log(warning('\nPlease restart Claude Desktop for changes to take effect.'));
    console.log('');
  } else {
    process.exit(1);
  }
}

/**
 * Update MCP memory server configuration
 */
export async function updateClaudeDesktop(): Promise<void> {
  console.log(colors.title(`\n${icons.cycle} Updating MCP Memory Server configuration...\n`));

  // Load user config
  const userConfig = loadUserConfig();
  if (!userConfig) {
    console.error(error('User configuration not found. Run "mcp-memory init" first.'));
    process.exit(1);
  }

  // Load Claude Desktop config
  const claudeConfig = loadClaudeDesktopConfig();
  if (!claudeConfig || !claudeConfig.mcpServers['mcp-memory-ts']) {
    console.error(error('MCP Memory Server not installed. Run "mcp-memory install" first.'));
    process.exit(1);
  }

  // Update server path
  try {
    const serverPath = getMcpServerPath();
    claudeConfig.mcpServers['mcp-memory-ts'].args = [serverPath];
  } catch (err) {
    console.error(error(`${err}`));
    process.exit(1);
  }

  // Update environment variables
  claudeConfig.mcpServers['mcp-memory-ts'].env = {
    TURSO_URL: userConfig.tursoUrl,
    TURSO_AUTH_TOKEN: userConfig.tursoAuthToken,
    OPENAI_API_KEY: userConfig.openaiApiKey,
    DEFAULT_USER_EMAIL: userConfig.userEmail,
    LOG_LEVEL: 'INFO',
  };

  // Save config
  if (saveClaudeDesktopConfig(claudeConfig)) {
    console.log(success('\nConfiguration updated successfully!'));
    console.log(warning('\nPlease restart Claude Desktop for changes to take effect.'));
    console.log('');
  } else {
    process.exit(1);
  }
}

/**
 * Check MCP memory server status
 */
export async function statusClaudeDesktop(): Promise<void> {
  console.log(section(`${icons.database} MCP Memory Server Status\n`));

  // Check user config
  const userConfig = loadUserConfig();
  if (!userConfig) {
    console.log(error('User configuration: Not found'));
    console.log(
      `   ${colors.dim('Run')} ${colors.command('mcp-memory init')} ${colors.dim('to set up configuration')}`
    );
    console.log('');
    return;
  }
  console.log(success('User configuration: Found'));
  console.log(`   ${keyValue('User', userConfig.userEmail)}`);

  // Check Claude Desktop config
  const claudeConfig = loadClaudeDesktopConfig();
  if (!claudeConfig) {
    console.log(error('Claude Desktop config: Not found'));
    console.log(
      `   ${colors.dim('Run')} ${colors.command('mcp-memory install')} ${colors.dim('to set up')}`
    );
    console.log('');
    return;
  }

  // Check if mcp-memory-ts is installed
  const mcpConfig = claudeConfig.mcpServers['mcp-memory-ts'];
  if (!mcpConfig) {
    console.log(error('MCP Memory Server: Not installed in Claude Desktop'));
    console.log(
      `   ${colors.dim('Run')} ${colors.command('mcp-memory install')} ${colors.dim('to set up')}`
    );
    console.log('');
    return;
  }

  console.log(success('MCP Memory Server: Installed in Claude Desktop'));
  console.log(`   ${keyValue('Command', mcpConfig.command)}`);
  console.log(`   ${keyValue('Server', mcpConfig.args[0])}`);

  // Check if server file exists
  const serverPath = mcpConfig.args[0];
  if (existsSync(serverPath)) {
    console.log(success('Server file: Found'));
  } else {
    console.log(error('Server file: Not found'));
    console.log(`   ${keyValue('Expected at', serverPath)}`);
    console.log(
      `   ${colors.dim('Run')} ${colors.command('npm run build')} ${colors.dim('to compile the server')}`
    );
  }

  // Check environment variables
  if (mcpConfig.env) {
    console.log(section(`${icons.pencil} Environment variables:`));
    console.log(
      `   ${keyValue('TURSO_URL', mcpConfig.env.TURSO_URL ? colors.success('Set') : colors.error('Not set'))}`
    );
    console.log(
      `   ${keyValue('TURSO_AUTH_TOKEN', mcpConfig.env.TURSO_AUTH_TOKEN ? colors.success('Set') : colors.error('Not set'))}`
    );
    console.log(
      `   ${keyValue('OPENAI_API_KEY', mcpConfig.env.OPENAI_API_KEY ? colors.success('Set') : colors.error('Not set'))}`
    );
    console.log(
      `   ${keyValue('DEFAULT_USER_EMAIL', mcpConfig.env.DEFAULT_USER_EMAIL || colors.dim('Not set'))}`
    );
  }

  console.log(`\n${icons.bulb} ${colors.dim('To apply changes, restart Claude Desktop')}`);
  console.log('');
}

/**
 * Uninstall MCP memory server from Claude Desktop
 */
export async function uninstallClaudeDesktop(): Promise<void> {
  console.log(
    colors.title(`\n${icons.trash} Uninstalling MCP Memory Server from Claude Desktop...\n`)
  );

  // Load Claude Desktop config
  const claudeConfig = loadClaudeDesktopConfig();
  if (!claudeConfig) {
    console.log(warning('Claude Desktop config not found. Nothing to uninstall.'));
    console.log('');
    return;
  }

  // Check if mcp-memory-ts is installed
  if (!claudeConfig.mcpServers['mcp-memory-ts']) {
    console.log(warning('MCP Memory Server not installed. Nothing to uninstall.'));
    console.log('');
    return;
  }

  // Remove mcp-memory-ts entry
  delete claudeConfig.mcpServers['mcp-memory-ts'];

  // Save config
  if (saveClaudeDesktopConfig(claudeConfig)) {
    console.log(success('\nMCP Memory Server uninstalled successfully!'));
    console.log(warning('\nPlease restart Claude Desktop for changes to take effect.'));
    console.log(
      `\n${icons.bulb} ${colors.dim('User configuration in ~/.mcp-memory/ has been preserved.')}`
    );
    console.log('');
  } else {
    process.exit(1);
  }
}
