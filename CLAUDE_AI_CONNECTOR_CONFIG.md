# Claude.AI Custom Connector Configuration

## 🎯 Quick Setup for Claude.AI

After implementing OAuth 2.0, here's what you need to configure your Claude.AI custom connector:

---

## Step 1: Deploy OAuth Infrastructure

```bash
# 1. Run database migration
npm run migrate:oauth

# 2. Build the project
npm run build
cd web && npm run build && cd ..

# 3. Deploy to production (Vercel)
vercel deploy --prod
```

---

## Step 2: Register Claude.AI as OAuth Client

```bash
# Run the interactive registration tool
npm run oauth:register-client
```

**When prompted, provide:**
- **Client Name**: `Claude.AI Custom Connector`
- **Redirect URIs**: `https://claude.ai/oauth/callback` (Claude.AI will provide the exact URL)
- **Allowed Scopes**: `memories:read memories:write entities:read entities:write`

**Save the output** - you'll need these credentials:
```
Client ID: claude_ai_XXXXXXXXXX
Client Secret: [SECRET - shown once]
```

---

## Step 3: Test OAuth Flow

```bash
# Verify implementation
npm run oauth:test-flow
```

All tests should pass ✅

---

## Step 4: Configure Claude.AI Custom Connector

In Claude.AI settings → Add Custom Connector, provide:

### Basic Information
```
Name: MCP Memory TypeScript
Description: Persistent vector memory with semantic search
```

### OAuth Configuration

**Authorization Endpoint:**
```
https://ai-memory.app/api/oauth/authorize
```

**Token Endpoint:**
```
https://ai-memory.app/api/oauth/token
```

**Client ID:**
```
[The client_id from Step 2]
```

**Client Secret:**
```
[The client_secret from Step 2 - shown once during registration]
```

**Scopes:** (space-separated)
```
memories:read memories:write entities:read entities:write
```

### MCP Server Configuration

**MCP Endpoint URL:**
```
https://ai-memory.app/api/mcp
```

**Authentication Method:**
```
OAuth 2.0 Bearer Token
```

---

## Step 5: Test the Connection

After adding the connector in Claude.AI:

1. **Authorize Access**: Claude.AI will redirect you to consent screen
2. **Approve Permissions**: Click "Approve" on https://ai-memory.app/oauth/consent
3. **Verify Connection**: Claude.AI should show "Connected" status

### Test Commands

Once connected, try these in Claude.AI:

```
"Store a memory about this conversation"
"Recall memories about OAuth implementation"
"Show me my memory statistics"
"Search for memories related to Claude.AI"
```

---

## OAuth Flow Diagram

```
┌─────────────┐
│  Claude.AI  │
└──────┬──────┘
       │ 1. User clicks "Connect"
       ▼
┌─────────────────────────────────────────┐
│ https://ai-memory.app/api/oauth/authorize │
│ ?response_type=code                      │
│ &client_id=claude_ai_XXX                 │
│ &redirect_uri=https://claude.ai/oauth/callback │
│ &scope=memories:read memories:write      │
│ &state=CSRF_TOKEN                        │
└──────┬──────────────────────────────────┘
       │ 2. Check Clerk authentication
       ▼
┌─────────────────────────────────────────┐
│ https://ai-memory.app/oauth/consent     │
│ User sees permission request:            │
│ ✓ Read your memories                    │
│ ✓ Write new memories                    │
│ ✓ Read entities                         │
│ ✓ Write entities                        │
│ [Approve] [Deny]                        │
└──────┬──────────────────────────────────┘
       │ 3. User clicks "Approve"
       ▼
┌─────────────────────────────────────────┐
│ POST /api/oauth/consent/approve         │
│ Generates authorization code            │
└──────┬──────────────────────────────────┘
       │ 4. Redirect with code
       ▼
┌─────────────────────────────────────────┐
│ https://claude.ai/oauth/callback        │
│ ?code=AUTH_CODE                         │
│ &state=CSRF_TOKEN                       │
└──────┬──────────────────────────────────┘
       │ 5. Exchange code for token
       ▼
┌─────────────────────────────────────────┐
│ POST https://ai-memory.app/api/oauth/token │
│ grant_type=authorization_code           │
│ code=AUTH_CODE                          │
│ client_id=claude_ai_XXX                 │
│ client_secret=SECRET                    │
│ redirect_uri=https://claude.ai/oauth/callback │
└──────┬──────────────────────────────────┘
       │ 6. Return access token
       ▼
┌─────────────────────────────────────────┐
│ {                                       │
│   "access_token": "mcp_at_XXX",        │
│   "token_type": "Bearer",              │
│   "expires_in": 604800,                │
│   "refresh_token": "mcp_rt_XXX",       │
│   "scope": "memories:read memories:write" │
│ }                                       │
└──────┬──────────────────────────────────┘
       │ 7. Use token for MCP requests
       ▼
┌─────────────────────────────────────────┐
│ POST https://ai-memory.app/api/mcp      │
│ Authorization: Bearer mcp_at_XXX        │
│ {                                       │
│   "jsonrpc": "2.0",                    │
│   "method": "tools/list",              │
│   "id": 1                              │
│ }                                       │
└─────────────────────────────────────────┘
```

---

## Security Features

✅ **OAuth 2.0 Standard Compliance**
- Authorization code grant flow
- State parameter for CSRF protection
- Secure token storage with bcrypt hashing

✅ **Token Management**
- Access tokens: 7-day expiry (mcp_at_ prefix)
- Refresh tokens: 30-day expiry (mcp_rt_ prefix)
- Authorization codes: 10-minute expiry (single-use)

✅ **Scope-Based Permissions**
- `memories:read` - Read memories
- `memories:write` - Create/update/delete memories
- `entities:read` - Read entities
- `entities:write` - Create/update/delete entities

✅ **User Consent Required**
- Explicit permission screen
- Approve/Deny options
- Scope visibility

---

## Troubleshooting

### Issue: "Invalid client credentials"
**Solution**: Verify client_id and client_secret match what was generated in Step 2.

### Issue: "Redirect URI mismatch"
**Solution**: Ensure redirect_uri in Claude.AI exactly matches what you registered.

### Issue: "Authorization code expired"
**Solution**: Codes expire after 10 minutes. Complete the flow faster or try again.

### Issue: "User not authenticated"
**Solution**: Sign in to https://ai-memory.app first, then try OAuth flow.

### Issue: "Consent screen not loading"
**Solution**: 
1. Check Clerk authentication is working
2. Verify web app is deployed and accessible
3. Check browser console for errors

---

## Monitoring

### Check Active OAuth Clients
```bash
# Query database
sqlite3 production.db "SELECT * FROM oauth_clients;"
```

### View Active Tokens
```bash
# See active access tokens
sqlite3 production.db "SELECT token, client_id, user_id, expires_at FROM oauth_access_tokens WHERE datetime(expires_at) > datetime('now');"
```

### Check OAuth Logs
```bash
# Vercel production logs
vercel logs https://ai-memory.app --follow | grep oauth
```

---

## Token Refresh

When access token expires (after 7 days), Claude.AI will automatically use the refresh token:

```bash
POST https://ai-memory.app/api/oauth/token
Content-Type: application/x-www-form-urlencoded

grant_type=refresh_token
&refresh_token=mcp_rt_XXX
&client_id=claude_ai_XXX
&client_secret=SECRET
```

Response:
```json
{
  "access_token": "mcp_at_NEW_TOKEN",
  "token_type": "Bearer",
  "expires_in": 604800,
  "refresh_token": "mcp_rt_NEW_REFRESH",
  "scope": "memories:read memories:write entities:read entities:write"
}
```

---

## Production Checklist

Before going live:

- [ ] OAuth migration executed: `npm run migrate:oauth`
- [ ] Claude.AI client registered: `npm run oauth:register-client`
- [ ] OAuth flow tested: `npm run oauth:test-flow`
- [ ] Web app deployed to production (Vercel)
- [ ] Environment variables set in Vercel (TURSO_URL, CLERK_SECRET_KEY, etc.)
- [ ] Clerk authentication working on production domain
- [ ] Health check passing: `curl https://ai-memory.app/api/health`
- [ ] MCP endpoint accessible: `curl https://ai-memory.app/api/mcp`
- [ ] OAuth endpoints accessible:
  - `https://ai-memory.app/api/oauth/authorize`
  - `https://ai-memory.app/api/oauth/token`
  - `https://ai-memory.app/oauth/consent`

---

## Support

For detailed documentation:
- **Setup Guide**: [docs/guides/OAUTH_SETUP_GUIDE.md](./docs/guides/OAUTH_SETUP_GUIDE.md)
- **Quick Start**: [docs/guides/OAUTH_QUICK_START.md](./docs/guides/OAUTH_QUICK_START.md)
- **Implementation**: [OAUTH_IMPLEMENTATION_SUMMARY.md](./OAUTH_IMPLEMENTATION_SUMMARY.md)
- **Deployment**: [OAUTH_DEPLOYMENT_CHECKLIST.md](./OAUTH_DEPLOYMENT_CHECKLIST.md)

---

**Ready to connect!** 🎉

Once you complete these steps, Claude.AI will have full access to your MCP Memory server with persistent, searchable vector memory capabilities.
