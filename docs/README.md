# Documentation Structure

This directory contains all project documentation for the MCP Memory TypeScript project.

## Directory Organization

### Root Documentation Files

The following documentation files should remain in the project root:
- **README.md** - Main project overview and quick start guide
- **CLAUDE.md** - Claude AI agent instructions and development guidelines
- **DEPLOYMENT.md** - Production deployment guide

All other documentation should be organized in subdirectories as described below.

### Documentation Categories

#### `/docs/guides/`
User-facing guides and how-to documentation:
- CLI usage guides
- Integration guides (Claude Desktop, OAuth, etc.)
- Migration guides
- Quick start tutorials
- Contact sync guides

**Add new guides here when creating:**
- Step-by-step tutorials
- Integration documentation
- User workflow guides

#### `/docs/testing/`
Test reports, QA documentation, and verification checklists:
- Test result reports (TEST_RESULTS_*.md)
- Test summaries (TEST_SUMMARY_*.md)
- Migration test reports
- QA test reports
- Verification checklists
- Configuration test results

**Add new test documentation here when:**
- Running comprehensive test suites
- Performing QA validation
- Creating test reports for releases
- Documenting configuration testing

#### `/docs/schema/`
Database schema documentation and analysis:
- Schema optimization guides
- Database schema analysis
- Migration documentation
- Schema design decisions

**Add new schema docs here when:**
- Modifying database schema
- Creating migration guides
- Analyzing schema performance
- Documenting database design

#### `/docs/security/`
Security reports, audits, and vulnerability documentation:
- Security fix reports
- Vulnerability assessments
- Security audit results
- Incident reports

**Add new security docs here when:**
- Fixing security vulnerabilities
- Performing security audits
- Documenting security incidents
- Creating security guidelines

#### `/docs/development/`
Internal development documentation:
- Architecture decisions
- Development workflows
- Code organization
- Internal APIs

#### `/docs/oauth/`
OAuth and authentication-specific documentation:
- OAuth setup guides
- Authentication flows
- Token management

#### `/docs/vcard/`
vCard integration documentation:
- vCard format specifications
- Import/export guides
- Contact sync documentation

#### `/docs/_archive/`
Historical documentation and deprecated guides:
- Old documentation versions
- Deprecated features
- Historical decisions

**Move docs here when:**
- Documentation becomes outdated
- Features are deprecated
- Keeping for historical reference

## Documentation Guidelines

### Naming Conventions

Use clear, descriptive names with appropriate prefixes:
- **Guides**: `[FEATURE]_GUIDE.md` (e.g., CLI_GUIDE.md, MIGRATION_GUIDE.md)
- **Reports**: `[TYPE]_REPORT.md` (e.g., QA_TEST_REPORT.md, SECURITY_FIX_REPORT.md)
- **Test Results**: `TEST_RESULTS_V[VERSION].md` or `[FEATURE]_TEST_RESULTS.md`
- **Checklists**: `[PURPOSE]_CHECKLIST.md` (e.g., VERIFICATION_CHECKLIST.md)

### File Placement Rules

1. **Never create documentation in project root** unless it's one of the three allowed files (README.md, CLAUDE.md, DEPLOYMENT.md)
2. **Use appropriate subdirectories** based on documentation type
3. **Archive outdated docs** instead of deleting them
4. **Group related documentation** in the same directory

### Version-Specific Documentation

For version-specific documentation (test reports, changelogs):
- Include version number in filename: `TEST_RESULTS_V1.3.0.md`
- Consider archiving older versions after new releases
- Keep only the latest 2-3 versions active

### Temporary Files

Temporary documentation and test files should NOT be committed:
- Test scripts in root: Use `/tools/` or `/tests/` directories
- Temporary reports: Create in appropriate subdirectory or don't commit
- Configuration tests: Place in `/docs/testing/` if needed for reference

The `.gitignore` file is configured to prevent accidental commits of:
- `/TEST_*.md` in root
- `/SECURITY_*.md` in root
- `/CHANGELOG-*.md` in root
- `/config-*.md` in root
- `/test-*.ts` and `/test-*.js` in root

## Contributing to Documentation

When adding new documentation:

1. **Determine the category** - Which subdirectory fits best?
2. **Check existing docs** - Is there similar documentation to follow?
3. **Follow naming conventions** - Use clear, consistent names
4. **Update this README** - If adding a new category or significant changes
5. **Link from main README** - If user-facing documentation

## Documentation Maintenance

### Regular Cleanup

Perform quarterly documentation audits:
- Archive outdated documentation
- Update version-specific docs
- Remove duplicate or redundant docs
- Verify all links are working

### Quality Standards

All documentation should:
- Be written in clear, concise English
- Include practical examples
- Stay up-to-date with code changes
- Follow markdown best practices
- Include a table of contents for long documents

## Quick Reference

| Documentation Type | Location | Example |
|-------------------|----------|---------|
| Main project docs | `/README.md`, `/CLAUDE.md`, `/DEPLOYMENT.md` | Main README |
| User guides | `/docs/guides/` | CLI_GUIDE.md |
| Test reports | `/docs/testing/` | QA_TEST_REPORT.md |
| Schema docs | `/docs/schema/` | SCHEMA_OPTIMIZATION_GUIDE.md |
| Security docs | `/docs/security/` | SECURITY_FIX_REPORT.md |
| Development docs | `/docs/development/` | Architecture decisions |
| Historical docs | `/docs/_archive/` | Deprecated guides |

---

**Last Updated**: 2025-10-03
**Maintained By**: Project maintainers
**Version**: 1.0.0
