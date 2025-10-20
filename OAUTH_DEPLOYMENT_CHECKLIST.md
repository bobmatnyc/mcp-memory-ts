# OAuth 2.0 Deployment Checklist

Use this checklist to deploy the OAuth 2.0 provider to production.

## Pre-Deployment (Local Testing)

### 1. Database Setup
- [ ] Run dry-run migration: `npm run migrate:oauth:dry-run`
- [ ] Review migration output
- [ ] Execute migration: `npm run migrate:oauth`
- [ ] Verify tables created in database

### 2. Code Validation
- [ ] Build project: `npm run build`
- [ ] Run OAuth tests: `npm run oauth:test-flow`
- [ ] Verify all tests pass
- [ ] Check for TypeScript errors

### 3. Local Testing
- [ ] Register test client: `npm run oauth:register-client`
- [ ] Test authorization flow in browser
- [ ] Test token exchange with curl
- [ ] Test MCP requests with OAuth token
- [ ] Verify Clerk authentication still works

## Production Deployment

### 1. Environment Preparation
- [ ] Verify Turso database is accessible
- [ ] Check environment variables are set
- [ ] Verify Clerk configuration is correct
- [ ] Ensure HTTPS is configured
- [ ] Review CORS settings

### 2. Database Migration
```bash
# Connect to production database
export TURSO_URL="your-production-url"
export TURSO_AUTH_TOKEN="your-production-token"

# Run migration
npm run migrate:oauth
```

- [ ] Migration completed successfully
- [ ] Verify tables in production database
- [ ] Check indexes created correctly

### 3. Code Deployment
- [ ] Merge OAuth implementation to main branch
- [ ] Deploy to production (Vercel/hosting platform)
- [ ] Verify deployment successful
- [ ] Check deployment logs for errors

### 4. OAuth Client Registration
```bash
# Register Claude.AI as OAuth client
npm run oauth:register-client
```

Provide production values:
- [ ] Name: "Claude.AI Custom Connector"
- [ ] Redirect URI: Check Claude.AI docs (likely `https://claude.ai/oauth/callback`)
- [ ] Scopes: `memories:read,memories:write,entities:read,entities:write`
- [ ] User ID: Production admin user ID

**CRITICAL**: Save these credentials securely!
- [ ] Client ID saved in password manager
- [ ] Client Secret saved in password manager
- [ ] Credentials documented for team access

### 5. Production Testing

#### Test Authorization Endpoint
```bash
# Should return redirect or consent screen
curl -I "https://ai-memory.app/api/oauth/authorize?response_type=code&client_id=mcp_oauth_...&redirect_uri=https://claude.ai/oauth/callback&scope=memories:read&state=test"
```
- [ ] Returns 302 redirect
- [ ] No server errors

#### Test Token Endpoint (After Getting Auth Code)
```bash
curl -X POST https://ai-memory.app/api/oauth/token \
  -d "grant_type=authorization_code" \
  -d "code=auth_..." \
  -d "redirect_uri=https://claude.ai/oauth/callback" \
  -d "client_id=mcp_oauth_..." \
  -d "client_secret=..."
```
- [ ] Returns access_token
- [ ] Returns refresh_token
- [ ] Token format correct (mcp_at_...)

#### Test MCP with OAuth Token
```bash
curl -X POST https://ai-memory.app/api/mcp \
  -H "Authorization: Bearer mcp_at_..." \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```
- [ ] Returns valid MCP response
- [ ] Authentication successful
- [ ] No authorization errors

### 6. Claude.AI Configuration

Access Claude.AI settings and configure custom connector:

| Field | Value | Status |
|-------|-------|--------|
| Name | MCP Memory | [ ] |
| Authorization URL | `https://ai-memory.app/api/oauth/authorize` | [ ] |
| Token URL | `https://ai-memory.app/api/oauth/token` | [ ] |
| Client ID | `mcp_oauth_...` | [ ] |
| Client Secret | `...` | [ ] |
| Scopes | `memories:read memories:write` | [ ] |
| API Base URL | `https://ai-memory.app/api/mcp` | [ ] |

- [ ] Configuration saved
- [ ] Test connection from Claude.AI
- [ ] Complete authorization flow
- [ ] Verify MCP tools accessible

## Post-Deployment

### 1. Monitoring Setup
- [ ] Set up error alerting for OAuth endpoints
- [ ] Monitor token generation rates
- [ ] Track failed authorization attempts
- [ ] Watch database size (tokens table)

### 2. Maintenance Configuration

#### Token Cleanup Cron Job
- [ ] Create cleanup script (see OAUTH_IMPLEMENTATION_SUMMARY.md)
- [ ] Schedule daily cleanup at off-peak hours
- [ ] Test cleanup script runs successfully
- [ ] Monitor cleanup logs

#### Database Backups
- [ ] Verify OAuth tables included in backups
- [ ] Test restore procedure
- [ ] Document backup retention policy

### 3. Documentation
- [ ] Update team documentation with OAuth details
- [ ] Document client credentials location
- [ ] Create runbook for common OAuth issues
- [ ] Share deployment summary with team

### 4. Security Review
- [ ] Verify HTTPS on all OAuth endpoints
- [ ] Check CORS configuration
- [ ] Review rate limiting settings
- [ ] Validate token expiry times
- [ ] Test token revocation (if implemented)
- [ ] Verify client secret is hashed in database

### 5. User Communication
- [ ] Announce OAuth support to users
- [ ] Update user documentation
- [ ] Provide Claude.AI integration guide
- [ ] Set up support channels for OAuth issues

## Verification Tests (End-to-End)

### Test 1: New User Authorization
1. [ ] Open Claude.AI
2. [ ] Add MCP Memory custom connector
3. [ ] Initiate authorization
4. [ ] Redirected to authorization endpoint
5. [ ] Login with Clerk
6. [ ] See consent screen
7. [ ] Approve authorization
8. [ ] Redirected back to Claude.AI
9. [ ] Claude.AI shows successful connection
10. [ ] Test MCP tool calls work

### Test 2: Existing User Re-authorization
1. [ ] User already has active token
2. [ ] Token expires
3. [ ] Claude.AI uses refresh token
4. [ ] New access token obtained
5. [ ] MCP calls continue working

### Test 3: Authorization Denial
1. [ ] User initiates authorization
2. [ ] User clicks "Deny" on consent screen
3. [ ] Redirected back with error
4. [ ] Claude.AI shows authorization failed
5. [ ] No token created

### Test 4: Invalid Client
1. [ ] Use incorrect client_id
2. [ ] Authorization fails with invalid_client
3. [ ] No security information leaked

### Test 5: Token Revocation (If Implemented)
1. [ ] User has active token
2. [ ] Revoke token via settings
3. [ ] Token marked as revoked in database
4. [ ] MCP calls with revoked token fail
5. [ ] User must re-authorize

## Rollback Plan

If issues occur during deployment:

### Immediate Rollback
1. [ ] Revert code deployment
2. [ ] OAuth endpoints disabled
3. [ ] Existing Clerk auth still works
4. [ ] Document issue for investigation

### Database Rollback
```bash
# Drop OAuth tables if needed
DROP TABLE oauth_refresh_tokens;
DROP TABLE oauth_access_tokens;
DROP TABLE oauth_authorization_codes;
DROP TABLE oauth_clients;
```
- [ ] Tables dropped
- [ ] No foreign key constraint issues
- [ ] System operational without OAuth

### Communication
- [ ] Notify team of rollback
- [ ] Inform users of temporary unavailability
- [ ] Update status page
- [ ] Schedule fix and re-deployment

## Success Criteria

Deployment is successful when:

- ✅ All database tables created
- ✅ OAuth client registered
- ✅ Authorization flow works end-to-end
- ✅ Token exchange successful
- ✅ MCP requests work with OAuth tokens
- ✅ Claude.AI integration functional
- ✅ Existing Clerk auth still works
- ✅ No critical errors in logs
- ✅ Performance acceptable
- ✅ Security measures in place

## Support Information

### Troubleshooting Resources
- Full Setup Guide: `docs/guides/OAUTH_SETUP_GUIDE.md`
- Quick Start: `docs/guides/OAUTH_QUICK_START.md`
- Implementation Summary: `OAUTH_IMPLEMENTATION_SUMMARY.md`

### Common Issues
- Invalid redirect_uri: Check exact match with registered URIs
- Authorization code expired: Codes expire after 10 minutes
- Token not recognized: Verify token starts with `mcp_at_`
- Client not found: Re-run client registration

### Emergency Contacts
- [ ] Document who to contact for OAuth issues
- [ ] Escalation path defined
- [ ] On-call schedule updated

## Completion

Deployment completed by: _______________

Date: _______________

Signature: _______________

---

**Next Review**: Schedule review 7 days after deployment to:
- Check error rates
- Review token usage patterns
- Validate monitoring effectiveness
- Identify optimization opportunities
