/**
 * MCP Authentication Middleware
 * Handles Clerk OAuth authentication for remote MCP server
 */

import { createClerkClient } from '@clerk/backend';

// Initialize Clerk client with secret key
const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY!,
});

export interface AuthenticatedUser {
  userId: string;
  email: string;
  sessionId: string;
  authenticated: boolean;
}

export interface SessionData {
  user: AuthenticatedUser;
  createdAt: Date;
  expiresAt: Date;
}

/**
 * Session manager for authenticated users
 */
export class SessionManager {
  private sessions: Map<string, SessionData> = new Map();
  private sessionTimeout = 3600000; // 1 hour in milliseconds

  /**
   * Create a new session for an authenticated user
   */
  createSession(user: AuthenticatedUser): string {
    const sessionId = user.sessionId;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.sessionTimeout);

    this.sessions.set(sessionId, {
      user,
      createdAt: now,
      expiresAt,
    });

    // Clean up expired sessions periodically
    this.cleanupExpiredSessions();

    return sessionId;
  }

  /**
   * Get session data by session ID
   */
  getSession(sessionId: string): SessionData | null {
    const session = this.sessions.get(sessionId);

    if (!session) {
      return null;
    }

    // Check if session has expired
    if (new Date() > session.expiresAt) {
      this.sessions.delete(sessionId);
      return null;
    }

    return session;
  }

  /**
   * Validate a session and return the user
   */
  validateSession(sessionId: string): AuthenticatedUser | null {
    const session = this.getSession(sessionId);
    return session ? session.user : null;
  }

  /**
   * Invalidate a session
   */
  invalidateSession(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  /**
   * Clean up expired sessions
   */
  private cleanupExpiredSessions(): void {
    const now = new Date();
    for (const [sessionId, session] of this.sessions.entries()) {
      if (now > session.expiresAt) {
        this.sessions.delete(sessionId);
      }
    }
  }

  /**
   * Get all active sessions (for debugging/monitoring)
   */
  getActiveSessions(): number {
    this.cleanupExpiredSessions();
    return this.sessions.size;
  }
}

/**
 * Verify Clerk Bearer token and extract user information
 */
export async function verifyClerkToken(token: string): Promise<AuthenticatedUser | null> {
  try {
    // Verify the session token with Clerk
    const sessionToken = token.replace('Bearer ', '').trim();

    // Verify the token and get session
    const session = await clerkClient.sessions.getSession(sessionToken);

    if (!session || !session.userId) {
      console.error('[MCP Auth] Invalid session token');
      return null;
    }

    // Get user details
    const user = await clerkClient.users.getUser(session.userId);

    if (!user) {
      console.error('[MCP Auth] User not found for session');
      return null;
    }

    // Extract primary email
    const primaryEmail = user.emailAddresses.find(email => email.id === user.primaryEmailAddressId);

    if (!primaryEmail) {
      console.error('[MCP Auth] No primary email found for user');
      return null;
    }

    console.info(`[MCP Auth] Authenticated user: ${primaryEmail.emailAddress}`);

    return {
      userId: user.id,
      email: primaryEmail.emailAddress,
      sessionId: session.id,
      authenticated: true,
    };
  } catch (error) {
    console.error('[MCP Auth] Token verification failed:', error);
    return null;
  }
}

/**
 * Extract Bearer token from Authorization header
 */
export function extractBearerToken(authHeader?: string): string | null {
  if (!authHeader) {
    return null;
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }

  return parts[1];
}

/**
 * Middleware to authenticate requests using Clerk
 */
export async function authenticateRequest(
  authHeader?: string,
  sessionManager?: SessionManager
): Promise<{ authenticated: boolean; user?: AuthenticatedUser; error?: string }> {
  // Extract token
  const token = extractBearerToken(authHeader);
  if (!token) {
    return {
      authenticated: false,
      error: 'Missing or invalid Authorization header',
    };
  }

  // Check if we have a session manager and if this is a session token
  if (sessionManager) {
    const user = sessionManager.validateSession(token);
    if (user) {
      return {
        authenticated: true,
        user,
      };
    }
  }

  // Verify with Clerk
  const user = await verifyClerkToken(`Bearer ${token}`);
  if (!user) {
    return {
      authenticated: false,
      error: 'Invalid or expired token',
    };
  }

  // Create session if we have a session manager
  if (sessionManager) {
    sessionManager.createSession(user);
  }

  return {
    authenticated: true,
    user,
  };
}

/**
 * Log authentication event
 */
export function logAuthEvent(
  event: 'success' | 'failure' | 'session_created' | 'session_expired',
  details: Record<string, unknown>
): void {
  const timestamp = new Date().toISOString();
  console.info(`[MCP Auth] [${timestamp}] ${event}:`, JSON.stringify(details, null, 2));
}
