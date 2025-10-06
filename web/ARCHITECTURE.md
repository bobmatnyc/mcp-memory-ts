# MCP Memory Web Architecture

Technical architecture documentation for the Next.js web interface.

## System Overview

```
┌──────────────────────────────────────────────────────────────┐
│                     Browser (Client)                         │
│                                                              │
│  ┌────────────┐  ┌─────────────┐  ┌──────────────┐         │
│  │  Dashboard │  │  Memories   │  │  Auth Pages  │         │
│  └────────────┘  └─────────────┘  └──────────────┘         │
└────────────┬──────────────────────────────────┬─────────────┘
             │                                   │
             │ HTTP/HTTPS                       │ OAuth Flow
             │                                   │
┌────────────▼──────────────────────────────────▼─────────────┐
│                   Next.js Server (SSR)                       │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │             NextAuth Middleware                       │  │
│  │  • Session validation                                 │  │
│  │  • Route protection                                   │  │
│  │  • OAuth callback handling                           │  │
│  └────────────────┬─────────────────────────────────────┘  │
│                   │                                          │
│  ┌────────────────▼─────────────────────────────────────┐  │
│  │              API Routes (App Router)                  │  │
│  │  • /api/memories      - Memory CRUD                   │  │
│  │  • /api/entities      - Entity management             │  │
│  │  • /api/stats         - Statistics                    │  │
│  │  • /api/auth          - NextAuth endpoints            │  │
│  └────────────────┬─────────────────────────────────────┘  │
│                   │                                          │
│  ┌────────────────▼─────────────────────────────────────┐  │
│  │          MemoryCore Integration Layer                 │  │
│  │  • Singleton instance management                      │  │
│  │  • User context injection                             │  │
│  │  • Error handling & logging                           │  │
│  └────────────────┬─────────────────────────────────────┘  │
└───────────────────┼──────────────────────────────────────────┘
                    │
┌───────────────────▼──────────────────────────────────────────┐
│              MCP Memory Core (../src/core/)                  │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  MemoryCore Class                                     │  │
│  │  • Memory operations (CRUD)                           │  │
│  │  • Vector search (OpenAI embeddings)                  │  │
│  │  • Entity management                                  │  │
│  │  • Statistics & health checks                         │  │
│  └────────────────┬─────────────────────────────────────┘  │
└───────────────────┼──────────────────────────────────────────┘
                    │
┌───────────────────▼──────────────────────────────────────────┐
│              Turso/LibSQL Database                           │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Tables:                                              │  │
│  │  • users          - User accounts                     │  │
│  │  • memories       - Memory storage (with embeddings)  │  │
│  │  • entities       - People, orgs, projects            │  │
│  │  • interactions   - Conversation history              │  │
│  └──────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

## Technology Stack

### Frontend (Browser)

```typescript
// Next.js App Router (Client Components)
'use client'

export function MemoriesPage() {
  const [memories, setMemories] = useState([]);

  // Fetch from API routes
  const fetchMemories = async () => {
    const res = await fetch('/api/memories');
    const data = await res.json();
    setMemories(data.data);
  };

  return <MemoryList memories={memories} />;
}
```

**Technologies:**
- React 18 (Client Components)
- Tailwind CSS for styling
- shadcn/ui for components
- Lucide React for icons
- date-fns for dates

### Server-Side (Next.js)

```typescript
// API Route (Server Component)
export async function GET(request: NextRequest) {
  // 1. Validate session
  const userId = await getUserEmail();

  // 2. Get MemoryCore instance
  const memoryCore = await getMemoryCore();

  // 3. Execute operation with user context
  const result = await memoryCore.searchMemories(query, { userId });

  // 4. Return response
  return NextResponse.json({
    success: true,
    data: result.data
  });
}
```

**Technologies:**
- Next.js 14 App Router
- NextAuth.js for authentication
- Server-side rendering (SSR)
- API routes with type safety

### Backend Integration

```typescript
// MemoryCore Singleton
let memoryCoreInstance: MemoryCore | null = null;

export async function getMemoryCore(): Promise<MemoryCore> {
  if (!memoryCoreInstance) {
    const db = getDbConnection();
    const openaiApiKey = process.env.OPENAI_API_KEY;

    memoryCoreInstance = new MemoryCore(db, openaiApiKey);
    await memoryCoreInstance.initialize();
  }

  return memoryCoreInstance;
}
```

**Integration Points:**
- Reuses existing `MemoryCore` class
- Shares database connection
- Inherits vector search capabilities
- Maintains user isolation

## Authentication Flow

### Sign In Process

```
1. User clicks "Sign in with Google"
   │
   ▼
2. NextAuth redirects to Google OAuth
   │
   ▼
3. User authenticates with Google
   │
   ▼
4. Google redirects to /api/auth/callback/google
   │
   ▼
5. NextAuth validates OAuth response
   │
   ▼
6. signIn callback creates/updates user in database
   │
   ▼
7. Session cookie created
   │
   ▼
8. User redirected to /dashboard
```

### Session Management

```typescript
// NextAuth Configuration
export const authOptions: NextAuthOptions = {
  providers: [GoogleProvider(...)],
  callbacks: {
    async signIn({ user }) {
      // Ensure user exists in MCP Memory database
      await ensureUser(user.email, user.name);
      return true;
    },
    async session({ session, token }) {
      // Add user email to session
      session.user.email = token.email;
      return session;
    },
  },
};
```

### Route Protection

```typescript
// middleware.ts
export { default } from 'next-auth/middleware';

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/memories/:path*',
    '/api/memories/:path*',
    '/api/entities/:path*',
    '/api/stats/:path*'
  ],
};
```

## Data Flow

### Memory Creation Flow

```
1. User submits form
   │
   ▼
2. Client POST to /api/memories
   {
     title: "Memory title",
     content: "Content",
     memoryType: "MEMORY",
     importance: 0.7,
     tags: ["tag1"]
   }
   │
   ▼
3. API route validates session
   const userId = await getUserEmail();
   │
   ▼
4. MemoryCore processes request
   await memoryCore.addMemory(title, content, type, { userId });
   │
   ▼
5. Generate OpenAI embedding (async)
   embedding = await embeddings.generateEmbedding(text, userId);
   │
   ▼
6. Save to database with user_id
   INSERT INTO memories (id, user_id, title, content, embedding, ...)
   │
   ▼
7. Return response to client
   { success: true, data: { id, title, hasEmbedding } }
   │
   ▼
8. Client updates UI
   setMemories([...memories, newMemory]);
```

### Semantic Search Flow

```
1. User enters search query
   │
   ▼
2. Client POST to /api/memories/search
   { query: "search term", limit: 10 }
   │
   ▼
3. API route validates session
   │
   ▼
4. Generate query embedding
   queryEmbedding = await embeddings.generateEmbedding(query, userId);
   │
   ▼
5. Vector search in database
   SELECT *, vector_distance(embedding, ?) as similarity
   FROM memories
   WHERE user_id = ?
   ORDER BY similarity
   LIMIT ?
   │
   ▼
6. Fallback to text search if needed
   SELECT * FROM memories
   WHERE user_id = ? AND (title LIKE ? OR content LIKE ?)
   │
   ▼
7. Merge and rank results
   results = [...vectorResults, ...textResults].slice(0, limit);
   │
   ▼
8. Return ranked results
   { success: true, data: results, message: "Found X memories" }
```

## Security Model

### Multi-Tenant Isolation

```typescript
// EVERY database operation MUST include userId

// ✅ CORRECT
const memories = await memoryCore.searchMemories(query, { userId });

// ❌ WRONG - allows cross-user access
const memories = await memoryCore.searchMemories(query);

// Database Level
SELECT * FROM memories WHERE user_id = ? AND ...

// API Level
const userId = await getUserEmail();  // From session
await memoryCore.operation(..., { userId });

// Middleware Level
export const config = {
  matcher: ['/dashboard/:path*', '/memories/:path*']
};
```

### Session Security

```typescript
// Session cookie configuration (NextAuth)
cookies: {
  sessionToken: {
    name: '__Secure-next-auth.session-token',
    options: {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      secure: true // HTTPS only in production
    }
  }
}
```

### API Security

```typescript
// Every API route follows this pattern:

export async function GET(request: NextRequest) {
  try {
    // 1. Validate session (throws if not authenticated)
    const userId = await getUserEmail();

    // 2. Validate input
    const { searchParams } = request.nextUrl;
    const limit = parseInt(searchParams.get('limit') || '20');

    // 3. Execute with user context
    const result = await memoryCore.operation({ userId });

    // 4. Return success
    return NextResponse.json({ success: true, data: result.data });

  } catch (error: any) {
    // 5. Handle errors securely
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 401 }
    );
  }
}
```

## Performance Optimizations

### Server-Side Caching

```typescript
// Singleton MemoryCore instance
let memoryCoreInstance: MemoryCore | null = null;

export async function getMemoryCore(): Promise<MemoryCore> {
  if (!memoryCoreInstance) {
    memoryCoreInstance = new MemoryCore(db, openaiApiKey);
    await memoryCoreInstance.initialize();
  }
  return memoryCoreInstance;
}

// Database connection pooling (LibSQL handles this)
const client = createClient({
  url: process.env.TURSO_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});
```

### Client-Side Optimizations

```typescript
// React Query patterns
const [memories, setMemories] = useState([]);
const [loading, setLoading] = useState(true);

useEffect(() => {
  fetchMemories();
}, []); // Only fetch once on mount

// Optimistic updates
const handleDelete = async (id: string) => {
  // Optimistic UI update
  setMemories(memories.filter(m => m.id !== id));

  try {
    await fetch(`/api/memories/${id}`, { method: 'DELETE' });
  } catch (error) {
    // Rollback on error
    fetchMemories();
  }
};
```

### Next.js Optimizations

```typescript
// next.config.mjs
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
};

// Automatic code splitting (App Router)
// Each route only loads its required code
```

## Error Handling

### Client-Side

```typescript
try {
  const response = await fetch('/api/memories', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error('Failed to create memory');
  }

  const result = await response.json();
  // Handle success

} catch (error) {
  console.error('Error:', error);
  alert('Failed to create memory');
}
```

### Server-Side

```typescript
export async function POST(request: NextRequest) {
  try {
    const userId = await getUserEmail();
    // ... operation

    return NextResponse.json({ success: true, data });

  } catch (error: any) {
    console.error('API error:', error);

    // Determine appropriate status code
    const status = error.message.includes('Unauthorized') ? 401
                 : error.message.includes('Not found') ? 404
                 : 400;

    return NextResponse.json(
      { success: false, error: error.message },
      { status }
    );
  }
}
```

## Deployment Architecture

### Development

```
┌─────────────────┐
│  localhost:3000 │  Next.js Dev Server
│                 │  • Hot reload
│                 │  • Source maps
│                 │  • Debug mode
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Turso Database │  Development instance
└─────────────────┘
```

### Production

```
┌──────────────────┐
│   Vercel/Server  │  Next.js Production
│                  │  • Static optimization
│                  │  • Edge functions
│                  │  • CDN caching
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  Turso Database  │  Production instance
│                  │  • Connection pooling
│                  │  • Auto-scaling
└──────────────────┘
```

## Monitoring & Logging

### Application Logging

```typescript
// Development
if (process.env.MCP_DEBUG) {
  console.error(`[VectorSearch] Found ${results.length} results`);
}

// Production
try {
  await operation();
} catch (error) {
  console.error('Operation failed:', {
    error: error.message,
    userId,
    timestamp: new Date().toISOString(),
  });
}
```

### Performance Monitoring

```typescript
// API route timing
const start = Date.now();
const result = await memoryCore.searchMemories(query, { userId });
const duration = Date.now() - start;

console.log(`Search completed in ${duration}ms`);
```

## Testing Strategy

### Unit Tests (Future)

```typescript
// Test API routes
describe('GET /api/memories', () => {
  it('requires authentication', async () => {
    const res = await GET(mockRequest);
    expect(res.status).toBe(401);
  });

  it('returns user memories only', async () => {
    const res = await GET(mockAuthenticatedRequest);
    const data = await res.json();
    expect(data.data.every(m => m.userId === 'test-user')).toBe(true);
  });
});
```

### Integration Tests (Future)

```typescript
// Test full flow
describe('Memory creation flow', () => {
  it('creates memory with embedding', async () => {
    const memory = await createMemory({
      title: 'Test',
      content: 'Content',
    });

    expect(memory.hasEmbedding).toBe(true);
    expect(memory.id).toBeDefined();
  });
});
```

## Future Enhancements

1. **Real-time Updates**: WebSocket integration for live updates
2. **Offline Support**: Service worker for offline functionality
3. **Advanced Search**: Faceted search, filters, date ranges
4. **Bulk Operations**: Batch create/update/delete
5. **Export/Import**: JSON/CSV export, import from files
6. **Analytics**: Usage tracking, search analytics
7. **Collaboration**: Shared memories, teams
8. **Mobile App**: React Native mobile client

## References

- [Next.js Documentation](https://nextjs.org/docs)
- [NextAuth.js Documentation](https://next-auth.js.org/)
- [MCP Memory Core](../src/core/memory-core.ts)
- [Database Schema](../src/database/schema.ts)

---

**Last Updated**: 2025-01-15
**Version**: 1.3.0
