# MCP Memory TypeScript - Master Development Plan

**Project**: mcp-memory-ts
**Version**: 2.0.0 (Unified Architecture)
**Status**: Planning
**Last Updated**: 2025-10-02

---

## Vision

Transform mcp-memory-ts into a unified, flexible memory management platform that supports:

1. **Local Installation** - CLI tools and local web service
2. **Cloud Service** - ai-memory.app with OAuth and API key management
3. **Multiple Modes** - Direct DB, API-first, and embedded replica support
4. **Centralized Secrets** - API keys (OpenAI, etc.) stored in Clerk profiles

---

## Current State (v1.1.3)

### ✅ Completed
- Multi-tenant memory system with Turso database
- Clerk OAuth authentication for remote MCP server
- vCard import/export CLI functionality
- Direct database access from all components
- MCP server (stdio and HTTP modes)
- Basic API endpoints in Vercel

### ⚠️ Limitations
- Database credentials distributed to all clients
- OpenAI API keys exposed to all installations
- No centralized monitoring or audit logging
- No connection abstraction layer
- Difficult to scale or add caching
- No local web service option

---

## Target Architecture (v2.0.0)

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Unified Codebase                          │
│                      (Single npm Package)                        │
└────────────┬──────────────┬──────────────┬──────────────────────┘
             │              │              │
    ┌────────▼────────┐ ┌──▼──────────┐ ┌─▼──────────────────┐
    │  CLI Tools      │ │ Local Web   │ │ Cloud Service      │
    │  mcp-memory     │ │ Service     │ │ ai-memory.app      │
    │  (global npm)   │ │ localhost   │ │ (Vercel)           │
    └────────┬────────┘ └──┬──────────┘ └─┬──────────────────┘
             │              │              │
             └──────────────┴──────────────┘
                            │
          ┌─────────────────▼──────────────────┐
          │   Connection Adapter (Mode Switch) │
          └─────────────────┬──────────────────┘
                            │
         ┌──────────────────┼──────────────────┐
         │                  │                  │
    ┌────▼─────┐    ┌──────▼──────┐    ┌─────▼─────────┐
    │ Direct   │    │ API Backend │    │ Embedded      │
    │ (Turso)  │    │ (REST API)  │    │ (Future)      │
    └──────────┘    └──────┬──────┘    └───────────────┘
                           │
                    ┌──────▼──────────────────┐
                    │  API Gateway            │
                    │  - Auth (Clerk/Keys)    │
                    │  - User Keys Storage    │
                    │  - Caching (Redis)      │
                    │  - Rate Limiting        │
                    │  - Audit Logging        │
                    └──────┬──────────────────┘
                           │
                    ┌──────▼──────┐
                    │   Turso DB  │
                    └─────────────┘
```

### Three Operating Modes

#### Mode 1: Direct Database Access
**Use Case**: Trusted environments, maximum performance
**Who**: Local development, Claude Desktop users, internal tools
**Credentials**: Direct Turso URL + auth token

```bash
# Configuration
export MCP_MODE=direct
export TURSO_URL=libsql://...
export TURSO_AUTH_TOKEN=...

# Usage
mcp-memory store "Important note"
mcp-memory search "find this"
```

#### Mode 2: API-First (Primary)
**Use Case**: Production deployments, untrusted clients
**Who**: Web apps, mobile apps, third-party integrations
**Credentials**: API URL + API key (from ai-memory.app)

```bash
# Configuration
export MCP_MODE=api
export API_URL=https://api.ai-memory.app
export API_KEY=mcp_sk_xxxxx

# Usage (same commands, different backend)
mcp-memory store "Important note"
mcp-memory search "find this"
```

#### Mode 3: Embedded Replica (Future)
**Use Case**: Offline-first applications
**Who**: Mobile apps, edge deployments
**Credentials**: Sync token for cloud replica

---

## Implementation Phases

### Phase 1: Foundation & Abstraction (Week 1-2)

**Goal**: Create connection adapter layer and unified configuration system

#### Epic 1.1: Connection Adapter Pattern
- [ ] Create `IMemoryBackend` interface
- [ ] Implement `DirectBackend` (wrap existing code)
- [ ] Implement `APIBackend` (HTTP client)
- [ ] Add mode detection and configuration
- [ ] Update `MemoryCore` to use adapter
- [ ] Write unit tests for both backends

#### Epic 1.2: Configuration System
- [ ] Create unified config loader
- [ ] Support environment variables
- [ ] Support config files (.mcp-memory.json)
- [ ] Add config validation
- [ ] Create setup wizard (`mcp-memory init`)
- [ ] Document configuration options

**Deliverables**:
- ✅ Code works with both direct and API modes
- ✅ Configuration system in place
- ✅ Tests pass for both modes

---

### Phase 2: API Gateway & Cloud Service (Week 3-5)

**Goal**: Build production-ready API layer and deploy to ai-memory.app

#### Epic 2.1: REST API Server
- [ ] Create unified API server (Express/Fastify)
- [ ] Implement all memory operations as REST endpoints
  - POST /api/v1/memories (store)
  - GET /api/v1/memories/search (search)
  - GET /api/v1/memories/:id (get)
  - PUT /api/v1/memories/:id (update)
  - DELETE /api/v1/memories/:id (delete)
  - GET /api/v1/entities (list)
  - POST /api/v1/entities (create)
  - GET /api/v1/stats (statistics)
- [ ] Add OpenAPI/Swagger documentation
- [ ] Implement comprehensive error handling
- [ ] Add request/response logging

#### Epic 2.2: Authentication & Authorization
- [ ] API key generation and management
- [ ] Clerk integration for web login
- [ ] JWT token validation
- [ ] Rate limiting per user/API key
- [ ] Permission system (read/write/admin)
- [ ] Audit logging for all operations

#### Epic 2.3: User Secrets Management
- [ ] Store OpenAI API keys in Clerk user metadata
- [ ] Secure storage for other API keys (future: Anthropic, etc.)
- [ ] Key rotation support
- [ ] Usage tracking per key
- [ ] Cost tracking and limits
- [ ] Key validation on save

#### Epic 2.4: Caching & Performance
- [ ] Redis integration for caching
- [ ] Cache frequently accessed memories
- [ ] Cache user profiles and settings
- [ ] Cache vector embeddings
- [ ] Connection pooling
- [ ] Performance monitoring

#### Epic 2.5: Cloud Deployment (ai-memory.app)
- [ ] Vercel deployment configuration
- [ ] Environment variable management
- [ ] Database migration strategy
- [ ] Redis deployment (Upstash/Vercel KV)
- [ ] CDN setup for static assets
- [ ] Monitoring and alerting (Sentry/Datadog)

**Deliverables**:
- ✅ API deployed to ai-memory.app
- ✅ Web dashboard for API key management
- ✅ User secrets stored in Clerk
- ✅ Comprehensive API documentation

---

### Phase 3: Local Installation & CLI (Week 6-7)

**Goal**: Enable local npm install with CLI and web service

#### Epic 3.1: CLI Enhancement
- [ ] Improve CLI commands and UX
- [ ] Add interactive mode
- [ ] Progress indicators for long operations
- [ ] Colorized output
- [ ] Shell completion (bash/zsh)
- [ ] Man pages generation

#### Epic 3.2: Local Web Service
- [ ] Create local web server mode
- [ ] Simple web dashboard (localhost:8080)
- [ ] API explorer/playground
- [ ] Settings management UI
- [ ] Import/export tools
- [ ] Service management (start/stop/status)

#### Epic 3.3: Installation & Setup
- [ ] Global npm installation support
- [ ] Post-install setup wizard
- [ ] Service installer (systemd/launchd)
- [ ] Docker image for self-hosting
- [ ] Upgrade migration scripts
- [ ] Uninstall cleanup script

#### Epic 3.4: Local Caching
- [ ] SQLite cache for API mode
- [ ] Async write-through caching
- [ ] Offline queue for operations
- [ ] Sync status indicators
- [ ] Conflict resolution
- [ ] Cache management (size limits, cleanup)

**Deliverables**:
- ✅ `npm install -g mcp-memory-ts` works
- ✅ Local web service available
- ✅ Excellent CLI user experience
- ✅ Local caching for performance

---

### Phase 4: Integration & Migration (Week 8-9)

**Goal**: Ensure seamless integration with existing tools and migration path

#### Epic 4.1: MCP Server Updates
- [ ] Update stdio MCP server for new architecture
- [ ] Update HTTP MCP server
- [ ] Add mode selection to MCP config
- [ ] Backward compatibility for existing configs
- [ ] Migration guide for Claude Desktop users

#### Epic 4.2: Client SDKs
- [ ] TypeScript/JavaScript SDK
- [ ] Python SDK (future)
- [ ] Example integrations
- [ ] SDK documentation
- [ ] npm package for SDK

#### Epic 4.3: Migration Tools
- [ ] Database migration scripts
- [ ] Configuration migration tool
- [ ] API key migration from env to Clerk
- [ ] Data export/import utilities
- [ ] Migration documentation

#### Epic 4.4: Testing & QA
- [ ] Integration tests (all modes)
- [ ] End-to-end tests
- [ ] Performance benchmarks
- [ ] Security audit
- [ ] Load testing (API)
- [ ] Chaos engineering tests

**Deliverables**:
- ✅ Existing users can migrate smoothly
- ✅ All integration points work
- ✅ Comprehensive test coverage
- ✅ Security validated

---

### Phase 5: Documentation & Launch (Week 10)

**Goal**: Complete documentation and public launch

#### Epic 5.1: Documentation
- [ ] Architecture documentation
- [ ] API reference (OpenAPI)
- [ ] User guides
  - Installation guide
  - Configuration guide
  - Migration guide
  - API integration guide
- [ ] Developer guides
  - Contributing guide
  - Architecture deep-dive
  - SDK development
- [ ] Video tutorials
- [ ] FAQ and troubleshooting

#### Epic 5.2: Website & Marketing
- [ ] Landing page for ai-memory.app
- [ ] Feature showcase
- [ ] Pricing page (if applicable)
- [ ] Blog posts
- [ ] Twitter/social media presence
- [ ] GitHub README update

#### Epic 5.3: Launch Preparation
- [ ] Beta testing program
- [ ] Bug bounty program
- [ ] Support channels (Discord/GitHub Discussions)
- [ ] Monitoring dashboards
- [ ] Incident response plan
- [ ] Backup and recovery procedures

#### Epic 5.4: Release
- [ ] npm publish v2.0.0
- [ ] GitHub release with notes
- [ ] Vercel production deployment
- [ ] Announcement posts
- [ ] Monitor launch metrics
- [ ] Address feedback and issues

**Deliverables**:
- ✅ v2.0.0 published and deployed
- ✅ Complete documentation
- ✅ Public launch announced
- ✅ Support channels active

---

## Technical Specifications

### API Endpoints (v1)

```
Authentication:
  POST   /api/v1/auth/login          # Clerk OAuth login
  POST   /api/v1/auth/logout         # Logout
  POST   /api/v1/auth/refresh        # Refresh token
  GET    /api/v1/auth/me             # Current user info

API Keys:
  GET    /api/v1/keys                # List API keys
  POST   /api/v1/keys                # Create API key
  DELETE /api/v1/keys/:id            # Revoke API key
  PUT    /api/v1/keys/:id            # Update key (rotate)

User Secrets:
  GET    /api/v1/secrets             # List user secrets
  PUT    /api/v1/secrets/openai      # Store OpenAI key
  DELETE /api/v1/secrets/:provider   # Delete secret
  POST   /api/v1/secrets/validate    # Validate secret

Memories:
  POST   /api/v1/memories            # Store memory
  GET    /api/v1/memories            # List memories
  GET    /api/v1/memories/search     # Search memories
  GET    /api/v1/memories/:id        # Get memory
  PUT    /api/v1/memories/:id        # Update memory
  DELETE /api/v1/memories/:id        # Delete memory

Entities:
  GET    /api/v1/entities            # List entities
  POST   /api/v1/entities            # Create entity
  GET    /api/v1/entities/:id        # Get entity
  PUT    /api/v1/entities/:id        # Update entity
  DELETE /api/v1/entities/:id        # Delete entity

Statistics:
  GET    /api/v1/stats               # Usage statistics
  GET    /api/v1/stats/costs         # Cost tracking
  GET    /api/v1/health              # Health check
```

### Configuration Schema

```typescript
interface MCPMemoryConfig {
  // Mode selection
  mode: 'direct' | 'api' | 'embedded';

  // Direct mode config
  direct?: {
    tursoUrl: string;
    tursoAuthToken: string;
    openaiKey?: string;
  };

  // API mode config
  api?: {
    url: string;
    key: string;
    cache?: {
      enabled: boolean;
      storage: 'sqlite' | 'memory';
      ttl: number;
    };
  };

  // Embedded mode config (future)
  embedded?: {
    syncUrl: string;
    syncToken: string;
    localPath: string;
  };

  // Common settings
  logging?: {
    level: 'debug' | 'info' | 'warn' | 'error';
    destination: 'console' | 'file';
    file?: string;
  };
}
```

### Package Structure

```
mcp-memory-ts/
├── src/
│   ├── core/
│   │   ├── interfaces/
│   │   │   └── memory-backend.ts      # IMemoryBackend interface
│   │   ├── backends/
│   │   │   ├── direct-backend.ts      # Direct Turso connection
│   │   │   ├── api-backend.ts         # API client
│   │   │   └── embedded-backend.ts    # Future: local replica
│   │   ├── memory-manager.ts          # Main manager class
│   │   └── config/
│   │       ├── loader.ts              # Config loading logic
│   │       └── validator.ts           # Config validation
│   │
│   ├── api/
│   │   ├── server.ts                  # Main API server
│   │   ├── routes/
│   │   │   ├── auth.ts                # Authentication routes
│   │   │   ├── keys.ts                # API key routes
│   │   │   ├── secrets.ts             # User secrets routes
│   │   │   ├── memories.ts            # Memory routes
│   │   │   ├── entities.ts            # Entity routes
│   │   │   └── stats.ts               # Statistics routes
│   │   ├── middleware/
│   │   │   ├── auth.ts                # Auth middleware
│   │   │   ├── rate-limit.ts          # Rate limiting
│   │   │   ├── audit-log.ts           # Audit logging
│   │   │   └── error-handler.ts       # Error handling
│   │   └── services/
│   │       ├── key-manager.ts         # API key management
│   │       ├── secrets-manager.ts     # User secrets storage
│   │       └── cache-manager.ts       # Caching logic
│   │
│   ├── cli/
│   │   ├── index.ts                   # CLI entry point
│   │   ├── commands/
│   │   │   ├── init.ts                # Setup wizard
│   │   │   ├── serve.ts               # Local web service
│   │   │   ├── store.ts               # Store memory
│   │   │   ├── search.ts              # Search memories
│   │   │   ├── config.ts              # Config management
│   │   │   └── keys.ts                # API key management
│   │   └── ui/
│   │       ├── prompts.ts             # Interactive prompts
│   │       └── formatters.ts          # Output formatting
│   │
│   ├── web/
│   │   ├── server.ts                  # Local web server
│   │   ├── dashboard/                 # Web dashboard UI
│   │   └── public/                    # Static assets
│   │
│   ├── mcp/
│   │   ├── simple-mcp-server.ts       # Stdio MCP server
│   │   └── remote-mcp-server.ts       # HTTP MCP server
│   │
│   └── utils/
│       ├── logger.ts                  # Logging utility
│       ├── errors.ts                  # Error classes
│       └── validators.ts              # Input validation
│
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
│
├── docs/
│   ├── MASTER_PLAN.md                 # This file
│   ├── ARCHITECTURE.md                # Architecture docs
│   ├── API_REFERENCE.md               # API documentation
│   ├── USER_GUIDE.md                  # User guide
│   └── MIGRATION_GUIDE.md             # Migration guide
│
└── scripts/
    ├── setup.js                       # Post-install setup
    ├── migrate.js                     # Migration scripts
    └── build.js                       # Build scripts
```

---

## Success Metrics

### Technical Metrics
- [ ] API response time < 200ms (p95)
- [ ] 99.9% uptime for ai-memory.app
- [ ] Zero credential leaks in audit
- [ ] 90%+ test coverage
- [ ] <5 critical bugs in first month

### User Adoption
- [ ] 1000+ npm downloads in first month
- [ ] 100+ active API users
- [ ] 50+ GitHub stars
- [ ] 10+ community contributions

### Business Metrics
- [ ] API key management working
- [ ] User secrets storage validated
- [ ] Cost tracking accurate
- [ ] Support ticket resolution <24h

---

## Risk Management

### Technical Risks

**Risk**: Breaking changes for existing users
**Mitigation**: Backward compatibility layer, migration tools, clear documentation

**Risk**: Performance degradation in API mode
**Mitigation**: Caching, benchmarking, optimization before launch

**Risk**: Security vulnerabilities in API
**Mitigation**: Security audit, penetration testing, bug bounty program

**Risk**: Database migration failures
**Mitigation**: Comprehensive testing, rollback plan, backup procedures

### Operational Risks

**Risk**: Insufficient documentation
**Mitigation**: Technical writer, beta user feedback, video tutorials

**Risk**: Poor API adoption
**Mitigation**: Good SDKs, example apps, developer relations

**Risk**: Support overload
**Mitigation**: Good docs, FAQ, community channels, automated responses

---

## Dependencies

### External Services
- **Turso** - Primary database (already in use)
- **Clerk** - Authentication and user management (already in use)
- **Vercel** - Hosting for ai-memory.app (already in use)
- **Redis/Upstash** - Caching layer (new)
- **OpenAI** - Embeddings (already in use)
- **Sentry/Datadog** - Monitoring (new)

### Development Tools
- TypeScript, Node.js (already in use)
- Vitest for testing (already in use)
- Express/Fastify for API server (new)
- Commander.js for CLI (already in use)
- OpenAPI/Swagger (new)

---

## Timeline Summary

| Phase | Duration | Key Deliverables |
|-------|----------|------------------|
| 1. Foundation | 2 weeks | Connection adapter, config system |
| 2. API Gateway | 3 weeks | REST API, secrets management, ai-memory.app |
| 3. Local Install | 2 weeks | CLI, local web service, caching |
| 4. Integration | 2 weeks | MCP updates, SDKs, migration tools |
| 5. Launch | 1 week | Documentation, marketing, release |
| **Total** | **10 weeks** | **v2.0.0 Production Release** |

---

## Next Steps

1. **Review & Approve Plan** - Get stakeholder sign-off
2. **Create Tickets** - Break down epics into actionable tickets
3. **Set Up Project Board** - Use mcp-ticketer for tracking
4. **Assign Responsibilities** - Identify owners for each epic
5. **Begin Phase 1** - Start with connection adapter implementation

---

## Notes

- This plan assumes single developer working full-time equivalent
- Timeline can be compressed with additional contributors
- Some features may be deprioritized based on user feedback
- Regular reviews after each phase to adjust course
- Focus on shipping working software incrementally

---

**Document Status**: Draft v1.0
**Next Review**: After Phase 1 completion
**Owner**: Development Team
**Stakeholders**: Users, Contributors, Maintainers
