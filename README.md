# MCP Memory Service - TypeScript

A modern TypeScript implementation of a cloud-based vector memory service for AI assistants via the Model Context Protocol (MCP). This service provides persistent storage with semantic search capabilities for Claude.ai and other AI assistants.

## Features

- **🧠 3-Tier Memory System**: SYSTEM, LEARNED, and MEMORY layers for hierarchical knowledge organization
- **👥 Multi-Tenant Support**: Secure user isolation with API key authentication
- **🔍 Vector Search**: Semantic similarity search using OpenAI embeddings
- **🏢 Entity Management**: Track people, organizations, projects, and relationships
- **📚 Interaction History**: Store and retrieve conversation history with context
- **🔌 MCP Protocol**: JSON-RPC 2.0 over stdio for Claude Desktop integration
- **🌐 REST API**: HTTP interface for web applications
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

## License

MIT License - See LICENSE file for details.
