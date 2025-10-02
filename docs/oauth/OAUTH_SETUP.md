# OAuth Setup for MCP Memory Service

Complete guide to understanding and implementing OAuth authentication for the Remote MCP Server.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [How It Works](#how-it-works)
- [User Isolation Strategy](#user-isolation-strategy)
- [Session Management](#session-management)
- [Security Considerations](#security-considerations)
- [Quick Links](#quick-links)

---

## Overview

The MCP Memory Service implements **Clerk OAuth authentication** for the Remote MCP Server, enabling secure, multi-tenant memory storage accessible over HTTP. This implementation provides:

- **🔐 Secure Authentication**: Industry-standard OAuth 2.0 via Clerk
- **👥 Multi-Tenant Isolation**: Complete data separation between users
- **🌐 HTTP Access**: JSON-RPC 2.0 over HTTP for web applications
- **⚡ Session Caching**: Efficient token validation and session management
- **🛡️ Rate Limiting**: Per-user rate limits to prevent abuse
- **📊 95.2% Test Success Rate**: Comprehensive test coverage

### Why OAuth for MCP?

Traditional MCP servers use stdio (standard input/output) for local communication with Claude Desktop. The Remote MCP Server extends this with HTTP transport, requiring:

1. **Authentication** - Verify user identity
2. **Authorization** - Ensure users access only their data
3. **Session Management** - Efficiently track authenticated users
4. **Rate Limiting** - Prevent abuse and ensure fair usage

---

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                      Client Application                      │
│  (Web App, Mobile App, Claude Desktop with HTTP transport)  │
└────────────────────────────┬────────────────────────────────┘
                             │
                             │ HTTPS with Bearer Token
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                    Remote MCP Server                         │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              Authentication Middleware               │  │
│  │  • Validates Clerk session token                     │  │
│  │  • Extracts user email and ID                        │  │
│  │  • Creates/validates session                         │  │
│  │  • Rate limiting per user                            │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              Multi-Tenant Memory Core                │  │
│  │  • User-scoped database operations                   │  │
│  │  • Automatic user_email injection                    │  │
│  │  • Vector search with isolation                      │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                    Turso Database (LibSQL)                   │
│  • Multi-tenant data storage                                 │
│  • User isolation via user_email column                      │
│  • Vector embeddings for semantic search                     │
└─────────────────────────────────────────────────────────────┘
```

### Authentication Flow

```
┌────────┐         ┌────────┐         ┌──────────┐         ┌──────────┐
│ Client │         │  Clerk │         │   MCP    │         │ Database │
│        │         │  OAuth │         │  Server  │         │          │
└───┬────┘         └───┬────┘         └────┬─────┘         └────┬─────┘
    │                  │                   │                    │
    │ 1. Login Request │                   │                    │
    ├─────────────────>│                   │                    │
    │                  │                   │                    │
    │ 2. Session Token │                   │                    │
    │<─────────────────┤                   │                    │
    │                  │                   │                    │
    │ 3. MCP Request + Bearer Token        │                    │
    ├──────────────────────────────────────>│                    │
    │                  │                   │                    │
    │                  │ 4. Validate Token │                    │
    │                  │<──────────────────┤                    │
    │                  │                   │                    │
    │                  │ 5. User Info      │                    │
    │                  ├──────────────────>│                    │
    │                  │                   │                    │
    │                  │                   │ 6. Query (user_email)
    │                  │                   ├───────────────────>│
    │                  │                   │                    │
    │                  │                   │ 7. User Data       │
    │                  │                   │<───────────────────┤
    │                  │                   │                    │
    │ 8. MCP Response  │                   │                    │
    │<──────────────────────────────────────┤                    │
    │                  │                   │                    │
```

### Key Components

#### 1. Authentication Middleware (`src/middleware/mcp-auth.ts`)

**Responsibilities:**
- Validate Clerk session tokens
- Extract user information (email, user ID)
- Manage session lifecycle
- Rate limiting enforcement

**Core Functions:**
```typescript
// Authenticate incoming requests
authenticateRequest(authorization: string, sessionManager: SessionManager)

// Session management
class SessionManager {
  createSession(user: AuthenticatedUser): string
  validateSession(sessionId: string): AuthenticatedUser | null
  invalidateSession(sessionId: string): void
  cleanupExpiredSessions(): void
}
```

#### 2. Rate Limiter (`src/middleware/rate-limiter.ts`)

**Responsibilities:**
- Per-user rate limiting using email as key
- Token bucket algorithm for smooth limiting
- Configurable limits via environment variables

**Features:**
- Requests per minute limit (default: 100 production, 1000 dev)
- Automatic token refill
- `Retry-After` header in responses
- Session cleanup

#### 3. Remote MCP Server (`src/remote-mcp-server.ts`)

**Responsibilities:**
- HTTP server with Fastify framework
- JSON-RPC 2.0 protocol handling
- User context injection
- CORS configuration
- Health monitoring

**Endpoints:**
- `POST /mcp` - Main MCP JSON-RPC endpoint
- `GET /health` - Health check and status
- `GET /mcp/tools` - List available tools

---

## How It Works

### 1. Client Authentication

The client application first authenticates with Clerk to obtain a session token:

```javascript
// Example: Clerk authentication in client
import { useAuth } from '@clerk/nextjs';

function MyComponent() {
  const { getToken } = useAuth();

  // Get session token
  const token = await getToken();

  // Use token for MCP requests
  const response = await fetch('https://api.example.com/mcp', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'store_memory',
      params: { content: 'My memory', type: 'MEMORY' }
    })
  });
}
```

### 2. Token Validation

The MCP server validates the token with Clerk:

```typescript
// In middleware/mcp-auth.ts
const session = await clerkClient.sessions.verifySession(
  sessionId,
  sessionToken
);

const user = await clerkClient.users.getUser(session.userId);
```

### 3. Session Creation

Upon successful validation, a session is created:

```typescript
const authenticatedUser = {
  userId: user.id,
  email: user.primaryEmailAddress.emailAddress,
  sessionId: session.id,
  authenticated: true
};

const sessionId = sessionManager.createSession(authenticatedUser);
```

### 4. Request Processing

Every MCP request is processed with user context:

```typescript
// User email is automatically injected
const result = await memoryCore.storeMemory(
  request.user.email,  // Automatic user isolation
  params.content,
  params.type
);
```

---

## User Isolation Strategy

### Database-Level Isolation

All database tables include a `user_email` column for tenant isolation:

```sql
CREATE TABLE IF NOT EXISTS memories (
  id TEXT PRIMARY KEY,
  user_email TEXT NOT NULL,  -- Tenant isolation
  content TEXT NOT NULL,
  memory_type TEXT NOT NULL,
  -- ... other fields
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_memories_user_email
  ON memories(user_email);
```

### Automatic User Scoping

The `MultiTenantMemoryCore` class ensures all operations are user-scoped:

```typescript
class MultiTenantMemoryCore {
  async storeMemory(userEmail: string, content: string, type: MemoryType) {
    // Every query automatically includes user_email
    const result = await this.db.execute({
      sql: `INSERT INTO memories (..., user_email) VALUES (..., ?)`,
      args: [..., userEmail]
    });
  }

  async searchMemories(userEmail: string, query: string) {
    // Searches are automatically scoped to user
    const results = await this.db.execute({
      sql: `SELECT * FROM memories WHERE user_email = ? AND ...`,
      args: [userEmail, ...]
    });
  }
}
```

### Isolation Verification

The test suite verifies complete isolation (95.2% pass rate):

```typescript
// From tests/integration/remote-mcp-auth.test.ts
describe('User Isolation', () => {
  it('prevents access to other users data', async () => {
    // User A stores memory
    await storeMemory(userA.token, 'User A secret');

    // User B cannot access User A's data
    const results = await searchMemories(userB.token, 'User A secret');
    expect(results).toHaveLength(0);
  });
});
```

---

## Session Management

### Session Lifecycle

1. **Creation** - When user first authenticates
2. **Validation** - On each request (with caching)
3. **Expiration** - After timeout (default: 2 hours production, 8 hours dev)
4. **Cleanup** - Automatic removal of expired sessions

### Session Data Structure

```typescript
interface SessionData {
  user: AuthenticatedUser;
  createdAt: Date;
  expiresAt: Date;
}

interface AuthenticatedUser {
  userId: string;        // Clerk user ID
  email: string;         // Primary email (tenant key)
  sessionId: string;     // Clerk session ID
  authenticated: boolean;
}
```

### Configuration

```bash
# Environment variables
SESSION_TIMEOUT_MINUTES=120  # Production: 2 hours
SESSION_TIMEOUT_MINUTES=480  # Development: 8 hours

# Session manager automatically:
# - Creates sessions on auth
# - Validates on each request
# - Cleans up expired sessions
# - Provides monitoring via /health endpoint
```

### Monitoring

Check active sessions via health endpoint:

```bash
curl http://localhost:3003/health | jq .activeSessions
# Response: { "activeSessions": 5 }
```

---

## Security Considerations

### Authentication Security

✅ **Implemented:**
- Industry-standard OAuth 2.0 via Clerk
- Bearer token authentication
- Token validation on every request
- Automatic session expiration
- Rate limiting per user

⚠️ **Best Practices:**
```bash
# Production Configuration
ALLOW_DEV_AUTH=false                    # Never allow dev bypass
CLERK_SECRET_KEY=sk_live_...           # Use production keys
SESSION_TIMEOUT_MINUTES=120            # Reasonable timeout
RATE_LIMIT_REQUESTS_PER_MINUTE=100     # Prevent abuse
```

### Data Isolation Security

✅ **Implemented:**
- Database-level user_email filtering
- No cross-user queries possible
- Automatic user scoping in all operations
- Comprehensive isolation tests

⚠️ **Never:**
```typescript
// ❌ NEVER do this - breaks isolation
db.execute(`SELECT * FROM memories WHERE content LIKE '%${query}%'`);

// ✅ ALWAYS include user filter
db.execute({
  sql: `SELECT * FROM memories WHERE user_email = ? AND content LIKE ?`,
  args: [userEmail, `%${query}%`]
});
```

### Network Security

✅ **Configured in `vercel.json`:**
```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "X-XSS-Protection", "value": "1; mode=block" },
        {
          "key": "Strict-Transport-Security",
          "value": "max-age=31536000; includeSubDomains"
        },
        {
          "key": "Content-Security-Policy",
          "value": "default-src 'self'; ..."
        }
      ]
    }
  ]
}
```

### CORS Security

```bash
# Development (relaxed for testing)
CORS_ORIGIN=*
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3003

# Production (strict)
CORS_ORIGIN=https://ai-memory.app,https://www.ai-memory.app
ALLOWED_ORIGINS=https://ai-memory.app,https://www.ai-memory.app,https://clerk.ai-memory.app
```

### Rate Limiting

Prevents abuse and ensures fair usage:

```typescript
// Token bucket algorithm
class RateLimiter {
  private buckets: Map<string, TokenBucket>;

  async checkLimit(userEmail: string): Promise<boolean> {
    const bucket = this.getBucket(userEmail);

    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      return true;  // Allow request
    }

    return false;  // Rate limit exceeded
  }
}
```

Response when limit exceeded:

```json
{
  "jsonrpc": "2.0",
  "id": null,
  "error": {
    "code": 429,
    "message": "Too Many Requests",
    "data": {
      "retryAfter": 60
    }
  }
}
```

### Security Checklist

Before deploying to production:

- [ ] `ALLOW_DEV_AUTH=false` in production
- [ ] Production Clerk keys configured
- [ ] CORS origins restricted to production domains
- [ ] Rate limiting enabled and configured
- [ ] HTTPS enforced (automatic with Vercel)
- [ ] Security headers enabled in vercel.json
- [ ] Clerk webhook secret configured
- [ ] All environment variables in Vercel dashboard (not in code)
- [ ] `.env` files in `.gitignore`
- [ ] Session timeout appropriate for use case

---

## Quick Links

### Documentation
- [Quick Start Guide](./OAUTH_QUICKSTART.md) - Get started in 5 minutes
- [API Reference](./OAUTH_API_REFERENCE.md) - Complete API documentation
- [Deployment Guide](./OAUTH_DEPLOYMENT.md) - Deploy to production
- [Client Integration](./OAUTH_CLIENT_INTEGRATION.md) - Integrate with your app

### Configuration Files
- [Environment Variables](./VERCEL_ENV_SETUP.md)
- [Deployment Configuration](./DEPLOYMENT.md)
- [Project Instructions](./CLAUDE.md)

### Testing
- [Test Report](./TEST-REPORT.md) - 95.2% test success rate
- Integration tests: `tests/integration/remote-mcp-auth.test.ts`

### External Resources
- [Clerk Documentation](https://clerk.com/docs)
- [MCP Protocol Specification](https://modelcontextprotocol.io)
- [Turso Documentation](https://docs.turso.tech)

---

## Support

For issues and questions:

1. Check the [Quick Start Guide](./OAUTH_QUICKSTART.md)
2. Review the [API Reference](./OAUTH_API_REFERENCE.md)
3. Consult the [Deployment Guide](./OAUTH_DEPLOYMENT.md)
4. Check integration tests for examples
5. Review Clerk documentation for OAuth issues

---

**Last Updated:** 2025-10-01
**Version:** 1.1.2
**Test Coverage:** 95.2% pass rate
