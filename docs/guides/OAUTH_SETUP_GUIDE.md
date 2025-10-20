# OAuth 2.0 Provider Setup Guide

This guide explains how to set up and configure the OAuth 2.0 provider for Claude.AI custom connector integration.

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Database Setup](#database-setup)
4. [Client Registration](#client-registration)
5. [Claude.AI Configuration](#claudeai-configuration)
6. [Testing the Integration](#testing-the-integration)
7. [Security Considerations](#security-considerations)
8. [Troubleshooting](#troubleshooting)

## Overview

The MCP Memory OAuth 2.0 provider enables external applications (like Claude.AI) to securely access user data through the authorization code flow. This implementation follows the OAuth 2.0 standard (RFC 6749) and supports:

- Authorization code grant type
- Refresh token grant type
- PKCE (Proof Key for Code Exchange) support
- Scope-based permissions
- Token revocation
- Automatic token cleanup

## Architecture

### Components

1. **Authorization Endpoint** (`/api/oauth/authorize`)
   - Handles authorization requests
   - Validates client and redirect URI
   - Redirects to consent screen

2. **Token Endpoint** (`/api/oauth/token`)
   - Exchanges authorization codes for access tokens
   - Supports token refresh
   - Validates client credentials

3. **Consent Screen** (`/oauth/consent`)
   - User authorization interface
   - Displays requested permissions
   - Generates authorization codes

4. **OAuth Utilities** (`src/utils/oauth.ts`)
   - Token generation and validation
   - Cryptographic operations
   - Database operations

5. **Enhanced Auth Middleware** (`src/middleware/mcp-auth.ts`)
   - Supports both Clerk and OAuth tokens
   - Validates access tokens
   - Extracts user information

### Authentication Flow

```
1. Client redirects user to /api/oauth/authorize
2. User authenticates via Clerk (if not already)
3. User sees consent screen at /oauth/consent
4. User approves → authorization code generated
5. Client exchanges code for access token at /api/oauth/token
6. Client uses access token to call /api/mcp endpoints
```

## Database Setup

### Step 1: Run Migration

Execute the OAuth database migration to create required tables:

```bash
# Dry run (preview changes)
npm run migrate:oauth:dry-run

# Execute migration
npm run migrate:oauth
```

This creates the following tables:

- **oauth_clients**: Registered OAuth applications
- **oauth_authorization_codes**: Temporary authorization codes (10-minute expiry)
- **oauth_access_tokens**: Long-lived access tokens (7-day expiry)
- **oauth_refresh_tokens**: Refresh tokens for token renewal (30-day expiry)

### Step 2: Verify Migration

Check that tables were created successfully:

```bash
# Connect to your database and verify
# For Turso, use the Turso CLI or web interface
```

## Client Registration

### Interactive Registration

Use the built-in CLI tool to register Claude.AI as an OAuth client:

```bash
npm run oauth:register-client
```

The tool will prompt you for:

1. **Client Name**: e.g., "Claude.AI Custom Connector"
2. **Redirect URIs**: Claude.AI callback URLs (comma-separated)
3. **Allowed Scopes**: Permissions the client can request
4. **Created By**: Your Clerk user ID

### Example Session

```
========================================
  OAuth 2.0 Client Registration Tool
========================================

Client name (e.g., "Claude.AI Custom Connector"): Claude.AI Custom Connector
Redirect URIs (comma-separated, e.g., "https://claude.ai/oauth/callback"): https://claude.ai/oauth/callback
Allowed scopes (comma-separated, default: "memories:read,memories:write"): memories:read,memories:write,entities:read,entities:write
Created by user ID (Clerk user ID): user_2xxx...

----------------------------------------
Client Configuration:
----------------------------------------
Name: Claude.AI Custom Connector
Redirect URIs:
  - https://claude.ai/oauth/callback
Allowed Scopes: memories:read, memories:write, entities:read, entities:write
Created By: user_2xxx...
----------------------------------------

Confirm registration? (yes/no): yes

========================================
✅ OAuth Client Registered Successfully!
========================================

Client Credentials:
----------------------------------------
Client ID:     mcp_oauth_a1b2c3d4e5f6...
Client Secret: 7890abcdef1234567890abcdef123456...
----------------------------------------
```

**IMPORTANT**: Save these credentials securely! The client secret will NOT be shown again.

### Manual Registration

For programmatic registration, use the database directly or create a custom script:

```typescript
import { initDatabaseFromEnv } from './src/database/connection.js';
import { generateClientCredentials, hashSecret, storeOAuthClient } from './src/utils/oauth.js';

const { clientId, clientSecret } = generateClientCredentials();
const clientSecretHash = await hashSecret(clientSecret);

const db = initDatabaseFromEnv();
await db.connect();

await storeOAuthClient(db, {
  clientId,
  clientSecretHash,
  name: 'My OAuth Client',
  redirectUris: ['https://example.com/callback'],
  allowedScopes: ['memories:read', 'memories:write'],
  createdBy: 'user_id',
});

await db.disconnect();
```

## Claude.AI Configuration

### Custom Connector Setup

1. **Navigate to Claude.AI Settings**
   - Go to Custom Connectors section
   - Click "Add Custom Connector"

2. **Configure OAuth Settings**

   | Field | Value |
   |-------|-------|
   | Name | MCP Memory |
   | Authorization URL | `https://your-domain.com/api/oauth/authorize` |
   | Token URL | `https://your-domain.com/api/oauth/token` |
   | Client ID | `mcp_oauth_...` (from registration) |
   | Client Secret | `...` (from registration) |
   | Scopes | `memories:read memories:write` |

3. **Set API Endpoint**
   - Base URL: `https://your-domain.com/api/mcp`
   - Authentication: OAuth 2.0 (configured above)

4. **Test Connection**
   - Claude.AI will redirect you to the authorization page
   - You'll see the consent screen
   - Approve the request
   - Claude.AI will receive the access token

### Redirect URI Requirements

The redirect URI must:
- Use HTTPS in production (HTTP allowed for localhost)
- Match exactly what's registered in the database
- Be whitelisted in your CORS configuration

Claude.AI typically uses:
- `https://claude.ai/oauth/callback`
- `https://claude.ai/api/oauth/callback`

Check Claude.AI documentation for the exact redirect URI.

## Testing the Integration

### Manual Testing

#### 1. Authorization Request

Open this URL in a browser (replace with your values):

```
https://your-domain.com/api/oauth/authorize?response_type=code&client_id=mcp_oauth_...&redirect_uri=https://claude.ai/oauth/callback&scope=memories:read%20memories:write&state=random_state_123
```

Expected flow:
- Redirects to login if not authenticated
- Shows consent screen
- User approves
- Redirects to callback with `?code=auth_...&state=random_state_123`

#### 2. Token Exchange

Exchange the authorization code for an access token:

```bash
curl -X POST https://your-domain.com/api/oauth/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=authorization_code" \
  -d "code=auth_..." \
  -d "redirect_uri=https://claude.ai/oauth/callback" \
  -d "client_id=mcp_oauth_..." \
  -d "client_secret=..."
```

Expected response:

```json
{
  "access_token": "mcp_at_...",
  "token_type": "Bearer",
  "expires_in": 604800,
  "refresh_token": "mcp_rt_...",
  "scope": "memories:read memories:write"
}
```

#### 3. API Request with Access Token

Test the access token with an MCP request:

```bash
curl -X POST https://your-domain.com/api/mcp \
  -H "Authorization: Bearer mcp_at_..." \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

Expected: Valid MCP response with available tools.

### Automated Testing

Create a test script:

```typescript
// test-oauth-flow.ts
import fetch from 'node-fetch';

const CLIENT_ID = 'mcp_oauth_...';
const CLIENT_SECRET = '...';
const REDIRECT_URI = 'https://your-domain.com/test/callback';

async function testTokenExchange(authCode: string) {
  const response = await fetch('https://your-domain.com/api/oauth/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: authCode,
      redirect_uri: REDIRECT_URI,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
    }),
  });

  return response.json();
}

async function testMCPRequest(accessToken: string) {
  const response = await fetch('https://your-domain.com/api/mcp', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/list',
    }),
  });

  return response.json();
}
```

## Security Considerations

### Client Secret Protection

- **Never expose client secrets in client-side code**
- Store secrets in environment variables or secure vaults
- Use secure channels (HTTPS) for all OAuth communications
- Rotate secrets periodically

### State Parameter

Always include a `state` parameter in authorization requests to prevent CSRF attacks:

```typescript
const state = crypto.randomBytes(32).toString('hex');
// Store state in session
// Include in authorization URL
// Validate on callback
```

### Token Security

- Access tokens expire after 7 days
- Refresh tokens expire after 30 days
- Tokens are stored hashed in the database
- Implement token revocation for compromised tokens

### Scope Validation

Only grant necessary scopes:

- `memories:read` - Read memories
- `memories:write` - Create/update/delete memories
- `entities:read` - Read entities
- `entities:write` - Create/update/delete entities

### HTTPS Requirements

- **Production**: All endpoints MUST use HTTPS
- **Development**: HTTP allowed only for localhost
- Configure proper TLS certificates

### Rate Limiting

Implement rate limiting on:
- Authorization endpoint (prevent brute force)
- Token endpoint (prevent token abuse)
- MCP endpoints (prevent API abuse)

### Token Cleanup

Run periodic cleanup to remove expired tokens:

```typescript
import { initDatabaseFromEnv } from './src/database/connection.js';
import { cleanupExpiredTokens } from './src/utils/oauth.js';

const db = initDatabaseFromEnv();
await db.connect();
const result = await cleanupExpiredTokens(db);
console.log(`Cleaned up: ${result.deletedCodes} codes, ${result.deletedTokens} tokens`);
await db.disconnect();
```

Schedule this as a cron job:

```bash
# Run daily at 2 AM
0 2 * * * cd /path/to/mcp-memory-ts && tsx scripts/cleanup-tokens.ts
```

## Troubleshooting

### Common Issues

#### 1. "Invalid client_id"

**Cause**: Client not registered or client_id incorrect

**Solution**:
- Verify client exists in database: `SELECT * FROM oauth_clients WHERE client_id = '...'`
- Re-register client if needed
- Check for typos in client_id

#### 2. "Invalid redirect_uri"

**Cause**: Redirect URI doesn't match registered URIs

**Solution**:
- Check registered URIs: `SELECT redirect_uris FROM oauth_clients WHERE client_id = '...'`
- Ensure exact match (including trailing slashes, protocol, port)
- Update registered URIs if needed

#### 3. "Invalid or expired authorization code"

**Cause**: Code already used, expired, or invalid

**Solution**:
- Authorization codes expire after 10 minutes
- Codes can only be used once
- Request a new authorization code
- Check database: `SELECT * FROM oauth_authorization_codes WHERE code = '...'`

#### 4. "Invalid grant"

**Cause**: Code doesn't match client_id or redirect_uri

**Solution**:
- Ensure client_id matches the one that requested the code
- Ensure redirect_uri matches exactly
- Check for clock skew (code may have expired)

#### 5. OAuth token not recognized by MCP

**Cause**: Token validation failing or wrong token format

**Solution**:
- Verify token starts with `mcp_at_`
- Check token exists and isn't revoked: `SELECT * FROM oauth_access_tokens WHERE token = '...'`
- Verify token hasn't expired
- Check middleware is properly updated

### Debug Mode

Enable debug logging:

```bash
# In .env or environment
LOG_LEVEL=debug
MCP_DEBUG=1

# Start server
npm run web:dev
```

Check logs for detailed OAuth flow information.

### Database Inspection

Useful queries for debugging:

```sql
-- Check all registered clients
SELECT client_id, name, redirect_uris, is_active FROM oauth_clients;

-- Check recent authorization codes
SELECT code, client_id, user_id, expires_at, used
FROM oauth_authorization_codes
ORDER BY created_at DESC
LIMIT 10;

-- Check active access tokens
SELECT token, client_id, user_id, expires_at, revoked
FROM oauth_access_tokens
WHERE revoked = 0 AND expires_at > datetime('now')
ORDER BY created_at DESC;

-- Count tokens by client
SELECT c.name, COUNT(t.token) as active_tokens
FROM oauth_clients c
LEFT JOIN oauth_access_tokens t ON c.client_id = t.client_id
WHERE t.revoked = 0 AND t.expires_at > datetime('now')
GROUP BY c.client_id;
```

## Advanced Topics

### Custom Scopes

Add custom scopes by:

1. Defining scope in client registration
2. Implementing scope validation in endpoints
3. Checking scope in MCP handlers

```typescript
// Example: Check if token has required scope
const hasScope = (tokenScope: string, requiredScope: string): boolean => {
  const scopes = tokenScope.split(' ');
  return scopes.includes(requiredScope);
};
```

### Token Revocation

Implement token revocation endpoint:

```typescript
// /api/oauth/revoke
import { revokeAccessToken } from '../src/utils/oauth.js';

export async function POST(request: NextRequest) {
  const { token } = await request.json();
  const db = initDatabaseFromEnv();
  await db.connect();
  const revoked = await revokeAccessToken(db, token);
  await db.disconnect();
  return NextResponse.json({ revoked });
}
```

### PKCE Support

The schema includes fields for PKCE (code_challenge, code_challenge_method). To implement:

1. Client generates code_verifier
2. Client sends code_challenge in authorization request
3. Store in oauth_authorization_codes table
4. Validate code_verifier in token exchange

### Multiple Redirect URIs

Register multiple redirect URIs for different environments:

```typescript
const redirectUris = [
  'https://production.example.com/callback',
  'https://staging.example.com/callback',
  'http://localhost:3000/callback', // Development only
];
```

## Support

For issues or questions:

1. Check this guide and troubleshooting section
2. Review implementation in `src/utils/oauth.ts`
3. Check database state with SQL queries above
4. Enable debug logging for detailed flow information
5. Consult OAuth 2.0 RFC 6749 for specification details

---

**Version**: 1.0.0
**Last Updated**: 2025-10-20
**Author**: MCP Memory Team
