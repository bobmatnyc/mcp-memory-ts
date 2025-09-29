/**
 * CORS Configuration for Cross-Origin Access
 * Optimized for Python clients and web applications
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

// Allowed origins for CORS
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:8080',
  'http://localhost:5000',
  'https://localhost:3000',
  'https://localhost:8080',
  'https://localhost:5000',
  'https://mcp-memory-ts.vercel.app',
  'https://mcp-memory-ts-git-main.vercel.app',
  // Add your custom domains here
];

// Python client user agents
const pythonClientPatterns = [
  /python-requests/i,
  /urllib/i,
  /python/i,
  /httpx/i,
  /aiohttp/i,
];

/**
 * Enhanced CORS configuration for API routes
 */
export function getCorsHeaders(req: VercelRequest): Record<string, string> {
  const origin = req.headers.origin as string;
  const userAgent = req.headers['user-agent'] as string;

  // Check if origin is allowed
  const isOriginAllowed = origin && (
    allowedOrigins.includes(origin) ||
    origin.includes('localhost') ||
    origin.includes('127.0.0.1') ||
    origin.endsWith('.vercel.app')
  );

  // Check if it's a Python client
  const isPythonClient = userAgent && pythonClientPatterns.some(pattern => pattern.test(userAgent));

  // For Python clients or allowed origins, set appropriate CORS headers
  const corsHeaders: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
    'Access-Control-Allow-Headers': [
      'Content-Type',
      'Authorization',
      'x-clerk-auth-token',
      'x-clerk-publishable-key',
      'x-api-key',
      'x-requested-with',
      'x-client-type',
      'x-client-version',
      'user-agent',
      'accept',
      'accept-language',
      'accept-encoding',
    ].join(', '),
    'Access-Control-Max-Age': '86400', // 24 hours
    'Access-Control-Expose-Headers': [
      'x-total-count',
      'x-rate-limit-remaining',
      'x-rate-limit-reset',
      'x-request-id',
    ].join(', '),
  };

  // Set origin based on request
  if (isPythonClient) {
    // For Python clients, allow any origin
    corsHeaders['Access-Control-Allow-Origin'] = '*';
    corsHeaders['Access-Control-Allow-Credentials'] = 'false';
  } else if (isOriginAllowed) {
    // For web clients, use specific origin
    corsHeaders['Access-Control-Allow-Origin'] = origin;
    corsHeaders['Access-Control-Allow-Credentials'] = 'true';
  } else {
    // For unknown origins, be restrictive
    corsHeaders['Access-Control-Allow-Origin'] = 'null';
    corsHeaders['Access-Control-Allow-Credentials'] = 'false';
  }

  return corsHeaders;
}

/**
 * Apply CORS headers to response
 */
export function applyCorsHeaders(req: VercelRequest, res: VercelResponse): void {
  const corsHeaders = getCorsHeaders(req);

  Object.entries(corsHeaders).forEach(([key, value]) => {
    res.setHeader(key, value);
  });

  // Additional headers for Python clients
  const userAgent = req.headers['user-agent'] as string;
  const isPythonClient = userAgent && pythonClientPatterns.some(pattern => pattern.test(userAgent));

  if (isPythonClient) {
    // Python-specific headers
    res.setHeader('Access-Control-Allow-Private-Network', 'true');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
  }
}

/**
 * Handle CORS preflight requests
 */
export function handlePreflight(req: VercelRequest, res: VercelResponse): boolean {
  if (req.method === 'OPTIONS') {
    applyCorsHeaders(req, res);
    res.status(200).end();
    return true;
  }
  return false;
}

/**
 * CORS middleware factory
 */
export function withCors(
  handler: (req: VercelRequest, res: VercelResponse) => Promise<void> | void
) {
  return async (req: VercelRequest, res: VercelResponse) => {
    // Handle preflight requests
    if (handlePreflight(req, res)) {
      return;
    }

    // Apply CORS headers
    applyCorsHeaders(req, res);

    // Call the actual handler
    return await handler(req, res);
  };
}

/**
 * Configuration for different client types
 */
export const corsConfig = {
  // Web application configuration
  web: {
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'x-clerk-auth-token',
      'x-clerk-publishable-key',
    ],
  },

  // Python client configuration
  python: {
    origin: '*',
    credentials: false,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'x-api-key',
      'x-client-type',
      'x-client-version',
      'user-agent',
    ],
  },

  // API client configuration
  api: {
    origin: '*',
    credentials: false,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'x-api-key',
    ],
  },
};

/**
 * Get client type from request
 */
export function getClientType(req: VercelRequest): 'web' | 'python' | 'api' | 'unknown' {
  const userAgent = req.headers['user-agent'] as string;
  const clientType = req.headers['x-client-type'] as string;

  // Explicit client type header
  if (clientType) {
    return clientType as any;
  }

  // Detect Python clients
  if (userAgent && pythonClientPatterns.some(pattern => pattern.test(userAgent))) {
    return 'python';
  }

  // Detect web browsers
  if (userAgent && /mozilla|chrome|safari|firefox/i.test(userAgent)) {
    return 'web';
  }

  // Default to API client
  return 'api';
}