# Client Integration Guide

Complete guide for integrating the OAuth-enabled Remote MCP Server with your client applications.

## Table of Contents

- [Overview](#overview)
- [Authentication Flow](#authentication-flow)
- [Next.js Integration](#nextjs-integration)
- [React Integration](#react-integration)
- [Vanilla JavaScript](#vanilla-javascript)
- [React Native](#react-native)
- [Token Management](#token-management)
- [Error Handling](#error-handling)
- [Best Practices](#best-practices)

---

## Overview

The Remote MCP Server uses **Clerk OAuth** for authentication. This guide shows how to integrate with various client frameworks and platforms.

### Prerequisites

- Clerk account and application configured
- Remote MCP Server deployed and accessible
- Client framework of choice installed

### Key Concepts

1. **Clerk Session Token** - JWT token from Clerk authentication
2. **Bearer Authentication** - Token passed in Authorization header
3. **JSON-RPC 2.0** - Protocol for MCP communication
4. **User Isolation** - Automatic data separation by email

---

## Authentication Flow

### High-Level Flow

```
1. User signs in via Clerk
   ↓
2. Client receives session token
   ↓
3. Client includes token in MCP requests
   ↓
4. Server validates token with Clerk
   ↓
5. Server processes request with user context
   ↓
6. Client receives response
```

### Token Lifecycle

```typescript
// 1. Get token from Clerk
const token = await clerk.session.getToken();

// 2. Use token in requests
const response = await fetch('https://api.example.com/mcp', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

// 3. Token expires after session timeout (2 hours default)
// 4. Clerk automatically refreshes token
// 5. Get fresh token for next request
```

---

## Next.js Integration

### Setup

#### 1. Install Clerk

```bash
npm install @clerk/nextjs
```

#### 2. Configure Clerk

Add to `.env.local`:

```bash
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_Y2xlcmsuYWktbWVtb3J5LmFwcCQ
CLERK_SECRET_KEY=your-clerk-live-secret-key
NEXT_PUBLIC_MCP_API_URL=https://your-mcp-server.vercel.app
```

#### 3. Wrap App with Clerk Provider

`app/layout.tsx`:

```typescript
import { ClerkProvider } from '@clerk/nextjs';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body>{children}</body>
      </html>
    </ClerkProvider>
  );
}
```

### MCP Client Hook

Create `hooks/useMCPClient.ts`:

```typescript
import { useAuth } from '@clerk/nextjs';
import { useCallback } from 'react';

interface MCPRequest {
  method: string;
  params?: any;
}

interface MCPResponse {
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

export function useMCPClient() {
  const { getToken } = useAuth();
  let requestId = 0;

  const call = useCallback(async (
    method: string,
    params?: any
  ): Promise<any> => {
    // Get fresh token
    const token = await getToken();

    if (!token) {
      throw new Error('Not authenticated');
    }

    // Make request
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_MCP_API_URL}/mcp`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: ++requestId,
          method,
          params,
        }),
      }
    );

    const result: MCPResponse = await response.json();

    if (result.error) {
      throw new Error(result.error.message);
    }

    return result.result;
  }, [getToken]);

  // Convenience methods
  const storeMemory = useCallback(
    async (content: string, type = 'MEMORY', importance = 'MEDIUM') => {
      return call('tools/call', {
        name: 'store_memory',
        arguments: { content, type, importance },
      });
    },
    [call]
  );

  const searchMemories = useCallback(
    async (query: string, limit = 10) => {
      return call('tools/call', {
        name: 'search_memories',
        arguments: { query, limit },
      });
    },
    [call]
  );

  return {
    call,
    storeMemory,
    searchMemories,
  };
}
```

### Using the Hook

`app/memories/page.tsx`:

```typescript
'use client';

import { useState } from 'react';
import { useMCPClient } from '@/hooks/useMCPClient';
import { SignedIn, SignedOut, SignInButton } from '@clerk/nextjs';

export default function MemoriesPage() {
  const mcp = useMCPClient();
  const [memory, setMemory] = useState('');
  const [results, setResults] = useState<any[]>([]);

  const handleStore = async () => {
    try {
      await mcp.storeMemory(memory);
      setMemory('');
      alert('Memory stored!');
    } catch (error) {
      console.error('Failed to store memory:', error);
    }
  };

  const handleSearch = async (query: string) => {
    try {
      const response = await mcp.searchMemories(query);
      setResults(JSON.parse(response.content[0].text).results);
    } catch (error) {
      console.error('Search failed:', error);
    }
  };

  return (
    <div>
      <SignedOut>
        <SignInButton mode="modal">
          <button>Sign In to Access Memories</button>
        </SignInButton>
      </SignedOut>

      <SignedIn>
        <h1>My Memories</h1>

        <div>
          <textarea
            value={memory}
            onChange={(e) => setMemory(e.target.value)}
            placeholder="Enter a memory..."
          />
          <button onClick={handleStore}>Store Memory</button>
        </div>

        <div>
          <input
            type="text"
            placeholder="Search memories..."
            onChange={(e) => handleSearch(e.target.value)}
          />

          <ul>
            {results.map((result) => (
              <li key={result.id}>{result.content}</li>
            ))}
          </ul>
        </div>
      </SignedIn>
    </div>
  );
}
```

### Server Actions (Alternative)

`app/actions/mcp.ts`:

```typescript
'use server';

import { auth } from '@clerk/nextjs';

export async function storeMemory(content: string) {
  const { getToken } = auth();
  const token = await getToken();

  const response = await fetch(`${process.env.MCP_API_URL}/mcp`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'tools/call',
      params: {
        name: 'store_memory',
        arguments: { content, type: 'MEMORY' },
      },
    }),
  });

  return response.json();
}
```

---

## React Integration

### Setup

#### 1. Install Clerk

```bash
npm install @clerk/clerk-react
```

#### 2. Configure Clerk Provider

`src/main.tsx` or `src/index.tsx`:

```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import { ClerkProvider } from '@clerk/clerk-react';
import App from './App';

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ClerkProvider publishableKey={clerkPubKey}>
      <App />
    </ClerkProvider>
  </React.StrictMode>
);
```

### MCP Client Context

`src/contexts/MCPContext.tsx`:

```typescript
import React, { createContext, useContext, useCallback } from 'react';
import { useAuth } from '@clerk/clerk-react';

interface MCPContextType {
  call: (method: string, params?: any) => Promise<any>;
  storeMemory: (content: string, type?: string) => Promise<any>;
  searchMemories: (query: string, limit?: number) => Promise<any>;
}

const MCPContext = createContext<MCPContextType | undefined>(undefined);

export function MCPProvider({ children }: { children: React.ReactNode }) {
  const { getToken } = useAuth();
  let requestId = 0;

  const call = useCallback(
    async (method: string, params?: any) => {
      const token = await getToken();

      const response = await fetch(
        `${import.meta.env.VITE_MCP_API_URL}/mcp`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: ++requestId,
            method,
            params,
          }),
        }
      );

      const result = await response.json();

      if (result.error) {
        throw new Error(result.error.message);
      }

      return result.result;
    },
    [getToken]
  );

  const storeMemory = useCallback(
    (content: string, type = 'MEMORY') =>
      call('tools/call', {
        name: 'store_memory',
        arguments: { content, type },
      }),
    [call]
  );

  const searchMemories = useCallback(
    (query: string, limit = 10) =>
      call('tools/call', {
        name: 'search_memories',
        arguments: { query, limit },
      }),
    [call]
  );

  return (
    <MCPContext.Provider value={{ call, storeMemory, searchMemories }}>
      {children}
    </MCPContext.Provider>
  );
}

export function useMCP() {
  const context = useContext(MCPContext);
  if (!context) {
    throw new Error('useMCP must be used within MCPProvider');
  }
  return context;
}
```

### Using the Context

`src/App.tsx`:

```typescript
import { SignedIn, SignedOut, SignInButton, UserButton } from '@clerk/clerk-react';
import { MCPProvider, useMCP } from './contexts/MCPContext';

function MemoryApp() {
  const mcp = useMCP();
  const [memory, setMemory] = React.useState('');

  const handleStore = async () => {
    try {
      await mcp.storeMemory(memory);
      setMemory('');
      alert('Memory stored!');
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div>
      <input
        value={memory}
        onChange={(e) => setMemory(e.target.value)}
      />
      <button onClick={handleStore}>Store</button>
    </div>
  );
}

export default function App() {
  return (
    <div>
      <SignedOut>
        <SignInButton mode="modal" />
      </SignedOut>

      <SignedIn>
        <UserButton />
        <MCPProvider>
          <MemoryApp />
        </MCPProvider>
      </SignedIn>
    </div>
  );
}
```

---

## Vanilla JavaScript

### Setup

#### 1. Include Clerk Script

```html
<!DOCTYPE html>
<html>
<head>
  <script
    async
    src="https://[your-frontend-api].clerk.accounts.dev/npm/@clerk/clerk-js@latest/dist/clerk.browser.js"
  ></script>
</head>
<body>
  <div id="app"></div>
  <script src="app.js"></script>
</body>
</html>
```

#### 2. Initialize Clerk

`app.js`:

```javascript
// Initialize Clerk
const clerk = window.Clerk;

await clerk.load({
  publishableKey: 'pk_live_Y2xlcmsuYWktbWVtb3J5LmFwcCQ',
});

// MCP Client
class MCPClient {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
    this.requestId = 0;
  }

  async call(method, params = {}) {
    // Get session token
    const token = await clerk.session.getToken();

    if (!token) {
      throw new Error('Not authenticated');
    }

    // Make request
    const response = await fetch(`${this.baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: ++this.requestId,
        method,
        params,
      }),
    });

    const result = await response.json();

    if (result.error) {
      throw new Error(result.error.message);
    }

    return result.result;
  }

  async storeMemory(content, type = 'MEMORY') {
    return this.call('tools/call', {
      name: 'store_memory',
      arguments: { content, type },
    });
  }

  async searchMemories(query, limit = 10) {
    return this.call('tools/call', {
      name: 'search_memories',
      arguments: { query, limit },
    });
  }
}

// Initialize MCP client
const mcp = new MCPClient('https://your-mcp-server.vercel.app');

// Use the client
document.getElementById('store-btn').addEventListener('click', async () => {
  const content = document.getElementById('memory-input').value;

  try {
    await mcp.storeMemory(content);
    alert('Memory stored!');
  } catch (error) {
    console.error('Error:', error);
  }
});
```

### Complete Example

```html
<!DOCTYPE html>
<html>
<head>
  <title>MCP Memory App</title>
  <script
    async
    src="https://[your-frontend-api].clerk.accounts.dev/npm/@clerk/clerk-js@latest/dist/clerk.browser.js"
  ></script>
</head>
<body>
  <div id="app">
    <div id="sign-in" style="display: none;">
      <h1>Welcome to MCP Memory</h1>
      <div id="clerk-signin"></div>
    </div>

    <div id="memory-app" style="display: none;">
      <h1>My Memories</h1>
      <div id="clerk-user-button"></div>

      <div>
        <input id="memory-input" type="text" placeholder="Enter memory..." />
        <button id="store-btn">Store</button>
      </div>

      <div>
        <input id="search-input" type="text" placeholder="Search..." />
        <div id="results"></div>
      </div>
    </div>
  </div>

  <script>
    const clerk = window.Clerk;

    window.addEventListener('load', async () => {
      await clerk.load({
        publishableKey: 'pk_live_...',
      });

      // Show appropriate UI
      if (clerk.user) {
        document.getElementById('memory-app').style.display = 'block';
        clerk.mountUserButton(document.getElementById('clerk-user-button'));
      } else {
        document.getElementById('sign-in').style.display = 'block';
        clerk.mountSignIn(document.getElementById('clerk-signin'));
      }

      // MCP Client
      const mcp = new MCPClient('https://your-mcp-server.vercel.app');

      // Event listeners
      document.getElementById('store-btn').addEventListener('click', async () => {
        const content = document.getElementById('memory-input').value;
        await mcp.storeMemory(content);
        document.getElementById('memory-input').value = '';
      });

      document.getElementById('search-input').addEventListener('input', async (e) => {
        const results = await mcp.searchMemories(e.target.value);
        displayResults(results);
      });
    });

    function displayResults(results) {
      const resultsDiv = document.getElementById('results');
      const data = JSON.parse(results.content[0].text);

      resultsDiv.innerHTML = data.results
        .map(r => `<div>${r.content}</div>`)
        .join('');
    }
  </script>
</body>
</html>
```

---

## React Native

### Setup

#### 1. Install Clerk

```bash
npm install @clerk/clerk-expo
```

#### 2. Configure Clerk

`App.tsx`:

```typescript
import { ClerkProvider } from '@clerk/clerk-expo';
import * as SecureStore from 'expo-secure-store';

const tokenCache = {
  async getToken(key: string) {
    return SecureStore.getItemAsync(key);
  },
  async saveToken(key: string, value: string) {
    return SecureStore.setItemAsync(key, value);
  },
};

export default function App() {
  return (
    <ClerkProvider
      publishableKey="pk_live_..."
      tokenCache={tokenCache}
    >
      <RootNavigator />
    </ClerkProvider>
  );
}
```

### MCP Client Hook

`hooks/useMCPClient.ts`:

```typescript
import { useAuth } from '@clerk/clerk-expo';
import { useCallback } from 'react';

const MCP_API_URL = 'https://your-mcp-server.vercel.app';

export function useMCPClient() {
  const { getToken } = useAuth();
  let requestId = 0;

  const call = useCallback(async (method: string, params?: any) => {
    const token = await getToken();

    const response = await fetch(`${MCP_API_URL}/mcp`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: ++requestId,
        method,
        params,
      }),
    });

    const result = await response.json();

    if (result.error) {
      throw new Error(result.error.message);
    }

    return result.result;
  }, [getToken]);

  const storeMemory = useCallback(
    async (content: string, type = 'MEMORY') => {
      return call('tools/call', {
        name: 'store_memory',
        arguments: { content, type },
      });
    },
    [call]
  );

  const searchMemories = useCallback(
    async (query: string, limit = 10) => {
      return call('tools/call', {
        name: 'search_memories',
        arguments: { query, limit },
      });
    },
    [call]
  );

  return { call, storeMemory, searchMemories };
}
```

### Using in Component

```typescript
import React, { useState } from 'react';
import { View, TextInput, Button, FlatList, Text } from 'react-native';
import { SignedIn, SignedOut, useUser } from '@clerk/clerk-expo';
import { useMCPClient } from '../hooks/useMCPClient';

export default function MemoriesScreen() {
  const mcp = useMCPClient();
  const { user } = useUser();
  const [memory, setMemory] = useState('');
  const [results, setResults] = useState([]);

  const handleStore = async () => {
    try {
      await mcp.storeMemory(memory);
      setMemory('');
      alert('Memory stored!');
    } catch (error) {
      console.error(error);
    }
  };

  const handleSearch = async (query: string) => {
    try {
      const response = await mcp.searchMemories(query);
      const data = JSON.parse(response.content[0].text);
      setResults(data.results);
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <View>
      <SignedOut>
        <Text>Please sign in</Text>
      </SignedOut>

      <SignedIn>
        <Text>Welcome {user?.firstName}!</Text>

        <TextInput
          value={memory}
          onChangeText={setMemory}
          placeholder="Enter memory..."
        />
        <Button title="Store" onPress={handleStore} />

        <TextInput
          placeholder="Search..."
          onChangeText={handleSearch}
        />

        <FlatList
          data={results}
          renderItem={({ item }) => (
            <Text>{item.content}</Text>
          )}
          keyExtractor={(item) => item.id}
        />
      </SignedIn>
    </View>
  );
}
```

---

## Token Management

### Token Refresh

Clerk automatically handles token refresh:

```typescript
// Clerk refreshes tokens automatically
const token = await getToken();

// Token is always fresh and valid
// No manual refresh needed
```

### Token Caching

```typescript
// Clerk caches tokens in memory
// Subsequent calls are fast
const token1 = await getToken(); // API call
const token2 = await getToken(); // Cached
```

### Manual Token Refresh

```typescript
// Force token refresh
const token = await getToken({ skipCache: true });
```

### Token Expiration Handling

```typescript
async function callWithRetry(fn: () => Promise<any>, retries = 1) {
  try {
    return await fn();
  } catch (error) {
    if (error.code === -32001 && retries > 0) {
      // Token expired, get fresh token and retry
      const token = await getToken({ skipCache: true });
      return callWithRetry(fn, retries - 1);
    }
    throw error;
  }
}
```

---

## Error Handling

### Error Types

```typescript
interface MCPError {
  code: number;
  message: string;
  data?: any;
}

// Common error codes
const ERROR_CODES = {
  AUTHENTICATION_REQUIRED: -32001,
  RATE_LIMIT_EXCEEDED: 429,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
};
```

### Retry Logic

```typescript
async function callWithRetry(
  fn: () => Promise<any>,
  maxRetries = 3,
  baseDelay = 1000
) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;

      // Exponential backoff
      const delay = baseDelay * Math.pow(2, i);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}
```

### Rate Limit Handling

```typescript
async function handleRateLimit(error: any) {
  if (error.code === 429) {
    const retryAfter = error.data?.retryAfter || 60;

    // Wait before retrying
    await new Promise(resolve =>
      setTimeout(resolve, retryAfter * 1000)
    );

    // Retry request
    return callWithRetry(/* ... */);
  }

  throw error;
}
```

### User-Friendly Error Messages

```typescript
function getErrorMessage(error: any): string {
  switch (error.code) {
    case -32001:
      return 'Please sign in to continue';
    case 429:
      return 'Too many requests. Please try again later.';
    case -32602:
      return 'Invalid input. Please check your data.';
    default:
      return 'An unexpected error occurred. Please try again.';
  }
}
```

---

## Best Practices

### 1. Security

```typescript
// ✅ Always use HTTPS
const MCP_API_URL = 'https://your-server.vercel.app';

// ✅ Never log tokens
console.log('Token:', token); // ❌ DON'T DO THIS

// ✅ Validate on server, not client
// Server validates every request
```

### 2. Performance

```typescript
// ✅ Batch requests when possible
const [memories, entities] = await Promise.all([
  mcp.searchMemories('query'),
  mcp.searchEntities('query'),
]);

// ✅ Implement debouncing for search
const debouncedSearch = useMemo(
  () => debounce((query) => mcp.searchMemories(query), 300),
  [mcp]
);
```

### 3. Error Handling

```typescript
// ✅ Always handle errors
try {
  await mcp.storeMemory(content);
} catch (error) {
  console.error('Failed to store memory:', error);
  showErrorToUser(getErrorMessage(error));
}

// ✅ Implement retry logic
const result = await callWithRetry(() => mcp.searchMemories(query));
```

### 4. User Experience

```typescript
// ✅ Show loading states
const [loading, setLoading] = useState(false);

const handleStore = async () => {
  setLoading(true);
  try {
    await mcp.storeMemory(memory);
  } finally {
    setLoading(false);
  }
};

// ✅ Provide feedback
toast.success('Memory stored successfully!');
```

### 5. Type Safety

```typescript
// ✅ Use TypeScript interfaces
interface Memory {
  id: string;
  content: string;
  type: 'SYSTEM' | 'LEARNED' | 'MEMORY';
  importance: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

// ✅ Type your MCP responses
const response = await mcp.searchMemories(query);
const data: { results: Memory[] } = JSON.parse(
  response.content[0].text
);
```

---

## Example Projects

### Minimal Next.js Example

See `examples/nextjs-minimal` in the repository for a complete working example.

### React SPA Example

See `examples/react-spa` for a single-page application implementation.

### React Native Example

See `examples/react-native` for a mobile app implementation.

---

## Troubleshooting

### Common Issues

#### "Not authenticated" Error

```typescript
// Ensure user is signed in
const { isSignedIn } = useAuth();

if (!isSignedIn) {
  return <SignInButton />;
}
```

#### CORS Errors

```typescript
// Verify MCP server CORS configuration
// Should include your app's domain
CORS_ORIGIN=https://your-app.com
```

#### Token Expired

```typescript
// Get fresh token
const token = await getToken({ skipCache: true });
```

---

## Additional Resources

- [OAuth Setup Guide](./OAUTH_SETUP.md)
- [API Reference](./OAUTH_API_REFERENCE.md)
- [Deployment Guide](./OAUTH_DEPLOYMENT.md)
- [Clerk Documentation](https://clerk.com/docs)
- [Test Report](./TEST-REPORT.md) - 95.2% coverage

---

**Last Updated:** 2025-10-01
**Version:** 1.1.2
**Client SDK Support:** Next.js, React, Vanilla JS, React Native
