/**
 * Color utilities for CLI output using chalk
 */

import chalk from 'chalk';

export const colors = {
  // Status colors
  success: chalk.green,
  error: chalk.red,
  warning: chalk.yellow,
  info: chalk.cyan,
  debug: chalk.gray,

  // UI elements
  command: chalk.bold.cyan,
  option: chalk.yellow,
  parameter: chalk.green,
  description: chalk.white,
  example: chalk.gray,
  highlight: chalk.bold.white,
  dim: chalk.dim,

  // Special
  title: chalk.bold.cyan,
  subtitle: chalk.cyan,
  link: chalk.blue.underline,
};

export const icons = {
  success: chalk.green('✅'),
  error: chalk.red('❌'),
  warning: chalk.yellow('⚠️'),
  info: chalk.cyan('ℹ️'),
  rocket: '🚀',
  gear: '🔧',
  magnify: '🔍',
  package: '📦',
  pencil: '📝',
  database: '📊',
  robot: '🤖',
  trash: '🗑️',
  cycle: '🔄',
  lightning: '⚡',
  book: '📖',
  bulb: '💡',
  contacts: '👥',
};

/**
 * Format success message
 */
export function success(message: string): string {
  return `${icons.success} ${colors.success(message)}`;
}

/**
 * Format error message
 */
export function error(message: string): string {
  return `${icons.error} ${colors.error(message)}`;
}

/**
 * Format warning message
 */
export function warning(message: string): string {
  return `${icons.warning} ${colors.warning(message)}`;
}

/**
 * Format info message
 */
export function info(message: string): string {
  return `${icons.info} ${colors.info(message)}`;
}

/**
 * Format command with syntax highlighting
 */
export function command(cmd: string): string {
  return colors.command(cmd);
}

/**
 * Format example with dimmed style
 */
export function example(text: string): string {
  return colors.example(text);
}

/**
 * Format section header
 */
export function section(title: string): string {
  return colors.title(`\n${title}`);
}

/**
 * Format subsection
 */
export function subsection(title: string): string {
  return colors.subtitle(`\n${title}`);
}

/**
 * Format link
 */
export function link(url: string): string {
  return colors.link(url);
}

/**
 * Format key-value pair
 */
export function keyValue(key: string, value: string): string {
  return `${colors.dim(key)}: ${colors.highlight(value)}`;
}
