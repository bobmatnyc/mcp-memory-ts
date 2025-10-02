/**
 * User Initialization Wizard
 * Interactive setup for user configuration
 */

import { createInterface } from 'readline';
import { stdin, stdout } from 'process';
import { saveUserConfig, loadUserConfig } from './claude-desktop.js';
import { createClient } from '@libsql/client';
import OpenAI from 'openai';
import { colors, icons, success, error, warning, info, section, keyValue } from './colors.js';

interface PromptOptions {
  question: string;
  default?: string;
  mask?: boolean;
}

/**
 * Prompt user for input
 */
function prompt({ question, default: defaultValue, mask }: PromptOptions): Promise<string> {
  return new Promise(resolve => {
    const rl = createInterface({
      input: stdin,
      output: stdout,
    });

    const displayQuestion = defaultValue ? `${question} (${defaultValue}): ` : `${question}: `;

    if (mask) {
      // For sensitive inputs, don't echo characters
      rl.question(displayQuestion, answer => {
        rl.close();
        resolve(answer || defaultValue || '');
      });
    } else {
      rl.question(displayQuestion, answer => {
        rl.close();
        resolve(answer || defaultValue || '');
      });
    }
  });
}

/**
 * Validate Turso database connection
 */
async function validateTursoConnection(url: string, authToken: string): Promise<boolean> {
  try {
    const client = createClient({
      url,
      authToken,
    });

    // Try a simple query
    await client.execute('SELECT 1');
    return true;
  } catch (err) {
    console.error(error(`Turso connection failed: ${err}`));
    return false;
  }
}

/**
 * Validate OpenAI API key
 */
async function validateOpenAIKey(apiKey: string): Promise<boolean> {
  try {
    const openai = new OpenAI({ apiKey });

    // Try to list models (lightweight operation)
    await openai.models.list();
    return true;
  } catch (err) {
    console.error(error(`OpenAI API key validation failed: ${err}`));
    return false;
  }
}

/**
 * Run initialization wizard
 */
export async function runInitWizard(): Promise<void> {
  console.log(colors.title(`\n${icons.rocket} MCP Memory TypeScript - Initialization Wizard\n`));
  console.log(
    colors.description(
      'This wizard will set up your user configuration for the MCP memory server.\n'
    )
  );

  // Check if config already exists
  const existingConfig = loadUserConfig();
  if (existingConfig) {
    console.log(warning('Existing configuration found:'));
    console.log(`   ${keyValue('User', existingConfig.userEmail)}`);
    console.log(`   ${keyValue('Database', existingConfig.tursoUrl)}\n`);

    const overwrite = await prompt({
      question: 'Do you want to overwrite it? (yes/no)',
      default: 'no',
    });

    if (overwrite.toLowerCase() !== 'yes' && overwrite.toLowerCase() !== 'y') {
      console.log(success('\nKeeping existing configuration.'));
      return;
    }
    console.log('');
  }

  // Collect user information
  const userEmail = await prompt({
    question: 'User email',
    default: existingConfig?.userEmail || 'bob@matsuoka.com',
  });

  console.log(section(`${icons.database} Turso Database Configuration`));
  console.log(colors.dim(`Get your credentials from: ${colors.link('https://turso.tech')}\n`));

  const tursoUrl = await prompt({
    question: 'Turso database URL',
    default: existingConfig?.tursoUrl || '',
  });

  const tursoAuthToken = await prompt({
    question: 'Turso auth token',
    default: existingConfig?.tursoAuthToken || '',
    mask: true,
  });

  console.log(section(`${icons.robot} OpenAI API Configuration`));
  console.log(
    colors.dim(`Get your API key from: ${colors.link('https://platform.openai.com/api-keys')}\n`)
  );

  const openaiApiKey = await prompt({
    question: 'OpenAI API key',
    default: existingConfig?.openaiApiKey || '',
    mask: true,
  });

  console.log(section(`${icons.magnify} Validating configuration...\n`));

  // Validate Turso connection
  console.log(info('Testing Turso connection...'));
  const tursoValid = await validateTursoConnection(tursoUrl, tursoAuthToken);
  if (!tursoValid) {
    console.log(error('Turso connection failed. Please check your credentials.'));
    const continueAnyway = await prompt({
      question: 'Continue anyway? (yes/no)',
      default: 'no',
    });
    if (continueAnyway.toLowerCase() !== 'yes' && continueAnyway.toLowerCase() !== 'y') {
      console.log(error('\nConfiguration aborted.'));
      process.exit(1);
    }
  } else {
    console.log(success('Turso connection successful!'));
  }

  // Validate OpenAI API key
  console.log(info('Testing OpenAI API key...'));
  const openaiValid = await validateOpenAIKey(openaiApiKey);
  if (!openaiValid) {
    console.log(error('OpenAI API key validation failed. Please check your key.'));
    const continueAnyway = await prompt({
      question: 'Continue anyway? (yes/no)',
      default: 'no',
    });
    if (continueAnyway.toLowerCase() !== 'yes' && continueAnyway.toLowerCase() !== 'y') {
      console.log(error('\nConfiguration aborted.'));
      process.exit(1);
    }
  } else {
    console.log(success('OpenAI API key validated!'));
  }

  // Save configuration
  const config = {
    userEmail,
    tursoUrl,
    tursoAuthToken,
    openaiApiKey,
  };

  if (saveUserConfig(config)) {
    console.log(success('\nConfiguration initialized successfully!'));
    console.log(section(`${icons.pencil} Next steps:`));
    console.log(`   ${colors.dim('1.')} Build the project: ${colors.command('npm run build')}`);
    console.log(
      `   ${colors.dim('2.')} Install to Claude Desktop: ${colors.command('mcp-memory claude-desktop install')}`
    );
    console.log(`   ${colors.dim('3.')} Restart Claude Desktop to activate the MCP server`);
    console.log('');
  } else {
    console.log(error('\nFailed to save configuration.'));
    process.exit(1);
  }
}

/**
 * Show current configuration (without sensitive data)
 */
export async function showConfig(): Promise<void> {
  const config = loadUserConfig();

  if (!config) {
    console.log(error('No configuration found. Run "mcp-memory init" to set up.'));
    return;
  }

  console.log(section(`${icons.pencil} Current Configuration\n`));
  console.log(keyValue('User Email', config.userEmail));
  console.log(keyValue('Turso URL', config.tursoUrl));
  console.log(
    keyValue(
      'Turso Token',
      config.tursoAuthToken ? '***' + config.tursoAuthToken.slice(-4) : 'Not set'
    )
  );
  console.log(
    keyValue('OpenAI Key', config.openaiApiKey ? '***' + config.openaiApiKey.slice(-4) : 'Not set')
  );
  console.log('');
}
