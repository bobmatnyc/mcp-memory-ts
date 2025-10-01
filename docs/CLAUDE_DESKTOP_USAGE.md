# Claude Desktop Usage Guide

This guide explains how to set up and use the MCP Memory Service with Claude Desktop.

## Prerequisites

- Claude Desktop application installed
- Node.js 18+ installed
- MCP Memory Service built and configured

## Installation

### 1. Build the Project

```bash
# Clone and build the project
git clone <repository-url>
cd mcp-memory-ts
npm install
npm run build
```

### 2. Configure Environment

Create a `.env.local` file with your credentials:

```bash
# Database Configuration
TURSO_URL=libsql://your-database.turso.io
TURSO_AUTH_TOKEN=your-auth-token

# OpenAI Configuration (for vector embeddings)
OPENAI_API_KEY=your-openai-api-key

# Optional: Default user email
DEFAULT_USER_EMAIL=your-email@example.com

# Debug logging (optional)
MCP_DEBUG=1
```

### 3. Initialize Database

```bash
npm run init-db
```

### 4. Configure Claude Desktop

Add the MCP server to your Claude Desktop configuration file:

**Location:** `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "memory-ts": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-memory-ts/dist/mcp/server.js"],
      "env": {
        "TURSO_URL": "libsql://your-database.turso.io",
        "TURSO_AUTH_TOKEN": "your-auth-token",
        "OPENAI_API_KEY": "your-openai-api-key",
        "DEFAULT_USER_EMAIL": "your-email@example.com"
      }
    }
  }
}
```

**Important:** Use absolute paths in the configuration.

### 5. Restart Claude Desktop

After updating the configuration, restart Claude Desktop completely:
1. Quit Claude Desktop
2. Wait a few seconds
3. Reopen Claude Desktop

## Available Tools

Once configured, Claude will have access to these memory tools:

### Memory Management

#### `memory_add`
Add new memories with automatic vector embedding generation.

**Example usage:**
```
Please remember that I prefer TypeScript over JavaScript for new projects because of better type safety and IDE support.
```

**Parameters:**
- `title` (required): Brief title for the memory
- `content` (required): Detailed content
- `memory_type`: Type of memory (SYSTEM, LEARNED, MEMORY, biographical, professional, personal, technical, project, interaction, preference)
- `importance`: 1-4 (low to critical)
- `tags`: Array of tags for categorization
- `entity_ids`: Related entity IDs

#### `memory_search`
Search memories using text and vector similarity.

**Example usage:**
```
What do you remember about my TypeScript preferences?
```

**Parameters:**
- `query` (required): Search query
- `limit`: Maximum results (default: 10)
- `threshold`: Similarity threshold 0-1 (default: 0.7)
- `memory_types`: Filter by memory types

#### `memory_delete`
Delete a memory by ID.

**Parameters:**
- `memory_id` (required): ID of memory to delete

### Entity Management

#### `entity_create`
Create entities (people, organizations, projects, etc.).

**Example usage:**
```
Please create an entity for my colleague Sarah Johnson who works as a Senior Developer at TechCorp.
```

**Parameters:**
- `name` (required): Entity name
- `entity_type` (required): person, organization, project, concept, location, event
- `description`: Description
- `company`: Company name (for people)
- `title`: Job title
- `email`: Email address
- `phone`: Phone number
- `website`: Website URL
- `importance`: 1-4 (low to critical)
- `tags`: Array of tags
- `notes`: Additional notes

#### `entity_search`
Search entities by name, description, or other fields.

**Example usage:**
```
Find all entities related to TechCorp.
```

**Parameters:**
- `query` (required): Search query
- `limit`: Maximum results (default: 10)

#### `entity_update`
Update an existing entity.

**Parameters:**
- `entity_id` (required): Entity ID
- `updates` (required): Object with fields to update

### Advanced Search

#### `unified_search`
Search across all data types (memories, entities, interactions).

**Example usage:**
```
Search for everything related to the React project we discussed last month.
```

**Parameters:**
- `query` (required): Search query
- `limit`: Maximum results (default: 10)
- `threshold`: Similarity threshold 0-1 (default: 0.7)
- `memory_types`: Filter memory types
- `entity_types`: Filter entity types

### Statistics and Health

#### `get_statistics`
Get database statistics and health information.

**Example usage:**
```
Show me statistics about my memory database.
```

#### `get_recent_interactions`
Get recent interactions and conversation history.

**Parameters:**
- `limit`: Maximum interactions (default: 10)

## Usage Examples

### Basic Memory Storage

```
User: Please remember that I'm working on a TypeScript project called "MCP Memory Service" and I prefer using Fastify over Express for API servers.

Claude: I'll remember that information for you.

[Claude uses memory_add tool with:
- title: "TypeScript Project Preferences"
- content: "Working on MCP Memory Service project. Prefers Fastify over Express for API servers."
- memory_type: "professional"
- tags: ["typescript", "project", "fastify", "api"]
]
```

### Entity Creation

```
User: I want to track my colleague John Smith who is a Product Manager at Acme Corp. His email is john.smith@acme.com.

Claude: I'll create an entity for John Smith.

[Claude uses entity_create tool with:
- name: "John Smith"
- entity_type: "person"
- company: "Acme Corp"
- title: "Product Manager"
- email: "john.smith@acme.com"
]
```

### Memory Retrieval

```
User: What do you remember about my API server preferences?

Claude: Let me search my memory for your API server preferences.

[Claude uses memory_search tool with:
- query: "API server preferences"
]

Based on my memory, you prefer using Fastify over Express for API servers, particularly for your TypeScript projects like the MCP Memory Service.
```

### Complex Search

```
User: Find everything related to my work projects and colleagues.

Claude: I'll search across all your data for work-related information.

[Claude uses unified_search tool with:
- query: "work projects colleagues"
- memory_types: ["professional", "project"]
- entity_types: ["person", "organization", "project"]
]
```

## Best Practices

### Memory Organization

1. **Use descriptive titles** for memories
2. **Add relevant tags** for better categorization
3. **Set appropriate importance levels**
4. **Link related entities** when creating memories

### Entity Management

1. **Create entities for important people, organizations, and projects**
2. **Keep entity information up to date**
3. **Use consistent naming conventions**
4. **Add detailed descriptions and notes**

### Search Optimization

1. **Use specific keywords** in search queries
2. **Adjust similarity thresholds** based on needs
3. **Filter by types** to narrow results
4. **Use unified search** for comprehensive results

## Troubleshooting

### Common Issues

#### 1. Tools Not Available
- Check Claude Desktop configuration file syntax
- Verify absolute paths in configuration
- Restart Claude Desktop completely
- Check server logs for errors

#### 2. Database Connection Errors
```bash
# Test database connection
npm run init-db

# Check environment variables
echo $TURSO_URL
echo $TURSO_AUTH_TOKEN
```

#### 3. Embedding Generation Errors
```bash
# Verify OpenAI API key
curl -H "Authorization: Bearer $OPENAI_API_KEY" \
     https://api.openai.com/v1/models
```

#### 4. Performance Issues
- Reduce search limits for faster responses
- Increase similarity thresholds to get fewer, more relevant results
- Check database size and consider archiving old memories

### Debug Mode

Enable debug logging to troubleshoot issues:

```json
{
  "mcpServers": {
    "memory-ts": {
      "command": "node",
      "args": ["/path/to/mcp-memory-ts/dist/mcp/server.js"],
      "env": {
        "TURSO_URL": "your-database-url",
        "TURSO_AUTH_TOKEN": "your-auth-token",
        "OPENAI_API_KEY": "your-openai-key",
        "MCP_DEBUG": "1"
      }
    }
  }
}
```

Debug logs will appear in the Claude Desktop console.

### Verification

Test the MCP server directly:

```bash
# Start the MCP server
npm run mcp-server

# In another terminal, test with a simple JSON-RPC request
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | node dist/mcp/server.js
```

## Advanced Configuration

### Custom User Configuration

Set up multiple users or custom default settings:

```json
{
  "mcpServers": {
    "memory-ts": {
      "command": "node",
      "args": ["/path/to/mcp-memory-ts/dist/mcp/server.js"],
      "env": {
        "TURSO_URL": "your-database-url",
        "TURSO_AUTH_TOKEN": "your-auth-token",
        "OPENAI_API_KEY": "your-openai-key",
        "DEFAULT_USER_EMAIL": "specific-user@example.com",
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

### Performance Tuning

Optimize for your usage patterns:

```json
{
  "env": {
    "TURSO_URL": "your-database-url",
    "TURSO_AUTH_TOKEN": "your-auth-token",
    "OPENAI_API_KEY": "your-openai-key",
    "EMBEDDING_BATCH_SIZE": "50",
    "VECTOR_SEARCH_THRESHOLD": "0.75",
    "MAX_SEARCH_RESULTS": "20"
  }
}
```

## Support

If you encounter issues:

1. Check the troubleshooting section above
2. Review server logs with debug mode enabled
3. Verify your configuration matches the examples
4. Test the MCP server independently
5. Check the main README.md for additional help
