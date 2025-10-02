# Vercel Environment Variables Setup Guide

Quick reference for setting up environment variables in Vercel dashboard for MCP Memory Service deployment.

## Access Vercel Dashboard

1. Go to https://vercel.com/dashboard
2. Select your project: `mcp-memory-ts`
3. Navigate to: **Settings** > **Environment Variables**

---

## Required Environment Variables

### Database Configuration

| Variable | Value | Environment |
|----------|-------|-------------|
| `TURSO_URL` | `libsql://ai-memory-bobmatnyc.aws-us-east-1.turso.io` | Production, Preview, Development |
| `TURSO_AUTH_TOKEN` | `eyJhbGci...` (your Turso token) | Production, Preview, Development |
| `DATABASE_URL` | Same as `TURSO_URL` | Production, Preview, Development |
| `DATABASE_AUTH_TOKEN` | Same as `TURSO_AUTH_TOKEN` | Production, Preview, Development |

### OpenAI Configuration

| Variable | Value | Environment |
|----------|-------|-------------|
| `OPENAI_API_KEY` | `sk-proj-...` (your OpenAI key) | Production, Preview, Development |

### Clerk Authentication - Development

| Variable | Value | Environment |
|----------|-------|-------------|
| `CLERK_SECRET_KEY` | `your-clerk-test-secret-key` | Development, Preview |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | `pk_test_bmF0aXZlLW1hcm1vc2V0LTc0LmNsZXJrLmFjY291bnRzLmRldiQ` | Development, Preview |

### Clerk Authentication - Production

| Variable | Value | Environment |
|----------|-------|-------------|
| `CLERK_SECRET_KEY` | `your-clerk-live-secret-key` | Production |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | `pk_live_Y2xlcmsuYWktbWVtb3J5LmFwcCQ` | Production |
| `CLERK_WEBHOOK_SECRET` | `whsec_...` (get from Clerk dashboard) | Production, Preview |

### Application Configuration

| Variable | Value | Environment |
|----------|-------|-------------|
| `NODE_ENV` | `production` | Production |
| `NODE_ENV` | `development` | Development, Preview |
| `LOG_LEVEL` | `info` | Production |
| `LOG_LEVEL` | `debug` | Development, Preview |
| `MCP_DEBUG` | `0` | Production, Preview, Development |

### Remote MCP Server

| Variable | Value | Environment |
|----------|-------|-------------|
| `REMOTE_MCP_PORT` | `3003` | Production, Preview, Development |
| `REMOTE_MCP_HOST` | `0.0.0.0` | Production, Preview, Development |

### CORS Configuration - Development

| Variable | Value | Environment |
|----------|-------|-------------|
| `CORS_ORIGIN` | `*` | Development, Preview |
| `ALLOWED_ORIGINS` | `http://localhost:3000,http://localhost:3003` | Development, Preview |

### CORS Configuration - Production

| Variable | Value | Environment |
|----------|-------|-------------|
| `CORS_ORIGIN` | `https://ai-memory.app,https://www.ai-memory.app` | Production |
| `ALLOWED_ORIGINS` | `https://ai-memory.app,https://www.ai-memory.app,https://clerk.ai-memory.app` | Production |

### Rate Limiting

| Variable | Value | Environment |
|----------|-------|-------------|
| `RATE_LIMIT_REQUESTS_PER_MINUTE` | `100` | Production |
| `RATE_LIMIT_REQUESTS_PER_MINUTE` | `1000` | Development, Preview |
| `RATE_LIMIT_WINDOW_MS` | `60000` | Production, Preview, Development |

### Session Configuration

| Variable | Value | Environment |
|----------|-------|-------------|
| `SESSION_TIMEOUT_MINUTES` | `120` | Production |
| `SESSION_TIMEOUT_MINUTES` | `480` | Development, Preview |
| `SESSION_CLEANUP_INTERVAL_MINUTES` | `30` | Production, Preview, Development |

### Security Settings

| Variable | Value | Environment |
|----------|-------|-------------|
| `ALLOW_DEV_AUTH` | `false` | Production |
| `ALLOW_DEV_AUTH` | `true` | Development, Preview |
| `ENABLE_REQUEST_LOGGING` | `false` | Production |
| `ENABLE_REQUEST_LOGGING` | `true` | Development, Preview |
| `ENABLE_DEBUG_ENDPOINTS` | `false` | Production |
| `ENABLE_DEBUG_ENDPOINTS` | `true` | Development, Preview |

---

## Quick Setup Commands

### Using Vercel CLI

```bash
# Set up all environments at once
npm run setup:vercel

# Or manually set individual variables
vercel env add TURSO_URL production
vercel env add TURSO_AUTH_TOKEN production
vercel env add OPENAI_API_KEY production
vercel env add CLERK_SECRET_KEY production
vercel env add NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY production
vercel env add CLERK_WEBHOOK_SECRET production
vercel env add NODE_ENV production
vercel env add LOG_LEVEL production
vercel env add CORS_ORIGIN production
vercel env add ALLOWED_ORIGINS production
vercel env add RATE_LIMIT_REQUESTS_PER_MINUTE production
```

---

## Environment-Specific Notes

### Development Environment

- Uses Clerk test keys for local testing
- Permissive CORS (`*` origin allowed)
- Relaxed rate limiting (1000 req/min)
- Debug logging enabled
- Long session timeout (8 hours)

### Preview Environment

- Uses Clerk test keys for preview deployments
- Same as development settings
- Used for testing before production

### Production Environment

- Uses Clerk live keys
- Strict CORS (specific domains only)
- Standard rate limiting (100 req/min)
- Info-level logging only
- Standard session timeout (2 hours)

---

## Clerk Webhook Configuration

After deployment, configure the Clerk webhook:

1. Go to https://dashboard.clerk.com/
2. Navigate to **Webhooks**
3. Click **Add Endpoint**
4. Enter URL: `https://your-deployment.vercel.app/api/auth/webhook`
5. Select events to listen for (e.g., `user.created`, `user.updated`, `session.created`)
6. Copy the **Signing Secret**
7. Add it to Vercel as `CLERK_WEBHOOK_SECRET`

---

## Verification Steps

After setting up environment variables:

1. **Check Configuration:**
   ```bash
   vercel env ls
   ```

2. **Deploy:**
   ```bash
   vercel --prod
   ```

3. **Test Health Endpoint:**
   ```bash
   curl https://your-deployment.vercel.app/health
   ```

4. **Test Authentication:**
   ```bash
   curl -X POST https://your-deployment.vercel.app/mcp \
     -H "Authorization: Bearer <clerk-token>" \
     -H "Content-Type: application/json" \
     -d '{"jsonrpc":"2.0","id":1,"method":"initialize"}'
   ```

---

## Security Best Practices

1. **Never commit** environment files with real values to git
2. **Use Vercel dashboard** or CLI to set sensitive variables
3. **Rotate secrets** periodically:
   - Turso auth token
   - OpenAI API key
   - Clerk webhook secret
4. **Monitor usage** to detect unauthorized access
5. **Enable alerts** in Vercel for deployment failures
6. **Review logs** regularly for security issues

---

## Troubleshooting

### Variables Not Applied

- Redeploy after adding variables
- Check correct environment selected
- Verify variable names match code

### CORS Errors

- Ensure `CORS_ORIGIN` includes your domain
- Check `ALLOWED_ORIGINS` format (comma-separated, no spaces)
- Verify Vercel deployment has correct headers

### Authentication Failures

- Verify correct Clerk keys for environment
- Check `CLERK_WEBHOOK_SECRET` is set
- Ensure webhook URL is configured in Clerk

---

## Reference Links

- Vercel Dashboard: https://vercel.com/dashboard
- Clerk Dashboard: https://dashboard.clerk.com/
- Turso Dashboard: https://turso.tech/
- OpenAI API Keys: https://platform.openai.com/api-keys

---

**Last Updated:** 2025-10-01
**Version:** 1.1.2
