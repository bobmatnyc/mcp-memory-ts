# MCP Memory TypeScript - Claude Agent Instructions

**Project Type**: MCP Server / TypeScript Library
**Purpose**: Cloud-based vector memory service for AI assistants via Model Context Protocol
**Location**: `/Users/masa/Projects/managed/mcp-memory-ts`

## 🔴 CRITICAL Requirements

### MCP Protocol Compliance
- **JSON-RPC 2.0 Standard**: All responses MUST include valid `jsonrpc: "2.0"` and `id` fields
- **Tool Interface**: Follow exact MCP tool schema with `inputSchema` validation
- **Claude Desktop Integration**: Ensure stdio communication works flawlessly
- **Error Handling**: Return proper JSON-RPC errors, never throw unhandled exceptions

### Database Integrity
- **Turso/LibSQL**: Production database with vector embeddings
- **Multi-tenant**: User isolation is MANDATORY for security
- **Schema Migrations**: Use existing schema, never break backward compatibility
- **Transaction Safety**: Wrap critical operations in transactions

### OpenAI Integration
- **Embeddings API**: Required for vector search functionality
- **Rate Limiting**: Handle API limits gracefully with retries
- **Error Recovery**: Fall back to text search if embeddings fail

## 🟡 IMPORTANT Standards

### Memory System Architecture
- **3-Tier System**: SYSTEM (core), LEARNED (patterns), MEMORY (user data)
- **Vector Search**: Semantic similarity using OpenAI embeddings
- **Entity Management**: People, organizations, projects with relationships
- **Interaction History**: Conversation context storage

### TypeScript Best Practices
- **Strict Mode**: All type checking enabled
- **ESM Modules**: ES2022 target with modern syntax
- **Type Safety**: No `any` types, proper interfaces
- **Error Handling**: MCPToolResult pattern for consistent responses

### Testing Requirements
- **Vitest Framework**: Unit and integration tests
- **Coverage Goals**: Core functions must have >80% coverage
- **Regression Testing**: Pre-deploy test suite required
- **Integration Tests**: Database and MCP protocol tests

## 🟢 STANDARD Operations

### Single-Path Commands

**Build the project:**
```bash
npm run build
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

**Code quality:**
```bash
npm run lint:fix && npm run format && npm run type-check
```

**Pre-deployment:**
```bash
npm run pre-deploy
```

### Project Structure
```
src/
├── types/          # TypeScript definitions
├── models/         # Data models and schemas
├── database/       # Database operations
├── core/           # Memory logic and vector search
├── mcp/           # MCP server implementation
├── api/           # REST API server
├── utils/         # Utilities and embeddings
└── simple-mcp-server.ts  # Main MCP entry point
```

### Environment Configuration
Required variables in `.env`:
```bash
# Database (Turso/LibSQL)
TURSO_URL=libsql://your-database.turso.io
TURSO_AUTH_TOKEN=your-auth-token

# OpenAI (for embeddings)
OPENAI_API_KEY=your-openai-api-key

# Optional
LOG_LEVEL=INFO
MCP_DEBUG=0
DEFAULT_USER_EMAIL=user@example.com
```

## ⚪ OPTIONAL Enhancements

### Performance Optimizations
- Vector search caching
- Batch embedding operations
- Connection pooling
- Query optimization

### Advanced Features
- Custom embedding models
- Advanced search algorithms
- Export/import functionality
- Analytics and insights

## Development Workflows

### Adding New Tools
1. Define tool schema in `simple-mcp-server.ts`
2. Implement handler in `handleToolsCall` method
3. Add corresponding method to `MemoryCore`
4. Write tests for both MCP and core functionality
5. Update documentation

### Database Changes
1. **NEVER** modify existing schema directly
2. Create migration scripts in `scripts/` directory
3. Test with both empty and populated databases
4. Update type definitions if needed
5. Document breaking changes

### MCP Server Development
1. Use `npm run mcp-server` for local testing
2. Test with Claude Desktop integration
3. Validate JSON-RPC compliance
4. Check error handling paths
5. Verify tool schemas match implementation

## Deployment Guide

### Claude Desktop Integration
Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "memory-ts": {
      "command": "node",
      "args": ["/path/to/mcp-memory-ts/dist/simple-mcp-server.js"],
      "env": {
        "TURSO_URL": "your-database-url",
        "TURSO_AUTH_TOKEN": "your-auth-token",
        "OPENAI_API_KEY": "your-openai-key"
      }
    }
  }
}
```

### Production Deployment
1. Build: `npm run build`
2. Test: `npm run pre-deploy`
3. Deploy compiled `dist/` directory
4. Configure environment variables
5. Monitor logs and performance

## Testing Strategy

### Unit Tests
- Core memory operations
- Database operations
- Utility functions
- Model validation

### Integration Tests
- MCP protocol compliance
- Database schema validation
- OpenAI API integration
- End-to-end tool flows

### Regression Tests
- Pre-deployment validation
- Schema compatibility
- API response formats
- Performance benchmarks

## Common Issues & Solutions

### Claude Desktop Connection Issues
- Verify JSON-RPC response format
- Check stdio communication
- Validate tool schemas
- Review error logging

### Database Problems
- Check Turso connection and auth
- Verify schema version compatibility
- Monitor connection limits
- Review transaction handling

### Embedding Failures
- Verify OpenAI API key
- Check rate limiting
- Implement fallback to text search
- Monitor API usage

### Performance Issues
- Profile vector search operations
- Check database index usage
- Monitor memory consumption
- Optimize batch operations

## Key Files & Responsibilities

- `simple-mcp-server.ts` - Main MCP server entry point
- `core/memory-core.ts` - Core memory operations
- `database/operations.ts` - Database layer
- `types/base.ts` - Type definitions
- `utils/embeddings.ts` - OpenAI integration

## Memory Patterns for Future Tasks

Remember these project-specific patterns:
- Use `MCPToolResult` for all operation responses
- Always check user authentication/authorization
- Wrap database operations in try/catch with proper error messages
- Generate embeddings for searchable content
- Use enum types for memory/entity types and importance levels
- Follow the 3-tier memory architecture (SYSTEM/LEARNED/MEMORY)

## Quick Reference

**Start development:** `npm run dev`
**Test changes:** `npm test`
**Build for production:** `npm run build`
**Run MCP server:** `npm run mcp-server`
**Quality check:** `npm run lint:fix && npm run format`
**Pre-deploy test:** `npm run pre-deploy`

---

*This MCP memory server provides persistent, searchable memory for AI assistants using vector embeddings and semantic search capabilities.*