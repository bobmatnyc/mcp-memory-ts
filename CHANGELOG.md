# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.3.0] - 2025-10-06

### Added
- **Bidirectional Contacts Sync**: Full synchronization between MCP Memory and macOS Contacts
- **LLM-Based Deduplication**: Intelligent duplicate detection using ChatGPT-4 (gpt-4o) with confidence scores
- **UID-Based Matching**: X-MCP-UUID field in vCards for reliable contact tracking
- **Configurable Conflict Resolution**: Multiple strategies (newest/oldest/merge) for handling conflicts
- **Next.js Web Interface**: Modern web application in `web/` directory for visual memory management
- **Clerk Authentication**: Multi-user authentication and session management for web interface
- **Enhanced Deployment Options**: Comprehensive deployment comparison guide with multiple hosting strategies
- New CLI command: `mcp-memory contacts sync` with options:
  - `--auto-merge`: Automatically merge duplicates above confidence threshold
  - `--threshold <number>`: Set deduplication confidence threshold (0-100)
  - `--no-llm`: Disable LLM and use rule-based matching only
  - `--direction [export|import|both]`: Control synchronization direction
- New CLI command structure: `mcp-memory vcard export/import` (restructured from v1.2.0)
- Advanced contact matching algorithms with intelligent conflict resolution
- Performance optimizations: batch processing and increased buffer limits
- Comprehensive contacts sync guide and performance optimization documentation

### Changed
- Restructured CLI vCard commands from standalone to nested under `vcard` namespace
- Auto-load configuration from `~/.mcp-memory/config.json` for CLI operations
- Improved documentation organization with categorized docs in `docs/` directory
- Enhanced test coverage with comprehensive test results in `docs/testing/`

### Fixed
- Configuration loading issues inherited from v1.2.1
- CLI command parsing and execution flow
- Contact synchronization edge cases and error handling

## [1.2.1] - 2025-10-03

### Security
- **CRITICAL SECURITY PATCH**: Fixed severe user data isolation vulnerabilities in multi-tenant operations
- Fixed `getEntityById` to require and validate user ownership (Breaking Change)
- Fixed `getMemoryById` to require and validate user ownership (Breaking Change)
- Fixed `updateEntity` to enforce user authorization checks (Breaking Change)
- Added comprehensive user isolation test suite (`scripts/test-user-isolation.ts`)
- Created security fix report with detailed vulnerability analysis (`docs/security/SECURITY_FIX_REPORT.md`)

### Changed
- **BREAKING**: `getEntityById(id, userId)` - now requires `userId` parameter (was `getEntityById(id)`)
- **BREAKING**: `getMemoryById(id, userId)` - now requires `userId` parameter (was `getMemoryById(id)`)
- **BREAKING**: `updateEntity(id, updates, userId)` - now requires `userId` parameter (was `updateEntity(id, updates)`)
- Enhanced database query-level user validation for complete data isolation

### Fixed
- Cross-user data access vulnerabilities that allowed unauthorized access to entities and memories
- Multi-tenant security enforcement across all database operations

**Impact**: Before this patch, users could access/modify other users' data by ID. This release enforces complete user isolation at the database query level.

**Recommendation**: All users should update immediately to protect data privacy.

## [1.2.0] - 2025-10-03

### Added
- **macOS Contacts Integration**: Native integration with macOS Contacts app
- vCard export functionality: `mcp-memory export-vcard`
- vCard import functionality: `mcp-memory import-vcard`
- Contact entity mapping with comprehensive vCard field support
- Contact parsing and generation utilities

### Changed
- Enhanced entity management to support contact synchronization
- Improved CLI architecture for contact operations

### Security
- Initial user isolation improvements for multi-tenant security
- Enhanced authentication and authorization checks

## [1.1.9] - 2025-09-XX

### Changed
- **CLI Architecture Refactor**: Migrated to action-first command pattern for better UX
- Improved command routing and error handling in CLI

## [1.1.8] - 2025-09-XX

### Fixed
- Dynamic CLI version import from `package.json` for accurate version reporting
- CLI version consistency across builds

## [1.1.7] - 2025-09-XX

### Fixed
- Schema initialization process for new database setups
- Removed invalid database indexes causing initialization failures
- Database schema validation and error handling

### Changed
- Cleaned up project structure and organized documentation
- Improved `.gitignore` patterns for development files

## [1.1.6] - 2025-09-XX

### Added
- **Comprehensive CLI Tool**: Full-featured command-line interface for MCP Memory management
- **Interactive Configuration Wizard**: `mcp-memory init` for guided setup
- **Claude Desktop Integration**: Automated installation with `mcp-memory install`
- **Installation Status Check**: `mcp-memory status` command
- **Configuration Updates**: `mcp-memory update` for Claude Desktop config management
- **Schema Migration Tools**: Migration scripts with dry-run support in `scripts/` directory
- Schema optimization for improved query performance
- Migration rollback capabilities

### Changed
- Enhanced CLI with comprehensive help documentation
- Improved error messages and user guidance
- Better validation for database operations

## [1.1.5] - 2025-09-XX

### Fixed
- Metadata handling and validation improvements
- Search result quality and relevance enhancements

## [1.1.4] - 2025-09-XX

### Fixed
- Enhanced embedding generation reliability
- Improved error recovery for OpenAI API failures

## [1.1.3] - 2025-09-XX

### Added
- **Enhanced Semantic Search**: Transparent similarity scoring in search results
- **Lower Similarity Threshold**: Reduced to 0.3 for better recall
- Comprehensive feature documentation and usage demonstrations

### Changed
- Improved search result ranking and relevance
- Enhanced search transparency with similarity scores displayed to users

## [1.1.2] - 2025-09-XX

### Added
- **Automatic Embedding Generation**: New memories automatically get vector embeddings
- **Embedding Update Triggers**: Automatic regeneration when content changes
- Enhanced metadata support across all memory types

### Fixed
- Tags storage format for proper array handling
- Embedding regeneration script for existing memories

## [1.1.1] - 2025-09-XX

### Fixed
- Metadata field handling in database queries
- Search strategy improvements for metadata filtering
- Embedding generation edge cases

## [1.1.0] - 2025-09-XX

### Added
- **Embedding Monitor**: Automatic detection and regeneration of missing embeddings
- **Temporal Decay**: Time-based relevance scoring for search results
- **Semantic Memory Linking**: Advanced relationship detection between memories
- Environment variable: `ENABLE_EMBEDDING_MONITOR` (default: true)
- Environment variable: `EMBEDDING_MONITOR_INTERVAL` (default: 60000ms)

### Fixed
- Critical MCP data corruption issues in `getMemory` operation
- Validation errors for edge cases in memory operations
- Metadata search functionality

## [1.0.2] - 2025-08-XX

### Fixed
- Critical data integrity issues in database operations
- Transaction handling for multi-step operations
- Error handling and rollback mechanisms

## [1.0.1] - 2025-08-XX

### Added
- Google OAuth login with Clerk authentication
- Memory display UI for web interface
- Vercel deployment configuration

### Fixed
- JSON-RPC protocol compliance for Claude Desktop integration
- Tool interface compatibility issues
- All JSON-RPC responses now include valid IDs

## [1.0.0] - 2025-08-XX

### Added
- **Initial Release**: Complete TypeScript port of MCP Memory Service
- **MCP Protocol Implementation**: Full compliance with Model Context Protocol specification
- **Vector Search**: Semantic similarity search using OpenAI embeddings (text-embedding-3-small)
- **Multi-Tenant Database**: Turso/LibSQL cloud database with user isolation
- **3-Tier Memory System**:
  - SYSTEM tier: Core functionality and configurations
  - LEARNED tier: Extracted patterns and insights
  - MEMORY tier: User data and interactions
- **Entity Management**: Support for people, organizations, and projects
- **Relationship Tracking**: Links between entities and memories
- **Interaction History**: Conversation context storage
- **MCP Tools**: Complete set of memory operations via MCP protocol
- **TypeScript**: Full type safety with strict mode
- **Testing**: Comprehensive test suite with Vitest
- **Documentation**: Complete API and usage documentation

### Technical Features
- JSON-RPC 2.0 compliant MCP server
- SQLite vector embeddings with libsql
- OpenAI Embeddings API integration
- ESM modules with ES2022 target
- Regression testing infrastructure
- Environment-based configuration

---

## Version Comparison

### Security Updates
- **v1.2.1**: Critical user isolation vulnerabilities fixed (REQUIRED UPDATE)
- **v1.0.1**: Initial security implementation with Clerk

### Feature Milestones
- **v1.3.0**: Contacts sync, web interface, multi-user support
- **v1.2.0**: macOS Contacts integration, vCard support
- **v1.1.6**: CLI tool with Claude Desktop automation
- **v1.1.0**: Automatic embedding generation and monitoring
- **v1.0.0**: Initial stable release with MCP protocol

### Performance Improvements
- **v1.3.0**: Batch processing optimizations for contacts sync
- **v1.1.6**: Schema optimizations for query performance
- **v1.1.3**: Lower similarity threshold (0.3) for better search recall
- **v1.1.0**: Temporal decay for time-based relevance

---

## Migration Guides

### Upgrading to v1.3.0
1. Review deployment options in [DEPLOYMENT_COMPARISON.md](./docs/deployment/DEPLOYMENT_COMPARISON.md)
2. For web interface: Follow [WEB_INTERFACE.md](./docs/features/WEB_INTERFACE.md)
3. For Clerk auth: See [CLERK_IMPLEMENTATION_NOTES.md](./docs/security/CLERK_IMPLEMENTATION_NOTES.md)
4. For contacts sync: Read [CONTACTS_SYNC_QUICK_START.md](./docs/guides/CONTACTS_SYNC_QUICK_START.md)

### Upgrading to v1.2.1
**CRITICAL**: This is a security patch. Update immediately.
- Breaking API changes require `userId` parameter in `getEntityById`, `getMemoryById`, and `updateEntity`
- Update all callers to pass `userId` for user validation
- Run security test suite: `tsx scripts/test-user-isolation.ts`

### Upgrading to v1.1.6
1. Run schema migration dry-run: `npm run migrate:schema:dry-run`
2. Review migration plan and backup recommendations
3. Execute migration: `npm run migrate:schema`
4. Verify schema: `npm run verify:schema`

### Upgrading from v1.0.x
- Enable embedding monitor in environment: `ENABLE_EMBEDDING_MONITOR=true`
- Regenerate embeddings for existing memories (automatic on first run)
- Update similarity threshold settings if using custom values

---

## Links

- [Repository](https://github.com/yourusername/mcp-memory-ts)
- [NPM Package](https://www.npmjs.com/package/mcp-memory-ts)
- [Documentation](./docs/README.md)
- [Issue Tracker](https://github.com/yourusername/mcp-memory-ts/issues)

---

**Note**: Dates marked with "XX" indicate the specific day was not recorded in git history.
