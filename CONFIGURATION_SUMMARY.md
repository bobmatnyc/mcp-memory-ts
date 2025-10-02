# MCP Memory Service - Configuration Summary

Quick reference for development and production environment configurations.

## Environment Files Created

1. **`.env.development`** - Development environment (localhost)
2. **`.env.production`** - Production environment (Vercel deployment)
3. **`.env.example`** - Template with documentation (commit-safe)

## Key Differences: Development vs Production

### Authentication

| Setting | Development | Production |
|---------|-------------|------------|
| Clerk Keys | Test keys | Live keys |
| `ALLOW_DEV_AUTH` | `true` | `false` |
| Session Timeout | 480 min (8 hours) | 120 min (2 hours) |

### CORS Configuration

| Setting | Development | Production |
|---------|-------------|------------|
| `CORS_ORIGIN` | `*` (all origins) | `https://ai-memory.app` (specific) |
| `ALLOWED_ORIGINS` | `localhost:3000,3003` | Production domains only |

### Rate Limiting

| Setting | Development | Production |
|---------|-------------|------------|
| Requests/minute | 1000 | 100 |
| Window (ms) | 60000 | 60000 |

### Logging & Debug

| Setting | Development | Production |
|---------|-------------|------------|
| `LOG_LEVEL` | `debug` | `info` |
| `MCP_DEBUG` | `1` (enabled) | `0` (disabled) |
| `ENABLE_REQUEST_LOGGING` | `true` | `false` |
| `ENABLE_DEBUG_ENDPOINTS` | `true` | `false` |

---

## Quick Start Guide

### Development Setup

1. **Copy environment template:**
   ```bash
   cp .env.example .env
   # OR
   cp .env.development .env
   ```

2. **Update with your keys:**
   - Get Turso credentials from https://turso.tech/
   - Get OpenAI key from https://platform.openai.com/
   - Get Clerk dev keys from https://dashboard.clerk.com/

3. **Start development server:**
   ```bash
   npm install
   npm run build
   npm run mcp-server-remote
   ```

4. **Test locally:**
   ```bash
   curl http://localhost:3003/health
   ```

### Production Deployment

1. **Set up Vercel environment variables:**
   ```bash
   npm run setup:vercel
   ```

2. **Deploy to production:**
   ```bash
   npm run deploy:vercel production
   ```

3. **Configure Clerk webhook:**
   - URL: `https://your-deployment.vercel.app/api/auth/webhook`
   - Copy signing secret to Vercel as `CLERK_WEBHOOK_SECRET`

4. **Verify deployment:**
   ```bash
   curl https://your-deployment.vercel.app/health
   ```

---

## Security Configuration

### Vercel Headers (vercel.json)

The following security headers are automatically applied:

- **CORS**: Configurable via environment variables
- **Content Security Policy**: Restricts resource loading
- **Strict Transport Security**: Enforces HTTPS
- **X-Frame-Options**: Prevents clickjacking
- **X-Content-Type-Options**: Prevents MIME sniffing
- **Permissions-Policy**: Disables unnecessary browser features

### Rate Limiting

Rate limiting is implemented using token bucket algorithm:

- Per-user limits based on email
- Configurable via environment variables
- Returns `429 Too Many Requests` with `Retry-After` header
- Automatic cleanup of expired sessions

### Authentication Flow

1. Client authenticates with Clerk
2. Client receives session token
3. Token included in `Authorization: Bearer <token>` header
4. Server validates with Clerk API
5. Session created and cached locally
6. Subsequent requests use cached session

---

## File Structure

```
mcp-memory-ts/
├── .env.development          # Development config (gitignored)
├── .env.production          # Production config (gitignored)
├── .env.example             # Template (commit-safe)
├── vercel.json              # Vercel deployment config
├── DEPLOYMENT.md            # Full deployment guide
├── VERCEL_ENV_SETUP.md      # Vercel-specific setup
├── CONFIGURATION_SUMMARY.md # This file
└── src/
    ├── middleware/
    │   ├── mcp-auth.ts      # Clerk authentication
    │   └── rate-limiter.ts  # Rate limiting
    └── remote-mcp-server.ts # Main server
```

---

## Configuration Checklist

### Before Development

- [ ] Copy `.env.example` to `.env` or `.env.development`
- [ ] Set `TURSO_URL` and `TURSO_AUTH_TOKEN`
- [ ] Set `OPENAI_API_KEY`
- [ ] Set Clerk development keys
- [ ] Verify `REMOTE_MCP_PORT=3003`

### Before Production Deployment

- [ ] All tests passing (`npm test`)
- [ ] Environment variables set in Vercel dashboard
- [ ] Production Clerk keys configured
- [ ] `ALLOW_DEV_AUTH=false` in production
- [ ] CORS origins restricted to production domains
- [ ] Rate limiting configured appropriately
- [ ] Clerk webhook secret set
- [ ] Security headers verified in `vercel.json`

### After Production Deployment

- [ ] Health check endpoint responding
- [ ] Clerk webhook configured and working
- [ ] Authentication flow tested
- [ ] CORS headers verified
- [ ] Rate limiting active
- [ ] Monitoring and logging active

---

## Environment Variables Reference

See [VERCEL_ENV_SETUP.md](./VERCEL_ENV_SETUP.md) for complete list of environment variables with values for each environment.

---

## Deployment Commands

```bash
# Development
npm run mcp-server-remote          # Start local server
npm test                           # Run tests
npm run build                      # Build project

# Production
npm run setup:vercel               # Configure Vercel env vars
npm run deploy:vercel production   # Deploy to production
npm run test:vercel                # Test Vercel deployment
```

---

## Troubleshooting

### Common Issues

1. **Authentication fails**
   - Check Clerk keys match environment (dev vs prod)
   - Verify `CLERK_SECRET_KEY` is set correctly
   - Ensure Clerk session is valid

2. **CORS errors**
   - Verify `CORS_ORIGIN` includes your domain
   - Check `ALLOWED_ORIGINS` format
   - Ensure no trailing slashes in URLs

3. **Rate limit errors**
   - Check `RATE_LIMIT_REQUESTS_PER_MINUTE` setting
   - Implement exponential backoff in client
   - Use `Retry-After` header value

4. **Database connection fails**
   - Verify Turso credentials are correct
   - Check database is active
   - Ensure auth token hasn't expired

---

## Support Resources

- **Deployment Guide**: [DEPLOYMENT.md](./DEPLOYMENT.md)
- **Vercel Setup**: [VERCEL_ENV_SETUP.md](./VERCEL_ENV_SETUP.md)
- **Project Instructions**: [CLAUDE.md](./CLAUDE.md)
- **Vercel Dashboard**: https://vercel.com/dashboard
- **Clerk Dashboard**: https://dashboard.clerk.com/

---

**Last Updated:** 2025-10-01
**Version:** 1.1.2
