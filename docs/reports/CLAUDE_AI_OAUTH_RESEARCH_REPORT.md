# Claude.AI Custom Connector OAuth Research Report

## Executive Summary

**Current Status**: The mcp-memory-ts project has a **complete OAuth consumer implementation** (Google OAuth for contacts/calendar), Clerk-based authentication, and a Vercel-deployed MCP server. However, there are **NO OAuth provider endpoints** that would allow Claude.AI to authenticate users via OAuth 2.0 authorization code flow.

**Gap Identified**: Claude.AI custom connectors require OAuth 2.0 provider functionality (authorization endpoint, token endpoint, user consent screen), which is currently NOT implemented in this project.

**Recommendation**: Implement custom OAuth 2.0 provider endpoints that wrap around existing Clerk authentication.

---

## 1. Current OAuth Implementation Analysis

### 1.1 OAuth Consumer (Google Integration)
**Location**: `src/utils/google-auth.ts`, `web/app/api/auth/google-connect/`

**Functionality**:
- ✅ Authorization URL generation for Google OAuth
- ✅ Token exchange (authorization code → access/refresh tokens)
- ✅ Token storage in user metadata
- ✅ Automatic token refresh
- ✅ Callback handler at `/api/auth/google-connect/callback`

**Purpose**: Allows MCP Memory users to connect their Google accounts for Contacts/Calendar sync.

**Not Applicable For**: Claude.AI connector authentication (this is consumer-side, not provider-side OAuth).

### 1.2 Clerk Authentication System
**Location**: `src/middleware/mcp-auth.ts`, `web/middleware.ts`, `web/lib/auth.ts`

**Functionality**:
- ✅ User authentication with Clerk OAuth
- ✅ Session management (1-hour timeout)
- ✅ Bearer token validation
- ✅ Multi-tenant user isolation
- ✅ Secure session storage

**Key Components**:
```typescript
// Authentication Flow
1. Client gets Clerk session token
2. Client sends token in Authorization header
3. Server validates token with Clerk API
4. Server creates MCP session
5. Server returns authenticated user context
```

**Current Authentication Endpoints**:
- ❌ NO `/authorize` endpoint (OAuth authorization)
- ❌ NO `/token` endpoint (OAuth token exchange)
- ✅ YES `/api/mcp` endpoint (JSON-RPC with Bearer token)
- ✅ YES `/api/health` endpoint (public health check)

### 1.3 MCP Server Implementation
**Location**: `api/mcp/index.ts` (Vercel), `src/desktop-mcp-server.ts` (stdio)

**Deployment**:
- **Vercel Production**: `https://ai-memory.app/api/mcp` (serverless, 30s timeout)
- **Self-Hosted**: `http://localhost:3003/mcp` (for long operations)
- **Claude Desktop**: stdio protocol (local integration)

**Authentication Method**: Clerk Bearer token in `Authorization` header

**Not Suitable For**: Claude.AI custom connectors (requires OAuth 2.0 provider flow, not Bearer token).

---

## 2. Claude.AI Custom Connector OAuth Requirements

### 2.1 OAuth 2.0 Authorization Code Flow
Claude.AI custom connectors typically require:

1. **Authorization Endpoint** (`/oauth/authorize`)
   - User consent screen
   - Scope selection
   - State parameter for CSRF protection
   - Redirect to Claude.AI with authorization code

2. **Token Endpoint** (`/oauth/token`)
   - Exchange authorization code for access token
   - Return `access_token`, `token_type`, `expires_in`
   - Optional `refresh_token` for long-lived access

3. **Client Credentials**
   - `client_id`: Identifier for Claude.AI connector
   - `client_secret`: Shared secret for token validation
   - `redirect_uri`: Claude.AI callback URL

4. **User Info Endpoint** (Optional)
   - `/oauth/userinfo` or `/api/user/me`
   - Returns authenticated user information

### 2.2 Standard OAuth 2.0 Flow
```
1. Claude.AI redirects user to:
   https://ai-memory.app/oauth/authorize?
     client_id=CLAUDE_CLIENT_ID&
     redirect_uri=https://claude.ai/oauth/callback&
     response_type=code&
     scope=memories:read memories:write&
     state=RANDOM_STATE

2. User sees consent screen on ai-memory.app:
   "Claude.AI wants to access your memories"
   [Scopes: Read memories, Write memories]
   [Approve] [Deny]

3. User approves, redirected to:
   https://claude.ai/oauth/callback?
     code=AUTHORIZATION_CODE&
     state=RANDOM_STATE

4. Claude.AI exchanges code for token:
   POST https://ai-memory.app/oauth/token
   Body: {
     grant_type: "authorization_code",
     code: "AUTHORIZATION_CODE",
     client_id: "CLAUDE_CLIENT_ID",
     client_secret: "CLAUDE_CLIENT_SECRET",
     redirect_uri: "https://claude.ai/oauth/callback"
   }

5. Server responds with access token:
   {
     access_token: "mcp_token_xyz",
     token_type: "Bearer",
     expires_in: 3600,
     scope: "memories:read memories:write"
   }

6. Claude.AI uses token to call MCP:
   POST https://ai-memory.app/api/mcp
   Authorization: Bearer mcp_token_xyz
   Body: { jsonrpc: "2.0", method: "tools/list", ... }
```

---

## 3. Gap Analysis: Missing OAuth Provider Infrastructure

### 3.1 Required Endpoints (Currently Missing)

#### ❌ Authorization Endpoint
**Expected URL**: `/oauth/authorize` or `/api/oauth/authorize`

**Required Functionality**:
- Validate client_id and redirect_uri
- Display user consent screen
- Handle user approval/denial
- Generate authorization code
- Store authorization code with state and expiration
- Redirect to Claude.AI callback with code

**Status**: **NOT IMPLEMENTED**

#### ❌ Token Endpoint
**Expected URL**: `/oauth/token` or `/api/oauth/token`

**Required Functionality**:
- Validate client credentials (client_id, client_secret)
- Validate authorization code
- Exchange code for access token
- Generate MCP-compatible Bearer token
- Return token response (JSON)
- Implement token expiration

**Status**: **NOT IMPLEMENTED**

#### ✅ Resource Endpoint (Partially Complete)
**Current URL**: `/api/mcp`

**Required Functionality**:
- Accept Bearer token authentication ✅
- Validate token against stored sessions ✅
- Execute MCP JSON-RPC methods ✅
- Enforce user isolation ✅

**Status**: **IMPLEMENTED** (already supports Bearer tokens)

### 3.2 Required Database Schema (Currently Missing)

#### OAuth Clients Table
Store registered OAuth clients (like Claude.AI):
```sql
CREATE TABLE oauth_clients (
  id TEXT PRIMARY KEY,
  client_id TEXT UNIQUE NOT NULL,
  client_secret TEXT NOT NULL,
  name TEXT NOT NULL,
  redirect_uris TEXT NOT NULL, -- JSON array
  scopes TEXT NOT NULL, -- JSON array
  created_at TEXT NOT NULL
);
```

#### Authorization Codes Table
Store temporary authorization codes:
```sql
CREATE TABLE oauth_authorization_codes (
  code TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  redirect_uri TEXT NOT NULL,
  scope TEXT NOT NULL,
  state TEXT,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  used BOOLEAN DEFAULT 0
);
```

#### OAuth Tokens Table (Optional - can reuse Clerk sessions)
Store issued access tokens:
```sql
CREATE TABLE oauth_tokens (
  token TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  scope TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  revoked BOOLEAN DEFAULT 0
);
```

### 3.3 Required Configuration (Currently Missing)

#### Environment Variables
```bash
# OAuth Provider Configuration
OAUTH_ISSUER=https://ai-memory.app
OAUTH_AUTHORIZE_URL=https://ai-memory.app/oauth/authorize
OAUTH_TOKEN_URL=https://ai-memory.app/oauth/token

# Claude.AI Client Registration
CLAUDE_CLIENT_ID=claude_ai_connector_12345
CLAUDE_CLIENT_SECRET=secret_xyz_must_be_secure
CLAUDE_REDIRECT_URI=https://claude.ai/oauth/callback

# Token Configuration
OAUTH_TOKEN_EXPIRY=3600  # 1 hour
OAUTH_CODE_EXPIRY=600    # 10 minutes
```

---

## 4. Implementation Approach Recommendations

### Option A: Custom OAuth Provider Endpoints (Recommended)

**Pros**:
- Full control over OAuth flow
- Can integrate seamlessly with existing Clerk authentication
- Supports standard OAuth 2.0 specification
- Works with any OAuth-compatible client (Claude.AI, other services)

**Cons**:
- Requires implementing OAuth 2.0 specification
- Need to handle authorization codes, token generation, validation
- Additional security considerations (PKCE, scope validation)

**Effort**: Medium (2-3 days development)

**Implementation Path**:
1. Create `/api/oauth/authorize` endpoint (user consent screen)
2. Create `/api/oauth/token` endpoint (token exchange)
3. Add database tables for OAuth clients and codes
4. Implement token generation and validation
5. Integrate with existing Clerk authentication
6. Add scope-based access control

### Option B: Clerk OAuth Provider (If Supported)

**Check**: Clerk has OAuth provider functionality in Enterprise plans

**Pros**:
- Minimal custom code
- Clerk handles OAuth complexity
- Built-in security features

**Cons**:
- May require Clerk Enterprise plan (expensive)
- Less flexibility in customization
- Dependent on Clerk's OAuth implementation

**Effort**: Low (1 day configuration) IF Clerk supports it

**Action Required**: Research if Clerk supports acting as OAuth provider

### Option C: Hybrid Approach (Clerk + Custom Token Exchange)

**Strategy**:
- Use Clerk for user authentication (existing flow)
- Implement custom OAuth wrapper around Clerk tokens
- Create authorization and token endpoints
- Map OAuth tokens to Clerk sessions

**Pros**:
- Leverages existing Clerk infrastructure
- Custom OAuth endpoints for Claude.AI
- Maintains existing authentication flow

**Cons**:
- Complexity in mapping between OAuth and Clerk
- Need to maintain token synchronization

**Effort**: Medium (2-3 days development)

**Implementation Path**:
1. Keep existing Clerk authentication
2. Add OAuth authorization endpoint (wraps Clerk auth)
3. Add OAuth token endpoint (generates tokens tied to Clerk sessions)
4. Use Clerk session validation for token verification

---

## 5. Recommended Implementation: Hybrid Approach

### 5.1 Architecture Overview

```
┌─────────────┐
│  Claude.AI  │
└──────┬──────┘
       │
       │ 1. Redirect to authorize
       ▼
┌─────────────────────────────────┐
│  /oauth/authorize               │
│  - Check Clerk session          │
│  - Show consent screen          │
│  - Generate auth code           │
│  - Redirect back to Claude      │
└──────┬──────────────────────────┘
       │
       │ 2. Return code
       ▼
┌─────────────┐
│  Claude.AI  │
└──────┬──────┘
       │
       │ 3. Exchange code for token
       ▼
┌─────────────────────────────────┐
│  /oauth/token                   │
│  - Validate code & credentials  │
│  - Create Clerk-backed session  │
│  - Return access token          │
└──────┬──────────────────────────┘
       │
       │ 4. Use token for MCP calls
       ▼
┌─────────────────────────────────┐
│  /api/mcp                       │
│  - Validate Bearer token        │
│  - Get user from token          │
│  - Execute MCP operations       │
└─────────────────────────────────┘
```

### 5.2 Required Endpoints

#### 1. Authorization Endpoint
**Path**: `/api/oauth/authorize`
**Method**: GET
**Query Parameters**:
- `client_id` (required): Claude.AI client identifier
- `redirect_uri` (required): Claude.AI callback URL
- `response_type` (required): Must be "code"
- `scope` (optional): Requested permissions
- `state` (required): CSRF protection token

**Implementation**:
```typescript
// File: web/app/api/oauth/authorize/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { validateOAuthClient } from '@/lib/oauth-provider';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get('client_id');
  const redirectUri = searchParams.get('redirect_uri');
  const responseType = searchParams.get('response_type');
  const scope = searchParams.get('scope') || 'memories:read memories:write';
  const state = searchParams.get('state');

  // Validate OAuth parameters
  if (!clientId || !redirectUri || responseType !== 'code' || !state) {
    return NextResponse.json(
      { error: 'invalid_request', error_description: 'Missing required parameters' },
      { status: 400 }
    );
  }

  // Validate client_id and redirect_uri
  const client = await validateOAuthClient(clientId, redirectUri);
  if (!client) {
    return NextResponse.json(
      { error: 'invalid_client', error_description: 'Invalid client credentials' },
      { status: 401 }
    );
  }

  // Check if user is authenticated with Clerk
  const { userId } = await auth();
  if (!userId) {
    // Redirect to Clerk sign-in, then back to authorize
    const signInUrl = `/sign-in?redirect_url=${encodeURIComponent(request.url)}`;
    return NextResponse.redirect(signInUrl);
  }

  // User is authenticated - show consent screen
  // This would render a consent UI page
  return NextResponse.redirect(
    `/oauth/consent?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}&state=${state}`
  );
}
```

#### 2. Consent Screen Page
**Path**: `/oauth/consent`
**Method**: GET (display), POST (approval)

**Implementation**:
```typescript
// File: web/app/oauth/consent/page.tsx
'use client';

export default function ConsentPage({ searchParams }) {
  const clientName = getClientName(searchParams.client_id); // e.g., "Claude.AI"
  const scopes = searchParams.scope.split(' ');

  const handleApprove = async () => {
    // Generate authorization code
    const code = await generateAuthorizationCode({
      clientId: searchParams.client_id,
      userId: currentUser.id,
      redirectUri: searchParams.redirect_uri,
      scope: searchParams.scope,
      state: searchParams.state,
    });

    // Redirect back to Claude.AI with code
    const callbackUrl = `${searchParams.redirect_uri}?code=${code}&state=${searchParams.state}`;
    window.location.href = callbackUrl;
  };

  return (
    <div className="consent-screen">
      <h1>{clientName} wants to access your MCP Memory</h1>
      <ul>
        {scopes.map(scope => (
          <li key={scope}>{getScopeDescription(scope)}</li>
        ))}
      </ul>
      <button onClick={handleApprove}>Approve</button>
      <button onClick={() => window.location.href = searchParams.redirect_uri + '?error=access_denied'}>
        Deny
      </button>
    </div>
  );
}
```

#### 3. Token Endpoint
**Path**: `/api/oauth/token`
**Method**: POST
**Content-Type**: `application/x-www-form-urlencoded` or `application/json`
**Body Parameters**:
- `grant_type` (required): Must be "authorization_code"
- `code` (required): Authorization code from authorize endpoint
- `client_id` (required): Claude.AI client identifier
- `client_secret` (required): Claude.AI client secret
- `redirect_uri` (required): Must match original redirect_uri

**Implementation**:
```typescript
// File: web/app/api/oauth/token/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { validateAuthorizationCode, generateAccessToken } from '@/lib/oauth-provider';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { grant_type, code, client_id, client_secret, redirect_uri } = body;

  // Validate grant type
  if (grant_type !== 'authorization_code') {
    return NextResponse.json(
      { error: 'unsupported_grant_type', error_description: 'Only authorization_code is supported' },
      { status: 400 }
    );
  }

  // Validate client credentials
  const client = await validateClientCredentials(client_id, client_secret);
  if (!client) {
    return NextResponse.json(
      { error: 'invalid_client', error_description: 'Invalid client credentials' },
      { status: 401 }
    );
  }

  // Validate and consume authorization code
  const codeData = await validateAuthorizationCode(code, client_id, redirect_uri);
  if (!codeData) {
    return NextResponse.json(
      { error: 'invalid_grant', error_description: 'Invalid or expired authorization code' },
      { status: 400 }
    );
  }

  // Generate access token linked to user
  const accessToken = await generateAccessToken({
    clientId: client_id,
    userId: codeData.userId,
    scope: codeData.scope,
  });

  // Return token response
  return NextResponse.json({
    access_token: accessToken.token,
    token_type: 'Bearer',
    expires_in: 3600,
    scope: codeData.scope,
  });
}
```

#### 4. MCP Endpoint (Already Exists - Minor Updates)
**Path**: `/api/mcp`
**Updates Needed**: Support OAuth-issued tokens alongside Clerk tokens

```typescript
// Update: src/middleware/mcp-auth.ts
export async function authenticateRequest(authHeader?: string): Promise<AuthResult> {
  const token = extractBearerToken(authHeader);
  if (!token) {
    return { authenticated: false, error: 'Missing token' };
  }

  // Try OAuth token first
  const oauthUser = await validateOAuthToken(token);
  if (oauthUser) {
    return { authenticated: true, user: oauthUser };
  }

  // Fall back to Clerk token
  const clerkUser = await verifyClerkToken(`Bearer ${token}`);
  if (clerkUser) {
    return { authenticated: true, user: clerkUser };
  }

  return { authenticated: false, error: 'Invalid token' };
}
```

### 5.3 Required Database Migrations

```typescript
// File: scripts/add-oauth-provider-schema.ts
export async function addOAuthProviderSchema(db: DatabaseOperations) {
  // OAuth Clients table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS oauth_clients (
      id TEXT PRIMARY KEY,
      client_id TEXT UNIQUE NOT NULL,
      client_secret TEXT NOT NULL,
      name TEXT NOT NULL,
      redirect_uris TEXT NOT NULL,
      allowed_scopes TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  // Authorization Codes table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS oauth_authorization_codes (
      code TEXT PRIMARY KEY,
      client_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      redirect_uri TEXT NOT NULL,
      scope TEXT NOT NULL,
      state TEXT,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      used INTEGER DEFAULT 0,
      FOREIGN KEY (client_id) REFERENCES oauth_clients(client_id)
    );
  `);

  // OAuth Tokens table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS oauth_tokens (
      token TEXT PRIMARY KEY,
      client_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      scope TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      revoked INTEGER DEFAULT 0,
      FOREIGN KEY (client_id) REFERENCES oauth_clients(client_id)
    );
  `);

  // Register Claude.AI as OAuth client
  await db.exec(`
    INSERT OR IGNORE INTO oauth_clients (
      id, client_id, client_secret, name, redirect_uris, allowed_scopes, created_at, updated_at
    ) VALUES (
      'claude_ai_connector',
      '${process.env.CLAUDE_CLIENT_ID}',
      '${process.env.CLAUDE_CLIENT_SECRET}',
      'Claude.AI Custom Connector',
      '["https://claude.ai/oauth/callback"]',
      '["memories:read", "memories:write", "entities:read", "entities:write"]',
      datetime('now'),
      datetime('now')
    );
  `);
}
```

### 5.4 Configuration Parameters for Claude.AI Connector

Once implemented, provide these configuration values to Claude.AI:

```yaml
# OAuth Provider Configuration
authorization_endpoint: https://ai-memory.app/api/oauth/authorize
token_endpoint: https://ai-memory.app/api/oauth/token
client_id: claude_ai_connector_12345
client_secret: [SECURE_SECRET_KEY]
redirect_uri: https://claude.ai/oauth/callback  # Or Claude.AI's actual callback
scope: memories:read memories:write entities:read entities:write

# MCP Endpoint
mcp_endpoint: https://ai-memory.app/api/mcp
authentication: Bearer token (from OAuth flow)

# Optional
revoke_endpoint: https://ai-memory.app/api/oauth/revoke
userinfo_endpoint: https://ai-memory.app/api/oauth/userinfo
```

---

## 6. Step-by-Step Implementation Plan

### Phase 1: Database Schema (Day 1, ~4 hours)

1. **Create migration script**
   - File: `scripts/add-oauth-provider-schema.ts`
   - Add `oauth_clients`, `oauth_authorization_codes`, `oauth_tokens` tables
   - Create indexes for performance

2. **Run migration**
   ```bash
   npm run migrate:oauth-provider
   ```

3. **Verify schema**
   ```bash
   npm run verify:oauth-provider
   ```

### Phase 2: OAuth Library Setup (Day 1, ~4 hours)

1. **Create OAuth provider utilities**
   - File: `src/utils/oauth-provider.ts`
   - Functions: `generateAuthorizationCode()`, `generateAccessToken()`, `validateToken()`
   - Use secure random generation (crypto.randomBytes)

2. **Create OAuth database operations**
   - File: `src/database/oauth-operations.ts`
   - Functions: `createAuthCode()`, `validateAuthCode()`, `storeToken()`, `validateToken()`

3. **Add OAuth client management**
   - File: `src/models/oauth-client.ts`
   - Client registration, validation, secret management

### Phase 3: Authorization Endpoint (Day 2, ~4 hours)

1. **Create authorization route**
   - File: `web/app/api/oauth/authorize/route.ts`
   - Parameter validation
   - Client validation
   - Clerk authentication check
   - Redirect to consent screen

2. **Create consent screen UI**
   - File: `web/app/oauth/consent/page.tsx`
   - Display client name and requested scopes
   - Approval/denial buttons
   - Generate authorization code on approval

3. **Test authorization flow**
   ```bash
   curl "http://localhost:3002/api/oauth/authorize?client_id=test&redirect_uri=http://localhost:3000/callback&response_type=code&state=xyz"
   ```

### Phase 4: Token Endpoint (Day 2, ~4 hours)

1. **Create token exchange route**
   - File: `web/app/api/oauth/token/route.ts`
   - Code validation
   - Client credential validation
   - Token generation
   - JSON response

2. **Update MCP authentication middleware**
   - File: `src/middleware/mcp-auth.ts`
   - Add OAuth token validation
   - Support both Clerk and OAuth tokens

3. **Test token exchange**
   ```bash
   curl -X POST http://localhost:3002/api/oauth/token \
     -H "Content-Type: application/json" \
     -d '{"grant_type":"authorization_code","code":"AUTH_CODE","client_id":"test","client_secret":"secret","redirect_uri":"http://localhost:3000/callback"}'
   ```

### Phase 5: Testing & Validation (Day 3, ~4 hours)

1. **Create test OAuth client**
   ```bash
   npm run oauth:register-client -- --name "Test Client" --redirect-uri "http://localhost:3000/callback"
   ```

2. **End-to-end flow test**
   - Start authorization flow
   - Approve consent
   - Exchange code for token
   - Use token to call MCP endpoint

3. **Security validation**
   - Test expired codes
   - Test invalid client credentials
   - Test CSRF protection (state parameter)
   - Test token expiration

### Phase 6: Documentation & Deployment (Day 3, ~4 hours)

1. **Create OAuth provider documentation**
   - File: `docs/oauth/OAUTH_PROVIDER_GUIDE.md`
   - Setup instructions
   - Client registration process
   - Security best practices

2. **Update environment configuration**
   - Add OAuth configuration to `.env.example`
   - Document required environment variables

3. **Deploy to Vercel**
   ```bash
   vercel --prod
   ```

4. **Register Claude.AI client**
   ```bash
   npm run oauth:register-client -- \
     --name "Claude.AI Custom Connector" \
     --client-id "claude_ai_connector" \
     --redirect-uri "https://claude.ai/oauth/callback"
   ```

5. **Provide configuration to Claude.AI team**
   - Authorization URL
   - Token URL
   - Client credentials
   - Supported scopes

---

## 7. Security Considerations

### 7.1 Critical Security Requirements

1. **Client Secret Protection**
   - Store client secrets with bcrypt hashing
   - Never log or expose client secrets
   - Rotate secrets regularly

2. **Authorization Code Security**
   - Short expiration (10 minutes max)
   - Single-use codes (mark as used after exchange)
   - Bind code to specific client and redirect URI

3. **State Parameter Validation**
   - Require state parameter for CSRF protection
   - Validate state on callback
   - Use cryptographically secure random values

4. **Token Security**
   - Use secure random token generation (32+ bytes)
   - Implement token expiration (1 hour recommended)
   - Support token revocation
   - Consider implementing PKCE for additional security

5. **Redirect URI Validation**
   - Exact match only (no wildcard matching)
   - HTTPS required in production
   - Validate against registered URIs

### 7.2 Rate Limiting

Implement rate limiting on OAuth endpoints:
```typescript
// 10 requests per minute per IP for /oauth/authorize
// 5 requests per minute per client for /oauth/token
```

### 7.3 Audit Logging

Log all OAuth events:
- Authorization attempts
- Code generation
- Token issuance
- Token validation failures
- Client authentication failures

---

## 8. Testing Strategy

### 8.1 Unit Tests
- OAuth code generation and validation
- Token generation and validation
- Client credential validation
- Scope parsing and validation

### 8.2 Integration Tests
- Full authorization flow
- Token exchange flow
- MCP endpoint with OAuth token
- Error handling (invalid codes, expired tokens)

### 8.3 Security Tests
- CSRF protection (state parameter)
- Authorization code reuse prevention
- Token expiration enforcement
- Client credential validation
- Redirect URI validation

### 8.4 Performance Tests
- Token validation latency
- Database query performance
- Concurrent authorization flows

---

## 9. Alternative: Clerk OAuth Provider Investigation

**Action Item**: Research if Clerk supports OAuth provider functionality

**If YES**:
- Check Clerk documentation for OAuth provider setup
- Verify if available in current plan (may require Enterprise)
- Compare implementation effort vs custom solution

**If NO**:
- Proceed with custom OAuth provider implementation (recommended approach)

**Research Links**:
- https://clerk.com/docs/authentication/oauth
- https://dashboard.clerk.com/ → Check available features

---

## 10. Estimated Timeline & Resources

### Timeline
- **Phase 1 (Database)**: 4 hours
- **Phase 2 (OAuth Library)**: 4 hours
- **Phase 3 (Authorization)**: 4 hours
- **Phase 4 (Token Exchange)**: 4 hours
- **Phase 5 (Testing)**: 4 hours
- **Phase 6 (Deployment)**: 4 hours

**Total**: 24 hours (~3 working days)

### Resources Required
- 1 Backend Developer (familiar with OAuth 2.0)
- Access to Vercel deployment
- Access to database for migrations
- Claude.AI custom connector documentation
- OAuth 2.0 specification reference

### Dependencies
- Existing Clerk authentication (✅ implemented)
- Existing MCP server (✅ implemented)
- Database migration system (✅ implemented)
- Vercel deployment pipeline (✅ implemented)

---

## 11. Conclusion & Next Steps

### Current State
The mcp-memory-ts project has a **solid foundation** for adding OAuth provider capabilities:
- ✅ Clerk authentication system
- ✅ MCP server with Bearer token support
- ✅ Database infrastructure
- ✅ Vercel serverless deployment
- ❌ Missing: OAuth provider endpoints (authorize, token)

### Recommended Action
**Implement Custom OAuth 2.0 Provider** (Hybrid Approach):
1. Add OAuth provider endpoints wrapping Clerk authentication
2. Create user consent flow
3. Generate OAuth-compatible tokens linked to Clerk sessions
4. Maintain existing MCP functionality

### Priority
**HIGH** - Required for Claude.AI custom connector integration

### Success Criteria
- [ ] Authorization endpoint functional (`/api/oauth/authorize`)
- [ ] Token endpoint functional (`/api/oauth/token`)
- [ ] User consent screen implemented
- [ ] Claude.AI can complete full OAuth flow
- [ ] MCP endpoint accepts OAuth-issued tokens
- [ ] Security requirements met (CSRF, expiration, validation)
- [ ] Documentation provided for Claude.AI team

### Risks
- **Medium**: OAuth 2.0 implementation complexity
- **Low**: Clerk integration issues (already validated)
- **Low**: Performance impact (tokens are cached)

### Mitigation
- Follow OAuth 2.0 specification strictly
- Implement comprehensive testing
- Use battle-tested libraries where possible
- Security audit before production deployment

---

**Report Generated**: 2025-10-20
**Version**: 1.7.2+
**Author**: Claude Code Research Agent
**Status**: Ready for Implementation

