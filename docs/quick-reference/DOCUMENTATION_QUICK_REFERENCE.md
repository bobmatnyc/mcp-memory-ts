# Documentation Quick Reference

**Last Updated**: 2025-10-20

This guide helps you quickly find the documentation you need in the newly organized structure.

## 🚀 Quick Links

### Getting Started
- [Main README](./README.md) - Project overview
- [Quick Start Guide](./docs/guides/quick-start/QUICK_START_GUIDE.md) - Get started quickly
- [CLI Guide](./docs/guides/CLI-GUIDE.md) - Command-line tool documentation
- [Deployment Guide](./DEPLOYMENT.md) - Main deployment documentation

### Feature Documentation
- [Web Interface](./docs/features/WEB_INTERFACE.md) - Web UI documentation
- [Google Sync](./docs/features/GOOGLE_SYNC.md) - Google integration overview
- [Google Integration Index](./docs/features/google/INDEX.md) - Complete Google docs
- [Gmail Integration Index](./docs/features/gmail/INDEX.md) - Gmail extraction docs
- [Batch Sync Index](./docs/features/batch-sync/INDEX.md) - Batch processing docs

### Guides by Topic
- [Google Contacts Sync](./docs/guides/GOOGLE_CONTACTS_SYNC_GUIDE.md) - User guide for Google Contacts
- [Google Calendar Sync](./docs/guides/GOOGLE_CALENDAR_SYNC_GUIDE.md) - User guide for Google Calendar
- [Google Setup](./docs/guides/GOOGLE_SETUP_GUIDE.md) - Google Cloud setup
- [Log Level Configuration](./docs/guides/LOG_LEVEL_GUIDE.md) - Control log verbosity
- [Changesets](./docs/guides/CHANGESET_GUIDE.md) - Version management

### Developer Documentation
- [Deployment Index](./docs/deployment/INDEX.md) - All deployment documentation
- [Testing Index](./docs/testing/INDEX.md) - All testing documentation
- [Schema Migrations Index](./docs/schema/migrations/INDEX.md) - Database migrations
- [Security Documentation](./docs/security/README.md) - Security guides
- [Test Scripts](./scripts/test/README.md) - Manual test scripts

## 📁 Directory Structure

```
docs/
├── deployment/          # Deployment guides and reports (INDEX.md)
├── testing/            # Testing and QA documentation (INDEX.md)
├── features/           # Feature-specific documentation
│   ├── google/         # Google integration (INDEX.md)
│   ├── gmail/          # Gmail extraction (INDEX.md)
│   ├── batch-sync/     # Batch processing (INDEX.md)
│   ├── async-embedding/
│   └── week-selector/
├── guides/             # User guides
│   ├── logging/        # Logging configuration
│   └── quick-start/    # Quick start guides
├── schema/             # Database schema documentation
│   └── migrations/     # Migration docs (INDEX.md)
├── security/           # Security and authentication
├── api/                # API documentation
└── _archive/           # Archived documentation

scripts/
└── test/               # Test scripts (README.md)

tmp/
└── _cleanup/           # Temporary cleanup results
```

## 🔍 Finding Documentation by Topic

### Deployment
**Location**: `docs/deployment/`
**Index**: [docs/deployment/INDEX.md](./docs/deployment/INDEX.md)

Topics covered:
- Production deployment procedures
- Vercel deployment
- Feature-specific deployments
- Deployment verification
- Infrastructure configuration

### Testing
**Location**: `docs/testing/`
**Index**: [docs/testing/INDEX.md](./docs/testing/INDEX.md)

Topics covered:
- Test reports and verification
- Security testing
- Feature testing (OAuth, Google, Gmail)
- Data quality and database testing
- Investigation reports

### Google Integration
**Location**: `docs/features/google/`
**Index**: [docs/features/google/INDEX.md](./docs/features/google/INDEX.md)

Topics covered:
- OAuth authentication
- Google Contacts sync
- Google Calendar sync
- Error handling
- Logging and debugging

### Gmail Integration
**Location**: `docs/features/gmail/`
**Index**: [docs/features/gmail/INDEX.md](./docs/features/gmail/INDEX.md)

Topics covered:
- Gmail extraction implementation
- Token management
- Retry logic
- Development status

### Batch Sync
**Location**: `docs/features/batch-sync/`
**Index**: [docs/features/batch-sync/INDEX.md](./docs/features/batch-sync/INDEX.md)

Topics covered:
- Batch processing implementation
- Progress tracking
- Error handling
- Performance optimization

### Database Migrations
**Location**: `docs/schema/migrations/`
**Index**: [docs/schema/migrations/INDEX.md](./docs/schema/migrations/INDEX.md)

Topics covered:
- Schema migrations
- User ID migrations
- NULL ID recovery
- Migration procedures

### Security
**Location**: `docs/security/`
**Index**: [docs/security/README.md](./docs/security/README.md)

Topics covered:
- Clerk authentication
- OAuth implementation
- Security fixes and patches
- User isolation

### Logging
**Location**: `docs/guides/logging/`

Topics covered:
- Log level configuration
- Smart logging implementation
- Logging best practices
- Debug procedures

## 🛠️ Common Tasks

### Running Tests
```bash
# Automated tests
npm test
npm run test:coverage
npm run pre-deploy

# Manual test scripts
cd scripts/test
./TEST_ALL_GOOGLE_ROUTES.sh
./test-security-fixes.sh
```

See: [Test Scripts README](./scripts/test/README.md)

### Running Migrations
```bash
# Schema migration
npm run migrate:schema:dry-run  # Preview
npm run migrate:schema          # Execute
npm run verify:schema           # Verify

# Fix NULL IDs
npm run fix-null-ids -- --dry-run
npm run fix-null-ids
```

See: [Schema Migrations Index](./docs/schema/migrations/INDEX.md)

### Deploying
```bash
# Build and test
npm run build-full
npm run pre-deploy

# Deploy to Vercel
vercel deploy
```

See: [Deployment Index](./docs/deployment/INDEX.md)

### Syncing Google Data
```bash
# Google Contacts
mcp-memory google contacts-sync --user-email user@example.com

# Google Calendar
mcp-memory google calendar-sync --user-email user@example.com
```

See: [Google Integration Index](./docs/features/google/INDEX.md)

## 📊 Documentation Statistics

- **Total documentation files**: 100+
- **Index files**: 7
- **Test scripts**: 8
- **User guides**: 10+
- **Feature documentation**: 30+
- **Testing reports**: 40+
- **Deployment guides**: 15+

## 🔄 Recent Changes

**2025-10-20**: Major documentation reorganization
- Organized 109+ files from root directory
- Created 7 comprehensive index files
- Moved test scripts to `scripts/test/`
- Added cross-references and navigation aids

See: [Documentation Organization Report](./DOCUMENTATION_ORGANIZATION_REPORT.md)

## 💡 Tips

1. **Start with INDEX.md files** - They provide comprehensive overviews
2. **Use search** - All documentation is markdown and easily searchable
3. **Check related docs** - Index files link to related documentation
4. **Follow the hierarchy** - Documentation structure matches project architecture
5. **Keep this updated** - Add new documentation to appropriate directories

## 🆘 Need Help?

If you can't find documentation:
1. Check the appropriate INDEX.md file
2. Search the `docs/` directory
3. Review this quick reference
4. Check the main README.md
5. Review CLAUDE.md for project instructions

## 📝 Contributing

When adding new documentation:
1. Place in appropriate `docs/` subdirectory
2. Update relevant INDEX.md file
3. Add cross-references to related docs
4. Follow existing naming conventions
5. Include "Last Updated" date

See: [Documentation Organization Report](./DOCUMENTATION_ORGANIZATION_REPORT.md) for guidelines

---

**Maintained By**: MCP Memory Development Team
**Documentation Structure**: v2.0 (2025-10-20)
