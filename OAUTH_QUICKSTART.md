# OAuth Quick Start Guide

Get your Remote MCP Server with Clerk OAuth authentication running in 5 minutes.

## Prerequisites

Before you begin, ensure you have:

- ✅ Node.js 18+ installed
- ✅ npm or yarn package manager
- ✅ Git for version control

You'll also need accounts for:

- ✅ [Turso](https://turso.tech/) - For database (free tier available)
- ✅ [OpenAI](https://platform.openai.com/) - For embeddings (pay-per-use)
- ✅ [Clerk](https://clerk.com/) - For authentication (free tier available)

---

## Step 1: Get Required Credentials

### 1.1 Turso Database Setup

1. Go to [https://turso.tech/](https://turso.tech/)
2. Create a new database
3. Copy your database URL and auth token

```bash
# You'll get something like:
TURSO_URL=libsql://your-database-xxxxx.turso.io
TURSO_AUTH_TOKEN=eyJhbGc...your-long-token
```

### 1.2 OpenAI API Key

1. Go to [https://platform.openai.com/api-keys](https://platform.openai.com/api-keys)
2. Create a new API key
3. Copy the key (starts with `sk-proj-`)

```bash
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxx
```

### 1.3 Clerk Authentication Keys

#### For Development:

1. Go to [https://dashboard.clerk.com/](https://dashboard.clerk.com/)
2. Create a new application or select existing
3. Navigate to **API Keys**
4. Copy the development keys:

```bash
# Development Keys
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_bmF0aXZlLW1hcm1vc2V0LTc0LmNsZXJrLmFjY291bnRzLmRldiQ
CLERK_SECRET_KEY=your-clerk-test-secret-key
```

#### For Production (when ready to deploy):

```bash
# Production Keys
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_Y2xlcmsuYWktbWVtb3J5LmFwcCQ
CLERK_SECRET_KEY=your-clerk-live-secret-key
```

---

## Step 2: Project Setup

### 2.1 Clone and Install

```bash
# Clone the repository
git clone https://github.com/your-org/mcp-memory-ts.git
cd mcp-memory-ts

# Install dependencies
npm install
```

### 2.2 Configure Environment

```bash
# Copy the example environment file
cp .env.example .env

# Edit .env with your credentials
nano .env  # or use your preferred editor
```

Your `.env` file should look like:

```bash
# Database Configuration (from Step 1.1)
TURSO_URL=libsql://your-database.turso.io
TURSO_AUTH_TOKEN=your-turso-auth-token

# OpenAI Configuration (from Step 1.2)
OPENAI_API_KEY=sk-proj-your-openai-key

# Clerk Development Keys (from Step 1.3)
CLERK_SECRET_KEY=sk_test_your-dev-secret-key
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_your-dev-publishable-key

# Development Settings
NODE_ENV=development
LOG_LEVEL=debug
MCP_DEBUG=1
REMOTE_MCP_PORT=3003
CORS_ORIGIN=*
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3003
RATE_LIMIT_REQUESTS_PER_MINUTE=1000
SESSION_TIMEOUT_MINUTES=480
ALLOW_DEV_AUTH=true
```

### 2.3 Build the Project

```bash
npm run build
```

---

## Step 3: Start the Server

### 3.1 Start Remote MCP Server

```bash
npm run mcp-server-remote
```

You should see:

```
[Remote MCP] Server starting on http://0.0.0.0:3003
[Remote MCP] Authentication: Clerk OAuth enabled
[Remote MCP] Multi-tenant memory core initialized
[Remote MCP] Server is ready to accept requests
```

### 3.2 Verify Server is Running

Open a new terminal and test the health endpoint:

```bash
curl http://localhost:3003/health
```

Expected response:

```json
{
  "status": "healthy",
  "version": "1.1.2",
  "timestamp": "2025-10-01T...",
  "activeSessions": 0,
  "authentication": "enabled",
  "database": "connected"
}
```

---

## Step 4: Test Authentication

### 4.1 Get a Test Token

For development testing, you can use Clerk's test mode:

1. Go to your Clerk Dashboard
2. Navigate to **Users**
3. Create a test user or use existing
4. Copy the session token from the user's session

Or use the development bypass (only if `ALLOW_DEV_AUTH=true`):

```bash
# Development bypass (for testing only!)
export DEV_USER_EMAIL="test@example.com"
```

### 4.2 Test MCP Initialization

```bash
# Replace YOUR_TOKEN with actual Clerk session token
export CLERK_TOKEN="your-clerk-session-token"

curl -X POST http://localhost:3003/mcp \
  -H "Authorization: Bearer $CLERK_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {
      "protocolVersion": "2024-11-05",
      "capabilities": {},
      "clientInfo": {
        "name": "test-client",
        "version": "1.0.0"
      }
    }
  }'
```

Expected response:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "protocolVersion": "2024-11-05",
    "capabilities": {
      "tools": {}
    },
    "serverInfo": {
      "name": "mcp-memory-service",
      "version": "1.1.2"
    }
  }
}
```

### 4.3 Store Your First Memory

```bash
curl -X POST http://localhost:3003/mcp \
  -H "Authorization: Bearer $CLERK_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/call",
    "params": {
      "name": "store_memory",
      "arguments": {
        "content": "My first authenticated memory!",
        "type": "MEMORY",
        "importance": "MEDIUM"
      }
    }
  }'
```

### 4.4 Search Memories

```bash
curl -X POST http://localhost:3003/mcp \
  -H "Authorization: Bearer $CLERK_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 3,
    "method": "tools/call",
    "params": {
      "name": "search_memories",
      "arguments": {
        "query": "first memory",
        "limit": 10
      }
    }
  }'
```

---

## Step 5: Test OAuth Flow

### 5.1 Without Authentication (Should Fail)

```bash
curl -X POST http://localhost:3003/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {}
  }'
```

Expected response (401 Unauthorized):

```json
{
  "jsonrpc": "2.0",
  "id": null,
  "error": {
    "code": -32001,
    "message": "Authentication required",
    "data": {
      "reason": "No authorization header provided"
    }
  }
}
```

### 5.2 With Invalid Token (Should Fail)

```bash
curl -X POST http://localhost:3003/mcp \
  -H "Authorization: Bearer invalid-token" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {}
  }'
```

Expected response (401 Unauthorized):

```json
{
  "jsonrpc": "2.0",
  "id": null,
  "error": {
    "code": -32001,
    "message": "Authentication required",
    "data": {
      "reason": "Invalid session token"
    }
  }
}
```

### 5.3 Verify User Isolation

Create two users in Clerk and test that they can't see each other's data:

```bash
# User A stores memory
curl -X POST http://localhost:3003/mcp \
  -H "Authorization: Bearer $USER_A_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "store_memory",
      "arguments": {
        "content": "User A secret data",
        "type": "MEMORY"
      }
    }
  }'

# User B searches (should not find User A's data)
curl -X POST http://localhost:3003/mcp \
  -H "Authorization: Bearer $USER_B_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/call",
    "params": {
      "name": "search_memories",
      "arguments": {
        "query": "User A secret",
        "limit": 10
      }
    }
  }'
```

---

## Common Issues & Solutions

### Issue 1: "Authentication required" Error

**Symptom:** All requests return 401 Unauthorized

**Solutions:**
- ✅ Verify Clerk keys are correct
- ✅ Ensure `CLERK_SECRET_KEY` matches environment (dev vs prod)
- ✅ Check Authorization header format: `Bearer <token>`
- ✅ Verify Clerk session is valid and not expired

```bash
# Check your Clerk keys
echo $CLERK_SECRET_KEY
echo $NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY

# Verify token format
echo "Authorization: Bearer $CLERK_TOKEN"
```

### Issue 2: "Database connection failed"

**Symptom:** 500 errors about database

**Solutions:**
- ✅ Verify Turso credentials are correct
- ✅ Check database is active in Turso dashboard
- ✅ Ensure auth token hasn't expired
- ✅ Test database connection:

```bash
# Test Turso connection
curl -X POST "$TURSO_URL" \
  -H "Authorization: Bearer $TURSO_AUTH_TOKEN" \
  -d '{"statements": ["SELECT 1"]}'
```

### Issue 3: "CORS Error" in Browser

**Symptom:** Browser blocks requests with CORS error

**Solutions:**
- ✅ Check `CORS_ORIGIN` includes your domain
- ✅ Verify `ALLOWED_ORIGINS` is set correctly
- ✅ Ensure no trailing slashes in URLs

```bash
# For development, allow all origins
CORS_ORIGIN=*
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3003
```

### Issue 4: Server Won't Start

**Symptom:** Error starting server

**Solutions:**
- ✅ Check port 3003 is not already in use:

```bash
lsof -i :3003
# If in use, kill the process or change port:
REMOTE_MCP_PORT=3004 npm run mcp-server-remote
```

- ✅ Verify all required environment variables are set
- ✅ Check build was successful: `npm run build`
- ✅ Look at server logs for specific errors

### Issue 5: Rate Limited

**Symptom:** 429 Too Many Requests errors

**Solutions:**
- ✅ Check `RATE_LIMIT_REQUESTS_PER_MINUTE` setting
- ✅ For development, increase limit:

```bash
RATE_LIMIT_REQUESTS_PER_MINUTE=1000
```

- ✅ Implement exponential backoff in client
- ✅ Check `Retry-After` header for wait time

---

## Next Steps

### For Development

1. **Explore MCP Tools**
   - See [API Reference](./OAUTH_API_REFERENCE.md) for all available tools
   - Test each tool with curl or your client

2. **Run Test Suite**
   ```bash
   npm test
   ```
   Expected: 95.2% pass rate (20/21 tests)

3. **Enable Debug Logging**
   ```bash
   LOG_LEVEL=debug
   MCP_DEBUG=1
   ENABLE_REQUEST_LOGGING=true
   ```

### For Production Deployment

1. **Review Deployment Guide**
   - See [OAUTH_DEPLOYMENT.md](./OAUTH_DEPLOYMENT.md)

2. **Configure Production Environment**
   - Update `.env.production` with production keys
   - Set `ALLOW_DEV_AUTH=false`
   - Restrict CORS origins

3. **Deploy to Vercel**
   ```bash
   npm run setup:vercel
   npm run deploy:vercel production
   ```

### For Client Integration

1. **Review Client Integration Guide**
   - See [OAUTH_CLIENT_INTEGRATION.md](./OAUTH_CLIENT_INTEGRATION.md)

2. **Choose Your Stack**
   - Next.js with Clerk
   - React with Clerk
   - Vanilla JavaScript
   - Mobile apps (React Native, Flutter)

---

## Helpful Commands

```bash
# Start development server
npm run mcp-server-remote

# Run tests
npm test

# Build project
npm run build

# Type checking
npm run type-check

# Linting
npm run lint:fix

# Format code
npm run format

# Health check
curl http://localhost:3003/health

# View logs with debug
LOG_LEVEL=debug MCP_DEBUG=1 npm run mcp-server-remote
```

---

## Resources

### Documentation
- [Main OAuth Setup](./OAUTH_SETUP.md) - Complete architecture overview
- [API Reference](./OAUTH_API_REFERENCE.md) - All endpoints and tools
- [Deployment Guide](./OAUTH_DEPLOYMENT.md) - Production deployment
- [Client Integration](./OAUTH_CLIENT_INTEGRATION.md) - Integrate with your app

### External Links
- [Clerk Documentation](https://clerk.com/docs)
- [Turso Documentation](https://docs.turso.tech)
- [MCP Protocol Spec](https://modelcontextprotocol.io)

### Support
- Check [Test Report](./TEST-REPORT.md) for verified functionality
- Review integration tests: `tests/integration/remote-mcp-auth.test.ts`
- Consult [CLAUDE.md](./CLAUDE.md) for project details

---

**Last Updated:** 2025-10-01
**Version:** 1.1.2
**Estimated Setup Time:** 5-10 minutes
