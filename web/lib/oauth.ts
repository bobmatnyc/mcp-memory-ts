/**
 * OAuth 2.0/2.1 Utility Functions
 * Used by OAuth endpoints for credential generation and validation
 */

import bcrypt from 'bcryptjs';
import crypto from 'crypto';

/**
 * Generate OAuth client credentials (ID and secret)
 */
export async function generateClientCredentials(): Promise<{
  clientId: string;
  clientSecret: string;
}> {
  // Generate client ID with prefix for easy identification
  const clientIdBytes = crypto.randomBytes(16).toString('hex');
  const clientId = `mcp_oauth_${clientIdBytes}`;

  // Generate client secret (longer for security)
  const clientSecretBytes = crypto.randomBytes(24).toString('hex');
  const clientSecret = clientSecretBytes;

  return {
    clientId,
    clientSecret,
  };
}

/**
 * Hash client secret using bcrypt
 */
export async function hashSecret(secret: string): Promise<string> {
  const saltRounds = 10;
  return bcrypt.hash(secret, saltRounds);
}

/**
 * Verify client secret against hash
 */
export async function verifySecret(secret: string, hash: string): Promise<boolean> {
  return bcrypt.compare(secret, hash);
}

/**
 * Generate authorization code
 */
export function generateAuthorizationCode(): string {
  return `mcp_code_${crypto.randomBytes(32).toString('hex')}`;
}

/**
 * Generate access token
 */
export function generateAccessToken(): string {
  return `mcp_at_${crypto.randomBytes(32).toString('hex')}`;
}

/**
 * Generate refresh token
 */
export function generateRefreshToken(): string {
  return `mcp_rt_${crypto.randomBytes(32).toString('hex')}`;
}

/**
 * Generate state parameter for CSRF protection
 */
export function generateState(): string {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Validate redirect URI against allowed list
 */
export function validateRedirectUri(redirectUri: string, allowedUris: string[]): boolean {
  return allowedUris.includes(redirectUri);
}

/**
 * Validate scopes against allowed list
 */
export function validateScopes(requestedScopes: string[], allowedScopes: string[]): boolean {
  return requestedScopes.every(scope => allowedScopes.includes(scope));
}
