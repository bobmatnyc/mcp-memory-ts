# Server-Side API Documentation

## Overview

All APIs in the MCP Memory TypeScript project are now pure server-side serverless functions running on Vercel's infrastructure. This ensures security, scalability, and proper isolation of authentication logic.

## Key Changes

### 1. Authentication
- **Removed**: Client-side `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- **Using**: Server-side only `@clerk/backend` SDK
- **Token Verification**: Pure server-side JWT verification with `verifyToken()`
- **No Client Dependencies**: Zero client-side JavaScript required

### 2. Environment Variables

#### Required (Server-Side Only)
```bash
# Clerk Authentication (Server-Side)
CLERK_SECRET_KEY=sk_test_your_secret_key
CLERK_WEBHOOK_SECRET=whsec_your_webhook_secret

# Database
TURSO_URL=libsql://your-database.turso.io
TURSO_AUTH_TOKEN=your_auth_token

# OpenAI
OPENAI_API_KEY=your_openai_key
```

#### Removed (No Longer Needed)
```bash
# These client-side variables have been removed:
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY  # ❌ Not needed for server-side auth
```

### 3. API Structure

```
/api
├── index.ts                 # Main API handler (server-side only)
├── auth/
│   └── webhook.ts          # Clerk webhook handler (server-side)
└── middleware/
    ├── clerk-auth.ts       # Server-side Clerk authentication
    └── cors.ts            # CORS configuration
```

## Authentication Flow

### Server-Side Token Verification

```typescript
// Authentication happens entirely on the server
import { verifyToken } from '@clerk/backend';
import { createClerkClient } from '@clerk/backend';

// Initialize Clerk client for server operations
const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY!
});

// Verify JWT token server-side
const payload = await verifyToken(authToken, {
  secretKey: process.env.CLERK_SECRET_KEY,
});

const userId = payload.sub; // Extract user ID
```

### Request Headers

Clients should send authentication tokens in one of these headers:

```http
Authorization: Bearer YOUR_CLERK_TOKEN
# OR
X-Clerk-Auth-Token: YOUR_CLERK_TOKEN
```

## API Endpoints

### Public Endpoints (No Auth Required)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | API landing page (HTML or JSON) |
| `/api` | GET | API documentation (JSON) |
| `/api/health` | GET | Health check endpoint |

### Protected Endpoints (Auth Required)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/memories` | POST | Create a new memory |
| `/api/memories/search` | GET | Search memories |
| `/api/entities` | POST | Create an entity |
| `/api/entities/search` | GET | Search entities |
| `/api/search` | GET | Unified search |
| `/api/statistics` | GET | User statistics |

## Vercel Configuration

### vercel.json
```json
{
  "functions": {
    "api/index.ts": {
      "maxDuration": 30,
      "runtime": "nodejs20.x",
      "memory": 1024
    },
    "api/auth/webhook.ts": {
      "maxDuration": 10,
      "runtime": "nodejs20.x",
      "memory": 512
    }
  },
  "rewrites": [
    {
      "source": "/api/(.*)",
      "destination": "/api"
    }
  ],
  "env": {
    "NODE_ENV": "production",
    "ALLOW_DEV_AUTH": "false"
  }
}
```

## Security Features

### 1. Server-Side Only Authentication
- All JWT verification happens on the server
- No exposure of authentication logic to clients
- Clerk secret key never leaves the server

### 2. CORS Configuration
- Configured for server-side validation
- Supports multiple client types (web, Python, API)
- Proper preflight handling

### 3. Security Headers
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`

## Testing

### Local Development
```bash
# Set environment variables
export CLERK_SECRET_KEY=your_secret_key
export NODE_ENV=development
export ALLOW_DEV_AUTH=true

# Run the API locally
npm run dev

# Test endpoints
npm run test:api
```

### Production Testing
```bash
# Test deployed API
export API_URL=https://mcp-memory-ts.vercel.app
export TEST_CLERK_TOKEN=your_valid_clerk_token

npm run test:api:prod
```

## Client Integration Examples

### JavaScript/TypeScript
```typescript
const response = await fetch('https://mcp-memory-ts.vercel.app/api/memories/search', {
  method: 'GET',
  headers: {
    'Authorization': 'Bearer YOUR_CLERK_TOKEN',
    'Content-Type': 'application/json'
  },
  params: {
    query: 'search term'
  }
});

const data = await response.json();
```

### Python
```python
import requests

headers = {
    'Authorization': 'Bearer YOUR_CLERK_TOKEN',
    'Content-Type': 'application/json'
}

response = requests.get(
    'https://mcp-memory-ts.vercel.app/api/memories/search',
    headers=headers,
    params={'query': 'search term'}
)

data = response.json()
```

### cURL
```bash
curl -X GET "https://mcp-memory-ts.vercel.app/api/memories/search?query=test" \
  -H "Authorization: Bearer YOUR_CLERK_TOKEN" \
  -H "Content-Type: application/json"
```

## Development Mode

In development mode (`NODE_ENV=development` and `ALLOW_DEV_AUTH=true`), the API provides a fallback authentication mechanism for testing without a valid Clerk token. This should **NEVER** be enabled in production.

## Deployment Checklist

- [ ] Set `CLERK_SECRET_KEY` in Vercel environment variables
- [ ] Set `CLERK_WEBHOOK_SECRET` for webhook endpoints
- [ ] Configure `TURSO_URL` and `TURSO_AUTH_TOKEN`
- [ ] Set `OPENAI_API_KEY` for embeddings
- [ ] Ensure `NODE_ENV=production`
- [ ] Set `ALLOW_DEV_AUTH=false` (or remove it)
- [ ] Deploy with `vercel --prod`
- [ ] Test all endpoints with valid Clerk tokens

## Troubleshooting

### Authentication Errors
1. **Missing authentication token**: Ensure token is in Authorization header
2. **Invalid token**: Verify token is valid and not expired
3. **Server not configured**: Check CLERK_SECRET_KEY is set

### CORS Issues
1. Check origin is allowed in CORS configuration
2. Ensure preflight requests are handled
3. Verify headers are correctly set

### Database Connection
1. Verify TURSO_URL and TURSO_AUTH_TOKEN are correct
2. Check database is accessible from Vercel
3. Ensure schema is initialized

## Migration Notes

If migrating from a client-side authentication setup:

1. **Remove all `NEXT_PUBLIC_*` environment variables** related to Clerk
2. **Update API calls** to use server-side endpoints only
3. **Ensure tokens** are sent in Authorization headers
4. **Test thoroughly** with production Clerk tokens
5. **Monitor logs** for any authentication failures

## Support

For issues or questions:
- Check logs in Vercel dashboard
- Review error responses from API
- Ensure all environment variables are set correctly
- Test with the provided test script