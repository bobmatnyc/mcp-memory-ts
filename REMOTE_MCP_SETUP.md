# Remote MCP Server Setup Guide

This guide explains how to set up and use the Remote MCP Server with Clerk OAuth authentication.

## Overview

The Remote MCP Server provides HTTP-based access to the MCP Memory Service with multi-tenant isolation using Clerk OAuth. This allows web applications and remote clients to access their memories securely via authenticated HTTP requests.

## Features

- **Clerk OAuth Authentication**: Secure authentication using Clerk session tokens
- **Multi-Tenant Isolation**: Complete data isolation between users
- **JSON-RPC 2.0 Protocol**: Standard MCP protocol over HTTP
- **Session Management**: 1-hour session timeout with automatic cleanup
- **User Quotas**: Configurable quotas per user
- **CORS Support**: Cross-origin requests enabled for web clients

## Architecture

```
Client (with Clerk token)
    ↓
Remote MCP Server (HTTP + JSON-RPC)
    ↓
Multi-Tenant Memory Core
    ↓
Turso Database (user_id isolation)
```

## Setup

### 1. Environment Configuration

Copy `.env.example` to `.env` and configure:

```bash
# Database
TURSO_URL=libsql://your-database.turso.io
TURSO_AUTH_TOKEN=your-auth-token

# OpenAI (for embeddings)
OPENAI_API_KEY=your-openai-api-key

# Clerk Authentication (Development)
CLERK_SECRET_KEY=your-clerk-test-secret-key
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_bmF0aXZlLW1hcm1vc2V0LTc0LmNsZXJrLmFjY291bnRzLmRldiQ

# Remote MCP Server
REMOTE_MCP_PORT=3001
REMOTE_MCP_HOST=0.0.0.0
CORS_ORIGIN=*
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Run the Server

**Local Development:**
```bash
npm run mcp-server-remote
```

**Production (Vercel Serverless):**
```bash
npm run deploy:vercel
```

The server will be available at:
- Local: `http://localhost:3001`
- Vercel: `https://your-deployment.vercel.app/api/mcp`

## Authentication

### Getting a Clerk Token

1. **Client-side (Browser):**
```javascript
import { useAuth } from '@clerk/nextjs';

function MyComponent() {
  const { getToken } = useAuth();

  async function callMCP() {
    const token = await getToken();
    // Use token in Authorization header
  }
}
```

2. **Server-side (Node.js):**
```javascript
import { clerkClient } from '@clerk/clerk-sdk-node';

const session = await clerkClient.sessions.createSession({
  userId: 'user_xxx',
});

const token = session.id;
```

### Making Authenticated Requests

```javascript
const response = await fetch('http://localhost:3001/mcp', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${clerkToken}`,
  },
  body: JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/call',
    params: {
      name: 'store_memory',
      arguments: {
        content: 'My memory content',
        type: 'semantic',
        importance: 0.8,
      },
    },
  }),
});

const result = await response.json();
```

## API Endpoints

### Main MCP Endpoint
- **URL**: `/mcp`
- **Method**: `POST`
- **Auth**: Required (Bearer token)
- **Body**: JSON-RPC 2.0 request

### Alternative REST-style Endpoints

- **POST** `/mcp/initialize` - Initialize MCP session
- **GET** `/mcp/tools/list` - List available tools
- **POST** `/mcp/tools/call` - Call a tool

### Health Check
- **URL**: `/health`
- **Method**: `GET`
- **Auth**: Not required

## Available Tools

All tools from the stdio MCP server are available:

1. `store_memory` - Store a new memory
2. `recall_memories` - Search and retrieve memories
3. `get_memory` - Get a specific memory by ID
4. `update_memory` - Update an existing memory
5. `delete_memory` - Delete a memory
6. `get_memory_stats` - Get memory statistics
7. `update_missing_embeddings` - Generate missing embeddings
8. `get_daily_costs` - Get daily API usage costs

## User Isolation

Each authenticated user's data is completely isolated:

- Memories are stored with `user_id = user.email`
- Queries automatically filter by authenticated user
- Cross-user access attempts are denied
- Separate quotas per user

## Security

### Authentication Flow

1. Client obtains Clerk session token
2. Token sent in `Authorization: Bearer {token}` header
3. Server verifies token with Clerk API
4. User email extracted from verified session
5. Session created with 1-hour timeout
6. All operations scoped to authenticated user

### Session Management

- Sessions expire after 1 hour
- Automatic cleanup of expired sessions
- Each request can use session token for faster auth
- Failed auth attempts are logged

### Data Protection

- Complete tenant isolation at database level
- No cross-user data access
- Input validation on all operations
- SQL injection protection via parameterized queries

## Development vs Production

### Development (Clerk Test Environment)

```bash
CLERK_SECRET_KEY=your-clerk-test-secret-key
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_bmF0aXZlLW1hcm1vc2V0LTc0LmNsZXJrLmFjY291bnRzLmRldiQ
```

### Production (Clerk Live Environment)

```bash
CLERK_SECRET_KEY=your-clerk-live-secret-key
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_Y2xlcmsuYWktbWVtb3J5LmFwcCQ
```

## Deployment

### Vercel Serverless

The serverless function at `api/mcp/index.ts` is automatically deployed with Vercel:

```bash
# Deploy to Vercel
vercel --prod

# Or use npm script
npm run deploy:vercel
```

### Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
CMD ["npm", "run", "mcp-server-remote"]
```

### Traditional Server

```bash
npm run build
node dist/remote-mcp-server.js
```

## Monitoring

### Health Check

```bash
curl http://localhost:3001/health
```

Response:
```json
{
  "status": "ok",
  "timestamp": "2025-10-01T12:00:00.000Z",
  "service": "remote-mcp-server",
  "activeSessions": 5
}
```

### Authentication Events

All authentication events are logged:

```
[MCP Auth] [2025-10-01T12:00:00.000Z] success: {
  "email": "user@example.com",
  "userId": "user_xxx"
}
```

## Testing

### Integration Tests

```bash
npm run test:integration
```

### Manual Testing

```bash
# Start server
npm run mcp-server-remote

# In another terminal, test with curl
curl -X POST http://localhost:3001/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_CLERK_TOKEN" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "store_memory",
      "arguments": {
        "content": "Test memory",
        "type": "semantic"
      }
    }
  }'
```

## Troubleshooting

### Authentication Fails

- Verify Clerk keys are correct
- Check token is not expired
- Ensure Bearer token format: `Bearer {token}`
- Check Clerk dashboard for user session status

### User Isolation Issues

- Verify `user_id` is set correctly (should be email)
- Check database queries include user filter
- Review memory ownership in database

### Performance Issues

- Enable connection pooling
- Monitor OpenAI API rate limits
- Check database query performance
- Review session cleanup frequency

## Comparison: stdio vs Remote MCP Server

| Feature | stdio (Local) | Remote (HTTP) |
|---------|---------------|---------------|
| Transport | stdin/stdout | HTTP/JSON-RPC |
| Auth | None (local user) | Clerk OAuth |
| Multi-tenant | Single user | Multi-user |
| Access | Local machine only | Network accessible |
| Use Case | Claude Desktop | Web apps, APIs |
| Session | Process lifetime | 1-hour timeout |

## Next Steps

1. Set up Clerk authentication in your app
2. Configure environment variables
3. Deploy to Vercel or your hosting platform
4. Test authentication flow
5. Monitor usage and quotas
6. Set up proper logging and monitoring

## Support

For issues or questions:
- Check the integration tests
- Review the authentication middleware code
- Consult Clerk documentation
- Check server logs for auth events
