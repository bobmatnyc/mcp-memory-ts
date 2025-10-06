# MCP Memory Web Setup Guide

Complete guide to setting up the Next.js web interface for MCP Memory.

## Prerequisites

1. **Node.js 18+** installed
2. **MCP Memory TypeScript** backend configured
3. **Google OAuth credentials** (or GitHub OAuth)
4. **Environment variables** from parent project (.env)

## Quick Start

### 1. Install Dependencies

From the **web/** directory:

```bash
cd web
npm install
```

Or from the **root** directory:

```bash
npm run web:install
```

### 2. Configure Environment

Create `web/.env.local`:

```env
# Database (from parent project)
TURSO_URL=libsql://your-database.turso.io
TURSO_AUTH_TOKEN=your-auth-token

# OpenAI
OPENAI_API_KEY=your-openai-api-key

# NextAuth.js
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=generate-with-openssl-rand-base64-32

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

### 3. Generate NextAuth Secret

```bash
openssl rand -base64 32
```

Copy the output to `NEXTAUTH_SECRET` in `.env.local`.

### 4. Set Up Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable **Google+ API**
4. Go to **Credentials** → **Create Credentials** → **OAuth 2.0 Client ID**
5. Application type: **Web application**
6. Authorized redirect URIs:
   - `http://localhost:3000/api/auth/callback/google` (development)
   - `https://your-domain.com/api/auth/callback/google` (production)
7. Copy **Client ID** and **Client Secret** to `.env.local`

### 5. Run Development Server

From **web/** directory:

```bash
npm run dev
```

Or from **root** directory:

```bash
npm run web:dev
```

Open [http://localhost:3000](http://localhost:3000)

## Production Deployment

### Build for Production

```bash
cd web
npm run build
```

Or from root:

```bash
npm run web:build
```

### Start Production Server

```bash
cd web
npm start
```

Or from root:

```bash
npm run web:start
```

## Deployment Options

### Vercel (Recommended)

1. Install Vercel CLI: `npm i -g vercel`
2. From `web/` directory: `vercel`
3. Set environment variables in Vercel dashboard
4. Deploy: `vercel --prod`

### Docker

Create `web/Dockerfile`:

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --production

COPY . .
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
```

Build and run:

```bash
docker build -t mcp-memory-web .
docker run -p 3000:3000 --env-file .env.local mcp-memory-web
```

### Traditional Server

1. Build: `npm run build`
2. Copy `.next/`, `public/`, `package.json`, `node_modules/` to server
3. Set environment variables
4. Run: `NODE_ENV=production npm start`

## Troubleshooting

### "Failed to connect to database"

- Verify `TURSO_URL` and `TURSO_AUTH_TOKEN` are correct
- Check network connectivity to Turso
- Ensure database is accessible from your location

### "OAuth error: invalid_client"

- Verify Google OAuth credentials
- Check redirect URI matches exactly (including http/https)
- Ensure Google+ API is enabled

### "NextAuth configuration error"

- Generate new `NEXTAUTH_SECRET` with `openssl rand -base64 32`
- Verify `NEXTAUTH_URL` matches your domain
- Check all NextAuth environment variables are set

### "OpenAI API error"

- Verify `OPENAI_API_KEY` is valid
- Check API key has credits
- Ensure key has access to embeddings API

### API endpoints return 401

- Check NextAuth session is valid
- Verify middleware is protecting routes
- Clear cookies and sign in again

## Development Tips

### Enable Debug Logging

Add to `.env.local`:

```env
MCP_DEBUG=1
LOG_LEVEL=DEBUG
```

### Hot Reload Issues

Clear Next.js cache:

```bash
rm -rf .next
npm run dev
```

### Type Errors

Run type check:

```bash
npm run type-check
```

### Database Changes

After modifying parent project schema:

```bash
cd ..
npm run migrate:schema
cd web
npm run dev
```

## Security Checklist

- [ ] `NEXTAUTH_SECRET` is randomly generated (32+ chars)
- [ ] OAuth redirect URIs match exactly
- [ ] `.env.local` is in `.gitignore`
- [ ] Production uses HTTPS
- [ ] CORS is properly configured
- [ ] Session timeout is reasonable
- [ ] User data isolation is enforced

## Integration with MCP Memory

The web interface integrates with existing MCP Memory core:

```typescript
// Reuses MemoryCore from parent project
import { MemoryCore } from '../../src/core/memory-core';

// Shares database connection
import { getDbConnection } from './lib/db';

// Enforces user isolation
const userId = session.user.email;
await memoryCore.searchMemories(query, { userId });
```

## Performance Optimization

### Enable Caching

In `next.config.mjs`:

```javascript
const nextConfig = {
  // ... existing config
  experimental: {
    staleTimes: {
      dynamic: 30,
      static: 180,
    },
  },
};
```

### Database Connection Pooling

Already handled by `@libsql/client` - no additional configuration needed.

### Static Generation

Dashboard and memory pages use server-side rendering for real-time data. For static content, use:

```typescript
export const revalidate = 60; // Revalidate every 60 seconds
```

## Monitoring

### Application Logs

```bash
# Development
npm run dev

# Production
NODE_ENV=production npm start | tee app.log
```

### Error Tracking

Add Sentry or similar:

```bash
npm install @sentry/nextjs
```

## Support

- GitHub Issues: [mcp-memory-ts/issues](https://github.com/your-repo/issues)
- Documentation: See `README.md`
- MCP Memory Docs: See parent project `CLAUDE.md`

## Next Steps

After setup:

1. Sign in with Google
2. Create your first memory
3. Try semantic search
4. View dashboard statistics
5. Explore API endpoints

## Additional Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [NextAuth.js Documentation](https://next-auth.js.org/)
- [Tailwind CSS](https://tailwindcss.com/)
- [shadcn/ui](https://ui.shadcn.com/)
- [MCP Memory TypeScript](../README.md)
