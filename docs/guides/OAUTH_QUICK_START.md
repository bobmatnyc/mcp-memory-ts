# OAuth 2.0 Quick Start Guide

Get your OAuth 2.0 provider up and running in 5 minutes.

## Prerequisites

- MCP Memory server deployed and running
- Access to the database (Turso)
- Clerk authentication configured

## Step 1: Run Migration (1 minute)

```bash
# Preview migration
npm run migrate:oauth:dry-run

# Execute migration
npm run migrate:oauth
```

**Expected Output**: 4 OAuth tables created (clients, authorization_codes, access_tokens, refresh_tokens)

## Step 2: Register Claude.AI Client (2 minutes)

```bash
npm run oauth:register-client
```

**Interactive Prompts**:
```
Client name: Claude.AI Custom Connector
Redirect URIs: https://claude.ai/oauth/callback
Allowed scopes: memories:read,memories:write
Created by user ID: [Your Clerk User ID]
```

**Save These Credentials**:
- Client ID: `mcp_oauth_...`
- Client Secret: `...` (shown only once)

## Step 3: Configure Claude.AI (2 minutes)

In Claude.AI Custom Connectors settings:

| Field | Value |
|-------|-------|
| Authorization URL | `https://your-domain.com/api/oauth/authorize` |
| Token URL | `https://your-domain.com/api/oauth/token` |
| Client ID | `mcp_oauth_...` |
| Client Secret | `...` |
| Scopes | `memories:read memories:write` |
| API Base URL | `https://your-domain.com/api/mcp` |

## Step 4: Test Authorization

1. Claude.AI will redirect you to authorization page
2. Login with Clerk (if not already authenticated)
3. Approve consent screen
4. Claude.AI receives access token
5. Test MCP integration

## Verification

Test with curl:

```bash
# Get authorization code (manual browser flow)
# Then exchange for token:
curl -X POST https://your-domain.com/api/oauth/token \
  -d "grant_type=authorization_code" \
  -d "code=auth_..." \
  -d "redirect_uri=https://claude.ai/oauth/callback" \
  -d "client_id=mcp_oauth_..." \
  -d "client_secret=..."

# Test MCP endpoint
curl -X POST https://your-domain.com/api/mcp \
  -H "Authorization: Bearer mcp_at_..." \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

## Common Issues

| Issue | Solution |
|-------|----------|
| Invalid redirect_uri | Must match exactly (including trailing slash) |
| Client not found | Re-run registration script |
| Authorization code expired | Codes expire after 10 minutes |
| Token not working | Verify token starts with `mcp_at_` |

## Next Steps

- Read full documentation: `docs/guides/OAUTH_SETUP_GUIDE.md`
- Set up token cleanup cron job
- Configure production HTTPS
- Implement token revocation

## Architecture Diagram

```
┌──────────┐      1. Auth Request      ┌───────────────┐
│          │ ───────────────────────> │               │
│          │                           │  /authorize   │
│  Claude  │      2. Consent Screen    │               │
│  .AI     │ <─────────────────────── │  /consent     │
│          │                           │               │
│          │      3. Auth Code         │               │
│          │ <─────────────────────── │               │
└──────────┘                           └───────────────┘
     │
     │ 4. Exchange Code
     │
     v
┌──────────────────────────────────────────────────────┐
│  POST /api/oauth/token                               │
│  Returns: access_token, refresh_token                │
└──────────────────────────────────────────────────────┘
     │
     │ 5. Use Access Token
     │
     v
┌──────────────────────────────────────────────────────┐
│  POST /api/mcp                                       │
│  Authorization: Bearer mcp_at_...                    │
│  Returns: MCP tool results                           │
└──────────────────────────────────────────────────────┘
```

## File Structure

```
src/utils/oauth.ts                      # OAuth utilities
src/middleware/mcp-auth.ts              # Auth middleware (updated)
web/app/api/oauth/authorize/route.ts   # Authorization endpoint
web/app/api/oauth/token/route.ts       # Token endpoint
web/app/oauth/consent/page.tsx         # Consent screen UI
scripts/create-oauth-tables.ts          # Migration script
scripts/register-oauth-client.ts        # Client registration
```

## Support

For detailed documentation, see:
- Full Setup Guide: `docs/guides/OAUTH_SETUP_GUIDE.md`
- Troubleshooting: `OAUTH_SETUP_GUIDE.md#troubleshooting`
- Security: `OAUTH_SETUP_GUIDE.md#security-considerations`
