/**
 * OAuth 2.0 Utility Functions
 * Handles token generation, validation, and cryptographic operations
 */

import crypto from 'crypto';
import bcrypt from 'bcrypt';
import type { DatabaseConnection } from '../database/connection.js';

// Security constants
const SALT_ROUNDS = 10;
const CLIENT_ID_PREFIX = 'mcp_oauth_';
const CLIENT_SECRET_LENGTH = 48;
const AUTH_CODE_LENGTH = 32;
const ACCESS_TOKEN_LENGTH = 48;
const REFRESH_TOKEN_LENGTH = 48;

// Token expiry durations (in milliseconds)
export const TOKEN_EXPIRY = {
  authorizationCode: 10 * 60 * 1000, // 10 minutes
  accessToken: 7 * 24 * 60 * 60 * 1000, // 7 days
  refreshToken: 30 * 24 * 60 * 60 * 1000, // 30 days
};

/**
 * Generate a cryptographically secure random string
 */
function generateSecureRandom(length: number, prefix = ''): string {
  const bytes = crypto.randomBytes(Math.ceil(length / 2));
  const randomString = bytes.toString('hex').slice(0, length);
  return prefix + randomString;
}

/**
 * Generate OAuth client credentials (client_id and client_secret)
 */
export function generateClientCredentials(): {
  clientId: string;
  clientSecret: string;
} {
  const clientId = generateSecureRandom(32, CLIENT_ID_PREFIX);
  const clientSecret = generateSecureRandom(CLIENT_SECRET_LENGTH);

  return {
    clientId,
    clientSecret,
  };
}

/**
 * Hash a secret using bcrypt
 */
export async function hashSecret(secret: string): Promise<string> {
  return bcrypt.hash(secret, SALT_ROUNDS);
}

/**
 * Compare a secret with its hashed version
 */
export async function compareSecret(secret: string, hash: string): Promise<boolean> {
  return bcrypt.compare(secret, hash);
}

/**
 * Generate an authorization code
 */
export function generateAuthorizationCode(): string {
  return generateSecureRandom(AUTH_CODE_LENGTH, 'auth_');
}

/**
 * Generate an access token
 */
export function generateAccessToken(): string {
  return generateSecureRandom(ACCESS_TOKEN_LENGTH, 'mcp_at_');
}

/**
 * Generate a refresh token
 */
export function generateRefreshToken(): string {
  return generateSecureRandom(REFRESH_TOKEN_LENGTH, 'mcp_rt_');
}

/**
 * Validate client credentials against database
 */
export async function validateClientCredentials(
  db: DatabaseConnection,
  clientId: string,
  clientSecret: string
): Promise<boolean> {
  try {
    const result = await db.execute(
      'SELECT client_secret_hash, is_active FROM oauth_clients WHERE client_id = ?',
      [clientId]
    );

    if (result.rows.length === 0) {
      return false;
    }

    const client = result.rows[0] as any;

    // Check if client is active
    if (!client.is_active) {
      return false;
    }

    // Verify secret
    return compareSecret(clientSecret, client.client_secret_hash);
  } catch (error) {
    console.error('Error validating client credentials:', error);
    return false;
  }
}

/**
 * Validate and consume an authorization code
 */
export async function validateAuthorizationCode(
  db: DatabaseConnection,
  code: string,
  clientId: string,
  redirectUri: string
): Promise<{
  valid: boolean;
  userId?: string;
  scope?: string;
}> {
  try {
    // Fetch the authorization code
    const result = await db.execute(
      `SELECT user_id, client_id, redirect_uri, scope, expires_at, used
       FROM oauth_authorization_codes
       WHERE code = ?`,
      [code]
    );

    if (result.rows.length === 0) {
      return { valid: false };
    }

    const authCode = result.rows[0] as any;

    // Validate not used
    if (authCode.used) {
      console.error('Authorization code already used');
      return { valid: false };
    }

    // Validate client_id
    if (authCode.client_id !== clientId) {
      console.error('Client ID mismatch');
      return { valid: false };
    }

    // Validate redirect_uri
    if (authCode.redirect_uri !== redirectUri) {
      console.error('Redirect URI mismatch');
      return { valid: false };
    }

    // Validate expiry
    const expiresAt = new Date(authCode.expires_at);
    if (new Date() > expiresAt) {
      console.error('Authorization code expired');
      return { valid: false };
    }

    // Mark as used
    await db.execute('UPDATE oauth_authorization_codes SET used = 1 WHERE code = ?', [code]);

    return {
      valid: true,
      userId: authCode.user_id,
      scope: authCode.scope,
    };
  } catch (error) {
    console.error('Error validating authorization code:', error);
    return { valid: false };
  }
}

/**
 * Validate an access token
 */
export async function validateAccessToken(
  db: DatabaseConnection,
  token: string
): Promise<{
  valid: boolean;
  userId?: string;
  clientId?: string;
  scope?: string;
}> {
  try {
    const result = await db.execute(
      `SELECT user_id, client_id, scope, expires_at, revoked
       FROM oauth_access_tokens
       WHERE token = ?`,
      [token]
    );

    if (result.rows.length === 0) {
      return { valid: false };
    }

    const accessToken = result.rows[0] as any;

    // Check if revoked
    if (accessToken.revoked) {
      return { valid: false };
    }

    // Check expiry
    const expiresAt = new Date(accessToken.expires_at);
    if (new Date() > expiresAt) {
      return { valid: false };
    }

    return {
      valid: true,
      userId: accessToken.user_id,
      clientId: accessToken.client_id,
      scope: accessToken.scope,
    };
  } catch (error) {
    console.error('Error validating access token:', error);
    return { valid: false };
  }
}

/**
 * Store an OAuth client in the database
 */
export async function storeOAuthClient(
  db: DatabaseConnection,
  params: {
    clientId: string;
    clientSecretHash: string;
    name: string;
    redirectUris: string[];
    allowedScopes: string[];
    createdBy: string;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  const now = new Date().toISOString();

  await db.execute(
    `INSERT INTO oauth_clients
     (client_id, client_secret_hash, name, redirect_uris, allowed_scopes, created_at, created_by, metadata)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      params.clientId,
      params.clientSecretHash,
      params.name,
      JSON.stringify(params.redirectUris),
      JSON.stringify(params.allowedScopes),
      now,
      params.createdBy,
      params.metadata ? JSON.stringify(params.metadata) : null,
    ]
  );
}

/**
 * Store an authorization code in the database
 */
export async function storeAuthorizationCode(
  db: DatabaseConnection,
  params: {
    code: string;
    clientId: string;
    userId: string;
    redirectUri: string;
    scope: string;
    state?: string;
  }
): Promise<void> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + TOKEN_EXPIRY.authorizationCode);

  await db.execute(
    `INSERT INTO oauth_authorization_codes
     (code, client_id, user_id, redirect_uri, scope, state, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      params.code,
      params.clientId,
      params.userId,
      params.redirectUri,
      params.scope,
      params.state || null,
      expiresAt.toISOString(),
      now.toISOString(),
    ]
  );
}

/**
 * Store an access token in the database
 */
export async function storeAccessToken(
  db: DatabaseConnection,
  params: {
    token: string;
    clientId: string;
    userId: string;
    scope: string;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + TOKEN_EXPIRY.accessToken);

  await db.execute(
    `INSERT INTO oauth_access_tokens
     (token, client_id, user_id, scope, expires_at, created_at, metadata)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      params.token,
      params.clientId,
      params.userId,
      params.scope,
      expiresAt.toISOString(),
      now.toISOString(),
      params.metadata ? JSON.stringify(params.metadata) : null,
    ]
  );
}

/**
 * Store a refresh token in the database
 */
export async function storeRefreshToken(
  db: DatabaseConnection,
  params: {
    token: string;
    accessToken: string;
    clientId: string;
    userId: string;
    scope: string;
  }
): Promise<void> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + TOKEN_EXPIRY.refreshToken);

  await db.execute(
    `INSERT INTO oauth_refresh_tokens
     (token, access_token, client_id, user_id, scope, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      params.token,
      params.accessToken,
      params.clientId,
      params.userId,
      params.scope,
      expiresAt.toISOString(),
      now.toISOString(),
    ]
  );
}

/**
 * Validate redirect URI against registered URIs
 */
export async function validateRedirectUri(
  db: DatabaseConnection,
  clientId: string,
  redirectUri: string
): Promise<boolean> {
  try {
    const result = await db.execute(
      'SELECT redirect_uris FROM oauth_clients WHERE client_id = ?',
      [clientId]
    );

    if (result.rows.length === 0) {
      return false;
    }

    const client = result.rows[0] as any;
    const registeredUris = JSON.parse(client.redirect_uris) as string[];

    return registeredUris.includes(redirectUri);
  } catch (error) {
    console.error('Error validating redirect URI:', error);
    return false;
  }
}

/**
 * Get OAuth client information
 */
export async function getOAuthClient(
  db: DatabaseConnection,
  clientId: string
): Promise<{
  clientId: string;
  name: string;
  redirectUris: string[];
  allowedScopes: string[];
  isActive: boolean;
} | null> {
  try {
    const result = await db.execute(
      'SELECT client_id, name, redirect_uris, allowed_scopes, is_active FROM oauth_clients WHERE client_id = ?',
      [clientId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const client = result.rows[0] as any;

    return {
      clientId: client.client_id,
      name: client.name,
      redirectUris: JSON.parse(client.redirect_uris),
      allowedScopes: JSON.parse(client.allowed_scopes),
      isActive: Boolean(client.is_active),
    };
  } catch (error) {
    console.error('Error getting OAuth client:', error);
    return null;
  }
}

/**
 * Revoke an access token
 */
export async function revokeAccessToken(
  db: DatabaseConnection,
  token: string
): Promise<boolean> {
  try {
    const result = await db.execute(
      'UPDATE oauth_access_tokens SET revoked = 1 WHERE token = ?',
      [token]
    );

    return (result as any).changes > 0;
  } catch (error) {
    console.error('Error revoking access token:', error);
    return false;
  }
}

/**
 * Clean up expired tokens and codes
 */
export async function cleanupExpiredTokens(db: DatabaseConnection): Promise<{
  deletedCodes: number;
  deletedTokens: number;
  deletedRefreshTokens: number;
}> {
  const now = new Date().toISOString();

  try {
    const codesResult = await db.execute(
      'DELETE FROM oauth_authorization_codes WHERE expires_at < ? OR used = 1',
      [now]
    );

    const tokensResult = await db.execute(
      'DELETE FROM oauth_access_tokens WHERE expires_at < ?',
      [now]
    );

    const refreshResult = await db.execute(
      'DELETE FROM oauth_refresh_tokens WHERE expires_at < ?',
      [now]
    );

    return {
      deletedCodes: (codesResult as any).changes || 0,
      deletedTokens: (tokensResult as any).changes || 0,
      deletedRefreshTokens: (refreshResult as any).changes || 0,
    };
  } catch (error) {
    console.error('Error cleaning up expired tokens:', error);
    return {
      deletedCodes: 0,
      deletedTokens: 0,
      deletedRefreshTokens: 0,
    };
  }
}
