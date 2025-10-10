# Changeset Guide - MCP Memory TypeScript

Automated versioning and changelog generation using [Changesets](https://github.com/changesets/changesets).

## Table of Contents

- [Overview](#overview)
- [Quick Start](#quick-start)
- [Creating Changesets](#creating-changesets)
- [Version Bump Types](#version-bump-types)
- [Release Workflow](#release-workflow)
- [CI/CD Integration](#cicd-integration)
- [Migration from Manual Versioning](#migration-from-manual-versioning)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

## Overview

Changesets provide an automated way to manage versions and changelogs across the project. When you make changes, you create a "changeset" that describes what changed and what version bump is needed (patch, minor, or major). When ready to release, changesets automatically:

- Bump version numbers according to semantic versioning
- Generate changelog entries
- Update package.json
- Prepare for npm publication

## Quick Start

### Creating a Changeset

After making changes to the codebase:

```bash
# Interactive CLI to create a changeset
npm run changeset:add

# Follow the prompts:
# 1. Select version bump type (patch/minor/major)
# 2. Write a summary of the changes
# 3. Review the generated changeset
```

### Releasing a New Version

When ready to publish:

```bash
# 1. Update version and generate changelog
npm run changeset:version

# 2. Review changes to package.json and CHANGELOG.md

# 3. Build, test, and publish
npm run release
```

## Creating Changesets

### Interactive Mode (Recommended)

```bash
npm run changeset:add
```

**Prompts you will see:**
1. **Which packages would you like to include?** - Select `mcp-memory-ts` (already selected by default)
2. **What kind of change is this?** - Choose patch/minor/major
3. **Summarize the changes** - Write a clear description

**Example interaction:**
```
🦋  Which packages would you like to include?
   ✓ mcp-memory-ts

🦋  What kind of change is this for mcp-memory-ts?
   ○ patch (bug fixes, no API changes)
   ● minor (new features, backwards compatible)
   ○ major (breaking changes)

🦋  Please enter a summary for this change (this will be in the changelog):
   Add Google Calendar sync with week-based event tracking
```

### Manual Changeset Creation

Alternatively, create a file in `.changeset/` manually:

```bash
# Create a new changeset file
touch .changeset/gentle-pandas-jump.md
```

**File format:**
```markdown
---
"mcp-memory-ts": minor
---

Add Google Calendar sync with week-based event tracking

- Implement calendar event extraction
- Add week-based caching
- Support entity creation from attendees
```

## Version Bump Types

Follow [Semantic Versioning](https://semver.org/):

### Patch (x.x.X)

**When:** Bug fixes, documentation updates, minor improvements
**Example:** Fixing a bug in contact sync, updating docs

```bash
# Changeset summary examples
- Fix null ID handling in database operations
- Update CHANGESET_GUIDE.md with examples
- Improve error messages in CLI
```

### Minor (x.X.x)

**When:** New features, backwards-compatible additions
**Example:** Adding Google Calendar sync, new CLI command

```bash
# Changeset summary examples
- Add Google Calendar sync functionality
- Implement LLM deduplication for contacts
- Add new CLI command for Gmail extraction
```

### Major (X.x.x)

**When:** Breaking changes, incompatible API changes
**Example:** Database schema changes requiring migration, API redesign

```bash
# Changeset summary examples
- BREAKING: Redesign MCP tool interface
- BREAKING: Change database schema (requires migration)
- BREAKING: Remove deprecated API endpoints
```

## Release Workflow

### Standard Release Process

```bash
# 1. Create changesets for all unreleased changes
npm run changeset:add

# 2. Check status of pending changesets
npm run changeset:status

# 3. Update versions and generate changelog
npm run changeset:version

# 4. Review generated changes
git diff package.json CHANGELOG.md

# 5. Commit version changes
git add .
git commit -m "chore: release version X.Y.Z"

# 6. Build, test, and publish (includes pre-deploy tests)
npm run release

# 7. Push to git with tags
git push origin main --follow-tags
```

### Pre-Release Process

For beta or release candidate versions:

```bash
# Create changeset with pre-release tag
npm run changeset:add

# Version with prerelease
npm run changeset:version -- --snapshot beta

# Publish with tag
npm publish --tag beta
```

## CI/CD Integration

### GitHub Actions Example

Create `.github/workflows/release.yml`:

```yaml
name: Release

on:
  push:
    branches:
      - main

jobs:
  release:
    name: Release
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v3
        with:
          fetch-depth: 0

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: 18
          registry-url: 'https://registry.npmjs.org'

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build-full

      - name: Create Release Pull Request or Publish
        uses: changesets/action@v1
        with:
          publish: npm run changeset:publish
          version: npm run changeset:version
          commit: 'chore: release version'
          title: 'chore: release version'
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
```

### Manual Release Checks

Before publishing, always:

```bash
# 1. Run full test suite
npm run pre-deploy

# 2. Verify schema
npm run verify:schema

# 3. Check build output
npm run build-full

# 4. Test CLI installation
npm link
mcp-memory --help
```

## Migration from Manual Versioning

The project previously used `scripts/manage_version.py` for version management. Here's how to transition:

### Differences

| Manual Versioning | Changesets |
|------------------|------------|
| `python scripts/manage_version.py bump patch` | `npm run changeset:add` → select patch |
| Manual CHANGELOG.md updates | Automatic changelog generation |
| Manual version.txt management | Automatic package.json updates |
| Single script execution | Two-step process (add → version) |

### When to Use Manual Script

The `manage_version.py` script may still be useful for:
- Emergency hotfixes without changesets
- Scripted version bumps in CI/CD
- Special versioning scenarios

### Transitioning

1. **For existing unreleased changes:**
   ```bash
   # Create changesets for all pending changes
   npm run changeset:add
   ```

2. **For future changes:**
   - Always create a changeset when making changes
   - Use changesets for all version management
   - Keep `manage_version.py` as backup

## Best Practices

### Writing Good Changeset Summaries

**Good examples:**
```markdown
- Add Google Calendar sync with week-based caching
- Fix database connection timeout in production
- Improve CLI error messages for invalid credentials
```

**Bad examples:**
```markdown
- Fix bug (too vague)
- Update code (not descriptive)
- Changes (no information)
```

### Multiple Changesets

For large releases with multiple features:

```bash
# Create separate changesets for each feature
npm run changeset:add  # Feature A
npm run changeset:add  # Feature B
npm run changeset:add  # Bug fix

# All changesets will be combined when versioning
npm run changeset:version
```

### Changeset Workflow Best Practices

1. **Create changesets with your PR** - Don't wait until release time
2. **One changeset per logical change** - Separate features, bugs, etc.
3. **Write clear summaries** - Think about what users need to know
4. **Review generated changelog** - Ensure it makes sense before publishing
5. **Test before publishing** - Always run `npm run pre-deploy`

### Version Strategy

- **Patch releases**: Weekly or as needed for critical bugs
- **Minor releases**: Monthly for new features
- **Major releases**: Quarterly or when breaking changes are necessary

## Troubleshooting

### No Changesets to Release

**Error:**
```
🦋  No changesets found
```

**Solution:**
```bash
# Create a changeset
npm run changeset:add
```

### Changeset Already Exists for Changes

**Error:**
```
🦋  You already have changesets that will be released
```

**Solution:**
This is informational - proceed with versioning:
```bash
npm run changeset:version
```

### Version Conflict

**Error:**
```
Version conflict in package.json
```

**Solution:**
```bash
# Resolve conflicts manually
git checkout package.json
npm run changeset:version
```

### NPM Publish Fails

**Error:**
```
npm ERR! 403 Forbidden
```

**Solution:**
```bash
# Check npm authentication
npm whoami

# Login if needed
npm login

# Verify package.json has correct access
# "access": "public" in changeset config
```

### Dry Run for Testing

Test versioning without making changes:

```bash
# Preview what would change
npm run changeset:status --verbose

# Or manually check
cat .changeset/*.md
```

## Advanced Usage

### Snapshot Releases

Create temporary versions for testing:

```bash
# Create snapshot version
npm run changeset:version -- --snapshot

# Example: 1.6.0-snapshot-20231009
```

### Ignore Specific Changes

Add to `.changeset/config.json`:

```json
{
  "ignore": ["web", "docs"]
}
```

### Custom Changelog Format

Modify `.changeset/config.json`:

```json
{
  "changelog": ["@changesets/changelog-github", { "repo": "bobmatnyc/mcp-memory-ts" }]
}
```

Requires installation:
```bash
npm install -D @changesets/changelog-github
```

## Integration with Existing Tools

### Pre-Deploy Script

The `release` script automatically runs pre-deploy tests:

```bash
npm run release
# Runs: npm run pre-deploy && changeset publish
```

### Version Verification

After versioning, verify changes:

```bash
# Check updated version
node -p "require('./package.json').version"

# Verify changelog
cat CHANGELOG.md | head -20

# Check git diff
git diff package.json CHANGELOG.md
```

## Complete Example Workflow

Here's a complete example from feature to release:

```bash
# 1. Develop new feature
git checkout -b feature/google-calendar-sync

# 2. Make changes
# ... code changes ...

# 3. Create changeset
npm run changeset:add
# Select: minor
# Summary: "Add Google Calendar sync with week-based event tracking"

# 4. Commit with changeset
git add .
git commit -m "feat: add Google Calendar sync"

# 5. Push and create PR
git push origin feature/google-calendar-sync

# 6. After PR merge to main
git checkout main
git pull

# 7. Check pending changesets
npm run changeset:status

# 8. Update version and changelog
npm run changeset:version

# 9. Review generated changes
git diff

# 10. Commit version bump
git add .
git commit -m "chore: release v1.7.0"

# 11. Build, test, and publish
npm run release

# 12. Push with tags
git push origin main --follow-tags

# 13. Create GitHub release
gh release create v1.7.0 --generate-notes
```

## Resources

- [Changesets Documentation](https://github.com/changesets/changesets)
- [Semantic Versioning](https://semver.org/)
- [MCP Memory CLAUDE.md](../../CLAUDE.md) - Project instructions
- [Deployment Guide](../../DEPLOYMENT.md) - Deployment procedures

## Support

For issues or questions:
- Create an issue: https://github.com/bobmatnyc/mcp-memory-ts/issues
- Review existing changesets: `.changeset/`
- Check configuration: `.changeset/config.json`
