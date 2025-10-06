# MCP Memory Service - TypeScript

A modern TypeScript implementation of a cloud-based vector memory service for AI assistants via the Model Context Protocol (MCP). This service provides persistent storage with semantic search capabilities for Claude.ai and other AI assistants.

## Features

- **🧠 3-Tier Memory System**: SYSTEM, LEARNED, and MEMORY layers for hierarchical knowledge organization
- **👥 Multi-Tenant Support**: Secure user isolation with Clerk OAuth authentication
- **🔍 Vector Search**: Semantic similarity search using OpenAI embeddings
- **🔄 Automatic Embeddings**: Auto-generates and updates embeddings on data changes
- **🏢 Entity Management**: Track people, organizations, projects, and relationships
- **📚 Interaction History**: Store and retrieve conversation history with context
- **📱 Contacts Sync**: True bidirectional sync with macOS Contacts using LLM-based deduplication
- **🌐 Web Interface**: Modern Next.js web UI for visual memory management (v1.3.0+)
- **🔌 MCP Protocol**: JSON-RPC 2.0 over stdio (local) and HTTP (remote)
- **🌐 REST API**: HTTP interface for web applications
- **🔐 OAuth Integration**: Clerk authentication for remote access with 95.2% test coverage
- **☁️ Cloud-Ready**: Built for modern cloud deployment with Turso database

## Architecture

```
src/
├── types/          # TypeScript type definitions
├── models/         # Data models and schemas
├── database/       # Database connection and operations
├── core/           # Core memory logic and vector search
├── mcp/           # MCP server implementation
├── api/           # REST API server
├── cli/           # CLI tool
├── utils/         # Utility functions
└── index.ts       # Main entry point

web/
├── app/           # Next.js app directory
├── components/    # React components
├── lib/           # Utilities and integrations
└── public/        # Static assets
```

## Quick Start

### Prerequisites

- Node.js 18+ 
- Turso database (or LibSQL compatible)
- OpenAI API key (for embeddings)

### Installation

```bash
# Clone and install dependencies
npm install

# Copy environment configuration
cp .env.local .env

# Build the project
npm run build

# Start development server
npm run dev
```

### Environment Variables

Required variables in `.env`:

```bash
# Database Configuration
TURSO_URL=libsql://your-database.turso.io
TURSO_AUTH_TOKEN=your-auth-token

# OpenAI Configuration (for vector embeddings)
OPENAI_API_KEY=your-openai-api-key

# Optional Configuration
LOG_LEVEL=INFO
MCP_DEBUG=0
DEFAULT_USER_EMAIL=user@example.com

# Automatic Embedding Updates (v1.1.0+)
ENABLE_EMBEDDING_MONITOR=true  # Enable background monitoring
EMBEDDING_MONITOR_INTERVAL=60000  # Check every 60 seconds

# Web Interface (v1.3.0+)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your-clerk-publishable-key
CLERK_SECRET_KEY=your-clerk-secret-key
```

## Usage

### MCP Server (for Claude Desktop)

```bash
# Start MCP server
npm run mcp-server

# Or with debug logging
MCP_DEBUG=1 npm run mcp-server
```

Add to Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json`):

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

### Remote MCP Server (HTTP with OAuth)

For web applications and remote access with Clerk authentication:

```bash
# Start remote MCP server
npm run mcp-server-remote
```

The remote MCP server will be available at `http://localhost:3003` with:
- **Authentication**: Clerk OAuth session tokens
- **Multi-Tenant**: Complete user isolation by email
- **Protocol**: JSON-RPC 2.0 over HTTP
- **Security**: Rate limiting, CORS, session management
- **Endpoints**: `/mcp` (main), `/health`
- **Test Coverage**: 95.2% pass rate (20/21 tests)

#### OAuth Setup

1. **Get Clerk credentials** from [dashboard.clerk.com](https://dashboard.clerk.com/)

2. **Configure environment:**
   ```bash
   # Development Keys
   CLERK_SECRET_KEY=your-clerk-test-secret-key
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_bmF0aXZlLW1hcm1vc2V0LTc0LmNsZXJrLmFjY291bnRzLmRldiQ

   # Production Keys (when ready)
   CLERK_SECRET_KEY=your-clerk-live-secret-key
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_Y2xlcmsuYWktbWVtb3J5LmFwcCQ
   ```

3. **Start server:**
   ```bash
   npm run mcp-server-remote
   ```

4. **Test with authentication:**
   ```bash
   curl -X POST http://localhost:3003/mcp \
     -H "Authorization: Bearer YOUR_CLERK_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}'
   ```

See [docs/REMOTE_MCP_SETUP.md](./docs/REMOTE_MCP_SETUP.md) for detailed setup instructions.

### Web Interface (v1.3.0+)

Modern Next.js web interface for visual memory management:

```bash
# Setup web interface
./scripts/setup-web.sh

# Start development server
cd web
npm run dev
```

The web interface will be available at `http://localhost:3001` with:
- **Authentication**: Clerk OAuth for multi-user support
- **Visual Search**: Interactive memory browser with semantic search
- **Entity Management**: Visual relationship mapping
- **Real-time Sync**: Bidirectional sync with MCP server
- **Contacts Integration**: Import/export with LLM deduplication

See [docs/features/WEB_INTERFACE.md](./docs/features/WEB_INTERFACE.md) for complete setup and deployment guide.

### REST API Server

```bash
# Start REST API server
npm run api-server
```

The API will be available at `http://localhost:3000` with endpoints for:
- `/api/memories` - Memory management
- `/api/entities` - Entity management
- `/api/search` - Vector and text search
- `/api/users` - User management

## Development

```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Lint code
npm run lint

# Format code
npm run format

# Type checking
npm run type-check
```

### Testing

The project includes comprehensive test coverage:

- **Unit Tests**: Core functionality and utilities
- **Integration Tests**: OAuth authentication, user isolation, MCP protocol
- **E2E Tests**: Complete workflows and Claude Desktop integration
- **Test Results**: 95.2% pass rate (20/21 tests passing)

See [docs/testing/QA_TEST_REPORT.md](./docs/testing/QA_TEST_REPORT.md) for detailed test results.

## Documentation

### Core Documentation
- [CLAUDE.md](./CLAUDE.md) - Project instructions and architecture
- [README.md](./README.md) - This file (project overview)

### Guides
- [Deployment Guide](./DEPLOYMENT.md) - Production deployment
- [CLI Guide](./docs/guides/CLI-GUIDE.md) - Command-line interface
- [Contacts Sync Guide](./docs/guides/CONTACTS_SYNC_GUIDE.md) - Bidirectional sync with macOS Contacts
- [Contacts Sync Quick Start](./docs/guides/CONTACTS_SYNC_QUICK_START.md) - Quick start for contacts sync
- [Migration Guide](./docs/guides/MIGRATION_QUICK_START.md) - Schema migrations

### Features
- [Web Interface](./docs/features/WEB_INTERFACE.md) - Web UI setup and usage
- [Contacts Sync Performance](./docs/features/CONTACTS_SYNC_PERFORMANCE_OPTIMIZATION.md) - Sync optimization

### Security
- [Clerk Implementation](./docs/security/CLERK_IMPLEMENTATION_NOTES.md) - Clerk setup guide
- [Clerk Migration](./docs/security/CLERK_MIGRATION_SUMMARY.md) - Auth migration guide
- [Security Fixes](./docs/security/SECURITY_FIX_REPORT.md) - v1.2.1 security patches

### Deployment
- [Deployment Comparison](./docs/deployment/DEPLOYMENT_COMPARISON.md) - Compare deployment options

### Schema & Database
- [Schema Optimization](./docs/schema/SCHEMA_OPTIMIZATION_GUIDE.md) - Database design
- [Schema Analysis](./docs/schema/DATABASE_SCHEMA_ANALYSIS.md) - Database structure

### Testing & Quality
- [Verification Checklist](./docs/testing/VERIFICATION-CHECKLIST.md) - Deployment checklist
- [Migration Tests](./docs/testing/MIGRATION_TEST_REPORT.md) - Migration test results
- [QA Test Report](./docs/testing/QA_TEST_REPORT.md) - Quality assurance results

### Additional Documentation
- [docs/](./docs/) - Complete documentation library
  - [features/](./docs/features/) - Feature documentation
  - [guides/](./docs/guides/) - User guides and quick starts
  - [security/](./docs/security/) - Authentication and security
  - [deployment/](./docs/deployment/) - Deployment options
  - [schema/](./docs/schema/) - Database schema documentation
  - [testing/](./docs/testing/) - Test reports and QA
  - [_archive/](./docs/_archive/) - Archived documentation versions

## License

MIT License - See LICENSE file for details.

## Testing

### Comprehensive Integrity Tests

A comprehensive test suite is available to verify data integrity and system reliability:

```bash
# Run the full test suite
tsx comprehensive-integrity-test.ts
```

The test suite validates:
- Data integrity (type preservation, importance values, metadata)
- Boundary conditions (volume, special characters, concurrent operations)
- Recovery & reliability (updates, deletions, clear operations)
- Search algorithms (single-word, multi-word, case insensitivity)
- Production scenarios (session tracking, priority queues, date handling)

Expected results: **17/17 tests passed, 5/5 production criteria met**

See [docs/testing/](./docs/testing/) for detailed test results and analysis.

