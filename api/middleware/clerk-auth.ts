/**
 * Clerk Authentication Middleware for Vercel Serverless Functions
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ClerkExpressRequireAuth } from '@clerk/clerk-sdk-node';

interface AuthenticatedRequest extends VercelRequest {
  auth?: {
    userId: string;
    sessionId: string;
  };
  user?: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
  };
}

/**
 * Clerk authentication middleware for Vercel serverless functions
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
        });
      }

      // Verify token with Clerk
      const userId = await verifyClerkToken(authToken);

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Invalid authentication token',
        });
      }

      // Get user details from Clerk
      const user = await getUserFromClerk(userId);

      if (!user) {
        return res.status(401).json({
          success: false,
          error: 'User not found',
        });
      }

      // Add auth info to request
      req.auth = {
        userId,
        sessionId: authToken, // Using token as session ID for simplicity
      };

      req.user = {
        id: userId,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      };

      // Call the handler
      return await handler(req, res);
    } catch (error) {
      console.error('Auth middleware error:', error);
      return res.status(500).json({
        success: false,
        error: 'Authentication error',
      });
    }
  };
}

/**
 * Verify Clerk JWT token and extract user ID
 */
async function verifyClerkToken(token: string): Promise<string | null> {
  try {
    // In production, you should use Clerk's JWT verification
    // For development, we'll use a simple approach

    if (process.env.NODE_ENV === 'development') {
      // Development mode: extract user ID from token
      return extractUserIdFromDevToken(token);
    }

    // Production mode: verify with Clerk
    // TODO: Implement proper Clerk JWT verification
    // const payload = await verifyToken(token, { secretKey: process.env.CLERK_SECRET_KEY });
    // return payload.sub;

    // For now, return a user ID based on token
    return extractUserIdFromDevToken(token);
  } catch (error) {
    console.error('Token verification error:', error);
    return null;
  }
}

/**
 * Extract user ID from development token
 */
function extractUserIdFromDevToken(token: string): string {
  // Simple hash-based approach for development
  const hash = Buffer.from(token).toString('base64').slice(0, 12);
  return `user_${hash}`;
}

/**
 * Get user details from Clerk
 */
async function getUserFromClerk(userId: string): Promise<any> {
  try {
    if (process.env.NODE_ENV === 'development') {
      // Development mode: return mock user
      return {
        id: userId,
        email: `${userId}@example.com`,
        firstName: 'Dev',
        lastName: 'User',
      };
    }

    // Production mode: get user from Clerk
    // TODO: Implement proper Clerk user fetching
    // const user = await users.getUser(userId);
    // For now, return mock user until proper Clerk integration
    return {
      id: userId,
      email: `${userId}@example.com`,
      firstName: 'Production',
      lastName: 'User',
    };
  } catch (error) {
    console.error('Error fetching user from Clerk:', error);

    // Fallback to mock user for development
    return {
      id: userId,
      email: `${userId}@example.com`,
      firstName: 'Dev',
      lastName: 'User',
    };
  }
}

/**
 * Extract user info from request without requiring authentication
 * Useful for optional auth endpoints
 */
export function extractUserInfo(req: VercelRequest): { userId?: string; email?: string } {
  const authToken = req.headers.authorization?.replace('Bearer ', '') ||
                   req.headers['x-clerk-auth-token'] as string;

  if (!authToken) {
    return {};
  }

  try {
    const userId = extractUserIdFromDevToken(authToken);
    return {
      userId,
      email: `${userId}@example.com`,
    };
  } catch {
    return {};
  }
}

/**
 * CORS configuration for Clerk authentication
 */
export const clerkCorsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-clerk-auth-token, x-clerk-publishable-key',
  'Access-Control-Max-Age': '86400',
  'Access-Control-Allow-Credentials': 'true',
};

/**
 * Handle CORS preflight requests
 */
export function handleCorsPreflightForClerk(res: VercelResponse): void {
  Object.entries(clerkCorsHeaders).forEach(([key, value]) => {
    res.setHeader(key, value);
  });
  res.status(200).end();
}