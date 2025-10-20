# MCP Memory Web Interface

A modern Next.js web application for managing your MCP Memory service with OAuth authentication, semantic search, and a beautiful UI.

**Current Version**: 1.7.2
**Last Updated**: 2025-10-14
**Staging Port**: 3002 | **Production Port**: 3001

## Features

### Authentication & Security
- **Google OAuth** integration via NextAuth.js
- **Session-based authentication** with secure cookies
- **Multi-tenant isolation** - users can only access their own data
- **Protected routes** - all pages require authentication
- **Secure API endpoints** - user validation on every request

### Dashboard
- **Real-time statistics** - total memories, entities, interactions
- **Memory type breakdown** - visualize distribution
- **Embedding coverage** - track vector search health
- **Vector search status** - monitor semantic search capabilities

### Memory Management
- **Create memories** with rich metadata
  - Title, content, type (SYSTEM/LEARNED/MEMORY)
  - Importance level (0-100%)
  - Tags for organization
  - Custom metadata support
- **Semantic search** - find memories by meaning, not just keywords
- **List view** - paginated memory display with cards
- **Delete memories** - with confirmation dialog
- **Real-time updates** - instant refresh after operations

### User Experience
- **Responsive design** - works on desktop, tablet, mobile
- **Modern UI** - built with Tailwind CSS and shadcn/ui
- **Fast performance** - Next.js App Router optimization
- **Type-safe** - full TypeScript coverage
- **Accessible** - ARIA-compliant components

## Technology Stack

| Category | Technology |
|----------|-----------|
| **Framework** | Next.js 14 (App Router) |
| **Authentication** | NextAuth.js |
| **UI Library** | Tailwind CSS + shadcn/ui |
| **Database** | Turso/LibSQL (shared with backend) |
| **Vector Search** | OpenAI embeddings |
| **Language** | TypeScript (strict mode) |
| **Icons** | Lucide React |
| **Date Handling** | date-fns |

## Architecture

### Integration with MCP Memory Core

The web interface reuses existing MCP Memory infrastructure:

```
┌─────────────────────────────────────────┐
│          Next.js Web App                │
│  ┌─────────────────────────────────┐   │
│  │   API Routes (App Router)       │   │
│  │   - /api/memories               │   │
│  │   - /api/entities               │   │
│  │   - /api/stats                  │   │
│  └──────────┬──────────────────────┘   │
│             │                           │
│  ┌──────────▼──────────────────────┐   │
│  │   MemoryCore Integration        │   │
│  │   (from ../src/core/)           │   │
│  └──────────┬──────────────────────┘   │
│             │                           │
└─────────────┼───────────────────────────┘
              │
    ┌─────────▼─────────┐
    │  Turso Database   │
    │  (Shared LibSQL)  │
    └───────────────────┘
```

### Security Architecture

```
User Request
    │
    ▼
NextAuth Middleware (session check)
    │
    ▼
API Route Handler
    │
    ▼
getUserEmail() - Extract authenticated user
    │
    ▼
MemoryCore - Pass userId for isolation
    │
    ▼
Database - WHERE user_id = ?
```

**CRITICAL**: Every database operation includes `userId` filter to enforce multi-tenant isolation.

## Project Structure

```
web/
├── app/                           # Next.js App Router
│   ├── api/                      # API Routes
│   │   ├── auth/[...nextauth]/   # NextAuth endpoints
│   │   ├── memories/             # Memory CRUD
│   │   │   ├── route.ts          # GET, POST
│   │   │   ├── [id]/route.ts     # GET, PUT, DELETE
│   │   │   └── search/route.ts   # POST search
│   │   ├── entities/route.ts     # Entity operations
│   │   └── stats/route.ts        # Statistics
│   ├── auth/                     # Authentication pages
│   │   ├── signin/page.tsx       # Login page
│   │   └── error/page.tsx        # Error page
│   ├── dashboard/page.tsx        # Dashboard
│   ├── memories/page.tsx         # Memory management
│   ├── layout.tsx                # Root layout
│   ├── page.tsx                  # Home (redirects)
│   └── globals.css               # Global styles
│
├── components/                    # React Components
│   ├── layout/
│   │   └── navbar.tsx            # Navigation bar
│   ├── memories/
│   │   ├── create-memory-dialog.tsx
│   │   ├── memory-list.tsx
│   │   └── memory-search.tsx
│   ├── providers/
│   │   └── auth-provider.tsx     # Session provider
│   └── ui/                       # shadcn/ui components
│       ├── button.tsx
│       ├── card.tsx
│       ├── dialog.tsx
│       ├── input.tsx
│       ├── label.tsx
│       ├── select.tsx
│       ├── textarea.tsx
│       └── badge.tsx
│
├── lib/                          # Utilities
│   ├── auth.ts                   # Auth helpers
│   ├── db.ts                     # Database connection
│   ├── memory-client.ts          # MemoryCore singleton
│   └── utils.ts                  # UI utilities
│
├── middleware.ts                 # Auth middleware
├── next.config.mjs               # Next.js config
├── tailwind.config.ts            # Tailwind config
├── tsconfig.json                 # TypeScript config
├── package.json                  # Dependencies
├── README.md                     # Documentation
├── SETUP.md                      # Setup guide
└── .gitignore                    # Git ignore
```

## API Endpoints

All endpoints enforce authentication and user isolation.

### Memories

#### `GET /api/memories`
List memories for authenticated user.

**Query Parameters:**
- `limit` (optional): Number of results (default: 20)
- `query` (optional): Search query

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "title": "Memory title",
      "content": "Memory content",
      "memoryType": "MEMORY",
      "importance": 0.7,
      "tags": ["tag1", "tag2"],
      "createdAt": "2025-01-15T10:30:00Z",
      "updatedAt": "2025-01-15T10:30:00Z"
    }
  ],
  "message": "Found 1 memories"
}
```

#### `POST /api/memories`
Create a new memory.

**Request Body:**
```json
{
  "title": "New memory",
  "content": "Memory content",
  "memoryType": "MEMORY",
  "importance": 0.5,
  "tags": ["tag1", "tag2"],
  "metadata": {}
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "title": "New memory",
    "hasEmbedding": true
  },
  "message": "Memory added successfully"
}
```

#### `GET /api/memories/:id`
Get specific memory by ID.

#### `PUT /api/memories/:id`
Update memory.

**Request Body:**
```json
{
  "title": "Updated title",
  "content": "Updated content",
  "importance": 0.8,
  "tags": ["new-tag"]
}
```

#### `DELETE /api/memories/:id`
Delete memory.

#### `POST /api/memories/search`
Semantic search.

**Request Body:**
```json
{
  "query": "search term",
  "limit": 10,
  "threshold": 0.3,
  "strategy": "composite"
}
```

### Entities

#### `GET /api/entities`
List entities.

**Query Parameters:**
- `query` (optional): Search query
- `limit` (optional): Number of results (default: 50)

#### `POST /api/entities`
Create entity.

**Request Body:**
```json
{
  "name": "John Doe",
  "entityType": "PERSON",
  "description": "Description",
  "importance": "MEDIUM",
  "tags": ["tag1"]
}
```

### Statistics

#### `GET /api/stats`
Get user statistics.

**Response:**
```json
{
  "success": true,
  "data": {
    "totalMemories": 42,
    "totalEntities": 15,
    "memoriesByType": {
      "MEMORY": 30,
      "SYSTEM": 5,
      "LEARNED": 7
    },
    "entitiesByType": {
      "PERSON": 10,
      "ORGANIZATION": 3,
      "PROJECT": 2
    },
    "memoriesWithEmbeddings": 40,
    "embeddingCoverage": "95%",
    "vectorSearchHealth": {
      "enabled": true,
      "memoriesWithValidEmbeddings": 40,
      "memoriesWithoutEmbeddings": 2,
      "coveragePercentage": 95,
      "recommendation": "Vector search coverage is healthy"
    }
  }
}
```

## Quick Start

### 1. Install Dependencies

```bash
cd web
npm install
```

### 2. Configure Environment

Create `web/.env.local`:

```env
# Database (from parent project)
TURSO_URL=libsql://your-database.turso.io
TURSO_AUTH_TOKEN=your-auth-token

# OpenAI
OPENAI_API_KEY=your-openai-api-key

# NextAuth
NEXTAUTH_URL=http://localhost:3002  # Port 3002 for staging, 3001 for production
NEXTAUTH_SECRET=your-random-secret  # Generate with: openssl rand -base64 32

# Google OAuth
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
```

### 3. Run Development Server

```bash
npm run dev
```

Open the web interface:
- **Staging**: [http://localhost:3002](http://localhost:3002) (via ./START_WEB_SERVER.sh)
- **Production**: [http://localhost:3001](http://localhost:3001) (via PM2)

## Development Workflow

### From Root Directory

```bash
# Install web dependencies
npm run web:install

# Start development server
npm run web:dev

# Build for production
npm run web:build

# Start production server
npm run web:start
```

### From Web Directory

```bash
cd web

# Development
npm run dev

# Production
npm run build
npm start

# Type check
npm run type-check

# Lint
npm run lint
```

## Deployment

See [SETUP.md](./web/SETUP.md) for detailed deployment instructions.

### Vercel (Recommended)

```bash
cd web
vercel
```

### Docker

```bash
cd web
docker build -t mcp-memory-web .
docker run -p 3000:3000 --env-file .env.local mcp-memory-web
```

### Traditional Server

```bash
cd web
npm run build
NODE_ENV=production npm start
```

## Security Best Practices

1. **Environment Variables**
   - Never commit `.env.local` to git
   - Use strong, random `NEXTAUTH_SECRET` (32+ characters)
   - Rotate secrets regularly

2. **OAuth Configuration**
   - Exact redirect URI match required
   - Use HTTPS in production
   - Limit OAuth scopes to minimum needed

3. **User Isolation**
   - Every API call validates session
   - Every database query includes `userId` filter
   - No cross-user data access possible

4. **API Security**
   - All routes protected by middleware
   - Session-based authentication
   - CSRF protection via NextAuth

## Troubleshooting

### Common Issues

1. **"Failed to connect to database"**
   - Check `TURSO_URL` and `TURSO_AUTH_TOKEN`
   - Verify network access to Turso

2. **"OAuth error: invalid_client"**
   - Verify Google OAuth credentials
   - Check redirect URI matches exactly

3. **"NextAuth configuration error"**
   - Generate new `NEXTAUTH_SECRET`
   - Verify `NEXTAUTH_URL` is correct

4. **API returns 401**
   - Clear cookies and sign in again
   - Check session is valid

See [SETUP.md](./web/SETUP.md) for detailed troubleshooting.

## Contributing

1. Fork the repository
2. Create feature branch
3. Make changes
4. Test thoroughly
5. Submit pull request

## License

MIT - Same as parent MCP Memory TypeScript project

## Support

- Documentation: See `web/README.md` and `web/SETUP.md`
- Issues: GitHub Issues
- Parent Project: See main `README.md` and `CLAUDE.md`

## Screenshots

### Dashboard
![Dashboard showing statistics and health metrics]

### Memory Management
![Memory list with search and create dialog]

### Semantic Search
![Search interface with results]

---

**Built with Next.js 14, NextAuth.js, and Tailwind CSS**
**Integrates seamlessly with MCP Memory TypeScript core**
