# Deployment Guide

This guide covers deploying the MCP Memory Service TypeScript implementation to various cloud platforms.

## Prerequisites

- Node.js 18+ 
- Turso database account
- OpenAI API key
- Cloud platform account (Fly.io, Railway, Vercel, etc.)

## Environment Configuration

Create a `.env` file with the following variables:

```bash
# Database Configuration
TURSO_URL=libsql://your-database.turso.io
TURSO_AUTH_TOKEN=your-auth-token

# OpenAI Configuration
OPENAI_API_KEY=your-openai-api-key

# Server Configuration
PORT=3000
HOST=0.0.0.0
LOG_LEVEL=info

# Optional Configuration
DEFAULT_USER_EMAIL=admin@yourdomain.com
MCP_DEBUG=0
```

## Turso Database Setup

1. **Create a Turso account** at [turso.tech](https://turso.tech)

2. **Create a new database:**
   ```bash
   turso db create mcp-memory-ts
   ```

3. **Get the database URL:**
   ```bash
   turso db show mcp-memory-ts
   ```

4. **Create an auth token:**
   ```bash
   turso db tokens create mcp-memory-ts
   ```

5. **Initialize the database schema:**
   ```bash
   npm run init-db
   ```

## Deployment Options

### Option 1: Fly.io (Recommended)

1. **Install Fly CLI:**
   ```bash
   curl -L https://fly.io/install.sh | sh
   ```

2. **Login to Fly:**
   ```bash
   fly auth login
   ```

3. **Create fly.toml:**
   ```toml
   app = "mcp-memory-ts"
   primary_region = "sjc"

   [build]
     builder = "heroku/buildpacks:20"

   [env]
     PORT = "8080"
     NODE_ENV = "production"

   [[services]]
     http_checks = []
     internal_port = 8080
     processes = ["app"]
     protocol = "tcp"
     script_checks = []

     [services.concurrency]
       hard_limit = 25
       soft_limit = 20
       type = "connections"

     [[services.ports]]
       force_https = true
       handlers = ["http"]
       port = 80

     [[services.ports]]
       handlers = ["tls", "http"]
       port = 443

     [[services.tcp_checks]]
       grace_period = "1s"
       interval = "15s"
       restart_limit = 0
       timeout = "2s"
   ```

4. **Set environment secrets:**
   ```bash
   fly secrets set TURSO_URL="your-database-url"
   fly secrets set TURSO_AUTH_TOKEN="your-auth-token"
   fly secrets set OPENAI_API_KEY="your-openai-key"
   fly secrets set DEFAULT_USER_EMAIL="admin@yourdomain.com"
   ```

5. **Deploy:**
   ```bash
   fly deploy
   ```

### Option 2: Railway

1. **Install Railway CLI:**
   ```bash
   npm install -g @railway/cli
   ```

2. **Login and create project:**
   ```bash
   railway login
   railway init
   ```

3. **Set environment variables:**
   ```bash
   railway variables set TURSO_URL="your-database-url"
   railway variables set TURSO_AUTH_TOKEN="your-auth-token"
   railway variables set OPENAI_API_KEY="your-openai-key"
   railway variables set DEFAULT_USER_EMAIL="admin@yourdomain.com"
   ```

4. **Deploy:**
   ```bash
   railway up
   ```

### Option 3: Vercel (API Server Only)

1. **Install Vercel CLI:**
   ```bash
   npm install -g vercel
   ```

2. **Create vercel.json:**
   ```json
   {
     "version": 2,
     "builds": [
       {
         "src": "dist/api/server.js",
         "use": "@vercel/node"
       }
     ],
     "routes": [
       {
         "src": "/(.*)",
         "dest": "dist/api/server.js"
       }
     ],
     "env": {
       "NODE_ENV": "production"
     }
   }
   ```

3. **Set environment variables:**
   ```bash
   vercel env add TURSO_URL
   vercel env add TURSO_AUTH_TOKEN
   vercel env add OPENAI_API_KEY
   vercel env add DEFAULT_USER_EMAIL
   ```

4. **Deploy:**
   ```bash
   npm run build
   vercel --prod
   ```

### Option 4: Docker

1. **Create Dockerfile:**
   ```dockerfile
   FROM node:18-alpine

   WORKDIR /app

   # Copy package files
   COPY package*.json ./
   COPY tsconfig.json ./

   # Install dependencies
   RUN npm ci --only=production

   # Copy source code
   COPY src/ ./src/

   # Build the application
   RUN npm run build

   # Expose port
   EXPOSE 3000

   # Health check
   HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
     CMD curl -f http://localhost:3000/health || exit 1

   # Start the application
   CMD ["npm", "start"]
   ```

2. **Create .dockerignore:**
   ```
   node_modules
   npm-debug.log
   .git
   .gitignore
   README.md
   .env
   .env.local
   coverage
   .nyc_output
   tests
   ```

3. **Build and run:**
   ```bash
   docker build -t mcp-memory-ts .
   docker run -p 3000:3000 --env-file .env mcp-memory-ts
   ```

## Claude Desktop Integration

After deployment, configure Claude Desktop to use your deployed MCP server:

1. **For local development:**
   ```json
   {
     "mcpServers": {
       "memory-ts": {
         "command": "node",
         "args": ["/path/to/mcp-memory-ts/dist/mcp/server.js"],
         "env": {
           "TURSO_URL": "your-database-url",
           "TURSO_AUTH_TOKEN": "your-auth-token",
           "OPENAI_API_KEY": "your-openai-key"
         }
       }
     }
   }
   ```

2. **For deployed server (if supporting remote MCP):**
   ```json
   {
     "mcpServers": {
       "memory-ts": {
         "command": "npx",
         "args": ["@your-org/mcp-memory-client", "https://your-app.fly.dev"],
         "env": {
           "API_KEY": "your-api-key"
         }
       }
     }
   }
   ```

## Monitoring and Maintenance

### Health Checks

The API server includes a health check endpoint at `/health`:

```bash
curl https://your-app.fly.dev/health
```

### Logging

Configure logging level via the `LOG_LEVEL` environment variable:
- `debug`: Detailed debugging information
- `info`: General information (default)
- `warn`: Warning messages only
- `error`: Error messages only

### Database Maintenance

1. **Backup your Turso database:**
   ```bash
   turso db dump mcp-memory-ts --output backup.sql
   ```

2. **Monitor database size:**
   ```bash
   turso db inspect mcp-memory-ts
   ```

3. **Update schema (if needed):**
   ```bash
   npm run init-db
   ```

### Performance Optimization

1. **Enable database caching** by setting up a local replica:
   ```bash
   # In your environment
   TURSO_SYNC_URL=libsql://your-database.turso.io
   ```

2. **Optimize vector search** by adjusting batch sizes and thresholds:
   ```bash
   # Environment variables for tuning
   EMBEDDING_BATCH_SIZE=50
   VECTOR_SEARCH_THRESHOLD=0.7
   ```

3. **Monitor API performance** using the statistics endpoint:
   ```bash
   curl -H "Authorization: Bearer your-api-key" \
        https://your-app.fly.dev/api/statistics
   ```

## Security Considerations

1. **API Key Management:**
   - Use strong, randomly generated API keys
   - Rotate keys regularly
   - Store keys securely in environment variables

2. **Database Security:**
   - Use Turso's built-in authentication
   - Regularly update auth tokens
   - Monitor database access logs

3. **Network Security:**
   - Use HTTPS for all communications
   - Implement rate limiting
   - Consider IP whitelisting for sensitive deployments

4. **Data Privacy:**
   - Implement data retention policies
   - Consider encryption for sensitive memories
   - Comply with relevant privacy regulations

## Troubleshooting

### Common Issues

1. **Database connection errors:**
   ```bash
   # Check database status
   turso db inspect mcp-memory-ts
   
   # Test connection
   npm run init-db
   ```

2. **OpenAI API errors:**
   ```bash
   # Verify API key
   curl -H "Authorization: Bearer $OPENAI_API_KEY" \
        https://api.openai.com/v1/models
   ```

3. **Memory/performance issues:**
   ```bash
   # Check application logs
   fly logs -a mcp-memory-ts
   
   # Monitor resource usage
   fly status -a mcp-memory-ts
   ```

### Support

For deployment issues:
1. Check the application logs
2. Verify environment variables
3. Test database connectivity
4. Review the troubleshooting section in README.md
5. Open an issue on GitHub with deployment details
