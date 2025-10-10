# Changeset Quick Reference

Quick reference for version management using changesets.

## Common Commands

```bash
# Create a changeset
npm run changeset:add

# Check status
npm run changeset:status

# Update version and changelog
npm run changeset:version

# Release to npm
npm run release
```

## Version Types

| Type | When to Use | Example |
|------|-------------|---------|
| **patch** | Bug fixes, docs | 1.6.0 → 1.6.1 |
| **minor** | New features | 1.6.0 → 1.7.0 |
| **major** | Breaking changes | 1.6.0 → 2.0.0 |

## Standard Workflow

```bash
# 1. Make changes and create changeset
git checkout -b feature/my-feature
# ... make changes ...
npm run changeset:add

# 2. Commit with changeset
git add .
git commit -m "feat: add my feature"

# 3. Push and create PR
git push origin feature/my-feature

# 4. After merge, release (on main)
git checkout main
git pull
npm run changeset:version
git add .
git commit -m "chore: release vX.Y.Z"
npm run release
git push --follow-tags
```

## Changeset Format

```markdown
---
"mcp-memory-ts": minor
---

Brief summary of changes

- Bullet point details
- More details
- Feature highlights
```

## Integration with Existing Workflow

| Old Way | New Way |
|---------|---------|
| `python scripts/manage_version.py bump patch` | `npm run changeset:add` (select patch) |
| Manual CHANGELOG.md | Automatic via `changeset:version` |
| Manual package.json | Automatic via `changeset:version` |
| `npm publish` | `npm run release` |

## Configuration

`.changeset/config.json`:
```json
{
  "access": "public",
  "baseBranch": "main",
  "changelog": "@changesets/cli/changelog",
  "commit": false,
  "ignore": ["web"]
}
```

## Troubleshooting

**No changesets found:**
```bash
npm run changeset:add
```

**Wrong version bumped:**
```bash
# Delete the changeset file and recreate
rm .changeset/your-changeset.md
npm run changeset:add
```

**Need to test without publishing:**
```bash
npm run changeset:status
```

## Full Documentation

See [CHANGESET_GUIDE.md](./CHANGESET_GUIDE.md) for complete documentation.
