# MCP Memory TypeScript - Claude Agent Instructions

**Project Type**: MCP Server / TypeScript Library
**Purpose**: Cloud-based vector memory service for AI assistants via Model Context Protocol
**Location**: `/Users/masa/Projects/mcp-memory-ts`
**Version**: 1.7.2 (published to npm)
**Status**: Production-ready with comprehensive test coverage (95.2%)

## 🔴 CRITICAL Requirements

### MCP Protocol Compliance
- **JSON-RPC 2.0 Standard**: All responses MUST include valid `jsonrpc: "2.0"` and `id` fields
- **Tool Interface**: Follow exact MCP tool schema with `inputSchema` validation
- **Claude Desktop Integration**: Ensure stdio communication works flawlessly
- **Error Handling**: Return proper JSON-RPC errors, never throw unhandled exceptions

### Database Integrity
- **Turso/LibSQL**: Production database with vector embeddings
- **Multi-tenant**: User isolation is MANDATORY for security
- **Schema Migrations**: Use migration scripts in `scripts/` directory, never modify schema directly
- **Transaction Safety**: Wrap critical operations in transactions
- **Schema Optimization**: v1.3.0 includes optimized schema - use migration tools for updates
- **User Isolation**: Critical security measures enforced (v1.2.1+ security patches applied)

### OpenAI Integration
- **Embeddings API**: Required for vector search functionality (text-embedding-3-small model)
- **Rate Limiting**: Handle API limits gracefully with retries
- **Error Recovery**: Fall back to text search if embeddings fail
- **Automatic Updates**: v1.1.0+ includes embedding monitor for auto-regeneration

## 🟡 IMPORTANT Standards

### Memory System Architecture
- **3-Tier System**: SYSTEM (core), LEARNED (patterns), MEMORY (user data)
- **Vector Search**: Semantic similarity using OpenAI embeddings with 0.3 threshold
- **Entity Management**: People, organizations, projects with relationships
- **Interaction History**: Conversation context storage
- **Enhanced Search**: v1.1.2+ includes transparent semantic search with similarity scores

### TypeScript Best Practices
- **Strict Mode**: All type checking enabled
- **ESM Modules**: ES2022 target with modern syntax
- **Type Safety**: No `any` types, proper interfaces
- **Error Handling**: MCPToolResult pattern for consistent responses
- **Code Quality**: Enforce with ESLint, Prettier, and TypeScript compiler

### Testing Requirements
- **Vitest Framework**: Unit and integration tests
- **Coverage Goals**: Core functions must have >80% coverage (currently 95.2%)
- **Regression Testing**: Pre-deploy test suite required before releases
- **Integration Tests**: Database and MCP protocol tests

## 🟢 STANDARD Operations

### Single-Path Commands

**Build the project:**
```bash
npm run build
```

**Full build (includes CLI):**
```bash
npm run build-full
```

**Development server:**
```bash
npm run dev
```

**MCP server (Claude Desktop):**
```bash
npm run mcp-server
```

**Run all tests:**
```bash
npm test
```

**Test with coverage:**
```bash
npm run test:coverage
```

**Run CLI tool:**
```bash
npm run cli
# Or after npm link:
mcp-memory --help
```

**Code quality (all checks):**
```bash
npm run lint:fix && npm run format && npm run type-check
```

**Pre-deployment validation:**
```bash
npm run pre-deploy
```

**Schema migration (dry run):**
```bash
npm run migrate:schema:dry-run
```

**Schema migration (execute):**
```bash
npm run migrate:schema
```

**Version management (changesets):**
```bash
# Create a changeset for your changes
npm run changeset:add

# Update version and generate changelog
npm run changeset:version

# Check changeset status
npm run changeset:status

# Release (build, test, and publish)
npm run release
```

### CLI Tool Commands

The project includes a comprehensive CLI tool for managing MCP Memory:

**Initialize configuration:**
```bash
mcp-memory init
```

**Install to Claude Desktop:**
```bash
mcp-memory install
```

**Check installation status:**
```bash
mcp-memory status
```

**Update Claude Desktop config:**
```bash
mcp-memory update
```

**Run as MCP server:**
```bash
mcp-memory server
# Or with debug logging:
mcp-memory server --debug
```

**Export entities to vCard:**
```bash
mcp-memory export-vcard --user-email user@example.com -o contacts.vcf
```

**Import vCard:**
```bash
mcp-memory import-vcard contacts.vcf --user-email user@example.com
```

**Sync with macOS Contacts:**
```bash
# Sync FROM MCP Memory TO macOS Contacts
mcp-memory contacts sync --direction export --user-email user@example.com

# Sync FROM macOS Contacts TO MCP Memory
mcp-memory contacts sync --direction import --user-email user@example.com

# Bidirectional sync (both ways)
mcp-memory contacts sync --direction both --user-email user@example.com
```

**Google Contacts and Calendar sync:**
```bash
# Check Google connection status
mcp-memory google auth --user-email user@example.com

# Sync Google Contacts (with LLM deduplication)
mcp-memory google contacts-sync --user-email user@example.com --direction import --auto-merge

# Sync Google Calendar (current week)
mcp-memory google calendar-sync --user-email user@example.com

# Sync specific week with entity creation
mcp-memory google calendar-sync --user-email user@example.com --week 2025-41 --create-entities
```

**OAuth 2.0 Management:**
```bash
# Register OAuth client (e.g., Claude.AI)
npm run oauth:register-client

# Test OAuth implementation
npm run oauth:test-flow

# Cleanup expired tokens (run as cron job)
npm run oauth:cleanup
```

See [CLI-GUIDE.md](./docs/guides/CLI-GUIDE.md), [CONTACTS_SYNC_GUIDE.md](./docs/guides/CONTACTS_SYNC_GUIDE.md), [GOOGLE_CONTACTS_SYNC_GUIDE.md](./docs/guides/GOOGLE_CONTACTS_SYNC_GUIDE.md), and [GOOGLE_CALENDAR_SYNC_GUIDE.md](./docs/guides/GOOGLE_CALENDAR_SYNC_GUIDE.md) for complete documentation.

### Web Interface Commands

The project includes a modern Next.js web interface for visual memory management. **The web app includes integrated API routes** - no separate API server needed.

**Setup web interface:**
```bash
./scripts/setup-web.sh
```

**Start web development server:**
```bash
# Staging server on port 3002 (recommended for testing)
./START_WEB_SERVER.sh

# Or manually specify port
cd web
npm run dev -- -p 3002

# Default development port (3000)
cd web
npm run dev
```

**Deploy web app with PM2 (includes API routes):**
```bash
# Build the web app
cd web && npm run build && cd ..

# Start with PM2 (configured for port 3001 in production, port 3002 for staging)
pm2 start ecosystem.config.cjs

# Check PM2 status
pm2 list
pm2 logs mcp-memory-web

# Restart after changes
pm2 restart mcp-memory-web
```

**Important**: The web application serves both:
- **Staging**: Frontend UI at `http://localhost:3002`, API at `http://localhost:3002/api/*`
- **Production**: Frontend UI at `http://localhost:3001`, API at `http://localhost:3001/api/*` (via PM2)

Do NOT deploy a separate standalone API server - the web app includes all API functionality.

**Build web interface for production:**
```bash
cd web
npm run build
```

See [WEB_INTERFACE.md](./docs/features/WEB_INTERFACE.md) for complete web interface documentation.

### Remote MCP Service (Vercel Production)

The project includes a production-ready remote MCP service deployed on Vercel.

**Production Endpoints:**
- **Health Check**: `https://ai-memory.app/api/health` (public)
- **MCP Service**: `https://ai-memory.app/api/mcp` (authenticated)

**Authentication:**
Remote MCP requires Clerk OAuth authentication via Bearer token:
```bash
curl -X POST https://ai-memory.app/api/mcp \
  -H "Authorization: Bearer YOUR_CLERK_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

**Testing the Deployment:**
```bash
# Check service health
curl https://ai-memory.app/api/health | jq .

# Test MCP endpoint (requires auth)
curl -X POST https://ai-memory.app/api/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
# Expected: Authentication required error (correct behavior)
```

**Deployment Characteristics:**
- Serverless deployment (30s max duration, 1024MB memory)
- Auto-scaling with global CDN
- Multi-layer security (Clerk OAuth + Bearer tokens)
- HTTP/2 with TLSv1.3 encryption
- ~100ms response time

**For Long-Running Operations:**
Use self-hosted remote MCP server on port 3003 for operations that exceed 30s timeout.

See deployment documentation: `VERCEL_ACCESS_GUIDE.md`

### Project Structure
```
src/
├── types/          # TypeScript definitions
├── models/         # Data models and schemas
├── database/       # Database operations and schema
├── core/           # Memory logic and vector search
├── mcp/           # MCP server implementation
├── api/           # REST API server
├── cli/           # CLI tool (init, Claude Desktop integration)
├── utils/         # Utilities and embeddings
└── desktop-mcp-server.ts  # Main MCP entry point

scripts/
├── migrate-schema-optimization.ts  # Schema migration tool
├── verify-schema-optimization.ts   # Schema verification
└── pre-deploy-test.ts             # Regression tests

docs/
├── _archive/      # Archived documentation versions
├── features/      # Feature documentation
├── guides/        # User guides
├── security/      # Security and authentication
├── deployment/    # Deployment guides
├── schema/        # Database schema documentation
├── testing/       # Testing and QA reports
└── MASTER_PLAN.md # Project roadmap and architecture

web/
├── app/           # Next.js app directory
├── components/    # React components
├── lib/           # Utilities and integrations
└── public/        # Static assets
```

### Environment Configuration
Required variables in `.env` or `~/.mcp-memory/config.json` (via CLI):
```bash
# Database (Turso/LibSQL)
TURSO_URL=libsql://your-database.turso.io
TURSO_AUTH_TOKEN=your-auth-token

# OpenAI (for embeddings)
OPENAI_API_KEY=your-openai-api-key

# Optional Configuration
LOG_LEVEL=info              # Options: debug, info (default), warn, error
MCP_DEBUG=0                 # Set to 1 for detailed MCP protocol debugging
DEFAULT_USER_EMAIL=user@example.com

# Embedding Monitoring (v1.1.0+)
ENABLE_EMBEDDING_MONITOR=true
EMBEDDING_MONITOR_INTERVAL=60000

# Web Interface (v1.3.0+)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your-clerk-publishable-key
CLERK_SECRET_KEY=your-clerk-secret-key

# Google Integration (v1.7.0+)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3002/api/auth/google/callback  # Port 3002 for staging
```

## ⚪ OPTIONAL Enhancements

### Performance Optimizations
- Vector search caching
- Batch embedding operations
- Connection pooling
- Query optimization with indexed fields

### Advanced Features
- Custom embedding models
- Advanced search algorithms
- Export/import functionality (vCard implemented)
- Analytics and insights
- Multi-language support
- Web interface for visual memory management (v1.3.0+)
- Bidirectional contacts synchronization with LLM deduplication (v1.3.0+)
- Multi-user authentication with Clerk (v1.3.0+)
- Google Contacts sync with incremental updates (v1.7.0+)
- Google Calendar week-based event tracking (v1.7.0+)
- Cross-platform contact synchronization (v1.7.0+)

## OAuth 2.0 Provider (v1.8.0+)

The project includes a complete OAuth 2.0 authorization server for Claude.AI custom connector integration.

**Setup OAuth Provider:**
```bash
# 1. Run database migration
npm run migrate:oauth

# 2. Register OAuth client (e.g., Claude.AI)
npm run oauth:register-client

# 3. Test OAuth flow
npm run oauth:test-flow
```

**OAuth Endpoints:**
- Authorization: `https://your-domain.com/api/oauth/authorize`
- Token: `https://your-domain.com/api/oauth/token`
- Consent Screen: `https://your-domain.com/oauth/consent`

**Features:**
- Authorization code grant flow
- Refresh token support
- Scope-based permissions (`memories:read`, `memories:write`, `entities:read`, `entities:write`)
- Secure token management (bcrypt hashing, 7-day access token expiry)
- PKCE support (code challenge fields included)
- User consent interface
- Token revocation capability
- Automatic token cleanup

**Authentication Support:**
The MCP server now supports two authentication methods:
1. **Clerk Bearer Tokens**: Existing authentication (unchanged)
2. **OAuth Access Tokens**: New OAuth 2.0 tokens (prefix: `mcp_at_`)

Both methods work seamlessly with all MCP endpoints.

**Documentation:**
- Setup Guide: [docs/guides/OAUTH_SETUP_GUIDE.md](./docs/guides/OAUTH_SETUP_GUIDE.md)
- Quick Start: [docs/guides/OAUTH_QUICK_START.md](./docs/guides/OAUTH_QUICK_START.md)
- Implementation Summary: [OAUTH_IMPLEMENTATION_SUMMARY.md](./OAUTH_IMPLEMENTATION_SUMMARY.md)
- Deployment Checklist: [OAUTH_DEPLOYMENT_CHECKLIST.md](./OAUTH_DEPLOYMENT_CHECKLIST.md)

## Development Workflows

### Adding New Tools
1. Define tool schema in `desktop-mcp-server.ts`
2. Implement handler in `handleToolsCall` method
3. Add corresponding method to `MemoryCore`
4. Write tests for both MCP and core functionality
5. Update documentation
6. Run regression tests before committing

### Database Changes
1. **NEVER** modify existing schema directly in production
2. Create migration scripts in `scripts/` directory
3. Test with both empty and populated databases using dry-run mode
4. Run migration: `npm run migrate:schema`
5. Verify with: `npm run verify:schema`
6. Update type definitions if needed
7. Document breaking changes in migration summary
8. Run full test suite to verify compatibility

### Schema Migration Workflow
```bash
# 1. Test migration with dry run
npm run migrate:schema:dry-run

# 2. Review migration plan and backup recommendations

# 3. Execute migration (creates automatic backups)
npm run migrate:schema

# 4. Verify schema optimization
npm run verify:schema

# 5. Check migration statistics
npm run migrate:schema:stats

# 6. If needed, rollback to backup
npm run migrate:schema:rollback
```

### NULL ID Fix Workflow
If you encounter memories with NULL IDs (LibSQL/Turso quirk), use this script to fix them:

```bash
# 1. Preview changes without applying (dry run)
npm run fix-null-ids -- --dry-run

# 2. Review the dry run output showing which records would be updated

# 3. Execute the fix (assigns UUIDs to all NULL IDs)
npm run fix-null-ids

# 4. Verify all NULL IDs are fixed
# The script will automatically verify and report statistics
```

**Features:**
- Dry-run mode for safe preview
- Batch processing (50 records at a time)
- Duplicate prevention (checks existing IDs)
- Automatic verification
- Comprehensive statistics reporting

### MCP Server Development
1. Use `npm run mcp-server` for local testing
2. Test with Claude Desktop integration
3. Validate JSON-RPC compliance
4. Check error handling paths
5. Verify tool schemas match implementation
6. Test with MCP_DEBUG=1 for detailed logging

### CLI Development
1. Build with `npm run build-full` to include CLI
2. Link globally with `npm link` for testing
3. Test all commands: init, install, status, export, import
4. Verify Claude Desktop config updates work
5. Test credential validation and error handling

### Web Interface Development
1. Set up web environment: `./scripts/setup-web.sh`
2. Configure Clerk authentication (see [CLERK_IMPLEMENTATION_NOTES.md](./docs/security/CLERK_IMPLEMENTATION_NOTES.md))
3. Build web interface: `cd web && npm run build`
4. Test locally: `cd web && npm run dev`
5. Deploy to Vercel or other hosting platforms
6. See deployment options: [DEPLOYMENT_COMPARISON.md](./docs/deployment/DEPLOYMENT_COMPARISON.md)

## Deployment Guide

### Deployment Options Overview

The project supports multiple deployment scenarios:
- **Claude Desktop Integration**: Local MCP server for personal use
- **Web Interface**: Multi-user web application with Clerk authentication
- **Remote MCP Service**: Serverless MCP via HTTPS (Vercel deployment at https://ai-memory.app)
- **API Server**: RESTful API for remote access
- **Hybrid Deployment**: Combine multiple deployment methods

See [DEPLOYMENT_COMPARISON.md](./docs/deployment/DEPLOYMENT_COMPARISON.md) for detailed comparison and recommendations.

### Claude Desktop Integration (Recommended Method)

Use the CLI tool for automated setup:
```bash
# 1. Initialize configuration
mcp-memory init

# 2. Build the project
npm run build-full

# 3. Install to Claude Desktop
mcp-memory install

# 4. Restart Claude Desktop

# 5. Verify installation
mcp-memory status
```

### Manual Claude Desktop Integration

**Recommended approach** (using CLI command):
Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "mcp-memory-ts": {
      "command": "mcp-memory",
      "args": ["server"],
      "env": {
        "TURSO_URL": "your-database-url",
        "TURSO_AUTH_TOKEN": "your-auth-token",
        "OPENAI_API_KEY": "your-openai-key",
        "DEFAULT_USER_EMAIL": "user@example.com"
      }
    }
  }
}
```

**Alternative approach** (direct node execution):
```json
{
  "mcpServers": {
    "mcp-memory-ts": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-memory-ts/dist/desktop-mcp-server.js"],
      "env": {
        "TURSO_URL": "your-database-url",
        "TURSO_AUTH_TOKEN": "your-auth-token",
        "OPENAI_API_KEY": "your-openai-key",
        "DEFAULT_USER_EMAIL": "user@example.com"
      }
    }
  }
}
```

### npm Package Installation

The project is published to npm as `mcp-memory-ts`:
```bash
# Install globally
npm install -g mcp-memory-ts

# Use CLI
mcp-memory init
mcp-memory install
```

### Production Deployment
1. Build: `npm run build-full`
2. Test: `npm run pre-deploy`
3. Verify schema: `npm run verify:schema`
4. Deploy compiled `dist/` directory
5. Configure environment variables
6. Monitor logs and performance
7. Set up embedding monitor for automatic updates

### Web Interface Deployment
1. Set up Clerk authentication project
2. Configure environment variables (see [CLERK_MIGRATION_SUMMARY.md](./docs/security/CLERK_MIGRATION_SUMMARY.md))
3. Build web interface: `cd web && npm run build`
4. Deploy to Vercel: `vercel deploy` or other platforms
5. Configure production database and API endpoints
6. Test authentication and user isolation
7. Monitor performance and security

## Testing Strategy

### Unit Tests
- Core memory operations
- Database operations
- Utility functions
- Model validation
- CLI command handlers

### Integration Tests
- MCP protocol compliance
- Database schema validation
- OpenAI API integration
- End-to-end tool flows
- Claude Desktop configuration

### Regression Tests
Run before every deployment:
```bash
npm run pre-deploy
```

This validates:
- Schema compatibility
- API response formats
- Performance benchmarks
- Core functionality integrity

### Test Coverage
Current coverage: **95.2%** (20/21 tests passing)
- Unit tests: All passing
- Integration tests: Comprehensive coverage
- E2E tests: Claude Desktop integration verified

## Common Issues & Solutions

### npm install Hangs
**Issue**: npm install freezes during package installation
**Solution**:
```bash
# Clear npm cache
npm cache clean --force

# Remove node_modules and package-lock.json
rm -rf node_modules package-lock.json

# Reinstall with verbose logging
npm install --verbose

# Or use alternative package manager
pnpm install
# or
yarn install
```

### Claude Desktop Connection Issues
**Problem**: MCP server not connecting to Claude Desktop
**Solutions**:
- Verify JSON-RPC response format in logs
- Check stdio communication (use MCP_DEBUG=1)
- Validate tool schemas match implementation
- Review Claude Desktop logs at: `~/Library/Logs/Claude/mcp*.log`
- Restart Claude Desktop after config changes
- Use CLI status check: `mcp-memory status`

### Database Problems
**Problem**: Database connection or query failures
**Solutions**:
- Check Turso connection and auth token validity
- Verify schema version compatibility with `npm run verify:schema`
- Monitor connection limits (Turso free tier: 500 rows)
- Review transaction handling in database operations
- Check for schema drift after migrations

**Problem**: Memories table has NULL IDs (LibSQL/Turso quirk)
**Solutions**:
- Preview the fix: `npm run fix-null-ids -- --dry-run`
- Execute the fix: `npm run fix-null-ids`
- Script assigns UUIDs to all NULL ID records in safe batches
- Automatic verification and statistics reporting included

### Embedding Failures
**Problem**: Vector search not working or embeddings missing
**Solutions**:
- Verify OpenAI API key is valid and has credits
- Check rate limiting (reduce batch sizes if needed)
- Enable embedding monitor for auto-regeneration
- Test with fallback to text search
- Monitor API usage in OpenAI dashboard
- Regenerate embeddings with migration tool

### Schema Migration Issues
**Problem**: Migration fails or causes data corruption
**Solutions**:
- Always run dry-run first: `npm run migrate:schema:dry-run`
- Review migration plan and backup recommendations
- Ensure database has sufficient space
- Check for locked tables or active connections
- Use rollback if migration fails: `npm run migrate:schema:rollback`
- Verify schema after migration: `npm run verify:schema`

### CLI Configuration Issues
**Problem**: CLI can't find configuration or server
**Solutions**:
- Run `mcp-memory init` to create config
- Build with `npm run build-full` (not just `build`)
- Check config exists: `~/.mcp-memory/config.json`
- Verify server built: `dist/desktop-mcp-server.js`
- Check absolute paths in Claude Desktop config
- Review CLI logs for specific errors

### Performance Issues
**Problem**: Slow queries or high memory usage
**Solutions**:
- Profile vector search operations (check similarity threshold)
- Check database index usage (schema v1.3.0 optimized)
- Monitor memory consumption during embedding generation
- Optimize batch operations (reduce batch sizes)
- Use connection pooling for high-traffic scenarios
- Cache frequently accessed data

### Web Interface Issues
**Problem**: Web interface not loading or authentication failing
**Solutions**:
- Verify Clerk configuration and API keys
- Check Next.js build output for errors
- Review browser console for client-side errors
- Verify database connection from web server
- Check CORS settings for API access
- Review [WEB_INTERFACE.md](./docs/features/WEB_INTERFACE.md) for setup issues
- Check [CLERK_IMPLEMENTATION_NOTES.md](./docs/security/CLERK_IMPLEMENTATION_NOTES.md) for auth issues

### Contacts Sync Issues
**Problem**: Contact synchronization failing or duplicates
**Solutions**:
- Review sync logs for specific error messages
- Check LLM deduplication settings and API access
- Verify contact data format and required fields
- Monitor sync performance and batch sizes
- Review conflict resolution settings
- See [CONTACTS_SYNC_PERFORMANCE_OPTIMIZATION.md](./docs/features/CONTACTS_SYNC_PERFORMANCE_OPTIMIZATION.md)

### Log Spam Issues (v1.7.0+)
**Problem**: Too many logs in Claude Desktop or excessive log file size
**Solutions**:
- Set appropriate LOG_LEVEL in environment configuration
- Use `LOG_LEVEL=error` for production (silent mode)
- Use `LOG_LEVEL=info` for normal operation (default)
- Use `LOG_LEVEL=debug` only when troubleshooting
- Smart logging prevents repetitive messages automatically
- See [LOG_LEVEL_GUIDE.md](./docs/guides/LOG_LEVEL_GUIDE.md) for complete documentation

**Example Configuration**:
```bash
# In .env or Claude Desktop config
LOG_LEVEL=info  # Balanced logging (recommended)
# or
LOG_LEVEL=error  # Silent mode for production
```

## Key Files & Responsibilities

### Core Files
- `desktop-mcp-server.ts` - Main MCP server entry point (use this for Claude Desktop)
- `core/memory-core.ts` - Core memory operations and business logic
- `database/operations.ts` - Database layer and query operations
- `database/schema.ts` - Database schema definitions
- `types/base.ts` - Type definitions and interfaces
- `utils/embeddings.ts` - OpenAI integration and embedding generation

### CLI Files
- `cli/index.ts` - CLI entry point and command router
- `cli/init.ts` - Interactive configuration wizard
- `cli/claude-desktop.ts` - Claude Desktop integration commands
- `cli/help.ts` - Help text and usage documentation

### Web Interface Files
- `web/app/` - Next.js app directory with pages and layouts
- `web/components/` - Reusable React components
- `web/lib/` - Utility functions and integrations
- `scripts/setup-web.sh` - Web interface setup script

### Migration Files
- `scripts/migrate-schema-optimization.ts` - Schema migration tool
- `scripts/verify-schema-optimization.ts` - Schema verification
- `scripts/test-migration-fixes.ts` - Migration test suite

### Configuration Files
- `package.json` - Dependencies and npm scripts
- `tsconfig.json` - TypeScript configuration
- `.env` or `.env.local` - Environment variables
- `~/.mcp-memory/config.json` - CLI user configuration

## Memory Patterns for Future Tasks

Remember these project-specific patterns:

### Response Patterns
- Use `MCPToolResult` for all operation responses
- Always include `success` boolean and descriptive messages
- Return empty arrays instead of null for list operations
- Include metadata in responses (counts, timestamps)

### Security Patterns
- Always check user authentication/authorization by email
- Validate user_email in all database operations
- Isolate user data in multi-tenant context (CRITICAL: v1.2.1 security patches applied)
- Never expose sensitive data in error messages
- Use Clerk for web interface authentication and session management
- Implement proper CORS policies for API access
- Validate all input on both client and server side

### Database Patterns
- Wrap database operations in try/catch with proper error messages
- Use transactions for multi-step operations
- Check for existing records before insert (avoid duplicates)
- Use prepared statements for all queries (SQLi prevention)

### Embedding Patterns
- Generate embeddings for searchable content automatically
- Fall back to text search if embeddings fail
- Use similarity threshold of 0.3 for semantic search
- Monitor and regenerate stale embeddings

### Type Patterns
- Use enum types for memory/entity types and importance levels
- Validate input against TypeScript types and Zod schemas
- Follow the 3-tier memory architecture (SYSTEM/LEARNED/MEMORY)
- Use strict TypeScript mode (no `any` types)

### Error Handling Patterns
- Return descriptive error messages in MCPToolResult
- Log errors with context (user, operation, timestamp)
- Handle edge cases gracefully (empty results, missing data)
- Provide actionable error messages for users

### Logging Patterns (v1.7.0+)
- Use proper log levels: `debug` < `info` < `warn` < `error`
- Respect `LOG_LEVEL` environment variable in all logging
- Use `console.log()` for info/debug, `console.error()` for errors
- Implement smart logging to prevent repetitive messages
- Track state changes to only log meaningful events
- Always log actual errors regardless of LOG_LEVEL
- Use descriptive prefixes like `[ComponentName]` for clarity

## Quick Reference

### Essential Commands
```bash
# Development
npm run dev                    # Start development server
npm test                       # Run all tests
npm run build-full            # Build including CLI

# MCP Server
npm run mcp-server            # Start MCP server
MCP_DEBUG=1 npm run mcp-server # Start with debug logging

# CLI Tool
mcp-memory init                 # Initialize configuration
mcp-memory install              # Install to Claude Desktop
mcp-memory status               # Check installation

# Google Sync
mcp-memory google auth -u user@example.com           # Check Google connection
mcp-memory google contacts-sync -u user@example.com  # Sync Google Contacts
mcp-memory google calendar-sync -u user@example.com  # Sync Google Calendar

# Web Interface
cd web && npm run dev           # Start web dev server
cd web && npm run build         # Build for production
./scripts/setup-web.sh          # Setup web environment

# Quality Checks
npm run lint:fix              # Fix linting issues
npm run format                # Format code
npm run type-check            # Type checking
npm run pre-deploy            # Full pre-deployment test

# Schema Management
npm run migrate:schema:dry-run  # Test migration
npm run migrate:schema          # Run migration
npm run verify:schema           # Verify schema
npm run fix-null-ids -- --dry-run  # Preview NULL ID fix
npm run fix-null-ids            # Fix NULL IDs in memories table

# Remote MCP Service
curl https://ai-memory.app/api/health     # Check service health
vercel logs https://ai-memory.app         # Monitor deployment logs
vercel env ls                             # List environment variables
npm run deploy:vercel                     # Deploy updates
```

### Quick Start (New Installation)
```bash
# 1. Install dependencies
npm install

# 2. Build project
npm run build-full

# 3. Link CLI globally (optional)
npm link

# 4. Initialize configuration
mcp-memory init

# 5. Install to Claude Desktop
mcp-memory install

# 6. Restart Claude Desktop
```

### Quick Start (Existing Installation Update)
```bash
# 1. Pull latest changes
git pull

# 2. Install dependencies
npm install

# 3. Run migrations if needed
npm run migrate:schema:dry-run
npm run migrate:schema

# 4. Rebuild
npm run build-full

# 5. Update Claude Desktop
mcp-memory update

# 6. Restart Claude Desktop
```

## Version History & Changes

### v1.7.2 (Current - October 2025)
- **Critical Bug Fix**: Fix MCP stdio protocol violation causing Claude Desktop connection failures
- **Stdout Pollution Fix**: Resolved JSON-RPC communication issues with proper logging isolation
- **Test Suite Enhancement**: Added 9 comprehensive unit tests to prevent stdout pollution regression
- **Documentation**: Added stdio protocol compliance guide and verification scripts

### v1.7.1 (October 2025)
- **CRITICAL SECURITY PATCH**: Fix user isolation vulnerabilities (CVE-INTERNAL-2025-001 through -004)
- **LOG_LEVEL Support**: Environment variable for controlling log verbosity (debug/info/warn/error)
- **Smart Logging**: State tracking to prevent repetitive log messages
- **Security Documentation**: Comprehensive security test reports and vulnerability analysis

### v1.7.0 (October 2025)
- **Google Contacts Sync**: Bidirectional sync with incremental updates (syncToken)
- **Google Calendar Sync**: Week-based event tracking with attendee linking
- **OAuth Integration**: Secure Google authentication with Clerk session management
- **LLM Deduplication**: GPT-4 powered duplicate detection for Google contacts
- **Cross-platform Sync**: Combine macOS Contacts and Google Contacts seamlessly
- **Calendar Entities**: Automatic entity creation from calendar attendees
- **Comprehensive Docs**: Complete user-facing documentation for Google features

### v1.6.0 (October 2025)
- **Async Embedding Optimization**: Improved performance for vector operations
- **Web Interface Enhancements**: Enhanced UI components and user experience
- **Gmail Extraction** (In Development): Gmail integration capabilities
- **Package Optimization**: Exclude backup files from npm distribution
- **Test Coverage Improvements**: Enhanced test suite and deployment validation
- **Documentation Updates**: Comprehensive docs and deployment guides

### v1.5.0-v1.5.2 (October 2025)
- **Background Contacts Sync**: Run sync without foreground app activation
- **AppleScript Improvements**: Fixed shell escaping and quoting issues
- **Contacts.app Auto-Launch**: Automatic launch with System Events integration
- **NULL ID Bug Fix**: Database cleanup and ID normalization
- **Stability Enhancements**: Multiple bug fixes for production reliability

### v1.4.0-v1.4.4 (October 2025)
- **Database Migration System**: Comprehensive migration tools with rollback support
- **Contacts Sync Fixes**: Improved reliability and error handling
- **AppleScript Stability**: Enhanced Contacts.app integration
- **CLI Path Resolution**: Fixed absolute vs relative path handling
- **Server Renaming**: `simple-mcp-server` → `desktop-mcp-server` for clarity

### v1.3.0-v1.3.5 (October 2025)
- Bidirectional Contacts Sync with LLM-powered deduplication
- Web interface for memory management (Next.js app in `web/`)
- Clerk authentication integration for multi-user support
- Enhanced deployment options with comparison guide
- Contact synchronization performance optimizations
- Improved documentation organization
- ESM module fixes and package optimization
- ID format normalization (strings vs numbers)
- CLI absolute path generation improvements

### v1.2.1
- **CRITICAL SECURITY PATCH**: Fix user isolation vulnerabilities
- Enhanced multi-tenant security enforcement
- Improved data protection mechanisms

### v1.2.0
- Security enhancements for user isolation
- Improved authentication and authorization
- Enhanced data protection

### v1.1.6
- Full CLI tool with Claude Desktop integration
- Interactive configuration wizard
- vCard export/import for entities
- Schema optimizations for better performance
- Comprehensive migration tools with dry-run support

### v1.1.3-1.1.5
- Enhanced semantic search with transparency
- Lower similarity threshold (0.3) for better results
- Improved search result ranking
- Bug fixes for metadata and tags

### v1.1.0-1.1.2
- Automatic embedding generation and monitoring
- Enhanced metadata support
- Improved validation and error handling
- Performance optimizations

### v1.0.x
- Initial stable release
- Core MCP protocol implementation
- Vector search with OpenAI embeddings
- Multi-tenant support with Turso database

## Documentation

### Core Documentation
- [README.md](./README.md) - Project overview and features
- [CLAUDE.md](./CLAUDE.md) - This file (agent instructions)

### Guides
- [DEPLOYMENT.md](./DEPLOYMENT.md) - Deployment guide
- [CLI-GUIDE.md](./docs/guides/CLI-GUIDE.md) - Complete CLI documentation
- [LOG_LEVEL_GUIDE.md](./docs/guides/LOG_LEVEL_GUIDE.md) - Log verbosity configuration (v1.7.0+)
- [CHANGESET_GUIDE.md](./docs/guides/CHANGESET_GUIDE.md) - Version management and releases
- [MIGRATION_QUICK_START.md](./docs/guides/MIGRATION_QUICK_START.md) - Migration guide
- [CONTACTS_SYNC_QUICK_START.md](./docs/guides/CONTACTS_SYNC_QUICK_START.md) - Contacts sync guide
- [GOOGLE_SETUP_GUIDE.md](./docs/guides/GOOGLE_SETUP_GUIDE.md) - Google Cloud setup and OAuth
- [GOOGLE_CONTACTS_SYNC_GUIDE.md](./docs/guides/GOOGLE_CONTACTS_SYNC_GUIDE.md) - Google Contacts sync
- [GOOGLE_CALENDAR_SYNC_GUIDE.md](./docs/guides/GOOGLE_CALENDAR_SYNC_GUIDE.md) - Google Calendar sync
- [GOOGLE_MIGRATION_GUIDE.md](./docs/guides/GOOGLE_MIGRATION_GUIDE.md) - Migrate to Google sync

### Features
- [WEB_INTERFACE.md](./docs/features/WEB_INTERFACE.md) - Web interface documentation
- [GOOGLE_SYNC.md](./docs/features/GOOGLE_SYNC.md) - Google integration overview
- [CONTACTS_SYNC_PERFORMANCE_OPTIMIZATION.md](./docs/features/CONTACTS_SYNC_PERFORMANCE_OPTIMIZATION.md) - Sync optimization

### API Reference
- [GOOGLE_API_REFERENCE.md](./docs/api/GOOGLE_API_REFERENCE.md) - Google sync REST API

### Security
- [CLERK_IMPLEMENTATION_NOTES.md](./docs/security/CLERK_IMPLEMENTATION_NOTES.md) - Clerk setup guide
- [CLERK_MIGRATION_SUMMARY.md](./docs/security/CLERK_MIGRATION_SUMMARY.md) - Auth migration guide

### Deployment
- [DEPLOYMENT_COMPARISON.md](./docs/deployment/DEPLOYMENT_COMPARISON.md) - Deployment options comparison

### Schema Documentation
- [SCHEMA_OPTIMIZATION_GUIDE.md](./docs/schema/SCHEMA_OPTIMIZATION_GUIDE.md) - Schema design
- [DATABASE_SCHEMA_ANALYSIS.md](./docs/schema/DATABASE_SCHEMA_ANALYSIS.md) - Schema analysis

### Testing & Quality
- [VERIFICATION-CHECKLIST.md](./docs/testing/VERIFICATION-CHECKLIST.md) - Pre-deployment checklist
- [MIGRATION_TEST_REPORT.md](./docs/testing/MIGRATION_TEST_REPORT.md) - Migration test results
- [QA_TEST_REPORT.md](./docs/testing/QA_TEST_REPORT.md) - Quality assurance tests

### Additional Documentation
- `docs/` - Comprehensive documentation (features, testing, deployment, etc.)
- `docs/_archive/` - Previous versions of documentation

## Support & Troubleshooting

### Getting Help
1. Check this CLAUDE.md file first
2. Review CLI-GUIDE.md for CLI-specific issues
3. Check issue tracker for known problems
4. Review Claude Desktop logs
5. Enable debug logging with MCP_DEBUG=1

### Debug Logging
```bash
# Enable MCP debug logging
MCP_DEBUG=1 npm run mcp-server

# Enable TypeScript debug logging
DEBUG=* npm run dev

# Check Claude Desktop logs
tail -f ~/Library/Logs/Claude/mcp*.log
```

### Common Debug Steps
1. Verify environment configuration
2. Check database connectivity
3. Test OpenAI API key
4. Validate schema version
5. Review recent migrations
6. Check CLI configuration
7. Verify Claude Desktop config
8. Restart all services

---

## Recent Development Activity (Last 30 Days)

### Release Velocity
- **4 major releases** in October 2025 (v1.3.x → v1.6.0)
- **64 commits** with active development and bug fixes
- **High iteration cycle** with rapid stability improvements

### Development Focus Areas
1. **Contacts Integration**: Background sync, AppleScript improvements, auto-launch
2. **Database Reliability**: Migration system, NULL ID fixes, schema optimization
3. **Gmail Integration**: New feature in development (uncommitted work)
4. **Web Interface**: Enhanced UI components and user experience
5. **Production Stability**: Multiple bug fixes and deployment enhancements

### Most Active Components
- Core memory operations (18 changes)
- Database layer (11 changes)
- CLI tools and commands (27 changes combined)
- Web interface components (significant enhancements in progress)

### Current Work in Progress
- Gmail extraction service (new integration)
- Web API authentication routes
- Memory extractor component enhancements
- Database usage tracking improvements

---

**Last Updated**: 2025-10-14
**Current Version**: 1.7.2
**Status**: Production-ready with 95.2% test coverage

**Port Configuration**:
- **Staging Web Server**: Port 3002 (via START_WEB_SERVER.sh or manual dev)
- **Production Web Server**: Port 3001 (via PM2 ecosystem.config.cjs)
- **MCP Server (stdio)**: No port (Claude Desktop integration)
- **Remote MCP Server (HTTP)**: Port 3003 (optional, for self-hosted)
- **Vercel MCP Serverless**: https://ai-memory.app/api/mcp (production deployment)

*This MCP memory server provides persistent, searchable memory for AI assistants using vector embeddings and semantic search capabilities. It includes a comprehensive CLI tool for easy setup and management, plus Google Contacts and Calendar sync with LLM-powered deduplication.*
