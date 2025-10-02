# MCP Memory Service - TypeScript

A modern TypeScript implementation of a cloud-based vector memory service for AI assistants via the Model Context Protocol (MCP). This service provides persistent storage with semantic search capabilities for Claude.ai and other AI assistants.

## Features

- **🧠 3-Tier Memory System**: SYSTEM, LEARNED, and MEMORY layers for hierarchical knowledge organization
- **👥 Multi-Tenant Support**: Secure user isolation with Clerk OAuth authentication
- **🔍 Vector Search**: Semantic similarity search using OpenAI embeddings
- **🔄 Automatic Embeddings**: Auto-generates and updates embeddings on data changes
- **🏢 Entity Management**: Track people, organizations, projects, and relationships
- **📚 Interaction History**: Store and retrieve conversation history with context
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
├── utils/         # Utility functions
└── index.ts       # Main entry point
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

#### OAuth Documentation

Complete OAuth setup and integration guides:

- **[OAuth Setup Guide](./OAUTH_SETUP.md)** - Architecture, security, and user isolation
- **[Quick Start Guide](./OAUTH_QUICKSTART.md)** - Get started in 5 minutes
- **[API Reference](./OAUTH_API_REFERENCE.md)** - Complete API documentation
- **[Deployment Guide](./OAUTH_DEPLOYMENT.md)** - Deploy to production
- **[Client Integration](./OAUTH_CLIENT_INTEGRATION.md)** - Next.js, React, React Native examples

#### Quick OAuth Setup

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

See [OAUTH_QUICKSTART.md](./OAUTH_QUICKSTART.md) for detailed setup instructions.

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

See [TEST-REPORT.md](./TEST-REPORT.md) for detailed test results.

## Documentation

### Core Documentation
- [CLAUDE.md](./CLAUDE.md) - Project instructions and architecture
- [DEPLOYMENT.md](./DEPLOYMENT.md) - Deployment guide
- [CONFIGURATION_SUMMARY.md](./CONFIGURATION_SUMMARY.md) - Environment configuration

### OAuth Authentication
- [OAUTH_SETUP.md](./OAUTH_SETUP.md) - OAuth architecture and security
- [OAUTH_QUICKSTART.md](./OAUTH_QUICKSTART.md) - 5-minute setup guide
- [OAUTH_API_REFERENCE.md](./OAUTH_API_REFERENCE.md) - Complete API reference
- [OAUTH_DEPLOYMENT.md](./OAUTH_DEPLOYMENT.md) - Production deployment
- [OAUTH_CLIENT_INTEGRATION.md](./OAUTH_CLIENT_INTEGRATION.md) - Client integration examples

### Testing & Verification
- [TEST-REPORT.md](./TEST-REPORT.md) - 95.2% test coverage report
- [VERIFICATION_CHECKLIST.md](./VERIFICATION_CHECKLIST.md) - Deployment checklist

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

See [TEST_RESULTS.md](./TEST_RESULTS.md) for detailed test results and analysis.

