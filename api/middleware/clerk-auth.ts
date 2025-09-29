/**
 * Clerk Authentication Middleware for Vercel Serverless Functions
 * Pure server-side authentication using @clerk/backend
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyToken } from '@clerk/backend';
import { createClerkClient } from '@clerk/backend';

interface AuthenticatedRequest extends VercelRequest {
  auth?: {
    userId: string;
    sessionId?: string;
    sessionClaims?: any;
  };
  user?: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
  };
}

// Initialize Clerk client for server-side operations
const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY!
});

/**
 * Clerk authentication middleware for Vercel serverless functions
 * This is a pure server-side implementation
 */
export async function withClerkAuth(
  handler: (req: AuthenticatedRequest, res: VercelResponse) => Promise<void> | void
) {
  return async (req: AuthenticatedRequest, res: VercelResponse) => {
    try {
      // Extract auth token from headers
      const authToken = req.headers.authorization?.replace('Bearer ', '') ||
                       req.headers['x-clerk-auth-token'] as string;

      if (!authToken) {
        return res.status(401).json({
          success: false,
          error: 'Missing authentication token',
          message: 'Please provide a valid authentication token in the Authorization header',
        });
      }

      // Verify token with Clerk (server-side only)
      const secretKey = process.env.CLERK_SECRET_KEY;
      if (!secretKey) {
        console.error('CLERK_SECRET_KEY not configured');
        return res.status(500).json({
          success: false,
          error: 'Authentication service not configured',
          message: 'The server is not properly configured for authentication',
        });
      }

      let userId: string;
      let sessionClaims: any;

      try {
        // Verify the JWT token with Clerk backend SDK
        const payload = await verifyToken(authToken, {
          secretKey,
        });

        userId = payload.sub; // Get user ID from token
        sessionClaims = payload;

        // Add auth info to request
        req.auth = {
          userId,
          sessionId: payload.sid,
          sessionClaims,
        };

        // Optionally fetch full user details from Clerk
        try {
          const user = await clerkClient.users.getUser(userId);

          req.user = {
            id: user.id,
            email: user.emailAddresses[0]?.emailAddress || '',
            firstName: user.firstName || undefined,
            lastName: user.lastName || undefined,
          };
        } catch (userError) {
          // If we can't fetch user details, continue with just the user ID
          console.log('Could not fetch user details:', userError);
          req.user = {
            id: userId,
            email: '',
          };
        }

      } catch (error) {
        console.error('Token verification failed:', error);

        // In development mode only, allow a fallback for testing
        if (process.env.NODE_ENV === 'development' && process.env.ALLOW_DEV_AUTH === 'true') {
          userId = 'dev_' + Buffer.from(authToken).toString('base64').slice(0, 8);
          console.log('Development mode: using fallback user ID:', userId);

          req.auth = {
            userId,
          };

          req.user = {
            id: userId,
            email: `${userId}@dev.local`,
            firstName: 'Dev',
            lastName: 'User',
          };
        } else {
          return res.status(401).json({
            success: false,
            error: 'Invalid authentication token',
            message: 'The provided authentication token is invalid or expired',
          });
        }
      }

      // Call the handler
      return await handler(req, res);
    } catch (error) {
      console.error('Auth middleware error:', error);
      return res.status(500).json({
        success: false,
        error: 'Authentication error',
        message: 'An error occurred while processing authentication',
      });
    }
  };
}

/**
 * Extract user info from request without requiring authentication
 * Useful for optional auth endpoints
 */
export async function extractUserInfo(req: VercelRequest): Promise<{ userId?: string; email?: string }> {
  const authToken = req.headers.authorization?.replace('Bearer ', '') ||
                   req.headers['x-clerk-auth-token'] as string;

  if (!authToken) {
    return {};
  }

  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) {
    return {};
  }

  try {
    const payload = await verifyToken(authToken, { secretKey });
    const userId = payload.sub;

    // Try to get user email from Clerk
    try {
      const user = await clerkClient.users.getUser(userId);
      return {
        userId,
        email: user.emailAddresses[0]?.emailAddress,
      };
    } catch {
      // If we can't get user details, just return the userId
      return { userId };
    }
  } catch {
    // Development fallback
    if (process.env.NODE_ENV === 'development' && process.env.ALLOW_DEV_AUTH === 'true') {
      const userId = 'dev_' + Buffer.from(authToken).toString('base64').slice(0, 8);
      return {
        userId,
        email: `${userId}@dev.local`,
      };
    }
    return {};
  }
}

/**
 * Verify a Clerk session token (server-side only)
 */
export async function verifyClerkSession(sessionToken: string): Promise<boolean> {
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) {
    return false;
  }

  try {
    await verifyToken(sessionToken, { secretKey });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get user by ID from Clerk (server-side only)
 */
export async function getClerkUser(userId: string) {
  try {
    return await clerkClient.users.getUser(userId);
  } catch (error) {
    console.error('Failed to fetch user from Clerk:', error);
    return null;
  }
}

/**
 * List users from Clerk (server-side only)
 */
export async function listClerkUsers(limit: number = 10) {
  try {
    const users = await clerkClient.users.getUserList({ limit });
    return users;
  } catch (error) {
    console.error('Failed to list users from Clerk:', error);
    return [];
  }
}

/**
 * CORS configuration for authentication endpoints
 * Note: These are server-side headers only
 */
export const authCorsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-clerk-auth-token',
  'Access-Control-Max-Age': '86400',
  'Access-Control-Allow-Credentials': 'false', // Set to false for pure server-side
};

/**
 * Handle CORS preflight requests for auth endpoints
 */
export function handleCorsPreflightForAuth(res: VercelResponse): void {
  Object.entries(authCorsHeaders).forEach(([key, value]) => {
    res.setHeader(key, value);
  });
  res.status(200).end();
}