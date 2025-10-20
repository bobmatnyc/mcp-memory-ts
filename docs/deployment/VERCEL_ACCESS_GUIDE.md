# Quick Access Guide - Vercel Production Deployment

## Production URLs
- **Primary Domain**: https://ai-memory.app
- **Latest Deployment**: https://mcp-memory-7re1x1ygd-1-m.vercel.app

---

## How to Access the API

### Method 1: Get Vercel Bypass Token (Recommended)

1. **Go to Vercel Dashboard**:
   ```
   https://vercel.com/1-m/mcp-memory-ts/settings/protection
   ```

2. **Copy your bypass token**

3. **Use in API calls**:
   ```bash
   # Health check
   curl "https://ai-memory.app/api/health?x-vercel-set-bypass-cookie=true&x-vercel-protection-bypass=YOUR_TOKEN_HERE"

   # OpenAI health check
   curl "https://ai-memory.app/api/health/openai?x-vercel-protection-bypass=YOUR_TOKEN_HERE"

   # MCP endpoint
   curl -X POST "https://ai-memory.app/api/mcp?x-vercel-protection-bypass=YOUR_TOKEN_HERE" \
     -H "Content-Type: application/json" \
     -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
   ```

### Method 2: Browser Access

1. Visit https://ai-memory.app
2. Authenticate with Vercel SSO
3. Then authenticate with Clerk for app access
4. Use the web interface

### Method 3: For AI Agents

Use the Vercel MCP server at https://mcp.vercel.com:
```javascript
// Using MCP Vercel server functions
get_access_to_vercel_url("https://ai-memory.app/api/health")
web_fetch_vercel_url("https://ai-memory.app/api/mcp")
```

---

## Testing the Deployment

### 1. Get Your Bypass Token
```bash
# Visit in browser:
open "https://vercel.com/1-m/mcp-memory-ts/settings/protection"

# Copy the bypass token shown in the UI
```

### 2. Test Health Endpoint
```bash
# Replace YOUR_TOKEN with your actual bypass token
export VERCEL_TOKEN="your-bypass-token-here"

curl -s "https://ai-memory.app/api/health?x-vercel-protection-bypass=$VERCEL_TOKEN" | jq .
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2025-10-19T...",
  "database": "connected",
  "openai": "configured"
}
```

### 3. Test MCP Endpoint
```bash
curl -s -X POST "https://ai-memory.app/api/mcp?x-vercel-protection-bypass=$VERCEL_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/list"
  }' | jq .
```

Expected response:
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "tools": [
      {
        "name": "store_memory",
        "description": "...",
        "inputSchema": {...}
      },
      // ... more tools
    ]
  }
}
```

---

## Monitoring Commands

### View Live Logs
```bash
vercel logs https://ai-memory.app --follow
```

### Check Deployment Status
```bash
vercel ls --prod
```

### Inspect Current Deployment
```bash
vercel inspect https://ai-memory.app --logs
```

### View Analytics
Visit: https://vercel.com/1-m/mcp-memory-ts/analytics

---

## Troubleshooting

### "Authentication Required" Error
This is expected! The deployment is protected. Use one of these solutions:
1. Add bypass token to URL (Method 1 above)
2. Access via browser and authenticate (Method 2 above)
3. Use Vercel MCP server (Method 3 above)

### Function Timeout (30s limit)
For long-running operations:
- Use the self-hosted remote MCP server (port 3003) instead
- Or optimize the operation to complete faster

### Cannot Access Custom Domain
Check DNS settings:
```bash
vercel domains ls
dig ai-memory.app
```

---

## Quick Commands Reference

```bash
# Deploy to production
vercel --prod

# View production deployments
vercel ls --prod

# Check logs
vercel logs https://ai-memory.app --follow

# Rollback if needed
vercel rollback https://mcp-memory-lgbhait56-1-m.vercel.app

# Check domains
vercel domains ls

# Inspect deployment
vercel inspect https://ai-memory.app
```

---

## Environment Variables

To update environment variables:
```bash
# List all variables
vercel env ls

# Add new variable
vercel env add VARIABLE_NAME production

# Pull to local
vercel env pull .env.production
```

Or use the dashboard:
https://vercel.com/1-m/mcp-memory-ts/settings/environment-variables

---

## Security Notes

1. **Bypass Token Security**:
   - Treat bypass token like a password
   - Don't commit to git
   - Rotate periodically

2. **Multi-Layer Protection**:
   - Layer 1: Vercel Deployment Protection
   - Layer 2: Clerk User Authentication
   - Layer 3: Database-level user isolation

3. **API Access**:
   - All endpoints require authentication
   - Use bypass token for API testing
   - Use Clerk sessions for user access

---

## Next Steps

1. **Get Bypass Token**: Visit protection settings
2. **Test Endpoints**: Use curl commands above
3. **Monitor Deployment**: Check logs and analytics
4. **Configure Alerts**: Set up Vercel monitoring alerts

For detailed information, see: `VERCEL_PRODUCTION_DEPLOYMENT_REPORT.md`
