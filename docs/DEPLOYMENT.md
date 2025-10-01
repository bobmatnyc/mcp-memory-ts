# Vercel Deployment Guide for MCP Memory Service

This guide provides step-by-step instructions for deploying the MCP Memory TypeScript service to Vercel with Clerk authentication.

## 🚀 Quick Start

1. **Install dependencies and build**:
   ```bash
   npm install
   npm run build:vercel
   ```

2. **Set up environment variables**:
   ```bash
   npm run setup:vercel
   ```

3. **Deploy to Vercel**:
   ```bash
   npm run deploy:vercel
   ```

## 📋 Prerequisites

- [Vercel CLI](https://vercel.com/cli) installed globally
- [Turso](https://turso.tech/) database with LibSQL
- [OpenAI API key](https://platform.openai.com/api-keys) for embeddings
- [Clerk](https://clerk.com/) account for authentication

## 🔧 Environment Variables

### Required Variables

Set these in your Vercel dashboard or via CLI:

```bash
# Database (Turso/LibSQL)
TURSO_URL=libsql://your-database.turso.io
TURSO_AUTH_TOKEN=your-auth-token

# OpenAI for embeddings
OPENAI_API_KEY=your-openai-api-key

# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_touching-gar-14.clerk.accounts.dev
CLERK_SECRET_KEY=sk_test_zRXJyKhoYuXlNaqiiqjiSDDCyt7jhLFmBEmp2npfYc
CLERK_WEBHOOK_SECRET=whsec_your-webhook-secret
```

### Environment Setup Script

Use the automated setup script:

```bash
./scripts/setup-vercel-env.sh
```

This script will:
- Check Vercel CLI installation
- Link your project
- Set up environment variables for all environments
- Configure production-optimized settings

## 🏗️ Project Structure

```
├── api/                           # Vercel serverless functions
│   ├── index.ts                   # Main API handler
│   ├── auth/
│   │   └── webhook.ts             # Clerk webhook handler
│   └── middleware/
│       ├── clerk-auth.ts          # Authentication middleware
│       └── cors.ts                # CORS configuration
├── src/                           # Source code
├── scripts/
│   ├── deploy-vercel.sh           # Deployment script
│   └── setup-vercel-env.sh        # Environment setup
├── vercel.json                    # Vercel configuration
├── tsconfig.vercel.json           # TypeScript config for Vercel
└── .env.production                # Production environment template
```

## 🔐 Authentication Setup

### 1. Clerk Configuration

1. **Create Clerk Application**:
   - Go to [Clerk Dashboard](https://dashboard.clerk.com)
   - Create a new application
   - Get your publishable and secret keys

2. **Configure Webhook**:
   - In Clerk dashboard, go to Webhooks
   - Add endpoint: `https://your-deployment.vercel.app/api/auth/webhook`
   - Select events: `user.created`, `user.updated`, `user.deleted`
   - Copy webhook secret

### 2. Environment Variables

Update the provided keys in your environment:

```bash
# Already provided for you:
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_touching-gar-14.clerk.accounts.dev
CLERK_SECRET_KEY=sk_test_zRXJyKhoYuXlNaqiiqjiSDDCyt7jhLFmBEmp2npfYc

# You need to set:
CLERK_WEBHOOK_SECRET=whsec_your-actual-webhook-secret
```

## 📡 API Endpoints

After deployment, your API will be available at:

```
https://your-deployment.vercel.app/api
```

### Available Endpoints:

- `GET /api/health` - Health check (no auth)
- `GET /api` - Service information (no auth)
- `POST /api/memories` - Add memory
- `GET /api/memories/search` - Search memories
- `POST /api/entities` - Create entity
- `GET /api/entities/search` - Search entities
- `GET /api/search` - Unified search
- `GET /api/statistics` - User statistics
- `POST /api/users` - Create user
- `POST /api/auth/webhook` - Clerk webhook

### Authentication

Include Clerk token in requests:

```bash
# Using Authorization header
curl -H "Authorization: Bearer your-clerk-token" \
     https://your-deployment.vercel.app/api/memories

# Using custom header
curl -H "x-clerk-auth-token: your-clerk-token" \
     https://your-deployment.vercel.app/api/memories
```

## 🐍 Python Client Usage

Use the provided Python client:

```python
from examples.python_client import MemoryServiceClient, MemoryServiceConfig

config = MemoryServiceConfig(
    base_url='https://your-deployment.vercel.app',
    auth_token='your-clerk-token'
)

client = MemoryServiceClient(config)

# Health check
health = client.health_check()
print(health)

# Add memory
result = client.add_memory(
    title="Test Memory",
    content="This is a test memory from Python",
    tags=["test", "python"]
)
print(result)
```

## 🚀 Deployment Process

### Automated Deployment

```bash
# Full deployment with checks
npm run deploy:vercel

# Or step by step:
npm run type-check
npm run lint:fix
npm run build:vercel
vercel --prod
```

### Manual Deployment

1. **Build the project**:
   ```bash
   npm run build:vercel
   ```

2. **Deploy to Vercel**:
   ```bash
   vercel --prod
   ```

3. **Verify deployment**:
   ```bash
   curl https://your-deployment.vercel.app/api/health
   ```

## 🔍 Monitoring & Debugging

### Vercel Dashboard

- View function logs in Vercel dashboard
- Monitor performance and usage
- Check environment variables

### Health Check

Test your deployment:

```bash
curl https://your-deployment.vercel.app/api/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2024-01-10T10:00:00.000Z",
  "service": "mcp-memory-ts"
}
```

### CORS Testing

Test CORS with Python:

```python
import requests

response = requests.get('https://your-deployment.vercel.app/api/health')
print(response.headers)
print(response.json())
```

## 🔧 Configuration Files

### vercel.json

```json
{
  "version": 2,
  "builds": [
    {
      "src": "api/**/*.ts",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/api/(.*)",
      "dest": "/api/$1"
    }
  ],
  "functions": {
    "api/**/*.ts": {
      "runtime": "nodejs18.x",
      "maxDuration": 30
    }
  }
}
```

### TypeScript Configuration

The project uses `tsconfig.vercel.json` for Vercel builds:

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "outDir": "./dist"
  },
  "include": ["src/**/*", "api/**/*"]
}
```

## 🚨 Troubleshooting

### Common Issues

1. **Environment Variables Not Set**:
   ```bash
   vercel env ls
   # Check if all required vars are present
   ```

2. **Build Failures**:
   ```bash
   npm run type-check
   npm run lint
   # Fix TypeScript and linting errors
   ```

3. **CORS Issues**:
   - Check origin in CORS middleware
   - Verify client headers

4. **Authentication Failures**:
   - Verify Clerk keys
   - Check webhook endpoint
   - Test token validation

### Logs and Debugging

```bash
# View Vercel function logs
vercel logs

# Check specific function
vercel logs --follow api/index.ts
```

## 📊 Performance Optimization

### Function Configuration

- **Runtime**: Node.js 18.x
- **Max Duration**: 30 seconds
- **Memory**: Default (1024 MB)

### Caching Strategy

- Static responses cached for 24 hours
- Database connections reused across invocations
- Embedding cache for repeated queries

## 🔒 Security Considerations

1. **Environment Variables**:
   - Use `--sensitive` flag for secrets
   - Never commit actual values
   - Rotate keys regularly

2. **CORS Configuration**:
   - Restrictive for web clients
   - Permissive for Python clients
   - Client type detection

3. **Authentication**:
   - Clerk JWT validation
   - User isolation
   - Rate limiting ready

## 📈 Scaling Considerations

1. **Database**:
   - Turso handles scaling automatically
   - Monitor connection limits

2. **OpenAI API**:
   - Implement rate limiting
   - Use embedding cache

3. **Vercel Functions**:
   - Stateless design
   - Connection pooling
   - Efficient memory usage

---

For more information, see:
- [Vercel Documentation](https://vercel.com/docs)
- [Clerk Documentation](https://clerk.com/docs)
- [Project README](./README.md)