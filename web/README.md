# MCP Memory Web Interface

Next.js web application for managing MCP Memory TypeScript service.

## Features

- **OAuth Authentication**: Secure Google OAuth login with NextAuth.js
- **Dashboard**: Overview of statistics, memory types, and vector search health
- **Memory Management**: Create, view, search, and delete memories
- **Semantic Search**: Full-text and vector-based semantic search
- **User Isolation**: Multi-tenant architecture with strict user data separation

## Getting Started

### Prerequisites

- Node.js 18+
- MCP Memory TypeScript backend configured
- Google OAuth credentials

### Environment Setup

Create `.env.local` file:

```env
# Database (from parent project)
TURSO_URL=libsql://your-database.turso.io
TURSO_AUTH_TOKEN=your-auth-token

# OpenAI
OPENAI_API_KEY=your-openai-api-key

# NextAuth.js
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-random-secret

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

### Installation

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
web/
├── app/                    # Next.js App Router
│   ├── api/               # API Routes
│   │   ├── auth/          # NextAuth endpoints
│   │   ├── memories/      # Memory CRUD endpoints
│   │   ├── entities/      # Entity endpoints
│   │   └── stats/         # Statistics endpoint
│   ├── auth/              # Auth pages
│   ├── dashboard/         # Dashboard page
│   ├── memories/          # Memories management page
│   └── layout.tsx         # Root layout
├── components/            # React components
│   ├── layout/           # Layout components
│   ├── memories/         # Memory-specific components
│   ├── providers/        # Context providers
│   └── ui/               # shadcn/ui components
├── lib/                   # Utilities
│   ├── auth.ts           # Auth helpers
│   ├── db.ts             # Database connection
│   ├── memory-client.ts  # MemoryCore integration
│   └── utils.ts          # General utilities
└── package.json
```

## API Endpoints

All endpoints require authentication.

### Memories

- `GET /api/memories` - List memories (with optional query parameter)
- `POST /api/memories` - Create memory
- `GET /api/memories/:id` - Get memory by ID
- `PUT /api/memories/:id` - Update memory
- `DELETE /api/memories/:id` - Delete memory
- `POST /api/memories/search` - Semantic search

### Entities

- `GET /api/entities` - List entities
- `POST /api/entities` - Create entity

### Statistics

- `GET /api/stats` - Get user statistics

## Security

- All routes protected by NextAuth.js middleware
- User isolation enforced at database level
- Session-based authentication
- OAuth 2.0 with Google

## Technology Stack

- **Framework**: Next.js 14 (App Router)
- **Authentication**: NextAuth.js
- **UI**: Tailwind CSS + shadcn/ui
- **Database**: Turso/LibSQL (via parent project)
- **Vector Search**: OpenAI embeddings
- **TypeScript**: Strict mode enabled

## Development

```bash
# Type check
npm run type-check

# Lint
npm run lint
```

## Integration with MCP Memory

This web interface integrates with the existing MCP Memory TypeScript core:

- Reuses `MemoryCore` from `src/core/memory-core.ts`
- Shares database connection via `@libsql/client`
- Enforces same user isolation patterns
- Uses identical vector search capabilities

## License

MIT
