/**
 * Google OAuth Service
 *
 * Manages Google OAuth2 authentication, token storage, and automatic refresh.
 * Tokens are stored encrypted in user metadata for security.
 */

import { google } from 'googleapis';
import type { OAuth2Client } from 'google-auth-library';
import { DatabaseOperations } from '../database/operations.js';
import type { GoogleOAuthTokens, SyncResult, SyncError } from '../types/google.js';
import { GOOGLE_SCOPES } from '../types/google.js';

export { GOOGLE_SCOPES };

/**
 * GoogleAuthService handles OAuth authentication with Google APIs
 *
 * Features:
 * - Token generation and exchange
 * - Automatic token refresh
 * - Secure token storage in user metadata
 * - Scope validation
 */
export class GoogleAuthService {
  private oauth2Client: OAuth2Client;
  private tokenRefreshPromises: Map<string, Promise<void>> = new Map();

  constructor(
    private db: DatabaseOperations,
    private clientId: string,
    private clientSecret: string,
    private redirectUri: string
  ) {
    this.oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  }

  /**
   * Generate authorization URL for OAuth consent flow
   *
   * @param scopes - Array of Google OAuth scopes
   * @param state - Optional state parameter (typically user ID)
   * @returns Authorization URL to redirect user to
   */
  generateAuthUrl(scopes: string[], state?: string): string {
    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline', // Get refresh token
      scope: scopes,
      state,
      prompt: 'consent', // Force consent to get refresh token
    });
  }

  /**
   * Exchange authorization code for OAuth tokens
   *
   * @param code - Authorization code from OAuth callback
   * @returns Google OAuth tokens
   */
  async getTokensFromCode(code: string): Promise<SyncResult<GoogleOAuthTokens>> {
    try {
      const { tokens } = await this.oauth2Client.getToken(code);

      if (!tokens.access_token) {
        return {
          ok: false,
          error: {
            type: 'AUTH_ERROR',
            message: 'No access token received from Google',
          },
        };
      }

      // Ensure all required fields are present and non-null
      const oauthTokens: GoogleOAuthTokens = {
        access_token: tokens.access_token || '',
        refresh_token: tokens.refresh_token || '',
        scope: tokens.scope || '',
        token_type: tokens.token_type || 'Bearer',
        expiry_date: tokens.expiry_date || Date.now() + 3600000,
      };

      return {
        ok: true,
        data: oauthTokens,
      };
    } catch (error) {
      return {
        ok: false,
        error: {
          type: 'AUTH_ERROR',
          message: error instanceof Error ? error.message : 'Failed to exchange code for tokens',
        },
      };
    }
  }

  /**
   * Store OAuth tokens in user metadata
   *
   * @param userId - User email or ID
   * @param tokens - OAuth tokens to store
   */
  async storeTokens(userId: string, tokens: GoogleOAuthTokens): Promise<SyncResult<void>> {
    try {
      console.log('[GoogleAuthService] Storing tokens for user:', userId);

      // Try to find user by ID first (most common case - Clerk userId)
      let user = await this.db.getUserById(userId);

      // Fall back to email lookup if not found by ID
      if (!user) {
        console.log('[GoogleAuthService] User not found by ID, trying email lookup:', userId);
        user = await this.db.getUserByEmail(userId);
      }

      if (!user) {
        console.error('[GoogleAuthService] User not found in database:', {
          userId,
          triedById: true,
          triedByEmail: true,
        });
        return {
          ok: false,
          error: {
            type: 'VALIDATION_ERROR',
            message: `User not found in database: ${userId}. User must exist before storing tokens.`,
          },
        };
      }

      console.log('[GoogleAuthService] User found, updating metadata:', {
        userId: user.id,
        email: user.email,
        hasExistingMetadata: !!user.metadata,
      });

      // Update user metadata with tokens
      const updatedUser = await this.db.updateUser(user.id, {
        metadata: {
          ...(user.metadata || {}),
          googleOAuthTokens: tokens,
          googleOAuthConnectedAt: new Date().toISOString(),
        },
      });

      if (!updatedUser) {
        console.error('[GoogleAuthService] User update returned null:', user.id);
        return {
          ok: false,
          error: {
            type: 'NETWORK_ERROR',
            message: 'Failed to update user - update operation returned null',
          },
        };
      }

      // Verify tokens were stored
      const hasTokens = updatedUser.metadata?.googleOAuthTokens;
      console.log('[GoogleAuthService] Token storage result:', {
        userId: updatedUser.id,
        tokensStored: !!hasTokens,
        metadataKeys: updatedUser.metadata ? Object.keys(updatedUser.metadata) : [],
      });

      if (!hasTokens) {
        console.error('[GoogleAuthService] Tokens not found in updated user metadata');
        return {
          ok: false,
          error: {
            type: 'NETWORK_ERROR',
            message: 'Token storage verification failed - tokens not found after update',
          },
        };
      }

      console.log('[GoogleAuthService] Tokens stored and verified successfully');
      return { ok: true, data: undefined };
    } catch (error) {
      console.error('[GoogleAuthService] Error storing tokens:', {
        userId,
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined,
      });
      return {
        ok: false,
        error: {
          type: 'NETWORK_ERROR',
          message: error instanceof Error ? error.message : 'Failed to store tokens',
        },
      };
    }
  }

  /**
   * Get authenticated OAuth2 client for user
   *
   * @param userId - User email or ID
   * @returns Authenticated OAuth2Client or null if not connected
   */
  async getAuthClient(userId: string): Promise<OAuth2Client | null> {
    try {
      let user = await this.db.getUserByEmail(userId);
      if (!user) {
        user = await this.db.getUserById(userId);
      }

      if (!user?.metadata?.googleOAuthTokens) {
        return null;
      }

      const tokens = user.metadata.googleOAuthTokens as GoogleOAuthTokens;
      const client = new google.auth.OAuth2(this.clientId, this.clientSecret, this.redirectUri);

      // Set credentials with proper typing
      client.setCredentials({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        scope: tokens.scope,
        token_type: tokens.token_type,
        expiry_date: tokens.expiry_date,
      });

      // Auto-refresh token handler with race condition prevention
      client.on('tokens', async newTokens => {
        console.log('🔄 OAuth tokens auto-refreshed for user:', userId);

        // Wait for any existing refresh operation to complete
        const existingRefresh = this.tokenRefreshPromises.get(userId);
        if (existingRefresh) {
          console.log('[GoogleAuthService] Waiting for existing token refresh to complete...');
          await existingRefresh;
        }

        // Store new tokens with synchronization
        const updatedTokens: GoogleOAuthTokens = {
          access_token: newTokens.access_token || tokens.access_token,
          refresh_token: newTokens.refresh_token || tokens.refresh_token,
          scope: newTokens.scope || tokens.scope,
          token_type: newTokens.token_type || tokens.token_type,
          expiry_date: newTokens.expiry_date || tokens.expiry_date,
        };

        const refreshPromise = (async () => {
          const result = await this.storeTokens(userId, updatedTokens);
          if (!result.ok) {
            const { error } = result;
            console.error('[GoogleAuthService] Failed to store refreshed tokens:', error);
          }
        })().finally(() => {
          // Clean up promise after completion
          this.tokenRefreshPromises.delete(userId);
        });

        this.tokenRefreshPromises.set(userId, refreshPromise);
        await refreshPromise;
      });

      return client;
    } catch (error) {
      console.error('Failed to get auth client:', error);
      return null;
    }
  }

  /**
   * Check if user has valid Google OAuth connection
   *
   * @param userId - User email or ID
   * @returns True if user has valid tokens
   */
  async isConnected(userId: string): Promise<boolean> {
    try {
      let user = await this.db.getUserByEmail(userId);
      if (!user) {
        user = await this.db.getUserById(userId);
      }

      return !!user?.metadata?.googleOAuthTokens;
    } catch (error) {
      console.error('Failed to check connection status:', error);
      return false;
    }
  }

  /**
   * Revoke Google OAuth access and remove stored tokens
   *
   * @param userId - User email or ID
   */
  async revokeAccess(userId: string): Promise<SyncResult<void>> {
    try {
      const client = await this.getAuthClient(userId);
      if (client) {
        await client.revokeCredentials();
      }

      let user = await this.db.getUserByEmail(userId);
      if (!user) {
        user = await this.db.getUserById(userId);
      }

      if (user) {
        await this.db.updateUser(user.id, {
          metadata: {
            ...(user.metadata || {}),
            googleOAuthTokens: undefined,
            googleOAuthConnectedAt: undefined,
            googleContactsSyncToken: undefined,
            googleContactsSyncAt: undefined,
          },
        });
      }

      return { ok: true, data: undefined };
    } catch (error) {
      return {
        ok: false,
        error: {
          type: 'NETWORK_ERROR',
          message: error instanceof Error ? error.message : 'Failed to revoke access',
        },
      };
    }
  }

  /**
   * Validate that stored tokens have required scopes
   *
   * @param userId - User email or ID
   * @param requiredScopes - Array of required scopes
   * @returns True if all required scopes are present
   */
  async hasRequiredScopes(userId: string, requiredScopes: string[]): Promise<boolean> {
    try {
      let user = await this.db.getUserByEmail(userId);
      if (!user) {
        user = await this.db.getUserById(userId);
      }

      const tokens = user?.metadata?.googleOAuthTokens as GoogleOAuthTokens | undefined;
      if (!tokens) return false;

      const grantedScopes = tokens.scope.split(' ');
      return requiredScopes.every(required => grantedScopes.includes(required));
    } catch (error) {
      console.error('Failed to validate scopes:', error);
      return false;
    }
  }

  /**
   * Get granted scopes for a user
   *
   * @param userId - User email or ID
   * @returns Array of granted scopes or null if not connected
   */
  async getUserScopes(userId: string): Promise<string[] | null> {
    try {
      let user = await this.db.getUserByEmail(userId);
      if (!user) {
        user = await this.db.getUserById(userId);
      }

      const tokens = user?.metadata?.googleOAuthTokens as GoogleOAuthTokens | undefined;
      if (!tokens) return null;

      return tokens.scope.split(' ').filter(s => s.length > 0);
    } catch (error) {
      console.error('Failed to get user scopes:', error);
      return null;
    }
  }
}
