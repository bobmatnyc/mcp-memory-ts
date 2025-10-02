# OAuth Deployment Guide

Complete guide for deploying the Remote MCP Server with Clerk OAuth authentication to production.

## Table of Contents

- [Overview](#overview)
- [Pre-Deployment Checklist](#pre-deployment-checklist)
- [Local Development Deployment](#local-development-deployment)
- [Vercel Production Deployment](#vercel-production-deployment)
- [Environment Configuration](#environment-configuration)
- [Security Hardening](#security-hardening)
- [Monitoring & Logging](#monitoring--logging)
- [Troubleshooting](#troubleshooting)

---

## Overview

This guide covers deploying the OAuth-enabled Remote MCP Server to:

1. **Local Development** - For testing and development
2. **Vercel Production** - For production deployment with serverless functions

### Deployment Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Vercel Edge Network                   │
│  • Global CDN                                            │
│  • Automatic HTTPS                                       │
│  • DDoS Protection                                       │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│              Vercel Serverless Functions                 │
│  • /api/mcp/index.ts - MCP endpoint                     │
│  • Auto-scaling                                          │
│  • Cold start optimization                               │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│                External Services                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │    Clerk     │  │    Turso     │  │   OpenAI     │  │
│  │    OAuth     │  │   Database   │  │  Embeddings  │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────┘
```

---

## Pre-Deployment Checklist

### Code Quality

- [ ] All tests passing: `npm test` (95.2% pass rate expected)
- [ ] Type checking successful: `npm run type-check`
- [ ] Linting clean: `npm run lint`
- [ ] Build successful: `npm run build`
- [ ] No sensitive data in code or commits

### Environment Setup

- [ ] Turso database created and accessible
- [ ] OpenAI API key with sufficient credits
- [ ] Clerk production application configured
- [ ] Vercel account created and CLI installed

### Security

- [ ] Production Clerk keys obtained
- [ ] Clerk webhook secret configured
- [ ] CORS origins restricted to production domains
- [ ] Rate limiting configured appropriately
- [ ] `ALLOW_DEV_AUTH=false` for production
- [ ] Security headers configured in `vercel.json`

### Documentation

- [ ] API documentation reviewed
- [ ] Deployment runbook prepared
- [ ] Rollback plan documented
- [ ] Team notified of deployment

---

## Local Development Deployment

### 1. Initial Setup

```bash
# Clone repository
git clone https://github.com/your-org/mcp-memory-ts.git
cd mcp-memory-ts

# Install dependencies
npm install

# Build project
npm run build
```

### 2. Configure Environment

Create `.env.development`:

```bash
# Copy example file
cp .env.example .env.development

# Edit with your values
nano .env.development
```

**Development Configuration:**

```bash
# Database (Turso)
TURSO_URL=libsql://your-dev-database.turso.io
TURSO_AUTH_TOKEN=your-dev-auth-token

# OpenAI
OPENAI_API_KEY=sk-proj-your-openai-key

# Clerk Development Keys
CLERK_SECRET_KEY=your-clerk-test-secret-key
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_bmF0aXZlLW1hcm1vc2V0LTc0LmNsZXJrLmFjY291bnRzLmRldiQ

# Development Settings
NODE_ENV=development
LOG_LEVEL=debug
MCP_DEBUG=1
REMOTE_MCP_PORT=3003
REMOTE_MCP_HOST=0.0.0.0

# CORS (relaxed for development)
CORS_ORIGIN=*
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3003

# Rate Limiting (relaxed for development)
RATE_LIMIT_REQUESTS_PER_MINUTE=1000
RATE_LIMIT_WINDOW_MS=60000

# Session (extended for development)
SESSION_TIMEOUT_MINUTES=480

# Development Features
ALLOW_DEV_AUTH=true
ENABLE_REQUEST_LOGGING=true
ENABLE_DEBUG_ENDPOINTS=true
```

### 3. Start Development Server

```bash
# Start the remote MCP server
npm run mcp-server-remote

# Or with environment file
NODE_ENV=development npm run mcp-server-remote
```

**Verify:**

```bash
# Health check
curl http://localhost:3003/health

# Expected response
{
  "status": "healthy",
  "version": "1.1.2",
  "authentication": "enabled",
  "database": "connected"
}
```

### 4. Run Tests

```bash
# Unit and integration tests
npm test

# Expected: 20/21 tests passed (95.2%)

# Run specific test suite
npm test -- tests/integration/remote-mcp-auth.test.ts
```

---

## Vercel Production Deployment

### Method 1: Automated Deployment (Recommended)

#### Step 1: Install Vercel CLI

```bash
npm install -g vercel@latest
vercel login
```

#### Step 2: Link Project

```bash
# Link to existing project or create new
vercel link

# Follow prompts:
# ? Set up and deploy "~/mcp-memory-ts"? [Y/n] Y
# ? Which scope? Your Team Name
# ? Link to existing project? [Y/n] N
# ? What's your project's name? mcp-memory-service
# ? In which directory is your code located? ./
```

#### Step 3: Configure Environment Variables

```bash
# Run setup script
npm run setup:vercel

# Or manually add each variable:
vercel env add TURSO_URL production
vercel env add TURSO_AUTH_TOKEN production
vercel env add OPENAI_API_KEY production
vercel env add CLERK_SECRET_KEY production
vercel env add NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY production
vercel env add CLERK_WEBHOOK_SECRET production
```

**Production Environment Variables:**

```bash
# Core Services
TURSO_URL=libsql://your-prod-database.turso.io
TURSO_AUTH_TOKEN=<turso-production-token>
OPENAI_API_KEY=sk-proj-<openai-key>

# Clerk Production Keys
CLERK_SECRET_KEY=your-clerk-live-secret-key
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_Y2xlcmsuYWktbWVtb3J5LmFwcCQ
CLERK_WEBHOOK_SECRET=whsec_<webhook-signing-secret>

# Production Settings
NODE_ENV=production
LOG_LEVEL=info
MCP_DEBUG=0

# CORS (restricted to production domains)
CORS_ORIGIN=https://ai-memory.app,https://www.ai-memory.app
ALLOWED_ORIGINS=https://ai-memory.app,https://www.ai-memory.app,https://clerk.ai-memory.app

# Rate Limiting (strict for production)
RATE_LIMIT_REQUESTS_PER_MINUTE=100
RATE_LIMIT_WINDOW_MS=60000

# Session (reasonable timeout)
SESSION_TIMEOUT_MINUTES=120

# Security (production hardening)
ALLOW_DEV_AUTH=false
ENABLE_REQUEST_LOGGING=false
ENABLE_DEBUG_ENDPOINTS=false
```

#### Step 4: Deploy to Production

```bash
# Deploy to production
npm run deploy:vercel production

# Or manually
vercel --prod

# First deployment will show:
# 🔍 Inspect: https://vercel.com/...
# ✅ Production: https://your-deployment.vercel.app
```

#### Step 5: Verify Deployment

```bash
# Health check
curl https://your-deployment.vercel.app/health

# Test with authentication
export CLERK_TOKEN="your-production-token"

curl -X POST https://your-deployment.vercel.app/mcp \
  -H "Authorization: Bearer $CLERK_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {
      "protocolVersion": "2024-11-05"
    }
  }'
```

### Method 2: GitHub Integration

#### Step 1: Connect GitHub Repository

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click **Add New** → **Project**
3. Import your Git repository
4. Configure project settings

#### Step 2: Configure Build Settings

**Framework Preset:** Other
**Build Command:** `npm run build`
**Output Directory:** `dist`
**Install Command:** `npm install`

#### Step 3: Add Environment Variables

In Vercel Dashboard:
1. Go to **Settings** → **Environment Variables**
2. Add all production variables
3. Set for **Production** environment

#### Step 4: Deploy

```bash
# Push to main branch triggers deployment
git push origin main

# Or deploy from dashboard
# Click "Deploy" button
```

---

## Environment Configuration

### Development vs Production

| Setting | Development | Production |
|---------|-------------|------------|
| **Clerk Keys** | Test keys (`sk_test_*`) | Live keys (`sk_live_*`) |
| **CORS** | `*` (all origins) | Specific domains only |
| **Rate Limit** | 1000 req/min | 100 req/min |
| **Session Timeout** | 8 hours | 2 hours |
| **Debug Logging** | Enabled | Disabled |
| **Dev Auth** | Allowed | Disabled |
| **Log Level** | `debug` | `info` |

### Environment Variable Reference

#### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `TURSO_URL` | Turso database URL | `libsql://db.turso.io` |
| `TURSO_AUTH_TOKEN` | Turso auth token | `eyJhbGc...` |
| `OPENAI_API_KEY` | OpenAI API key | `sk-proj-...` |
| `CLERK_SECRET_KEY` | Clerk secret key | `sk_live_...` |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk public key | `pk_live_...` |

#### Optional Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | `development` | Environment mode |
| `LOG_LEVEL` | `info` | Logging level |
| `MCP_DEBUG` | `0` | MCP debug logging |
| `REMOTE_MCP_PORT` | `3003` | Server port |
| `CORS_ORIGIN` | `*` | CORS allowed origins |
| `RATE_LIMIT_REQUESTS_PER_MINUTE` | `100` | Rate limit |
| `SESSION_TIMEOUT_MINUTES` | `120` | Session timeout |
| `ALLOW_DEV_AUTH` | `false` | Allow dev bypass |

### Vercel-Specific Configuration

The `vercel.json` file configures:

```json
{
  "version": 2,
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "functions": {
    "api/mcp/index.ts": {
      "maxDuration": 30,
      "memory": 1024
    }
  },
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        },
        {
          "key": "Strict-Transport-Security",
          "value": "max-age=31536000; includeSubDomains"
        }
      ]
    }
  ]
}
```

---

## Security Hardening

### Pre-Deployment Security Checklist

#### Authentication & Authorization

- [ ] Production Clerk keys configured (not test keys)
- [ ] `ALLOW_DEV_AUTH=false` in production
- [ ] Session timeout appropriate (2 hours recommended)
- [ ] Clerk webhook secret configured
- [ ] All auth endpoints return proper error codes

#### Network Security

- [ ] CORS restricted to production domains only
- [ ] No wildcard (`*`) CORS in production
- [ ] HTTPS enforced (automatic with Vercel)
- [ ] Security headers configured in `vercel.json`
- [ ] Content Security Policy enabled

#### Rate Limiting

- [ ] Rate limiting enabled (`100 req/min` recommended)
- [ ] Per-user limits configured
- [ ] `Retry-After` headers included
- [ ] Rate limit monitoring in place

#### Data Security

- [ ] User isolation tested (95.2% test pass rate)
- [ ] All queries include `user_email` filter
- [ ] No SQL injection vulnerabilities
- [ ] Sensitive data encrypted at rest (Turso)
- [ ] Database backups configured

#### Secrets Management

- [ ] All secrets in Vercel environment variables
- [ ] No secrets in code or version control
- [ ] `.env` files in `.gitignore`
- [ ] API keys rotated regularly
- [ ] Least privilege access for service accounts

### Security Headers

Configured in `vercel.json`:

```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        },
        {
          "key": "X-XSS-Protection",
          "value": "1; mode=block"
        },
        {
          "key": "Strict-Transport-Security",
          "value": "max-age=31536000; includeSubDomains; preload"
        },
        {
          "key": "Content-Security-Policy",
          "value": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';"
        },
        {
          "key": "Permissions-Policy",
          "value": "geolocation=(), microphone=(), camera=()"
        },
        {
          "key": "Referrer-Policy",
          "value": "strict-origin-when-cross-origin"
        }
      ]
    }
  ]
}
```

### Clerk Webhook Setup

1. **Navigate to Clerk Dashboard**
   - Go to [Clerk Dashboard](https://dashboard.clerk.com/)
   - Select your production application

2. **Add Webhook Endpoint**
   - Go to **Webhooks** section
   - Click **Add Endpoint**
   - URL: `https://your-deployment.vercel.app/api/auth/webhook`
   - Events: Select relevant events (user.created, session.created, etc.)

3. **Configure Signing Secret**
   - Copy the webhook signing secret
   - Add to Vercel environment variables:
   ```bash
   vercel env add CLERK_WEBHOOK_SECRET production
   ```

4. **Test Webhook**
   - Clerk provides a test feature
   - Verify webhook receives and processes events

---

## Monitoring & Logging

### Health Monitoring

#### Health Check Endpoint

```bash
# Check server health
curl https://your-deployment.vercel.app/health

# Response includes:
{
  "status": "healthy",
  "version": "1.1.2",
  "timestamp": "2025-10-01T12:00:00.000Z",
  "activeSessions": 12,
  "authentication": "enabled",
  "database": "connected",
  "uptime": 3600
}
```

#### Automated Health Checks

Set up external monitoring:

```bash
# UptimeRobot, Pingdom, or custom script
*/5 * * * * curl -f https://your-deployment.vercel.app/health || alert
```

### Vercel Logs

#### View Logs

```bash
# View real-time logs
vercel logs

# View logs for specific deployment
vercel logs <deployment-url>

# Follow logs
vercel logs --follow
```

#### Log Levels

Production logging configuration:

```bash
LOG_LEVEL=info         # Default for production
MCP_DEBUG=0            # Disable MCP debug logs
ENABLE_REQUEST_LOGGING=false  # Disable detailed request logs
```

### Error Tracking

#### Vercel Analytics

Enable in Vercel Dashboard:
1. Go to **Analytics**
2. Enable **Web Analytics**
3. Configure error tracking

#### Custom Error Monitoring

Integrate with services like:
- **Sentry** - Error tracking and performance
- **LogRocket** - Session replay and debugging
- **Datadog** - Infrastructure and APM

Example Sentry integration:

```typescript
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
});
```

### Performance Monitoring

#### Key Metrics

- **Response Time** - P50, P95, P99
- **Error Rate** - 4xx and 5xx errors
- **Rate Limit Hits** - 429 responses
- **Database Latency** - Query performance
- **Active Sessions** - Concurrent users

#### Monitoring Dashboard

Access via Vercel Dashboard:
- **Analytics** → **Performance**
- View response times, status codes
- Monitor function execution time
- Track bandwidth usage

---

## Troubleshooting

### Common Deployment Issues

#### 1. Build Fails

**Symptom:** Vercel deployment fails during build

**Solutions:**
```bash
# Test build locally
npm run build

# Check TypeScript errors
npm run type-check

# Verify all dependencies installed
npm install

# Check Node.js version (18+ required)
node --version
```

#### 2. Authentication Errors in Production

**Symptom:** All requests return 401 Unauthorized

**Solutions:**
- Verify production Clerk keys are correct
- Ensure `CLERK_SECRET_KEY` uses `sk_live_` prefix
- Check Clerk application is in production mode
- Verify environment variables in Vercel dashboard

```bash
# Verify environment variables
vercel env ls

# Pull environment to local
vercel env pull
```

#### 3. CORS Errors

**Symptom:** Browser blocks requests with CORS error

**Solutions:**
- Verify `CORS_ORIGIN` includes your domain
- Check `ALLOWED_ORIGINS` format (no trailing slashes)
- Ensure Vercel headers are configured

```bash
# Check CORS configuration
curl -I https://your-deployment.vercel.app/health

# Should see CORS headers:
# Access-Control-Allow-Origin: https://ai-memory.app
```

#### 4. Database Connection Failures

**Symptom:** 500 errors about database connection

**Solutions:**
- Verify Turso database is active
- Check `TURSO_URL` and `TURSO_AUTH_TOKEN`
- Ensure Turso plan supports production traffic
- Test database connection:

```bash
# Test Turso connection
curl -X POST "$TURSO_URL" \
  -H "Authorization: Bearer $TURSO_AUTH_TOKEN" \
  -d '{"statements": ["SELECT 1"]}'
```

#### 5. Rate Limiting Issues

**Symptom:** Users frequently get 429 errors

**Solutions:**
- Review `RATE_LIMIT_REQUESTS_PER_MINUTE` setting
- Implement client-side retry logic
- Consider increasing limits for high-traffic users
- Monitor rate limit metrics

```bash
# Temporarily increase limit
vercel env add RATE_LIMIT_REQUESTS_PER_MINUTE production
# Enter: 200
```

### Rollback Procedure

#### Immediate Rollback

```bash
# List recent deployments
vercel ls

# Promote previous deployment to production
vercel promote <previous-deployment-url>
```

#### Gradual Rollback

1. **Identify issue** - Check logs and metrics
2. **Communicate** - Notify team and users
3. **Deploy fix** - Push fix to staging first
4. **Test** - Verify fix works
5. **Deploy** - Roll out to production
6. **Monitor** - Watch for issues

### Debug Mode

Enable debug logging temporarily:

```bash
# Update environment variable
vercel env add LOG_LEVEL production
# Enter: debug

# Update MCP_DEBUG
vercel env add MCP_DEBUG production
# Enter: 1

# Redeploy to apply
vercel --prod
```

**Remember to disable debug mode after troubleshooting!**

---

## Post-Deployment Checklist

### Immediate Verification

- [ ] Health check returns 200 OK
- [ ] Authentication works with production tokens
- [ ] Database queries succeed
- [ ] CORS headers correct
- [ ] Rate limiting active
- [ ] Error handling works

### Configuration Verification

- [ ] All environment variables set correctly
- [ ] Production Clerk keys in use
- [ ] `ALLOW_DEV_AUTH=false`
- [ ] CORS restricted to production domains
- [ ] Security headers enabled
- [ ] Clerk webhook configured

### Monitoring Setup

- [ ] Health check monitoring active
- [ ] Error tracking configured
- [ ] Log aggregation working
- [ ] Performance metrics tracked
- [ ] Alerts configured for critical issues

### Documentation & Communication

- [ ] Deployment documented
- [ ] API documentation updated
- [ ] Team notified of changes
- [ ] Users informed if needed
- [ ] Rollback plan documented

---

## Continuous Deployment

### GitHub Actions Workflow

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Vercel

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npm test

      - name: Build
        run: npm run build

      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v20
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod'
```

---

## Support & Resources

### Documentation
- [OAuth Setup](./OAUTH_SETUP.md) - Architecture overview
- [Quick Start](./OAUTH_QUICKSTART.md) - Get started
- [API Reference](./OAUTH_API_REFERENCE.md) - Complete API docs
- [Client Integration](./OAUTH_CLIENT_INTEGRATION.md) - Client setup

### External Resources
- [Vercel Documentation](https://vercel.com/docs)
- [Clerk Documentation](https://clerk.com/docs)
- [Turso Documentation](https://docs.turso.tech)

### Getting Help
- Review [Test Report](./TEST-REPORT.md) - 95.2% test coverage
- Check integration tests for examples
- Consult [CLAUDE.md](./CLAUDE.md) for project details
- Vercel support: [vercel.com/support](https://vercel.com/support)

---

**Last Updated:** 2025-10-01
**Version:** 1.1.2
**Deployment Status:** Production Ready
