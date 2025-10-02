# OAuth API Reference

Complete API reference for the Remote MCP Server with Clerk OAuth authentication.

## Table of Contents

- [Authentication](#authentication)
- [Endpoints](#endpoints)
- [JSON-RPC Methods](#json-rpc-methods)
- [MCP Tools](#mcp-tools)
- [Error Codes](#error-codes)
- [Rate Limiting](#rate-limiting)
- [Examples](#examples)

---

## Authentication

All MCP endpoints (except `/health`) require Clerk OAuth authentication via Bearer token.

### Authentication Header

```
Authorization: Bearer <clerk_session_token>
```

### Getting a Session Token

#### Using Clerk React/Next.js

```javascript
import { useAuth } from '@clerk/nextjs';

function MyComponent() {
  const { getToken } = useAuth();

  const token = await getToken();
  // Use token in Authorization header
}
```

#### Using Clerk JavaScript

```javascript
import Clerk from '@clerk/clerk-js';

const clerk = new Clerk('your_publishable_key');
await clerk.load();

const token = await clerk.session.getToken();
```

### Token Validation

The server validates tokens by:
1. Extracting Bearer token from Authorization header
2. Verifying with Clerk API
3. Creating/validating session
4. Extracting user email for data isolation

---

## Endpoints

### Base URL

- **Development:** `http://localhost:3003`
- **Production:** `https://your-deployment.vercel.app`

### Available Endpoints

| Endpoint | Method | Auth Required | Description |
|----------|--------|---------------|-------------|
| `/health` | GET | No | Health check and server status |
| `/mcp` | POST | Yes | Main JSON-RPC endpoint |
| `/mcp/tools` | GET | Yes | List available tools |

---

## JSON-RPC Methods

### Overview

All requests to `/mcp` endpoint use JSON-RPC 2.0 protocol:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "method_name",
  "params": { /* method-specific parameters */ }
}
```

### initialize

Initialize MCP session with the server.

**Request:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": {
    "protocolVersion": "2024-11-05",
    "capabilities": {},
    "clientInfo": {
      "name": "your-client-name",
      "version": "1.0.0"
    }
  }
}
```

**Response:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "protocolVersion": "2024-11-05",
    "capabilities": {
      "tools": {}
    },
    "serverInfo": {
      "name": "mcp-memory-service",
      "version": "1.1.2"
    }
  }
}
```

### tools/list

List all available MCP tools.

**Request:**
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/list",
  "params": {}
}
```

**Response:**
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "tools": [
      {
        "name": "store_memory",
        "description": "Store a memory with automatic embedding generation",
        "inputSchema": { /* ... */ }
      },
      {
        "name": "search_memories",
        "description": "Search memories using text or semantic search",
        "inputSchema": { /* ... */ }
      }
      // ... more tools
    ]
  }
}
```

### tools/call

Execute a specific MCP tool.

**Request:**
```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/call",
  "params": {
    "name": "tool_name",
    "arguments": {
      /* tool-specific arguments */
    }
  }
}
```

**Response:**
```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "Tool result as text or JSON string"
      }
    ]
  }
}
```

---

## MCP Tools

### Memory Tools

#### store_memory

Store a new memory with automatic embedding generation.

**Parameters:**
- `content` (string, required) - The memory content
- `type` (string, required) - Memory type: `"SYSTEM"`, `"LEARNED"`, or `"MEMORY"`
- `importance` (string, optional) - Importance level: `"LOW"`, `"MEDIUM"`, `"HIGH"`, `"CRITICAL"` (default: `"MEDIUM"`)
- `metadata` (object, optional) - Additional metadata as key-value pairs

**Example:**
```bash
curl -X POST http://localhost:3003/mcp \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "store_memory",
      "arguments": {
        "content": "User prefers dark mode in applications",
        "type": "MEMORY",
        "importance": "MEDIUM",
        "metadata": {
          "category": "preferences",
          "ui": "theme"
        }
      }
    }
  }'
```

**Response:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "{\"status\":\"success\",\"memoryId\":\"mem_abc123\",\"message\":\"Memory stored successfully\"}"
      }
    ]
  }
}
```

#### search_memories

Search memories using text search or semantic vector search.

**Parameters:**
- `query` (string, required) - Search query
- `limit` (number, optional) - Maximum results to return (default: 10)
- `type` (string, optional) - Filter by memory type
- `importance` (string, optional) - Filter by minimum importance

**Example:**
```bash
curl -X POST http://localhost:3003/mcp \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/call",
    "params": {
      "name": "search_memories",
      "arguments": {
        "query": "dark mode preferences",
        "limit": 5,
        "type": "MEMORY"
      }
    }
  }'
```

**Response:**
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "{\"status\":\"success\",\"results\":[{\"id\":\"mem_abc123\",\"content\":\"User prefers dark mode...\",\"similarity\":0.95,\"type\":\"MEMORY\"}],\"count\":1}"
      }
    ]
  }
}
```

#### update_memory

Update an existing memory.

**Parameters:**
- `memoryId` (string, required) - ID of memory to update
- `content` (string, optional) - New content
- `importance` (string, optional) - New importance level
- `metadata` (object, optional) - Updated metadata

**Example:**
```bash
curl -X POST http://localhost:3003/mcp \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 3,
    "method": "tools/call",
    "params": {
      "name": "update_memory",
      "arguments": {
        "memoryId": "mem_abc123",
        "content": "User strongly prefers dark mode in all applications",
        "importance": "HIGH"
      }
    }
  }'
```

#### delete_memory

Delete a specific memory.

**Parameters:**
- `memoryId` (string, required) - ID of memory to delete

**Example:**
```bash
curl -X POST http://localhost:3003/mcp \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 4,
    "method": "tools/call",
    "params": {
      "name": "delete_memory",
      "arguments": {
        "memoryId": "mem_abc123"
      }
    }
  }'
```

### Entity Tools

#### create_entity

Create a new entity (person, organization, or project).

**Parameters:**
- `name` (string, required) - Entity name
- `entityType` (string, required) - Type: `"PERSON"`, `"ORGANIZATION"`, or `"PROJECT"`
- `details` (string, optional) - Additional details
- `metadata` (object, optional) - Entity metadata

**Example:**
```bash
curl -X POST http://localhost:3003/mcp \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 5,
    "method": "tools/call",
    "params": {
      "name": "create_entity",
      "arguments": {
        "name": "John Doe",
        "entityType": "PERSON",
        "details": "Senior Software Engineer at Acme Corp",
        "metadata": {
          "role": "engineer",
          "department": "backend"
        }
      }
    }
  }'
```

#### search_entities

Search for entities by name or type.

**Parameters:**
- `query` (string, required) - Search query
- `entityType` (string, optional) - Filter by entity type
- `limit` (number, optional) - Maximum results (default: 10)

**Example:**
```bash
curl -X POST http://localhost:3003/mcp \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 6,
    "method": "tools/call",
    "params": {
      "name": "search_entities",
      "arguments": {
        "query": "John",
        "entityType": "PERSON",
        "limit": 5
      }
    }
  }'
```

#### create_relationship

Create a relationship between two entities.

**Parameters:**
- `fromEntityId` (string, required) - Source entity ID
- `toEntityId` (string, required) - Target entity ID
- `relationshipType` (string, required) - Relationship type
- `metadata` (object, optional) - Relationship metadata

**Example:**
```bash
curl -X POST http://localhost:3003/mcp \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 7,
    "method": "tools/call",
    "params": {
      "name": "create_relationship",
      "arguments": {
        "fromEntityId": "ent_person_123",
        "toEntityId": "ent_org_456",
        "relationshipType": "WORKS_AT",
        "metadata": {
          "since": "2020-01-01",
          "position": "Engineer"
        }
      }
    }
  }'
```

### Interaction Tools

#### store_interaction

Store a conversation interaction.

**Parameters:**
- `agentName` (string, required) - Name of the AI agent
- `content` (string, required) - Interaction content
- `context` (string, optional) - Interaction context
- `metadata` (object, optional) - Interaction metadata

**Example:**
```bash
curl -X POST http://localhost:3003/mcp \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 8,
    "method": "tools/call",
    "params": {
      "name": "store_interaction",
      "arguments": {
        "agentName": "Claude",
        "content": "Discussed OAuth implementation for MCP server",
        "context": "Technical discussion about authentication",
        "metadata": {
          "topic": "authentication",
          "duration": "15m"
        }
      }
    }
  }'
```

#### get_recent_interactions

Get recent interactions with an agent.

**Parameters:**
- `agentName` (string, required) - Name of the agent
- `limit` (number, optional) - Maximum results (default: 10)

**Example:**
```bash
curl -X POST http://localhost:3003/mcp \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 9,
    "method": "tools/call",
    "params": {
      "name": "get_recent_interactions",
      "arguments": {
        "agentName": "Claude",
        "limit": 5
      }
    }
  }'
```

### Utility Tools

#### clear_all_memories

Clear all memories for the authenticated user.

**Parameters:** None

**Example:**
```bash
curl -X POST http://localhost:3003/mcp \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 10,
    "method": "tools/call",
    "params": {
      "name": "clear_all_memories",
      "arguments": {}
    }
  }'
```

**⚠️ Warning:** This action is irreversible!

#### update_missing_embeddings

Regenerate embeddings for memories that don't have them.

**Parameters:**
- `limit` (number, optional) - Maximum memories to process (default: 100)

**Example:**
```bash
curl -X POST http://localhost:3003/mcp \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 11,
    "method": "tools/call",
    "params": {
      "name": "update_missing_embeddings",
      "arguments": {
        "limit": 50
      }
    }
  }'
```

---

## Error Codes

### JSON-RPC Error Codes

| Code | Message | Description |
|------|---------|-------------|
| `-32700` | Parse error | Invalid JSON received |
| `-32600` | Invalid Request | Invalid JSON-RPC request |
| `-32601` | Method not found | Method does not exist |
| `-32602` | Invalid params | Invalid method parameters |
| `-32603` | Internal error | Internal JSON-RPC error |
| `-32001` | Authentication required | Missing or invalid auth token |
| `-32002` | Rate limit exceeded | Too many requests |

### HTTP Status Codes

| Code | Message | Description |
|------|---------|-------------|
| `200` | OK | Request successful |
| `400` | Bad Request | Invalid request format |
| `401` | Unauthorized | Authentication required or failed |
| `429` | Too Many Requests | Rate limit exceeded |
| `500` | Internal Server Error | Server error |

### Error Response Format

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "error": {
    "code": -32001,
    "message": "Authentication required",
    "data": {
      "reason": "No authorization header provided"
    }
  }
}
```

---

## Rate Limiting

### Configuration

Rate limiting is enforced per user (based on email):

**Development:**
- Requests per minute: 1000
- Window: 60 seconds

**Production:**
- Requests per minute: 100
- Window: 60 seconds

### Rate Limit Headers

Responses include rate limit information:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1696176000
```

### Rate Limit Exceeded Response

```json
{
  "jsonrpc": "2.0",
  "id": null,
  "error": {
    "code": 429,
    "message": "Too Many Requests",
    "data": {
      "retryAfter": 60
    }
  }
}
```

**Retry-After Header:**
```
Retry-After: 60
```

### Best Practices

1. **Implement Exponential Backoff**
   ```javascript
   async function retryWithBackoff(fn, maxRetries = 3) {
     for (let i = 0; i < maxRetries; i++) {
       try {
         return await fn();
       } catch (error) {
         if (error.code === 429 && i < maxRetries - 1) {
           const delay = Math.pow(2, i) * 1000;
           await new Promise(resolve => setTimeout(resolve, delay));
         } else {
           throw error;
         }
       }
     }
   }
   ```

2. **Check Retry-After Header**
   ```javascript
   if (response.status === 429) {
     const retryAfter = response.headers.get('Retry-After');
     await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
   }
   ```

3. **Batch Operations**
   - Store multiple memories in fewer requests
   - Use search with higher limits instead of multiple searches

---

## Examples

### Complete JavaScript Example

```javascript
class MCPClient {
  constructor(baseUrl, token) {
    this.baseUrl = baseUrl;
    this.token = token;
    this.requestId = 0;
  }

  async call(method, params = {}) {
    const response = await fetch(`${this.baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: ++this.requestId,
        method,
        params
      })
    });

    const result = await response.json();

    if (result.error) {
      throw new Error(result.error.message);
    }

    return result.result;
  }

  async initialize() {
    return this.call('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: {
        name: 'my-client',
        version: '1.0.0'
      }
    });
  }

  async storeMemory(content, type = 'MEMORY', importance = 'MEDIUM') {
    return this.call('tools/call', {
      name: 'store_memory',
      arguments: { content, type, importance }
    });
  }

  async searchMemories(query, limit = 10) {
    return this.call('tools/call', {
      name: 'search_memories',
      arguments: { query, limit }
    });
  }
}

// Usage
const client = new MCPClient('http://localhost:3003', 'your-token');

await client.initialize();
await client.storeMemory('Important meeting tomorrow at 3pm', 'MEMORY', 'HIGH');
const results = await client.searchMemories('meeting');
```

### cURL Examples

#### Store Memory
```bash
curl -X POST http://localhost:3003/mcp \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "store_memory",
      "arguments": {
        "content": "Customer prefers email communication",
        "type": "MEMORY",
        "importance": "HIGH",
        "metadata": {
          "category": "preferences",
          "contact": "email"
        }
      }
    }
  }'
```

#### Search with Filters
```bash
curl -X POST http://localhost:3003/mcp \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/call",
    "params": {
      "name": "search_memories",
      "arguments": {
        "query": "preferences",
        "type": "MEMORY",
        "importance": "HIGH",
        "limit": 5
      }
    }
  }'
```

#### Create Entity with Relationship
```bash
# First, create entities
curl -X POST http://localhost:3003/mcp \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 3,
    "method": "tools/call",
    "params": {
      "name": "create_entity",
      "arguments": {
        "name": "Alice Johnson",
        "entityType": "PERSON",
        "details": "Product Manager"
      }
    }
  }'

# Then create relationship
curl -X POST http://localhost:3003/mcp \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 4,
    "method": "tools/call",
    "params": {
      "name": "create_relationship",
      "arguments": {
        "fromEntityId": "ent_person_alice",
        "toEntityId": "ent_project_app",
        "relationshipType": "MANAGES"
      }
    }
  }'
```

---

## Response Format

### Success Response

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "{\"status\":\"success\",\"data\":{...}}"
      }
    ]
  }
}
```

### Tool Result Structure

All tool results follow this pattern:

```typescript
interface ToolResult {
  status: 'success' | 'error';
  message?: string;
  data?: any;
  error?: string;
}
```

---

## Health Check Endpoint

### GET /health

Check server health and status (no authentication required).

**Request:**
```bash
curl http://localhost:3003/health
```

**Response:**
```json
{
  "status": "healthy",
  "version": "1.1.2",
  "timestamp": "2025-10-01T12:00:00.000Z",
  "activeSessions": 5,
  "authentication": "enabled",
  "database": "connected",
  "uptime": 3600
}
```

---

## Additional Resources

- [OAuth Setup Guide](./OAUTH_SETUP.md) - Architecture overview
- [Quick Start Guide](./OAUTH_QUICKSTART.md) - Get started quickly
- [Deployment Guide](./OAUTH_DEPLOYMENT.md) - Production deployment
- [Client Integration](./OAUTH_CLIENT_INTEGRATION.md) - Integrate with your app
- [Test Report](./TEST-REPORT.md) - 95.2% test coverage

---

**Last Updated:** 2025-10-01
**Version:** 1.1.2
**API Stability:** Stable
