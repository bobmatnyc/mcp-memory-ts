# MCP Memory Service - Deployment Checklist

## 🚨 CRITICAL: Pre-Deployment Validation

**NEVER deploy without running these regression tests first!**

### 1. Run Regression Tests

```bash
# Full pre-deployment validation
npm run pre-deploy

# Or run tests individually
npm run build
npm run test:regression
```

### 2. Expected Test Results

All tests must pass before deployment:

- ✅ **Server responds to tools/list** - Validates MCP protocol
- ✅ **Server responds to initialize** - Validates handshake
- ✅ **Get statistics from empty database** - Validates DB connection
- ✅ **Add memory successfully** - Validates write operations
- ✅ **Statistics show added memory** - Validates persistence
- ✅ **Search finds added memory** - Validates search functionality
- ✅ **Unknown tool returns error** - Validates error handling
- ✅ **Auto ID generation** - Validates JSON-RPC compliance

### 3. Test Output Example

```
🚀 Starting MCP Server Regression Tests

🧪 Running: Server responds to tools/list
✅ PASS: Server responds to tools/list

🧪 Running: Server responds to initialize
✅ PASS: Server responds to initialize

...

📊 REGRESSION TEST RESULTS
==================================================
✅ PASS Server responds to tools/list
✅ PASS Server responds to initialize
✅ PASS Get statistics from empty database
✅ PASS Add memory successfully
✅ PASS Statistics show added memory
✅ PASS Search finds added memory
✅ PASS Unknown tool returns error
✅ PASS Auto ID generation for requests without ID
==================================================
📈 Results: 8/8 tests passed
🎉 ALL TESTS PASSED - READY FOR DEPLOYMENT!
```

## 🔧 Environment Setup

### Required Environment Variables

```bash
# Database (required)
TURSO_URL=your-database-url
TURSO_AUTH_TOKEN=your-auth-token  # Not needed for file: URLs

# User Management (required)
DEFAULT_USER_EMAIL=your-email@example.com

# AI Features (optional)
OPENAI_API_KEY=your-openai-key  # For embeddings

# Debug (optional)
MCP_DEBUG=1  # Enable debug logging
```

### Database Options

1. **Local SQLite** (for testing):
   ```bash
   TURSO_URL=file:memory.db
   ```

2. **Turso Cloud** (for production):
   ```bash
   TURSO_URL=libsql://your-db.turso.io
   TURSO_AUTH_TOKEN=your-token
   ```

## 🚀 Deployment Methods

### Method 1: Claude Desktop (Local)

1. **Build the project**:
   ```bash
   npm run build
   ```

2. **Update Claude Desktop config** (`~/Library/Application Support/Claude/claude_desktop_config.json`):
   ```json
   {
     "mcpServers": {
       "memory-ts": {
         "command": "node",
         "args": ["/path/to/mcp-memory-ts/dist/desktop-mcp-server.js"],
         "env": {
           "TURSO_URL": "your-database-url",
           "TURSO_AUTH_TOKEN": "your-auth-token",
           "DEFAULT_USER_EMAIL": "your-email@example.com",
           "OPENAI_API_KEY": "your-openai-key"
         }
       }
     }
   }
   ```

3. **Restart Claude Desktop**

### Method 2: Docker Deployment

1. **Build Docker image**:
   ```bash
   docker build -t mcp-memory-ts .
   ```

2. **Run container**:
   ```bash
   docker run -d \
     -e TURSO_URL=your-database-url \
     -e TURSO_AUTH_TOKEN=your-auth-token \
     -e DEFAULT_USER_EMAIL=your-email@example.com \
     -e OPENAI_API_KEY=your-openai-key \
     -p 3000:3000 \
     mcp-memory-ts
   ```

### Method 3: Cloud Deployment (Fly.io)

1. **Install Fly CLI** and login

2. **Deploy**:
   ```bash
   fly deploy
   ```

3. **Set environment variables**:
   ```bash
   fly secrets set TURSO_URL=your-database-url
   fly secrets set TURSO_AUTH_TOKEN=your-auth-token
   fly secrets set DEFAULT_USER_EMAIL=your-email@example.com
   fly secrets set OPENAI_API_KEY=your-openai-key
   ```

## ✅ Post-Deployment Validation

### 1. Test Basic Functionality

```bash
# Test tools list
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | \
  node dist/desktop-mcp-server.js

# Test memory add
echo '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"memory_add","arguments":{"title":"Test","content":"Test memory"}}}' | \
  node dist/desktop-mcp-server.js
```

### 2. Verify Claude Desktop Integration

1. Open Claude Desktop
2. Check for "memory-ts" in available tools
3. Test adding a memory: "Remember that I like coffee"
4. Test searching: "What do you remember about my preferences?"

### 3. Monitor Logs

- Check for any error messages
- Verify database connections
- Monitor memory usage

## 🚨 Rollback Plan

If deployment fails:

1. **Immediate**: Revert Claude Desktop config to previous version
2. **Docker**: Stop container and revert to previous image
3. **Cloud**: Use `fly rollback` or redeploy previous version
4. **Database**: Restore from backup if needed

## 📋 Deployment History

| Date | Version | Deployer | Status | Notes |
|------|---------|----------|--------|-------|
| 2025-09-27 | 1.0.0 | Initial | ✅ | First production deployment |

## 🔍 Troubleshooting

### Common Issues

1. **"Database configuration missing"**
   - Check TURSO_URL environment variable
   - For local files, use `file:path/to/db.sqlite`

2. **"OpenAI API key not provided"**
   - Embeddings will be disabled (non-critical)
   - Set OPENAI_API_KEY for full functionality

3. **"Method not found" errors**
   - Check JSON-RPC request format
   - Verify tool names match exactly

4. **Claude Desktop not seeing tools**
   - Restart Claude Desktop after config changes
   - Check config file syntax (valid JSON)
   - Verify file paths are absolute

### Debug Mode

Enable detailed logging:
```bash
MCP_DEBUG=1 node dist/desktop-mcp-server.js
```

## 📞 Support

- **GitHub Issues**: https://github.com/bobmatnyc/mcp-memory-ts/issues
- **Documentation**: See README.md and docs/ folder
- **Regression Tests**: Run `npm run test:regression` for validation
