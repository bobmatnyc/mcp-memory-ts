# MCP Memory Service - Deployment Guide

Complete guide for deploying the MCP Memory Service with Clerk OAuth authentication to both development and production environments.

**Current Version**: 1.7.2 | **Last Updated**: 2025-10-14

## Table of Contents

- [Prerequisites](#prerequisites)
- [Environment Setup](#environment-setup)
- [Local Development](#local-development)
- [Production Deployment](#production-deployment)
- [Configuration Reference](#configuration-reference)
- [Security Checklist](#security-checklist)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Services

1. **Turso Database** (https://turso.tech/)
   - Create a LibSQL database
   - Generate authentication token
   - Note the database URL

2. **OpenAI API** (https://platform.openai.com/)
   - Create an API key for embeddings
   - Ensure sufficient credits

3. **Clerk Account** (https://dashboard.clerk.com/)
   - Development keys for testing
   - Production keys for deployment
   - Webhook secret for event handling

4. **Vercel Account** (https://vercel.com/)
   - Install Vercel CLI: `npm install -g vercel@latest`
   - Authenticate: `vercel login`

### Development Tools

- Node.js >= 18.0.0
- npm or yarn package manager
- Git for version control

---

## Environment Setup

### 1. Development Environment

Copy `.env.example` to `.env` or `.env.development`:

```bash
cp .env.example .env.development
```

Update the following values in `.env.development`:

```bash
# Database (from Turso)
TURSO_URL=libsql://your-database.turso.io
TURSO_AUTH_TOKEN=your-turso-auth-token

# OpenAI (for embeddings)
OPENAI_API_KEY=sk-proj-your-openai-api-key

# Clerk Development Keys
CLERK_SECRET_KEY=sk_test_your-dev-secret-key
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_your-dev-publishable-key

# Development Settings
NODE_ENV=development
LOG_LEVEL=debug
MCP_DEBUG=1
REMOTE_MCP_PORT=3003
CORS_ORIGIN=*
```

### 2. Production Environment

Create `.env.production` for production settings:

```bash
cp .env.example .env.production
```

Update with production values:

```bash
# Database
TURSO_URL=libsql://your-database.turso.io
TURSO_AUTH_TOKEN=your-turso-auth-token

# OpenAI
OPENAI_API_KEY=sk-proj-your-openai-api-key

# Clerk Production Keys
CLERK_SECRET_KEY=sk_live_your-production-secret-key
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_your-production-publishable-key
CLERK_WEBHOOK_SECRET=whsec_your-webhook-secret

# Production Settings
NODE_ENV=production
LOG_LEVEL=info
MCP_DEBUG=0
CORS_ORIGIN=https://ai-memory.app,https://www.ai-memory.app
ALLOWED_ORIGINS=https://ai-memory.app,https://www.ai-memory.app,https://clerk.ai-memory.app
RATE_LIMIT_REQUESTS_PER_MINUTE=100
ALLOW_DEV_AUTH=false
```

---

## Local Development

### Starting the Development Server

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Build the project:**
   ```bash
   npm run build
   ```

3. **Start the remote MCP server (optional for HTTP MCP):**
   ```bash
   npm run mcp-server-remote
   ```

   The server will start on `http://localhost:3003`

4. **Start the web interface (staging on port 3002):**
   ```bash
   ./START_WEB_SERVER.sh
   ```

   The web interface will start on `http://localhost:3002`

5. **Deploy with PM2 for production (port 3001):**
   ```bash
   cd web && npm run build && cd ..
   pm2 start ecosystem.config.cjs
   pm2 list
   ```

### Testing Locally

1. **Health check:**
   ```bash
   curl http://localhost:3003/health
   ```

2. **Test with authentication:**
   ```bash
   # Get a session token from Clerk
   export CLERK_TOKEN="your-clerk-session-token"
   
   # Test MCP initialize
   curl -X POST http://localhost:3003/mcp \
     -H "Authorization: Bearer $CLERK_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05"}}'
   ```

3. **Run test suite:**
   ```bash
   npm test
   ```

---

## Production Deployment

### Method 1: Automated Deployment Script

```bash
# 1. Set up Vercel environment variables (one-time setup)
npm run setup:vercel

# 2. Deploy to production
npm run deploy:vercel production
```

### Method 2: Manual Vercel Deployment

#### Step 1: Link Vercel Project

```bash
vercel link
```

Follow the prompts to link or create a Vercel project.

#### Step 2: Set Environment Variables

Use Vercel dashboard or CLI to set environment variables:

```bash
# Database
vercel env add TURSO_URL production
vercel env add TURSO_AUTH_TOKEN production

# OpenAI
vercel env add OPENAI_API_KEY production

# Clerk (Production Keys)
vercel env add CLERK_SECRET_KEY production
vercel env add NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY production
vercel env add CLERK_WEBHOOK_SECRET production

# Configuration
vercel env add NODE_ENV production
vercel env add LOG_LEVEL production
vercel env add MCP_DEBUG production
vercel env add CORS_ORIGIN production
vercel env add ALLOWED_ORIGINS production
vercel env add RATE_LIMIT_REQUESTS_PER_MINUTE production
```

#### Step 3: Deploy

```bash
# Deploy to production
vercel --prod

# Or deploy to preview
vercel
```

### Post-Deployment Steps

1. **Verify deployment:**
   ```bash
   curl https://your-deployment.vercel.app/health
   ```

2. **Configure Clerk webhook:**
   - Go to Clerk Dashboard > Webhooks
   - Add endpoint: `https://your-deployment.vercel.app/api/auth/webhook`
   - Copy webhook signing secret
   - Update `CLERK_WEBHOOK_SECRET` in Vercel

3. **Test production endpoints:**
   ```bash
   npm run test:vercel
   ```

4. **Monitor deployment:**
   - Check Vercel dashboard for logs
   - Monitor error rates
   - Verify CORS headers

---

## Configuration Reference

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NODE_ENV` | Yes | `development` | Environment mode |
| `TURSO_URL` | Yes | - | Turso database URL |
| `TURSO_AUTH_TOKEN` | Yes | - | Turso authentication token |
| `OPENAI_API_KEY` | Yes | - | OpenAI API key for embeddings |
| `CLERK_SECRET_KEY` | Yes | - | Clerk secret key |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Yes | - | Clerk publishable key |
| `CLERK_WEBHOOK_SECRET` | Production | - | Clerk webhook signing secret |
| `LOG_LEVEL` | No | `info` | Logging level (debug/info/warn/error) |
| `MCP_DEBUG` | No | `0` | Enable MCP debug logging |
| `REMOTE_MCP_PORT` | No | `3003` | Server port |
| `REMOTE_MCP_HOST` | No | `0.0.0.0` | Server bind address |
| `CORS_ORIGIN` | No | `*` | CORS allowed origins |
| `ALLOWED_ORIGINS` | No | - | Comma-separated allowed origins |
| `RATE_LIMIT_REQUESTS_PER_MINUTE` | No | `100` | Rate limit per user |
| `RATE_LIMIT_WINDOW_MS` | No | `60000` | Rate limit window |
| `SESSION_TIMEOUT_MINUTES` | No | `120` | Session timeout |
| `ALLOW_DEV_AUTH` | No | `false` | Allow dev auth bypass |

### CORS Configuration

**Development:**
```bash
CORS_ORIGIN=*
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3003
```

**Production:**
```bash
CORS_ORIGIN=https://ai-memory.app,https://www.ai-memory.app
ALLOWED_ORIGINS=https://ai-memory.app,https://www.ai-memory.app,https://clerk.ai-memory.app
```

### Rate Limiting

**Development (Relaxed):**
```bash
RATE_LIMIT_REQUESTS_PER_MINUTE=1000
RATE_LIMIT_WINDOW_MS=60000
```

**Production (Strict):**
```bash
RATE_LIMIT_REQUESTS_PER_MINUTE=100
RATE_LIMIT_WINDOW_MS=60000
```

---

## Security Checklist

### Pre-Deployment Security Checks

- [ ] All environment variables are set in Vercel dashboard (not in code)
- [ ] `.env` files are in `.gitignore` (should already be there)
- [ ] Production uses `ALLOW_DEV_AUTH=false`
- [ ] CORS origins are restricted to production domains
- [ ] Rate limiting is enabled and properly configured
- [ ] Clerk webhook secret is configured
- [ ] HTTPS is enforced (automatic with Vercel)
- [ ] Security headers are enabled in `vercel.json`

### Security Headers (Configured in vercel.json)

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Strict-Transport-Security: max-age=31536000`
- `Content-Security-Policy` with restricted sources
- `Permissions-Policy` with disabled features

### Authentication Flow

1. Client requests authentication from Clerk
2. Client receives session token
3. Client includes token in `Authorization: Bearer <token>` header
4. Server validates token with Clerk
5. Server creates session and allows access

### Rate Limiting

- Per-user rate limiting using email as key
- Token bucket algorithm for smooth rate limiting
- Returns `429 Too Many Requests` when exceeded
- Includes `Retry-After` header

---

## Troubleshooting

### Common Issues

#### 1. Authentication Errors

**Symptom:** 401 Unauthorized errors

**Solutions:**
- Verify Clerk keys are correct for environment (dev vs prod)
- Check Authorization header format: `Bearer <token>`
- Ensure Clerk session is valid and not expired
- Verify `CLERK_SECRET_KEY` is set correctly

#### 2. CORS Errors

**Symptom:** Browser blocks requests with CORS error

**Solutions:**
- Check `CORS_ORIGIN` includes your domain
- Verify `ALLOWED_ORIGINS` is set correctly
- Ensure request includes credentials if needed
- Check Vercel deployment has correct CORS headers

#### 3. Rate Limiting

**Symptom:** 429 Too Many Requests errors

**Solutions:**
- Check `RATE_LIMIT_REQUESTS_PER_MINUTE` setting
- Verify rate limiter is using correct user key
- Implement exponential backoff in client
- Check `Retry-After` header for wait time

#### 4. Database Connection Errors

**Symptom:** Failed to connect to Turso database

**Solutions:**
- Verify `TURSO_URL` and `TURSO_AUTH_TOKEN` are correct
- Check Turso database is active
- Ensure auth token has not expired
- Verify network connectivity to Turso

#### 5. Embedding Generation Failures

**Symptom:** Memories stored without embeddings

**Solutions:**
- Verify `OPENAI_API_KEY` is valid
- Check OpenAI account has sufficient credits
- Monitor API rate limits
- Run `update_missing_embeddings` tool to regenerate

### Debug Mode

Enable debug logging in development:

```bash
LOG_LEVEL=debug
MCP_DEBUG=1
ENABLE_REQUEST_LOGGING=true
```

### Monitoring

**Health Check Endpoint:**
```bash
curl https://your-deployment.vercel.app/health
```

**Session Monitoring:**
```bash
curl https://your-deployment.vercel.app/health | jq .activeSessions
```

**Vercel Logs:**
```bash
vercel logs
```

---

## Support

For issues and questions:

1. Check this deployment guide
2. Review [CLAUDE.md](./CLAUDE.md) for project details
3. Check Vercel deployment logs
4. Verify environment variables in Vercel dashboard
5. Test with development environment first

---

## Deployment Checklist

### Pre-Deployment

- [ ] All tests passing (`npm test`)
- [ ] Type checking successful (`npm run type-check`)
- [ ] Linting clean (`npm run lint`)
- [ ] Build successful (`npm run build`)
- [ ] Environment variables configured
- [ ] Security checklist completed

### Deployment

- [ ] Deployed to Vercel
- [ ] Health check passing
- [ ] API endpoints responding
- [ ] Authentication working
- [ ] CORS headers correct
- [ ] Rate limiting active

### Post-Deployment

- [ ] Clerk webhook configured
- [ ] Production domains added to CORS
- [ ] Monitoring set up
- [ ] Error tracking enabled
- [ ] Documentation updated
- [ ] Team notified

---

## Web Interface Deployment

### Staging Environment (Port 3002)

For development and testing:

```bash
# Quick start with dedicated script
./START_WEB_SERVER.sh

# Or manually
cd web
npm run dev -- -p 3002
```

Access at: `http://localhost:3002`

### Production Environment (Port 3001)

Using PM2 process manager:

```bash
# 1. Build the web application
cd web
npm run build
cd ..

# 2. Deploy with PM2
pm2 start ecosystem.config.cjs

# 3. Monitor
pm2 list
pm2 logs mcp-memory-web

# 4. Manage
pm2 restart mcp-memory-web
pm2 stop mcp-memory-web
pm2 delete mcp-memory-web

# 5. Save PM2 configuration
pm2 save
pm2 startup  # For auto-start on system boot
```

Access at: `http://localhost:3001`

### Port Configuration Summary

| Environment | Port | Method | URL |
|-------------|------|--------|-----|
| **Staging** | 3002 | ./START_WEB_SERVER.sh or npm run dev | http://localhost:3002 |
| **Production** | 3001 | PM2 (ecosystem.config.cjs) | http://localhost:3001 |
| **Remote MCP** | 3003 | npm run mcp-server-remote | http://localhost:3003 |
| **Claude Desktop** | N/A | stdio (npm run mcp-server) | N/A (local stdio) |

---

**Last Updated:** 2025-10-14
**Version:** 1.7.2
