# Quick Access Guide - Production MCP Gateway

**Domain**: https://ai-memory.app
**Status**: ✅ OPERATIONAL
**Last Verified**: 2025-10-20

---

## Production Endpoints

### 1. Health Check (Public)
```bash
curl https://ai-memory.app/api/health
```

**Expected Response**:
```json
{
  "success": true,
  "status": "online",
  "timestamp": "2025-10-20T...",
  "service": "mcp-memory-ts",
  "version": "1.0.0",
  "environment": "production"
}
```

### 2. MCP Gateway (Authenticated)
```bash
curl -X POST https://ai-memory.app/api/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_CLERK_TOKEN" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

**Authentication**: Requires Clerk OAuth token

---

## Quick Test

Run the automated test suite:
```bash
./scripts/test-production-mcp.sh
```

**Expected Output**:
```
✓ Vercel Health Check - PASSED
✓ Vercel MCP Authentication - PASSED
✓ Self-Hosted Health Check - PASSED
✓ Self-Hosted MCP Authentication - PASSED

Vercel Production: ✓ OPERATIONAL
Self-Hosted Server: ✓ OPERATIONAL
```

---

## Access Methods

### Method 1: With Clerk Authentication
1. Get Clerk session token from web interface
2. Use in Authorization header
3. Make MCP requests

### Method 2: With Vercel Bypass Token (Testing Only)
1. Visit: https://vercel.com/1-m/mcp-memory-ts/settings/protection
2. Copy bypass token
3. Add to URL: `?x-vercel-protection-bypass=YOUR_TOKEN`

### Method 3: Web Interface
1. Visit: https://ai-memory.app
2. Sign in with Clerk
3. Use web UI for memory management

---

## Deployment Architecture

### Vercel Serverless MCP
- **URL**: https://ai-memory.app/api/mcp
- **Timeout**: 30 seconds
- **Region**: US East (iad1)
- **Scaling**: Automatic
- **Best For**: Quick operations (<30s)

### Self-Hosted Remote MCP
- **URL**: http://localhost:3003/mcp
- **Timeout**: None
- **Process Manager**: PM2
- **Best For**: Long-running operations (>30s)

---

## Monitoring

### Vercel Dashboard
- **Analytics**: https://vercel.com/1-m/mcp-memory-ts/analytics
- **Logs**: https://vercel.com/1-m/mcp-memory-ts/logs
- **Status**: https://vercel.com/1-m/mcp-memory-ts

### Command Line
```bash
# View production logs
vercel logs https://ai-memory.app --follow

# Check deployment status
vercel ls --prod

# Inspect current deployment
vercel inspect https://ai-memory.app
```

### PM2 Monitoring (Self-Hosted)
```bash
# Process status
pm2 list

# View logs
pm2 logs mcp-memory-remote

# Monitor performance
pm2 monit
```

---

## Common Operations

### Test MCP Protocol
```bash
# Initialize
curl -X POST https://ai-memory.app/api/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {
      "protocolVersion": "2024-11-05",
      "capabilities": {}
    }
  }'

# List tools
curl -X POST https://ai-memory.app/api/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list"}'

# Store memory
curl -X POST https://ai-memory.app/api/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "jsonrpc": "2.0",
    "id": 3,
    "method": "tools/call",
    "params": {
      "name": "store_memory",
      "arguments": {
        "content": "Test memory from production MCP",
        "type": "semantic",
        "importance": 0.7
      }
    }
  }'
```

---

## Security

### Multi-Layer Protection
1. **Vercel Deployment Protection** - SSO + bypass tokens
2. **Clerk OAuth Authentication** - User authentication
3. **Database User Isolation** - Multi-tenant data separation

### Security Headers
- ✅ HSTS (Strict Transport Security)
- ✅ CSP (Content Security Policy)
- ✅ X-Frame-Options: DENY
- ✅ X-Content-Type-Options: nosniff

---

## Troubleshooting

### Issue: Authentication Required
**Cause**: Missing Clerk token

**Solution**:
```bash
# Get bypass token from Vercel
open "https://vercel.com/1-m/mcp-memory-ts/settings/protection"

# Or authenticate via web interface
open "https://ai-memory.app"
```

### Issue: Request Timeout
**Cause**: Operation exceeds 30s limit

**Solution**: Use self-hosted endpoint (localhost:3003) for long operations

### Issue: Cannot Connect
**Cause**: Server down or network issue

**Solution**:
```bash
# Check server status
curl https://ai-memory.app/api/health

# Check Vercel deployment
vercel ls --prod
```

---

## Support

### Documentation
- **Full Status Report**: `REMOTE_MCP_PRODUCTION_STATUS.md`
- **Deployment Guide**: `DEPLOYMENT.md`
- **Security Guide**: `docs/security/CLERK_IMPLEMENTATION_NOTES.md`
- **API Reference**: `docs/api/GOOGLE_API_REFERENCE.md`

### Quick Links
- **Production Dashboard**: https://vercel.com/1-m/mcp-memory-ts
- **Clerk Dashboard**: https://dashboard.clerk.com
- **Turso Database**: https://turso.tech/app

---

**Last Updated**: 2025-10-20
**Status**: Production Ready ✅
