# Google Sync Migration Guide

**Version**: 1.7.0
**Target Audience**: Users migrating from other sync sources
**Last Updated**: 2025-10-09

## Table of Contents

- [Overview](#overview)
- [Migration Scenarios](#migration-scenarios)
- [macOS Contacts to Google Contacts](#macos-contacts-to-google-contacts)
- [Using Both Sync Sources](#using-both-sync-sources)
- [Data Deduplication Strategies](#data-deduplication-strategies)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

## Overview

This guide helps you migrate from macOS Contacts sync to Google Contacts sync, or use both sources together effectively.

### Why Migrate to Google Contacts?

| Feature | macOS Contacts | Google Contacts |
|---------|----------------|-----------------|
| **Cross-platform** | macOS only | All platforms |
| **Cloud sync** | iCloud only | Google Cloud |
| **Incremental sync** | No (full sync) | Yes (syncToken) |
| **Team sharing** | Limited | Full support |
| **Calendar integration** | No | Yes |
| **Mobile access** | iOS only | iOS + Android |
| **API access** | Limited | Full REST API |

### Migration Paths

1. **Full migration**: Stop using macOS Contacts, move to Google
2. **Hybrid approach**: Use both sources with deduplication
3. **Gradual transition**: Phase out macOS Contacts over time

## Migration Scenarios

### Scenario 1: Complete Migration

**Goal**: Migrate all contacts from macOS to Google, then use Google only.

**Steps**:

1. **Export from macOS Contacts**:
   ```bash
   mcp-memory contacts sync \
     --user-email your@email.com \
     --direction import
   ```

2. **Push to Google Contacts**:
   ```bash
   mcp-memory google contacts-sync \
     --user-email your@email.com \
     --direction export
   ```

3. **Verify in Google**:
   - Open [contacts.google.com](https://contacts.google.com)
   - Check all contacts migrated correctly

4. **Disable macOS sync**:
   - Stop running `mcp-memory contacts sync`
   - Remove from cron/scheduled tasks

5. **Use Google sync only**:
   ```bash
   mcp-memory google contacts-sync \
     --user-email your@email.com \
     --direction import
   ```

**Timeline**: 1-2 hours

### Scenario 2: Hybrid Sync (Both Sources)

**Goal**: Keep using both macOS and Google Contacts with automatic deduplication.

**Steps**:

1. **Sync from both sources**:
   ```bash
   # macOS Contacts
   mcp-memory contacts sync \
     --user-email your@email.com \
     --direction import

   # Google Contacts
   mcp-memory google contacts-sync \
     --user-email your@email.com \
     --direction import
   ```

2. **Run deduplication**:
   ```bash
   mcp-memory google contacts-sync \
     --user-email your@email.com \
     --direction import \
     --auto-merge \
     --threshold 90
   ```

3. **Schedule both syncs**:
   ```bash
   # Cron: Daily at 9 AM (macOS Contacts)
   0 9 * * * mcp-memory contacts sync -u your@email.com

   # Cron: Daily at 9:15 AM (Google Contacts + dedup)
   15 9 * * * mcp-memory google contacts-sync -u your@email.com --auto-merge
   ```

**Timeline**: Ongoing

### Scenario 3: Gradual Transition

**Goal**: Slowly move contacts to Google while maintaining macOS as fallback.

**Steps**:

1. **Week 1-2: Setup**
   - Connect Google account
   - Export current MCP entities to Google

2. **Week 3-4: Parallel sync**
   - Sync from both sources
   - Monitor for issues
   - Manually verify important contacts

3. **Week 5-6: Reduce macOS dependency**
   - Only sync macOS weekly
   - Use Google as primary source

4. **Week 7+: Full migration**
   - Disable macOS sync
   - Google becomes sole source

**Timeline**: 6-8 weeks

## macOS Contacts to Google Contacts

### Step-by-Step Migration

#### Phase 1: Preparation (30 minutes)

**1. Backup macOS Contacts**:
```bash
# Export to vCard
mcp-memory export-vcard \
  --user-email your@email.com \
  -o macos-contacts-backup.vcf

# Or use macOS Contacts app:
# File → Export → vCard...
```

**2. Clean up macOS Contacts** (optional):
- Remove obvious duplicates
- Fix malformed data
- Standardize phone formats

**3. Verify MCP Memory has all contacts**:
```bash
mcp-memory list entities --user-email your@email.com --limit 999
```

#### Phase 2: Export to Google (1 hour)

**1. Connect Google account**:
```bash
# Via web interface
open http://localhost:3000/settings
# Click "Connect Google Account"

# Or via CLI
mcp-memory google auth --user-email your@email.com
```

**2. Dry-run export**:
```bash
mcp-memory google contacts-sync \
  --user-email your@email.com \
  --direction export \
  --dry-run
```

**Expected output**:
```
🔄 Google Contacts Sync (DRY RUN)

📤 Export preview:
  Would export: 150 entities to Google
  Would update: 0 existing contacts
  Would skip: 5 entities (missing required fields)

Skipped entities:
  1. "Incomplete Contact" - Missing email
  2. "Test Entity" - Not a person/organization
  ... (3 more)

✅ Dry run complete
Run without --dry-run to export 150 contacts
```

**3. Review and fix skipped entities**:
```bash
# Add missing emails or mark as non-contact entities
mcp-memory update-entity --id entity-123 --email new@email.com
```

**4. Actual export**:
```bash
mcp-memory google contacts-sync \
  --user-email your@email.com \
  --direction export
```

**5. Verify in Google Contacts**:
- Visit [contacts.google.com](https://contacts.google.com)
- Check contact count matches
- Spot-check important contacts

#### Phase 3: Switch to Google Sync (15 minutes)

**1. Update sync commands**:
```bash
# OLD (macOS Contacts):
mcp-memory contacts sync -u your@email.com

# NEW (Google Contacts):
mcp-memory google contacts-sync -u your@email.com
```

**2. Update cron jobs**:
```bash
crontab -e

# Replace:
# 0 9 * * * mcp-memory contacts sync -u your@email.com

# With:
0 9 * * * mcp-memory google contacts-sync -u your@email.com
```

**3. Update web interface** (if applicable):
- Change sync source in settings
- Test sync from UI

### Data Mapping Differences

| Field | macOS Contacts | Google Contacts | Notes |
|-------|----------------|-----------------|-------|
| Name | Full name | Display name | Similar |
| Email | Multiple types | Multiple emails | Google has more types |
| Phone | Multiple types | Multiple phones | Different type names |
| Address | Structured | Structured | Similar format |
| Organization | Single | Single + title | Google has job title field |
| Notes | Plain text | Rich text | Google supports formatting |
| Birthday | Date | Date + year | Google supports partial dates |
| Photo | URL or data | URL only | Must be accessible URL |

### Handling Data Loss

Some fields may not map perfectly. Here's how to preserve them:

**Before export, check for unmapped fields**:
```bash
# Get entities with custom metadata
mcp-memory get-entities --user-email your@email.com --has-metadata
```

**Custom fields are stored in `metadata`**:
```json
{
  "name": "John Smith",
  "email": "john@example.com",
  "metadata": {
    "customField1": "value1",
    "macosContactGroups": ["Work", "Favorites"],
    "lastContactedDate": "2025-10-01"
  }
}
```

**These fields are preserved in MCP Memory** but won't sync to Google unless Google supports them.

## Using Both Sync Sources

### Architecture

```
┌──────────────────┐         ┌──────────────────┐
│  macOS Contacts  │         │ Google Contacts  │
└────────┬─────────┘         └────────┬─────────┘
         │                            │
         │ Import                     │ Import
         ▼                            ▼
┌────────────────────────────────────────────────┐
│           MCP Memory (Master)                  │
│                                                │
│  Deduplication Layer:                          │
│  • Detect duplicates from both sources         │
│  • Merge using LLM confidence scoring          │
│  • Maintain source tracking                    │
└────────────────────────────────────────────────┘
         │                            │
         │ Export                     │ Export
         ▼                            ▼
┌──────────────────┐         ┌──────────────────┐
│  macOS Contacts  │         │ Google Contacts  │
│   (secondary)    │         │   (secondary)    │
└──────────────────┘         └──────────────────┘
```

### Configuration

**Daily sync script** (`dual-sync.sh`):

```bash
#!/bin/bash
set -e

USER_EMAIL="your@email.com"

echo "🔄 Starting dual sync..."

# Phase 1: Import from macOS
echo "📥 Importing from macOS Contacts..."
mcp-memory contacts sync \
  --user-email "$USER_EMAIL" \
  --direction import

# Phase 2: Import from Google
echo "📥 Importing from Google Contacts..."
mcp-memory google contacts-sync \
  --user-email "$USER_EMAIL" \
  --direction import \
  --auto-merge \
  --threshold 90

# Phase 3: Export to both (optional)
# Uncomment to keep both sources in sync
# echo "📤 Exporting to macOS Contacts..."
# mcp-memory contacts sync \
#   --user-email "$USER_EMAIL" \
#   --direction export

# echo "📤 Exporting to Google Contacts..."
# mcp-memory google contacts-sync \
#   --user-email "$USER_EMAIL" \
#   --direction export

echo "✅ Dual sync complete!"
```

**Schedule with cron**:
```bash
# Daily at 9 AM
0 9 * * * /path/to/dual-sync.sh >> /tmp/dual-sync.log 2>&1
```

### Conflict Resolution

When the same contact exists in both sources:

**Strategy 1: Newest Wins (Default)**
- Compare `updatedAt` timestamps
- Use most recent version
- Merge fields if possible

**Strategy 2: Source Priority**
- Choose a primary source (e.g., Google)
- Always prefer that source in conflicts
- Use other source for new contacts only

**Strategy 3: Manual Review**
- Use `--dry-run` to preview conflicts
- Manually resolve in preferred source
- Re-sync after resolution

### Source Tracking

MCP Memory tracks which source each entity came from:

```json
{
  "name": "John Smith",
  "email": "john@example.com",
  "metadata": {
    "syncSources": ["macos", "google"],
    "primarySource": "google",
    "lastSyncedFromMacOS": "2025-10-09T09:00:00Z",
    "lastSyncedFromGoogle": "2025-10-09T09:15:00Z"
  }
}
```

**Query by source**:
```sql
SELECT * FROM entities
WHERE metadata LIKE '%"syncSources":%"macos"%'
  AND metadata LIKE '%"syncSources":%"google"%';
```

## Data Deduplication Strategies

### Strategy 1: Aggressive Deduplication

**Goal**: Minimize duplicates, even if some false positives

**Configuration**:
```bash
mcp-memory google contacts-sync \
  --user-email your@email.com \
  --auto-merge \
  --threshold 80  # Lower threshold = more aggressive
```

**Pros**:
- Fewer duplicates
- Cleaner data

**Cons**:
- Potential false positives
- May merge different people with similar names

**Best for**: Personal use with known contact set

### Strategy 2: Conservative Deduplication

**Goal**: Only merge obvious duplicates

**Configuration**:
```bash
mcp-memory google contacts-sync \
  --user-email your@email.com \
  --auto-merge \
  --threshold 95  # Higher threshold = more conservative
```

**Pros**:
- Fewer false positives
- Safer for large datasets

**Cons**:
- More duplicates remain
- Manual cleanup needed

**Best for**: Business use with many contacts

### Strategy 3: Manual Review

**Goal**: Review all duplicates before merging

**Configuration**:
```bash
# 1. Dry run to see duplicates
mcp-memory google contacts-sync \
  --user-email your@email.com \
  --dry-run \
  --auto-merge \
  --threshold 85

# 2. Review output, then decide per-duplicate
# 3. Actual sync without auto-merge
mcp-memory google contacts-sync \
  --user-email your@email.com
```

**Pros**:
- Full control
- No unwanted merges

**Cons**:
- Time-consuming
- Not automated

**Best for**: Initial migration or critical data

### Deduplication Workflow

```
┌──────────────────────────────────────────────────────────┐
│  Step 1: Import from all sources                         │
│  • macOS Contacts → MCP Memory                           │
│  • Google Contacts → MCP Memory                          │
└──────────────────────┬───────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────┐
│  Step 2: Detect duplicates                               │
│  • Run LLM deduplication                                 │
│  • Generate confidence scores                            │
│  • Group by similarity                                   │
└──────────────────────┬───────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────┐
│  Step 3: Review duplicates                               │
│  • Sort by confidence (highest first)                    │
│  • Manual review of borderline cases (70-90%)            │
│  • Approve merges above threshold                        │
└──────────────────────┬───────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────┐
│  Step 4: Merge approved duplicates                       │
│  • Combine data from both records                        │
│  • Preserve all unique fields                            │
│  • Mark as merged in metadata                            │
└──────────────────────┬───────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────┐
│  Step 5: Sync back to sources (optional)                │
│  • Export merged entities to macOS/Google                │
│  • Delete duplicates in source systems                   │
│  • Verify sync completion                                │
└──────────────────────────────────────────────────────────┘
```

## Best Practices

### Pre-Migration Checklist

- [ ] Backup all data (macOS Contacts export + MCP Memory backup)
- [ ] Clean up obvious duplicates in source systems
- [ ] Verify email addresses are correct
- [ ] Standardize phone number formats
- [ ] Test sync with a small subset first
- [ ] Document custom fields that may not map

### During Migration

- [ ] Use `--dry-run` for all operations initially
- [ ] Review preview output carefully
- [ ] Start with conservative deduplication (threshold: 95)
- [ ] Monitor sync logs for errors
- [ ] Verify data in target system after each phase
- [ ] Keep source system available as backup

### Post-Migration

- [ ] Run final deduplication pass
- [ ] Update sync scripts/cron jobs
- [ ] Document new sync process
- [ ] Train users on new system (if team)
- [ ] Monitor sync health for 2-4 weeks
- [ ] Archive old sync logs

### Rollback Plan

If migration fails:

**1. Stop all syncs**:
```bash
# Disable cron jobs
crontab -e
# Comment out sync commands
```

**2. Restore from backup**:
```bash
# Restore MCP Memory entities
mcp-memory import-entities -u your@email.com -i backup.json

# Restore macOS Contacts
# macOS Contacts → File → Import → backup.vcf
```

**3. Revert to previous sync method**:
```bash
# Resume macOS sync
mcp-memory contacts sync -u your@email.com
```

## Troubleshooting

### Duplicates After Migration

**Issue**: Same contact appears multiple times

**Solutions**:

1. **Run deduplication**:
   ```bash
   mcp-memory google contacts-sync \
     -u your@email.com \
     --auto-merge \
     --threshold 90
   ```

2. **Lower threshold if too conservative**:
   ```bash
   # Try 85% threshold
   mcp-memory google contacts-sync \
     -u your@email.com \
     --auto-merge \
     --threshold 85
   ```

3. **Manual cleanup**:
   ```bash
   # List potential duplicates
   mcp-memory find-duplicates -u your@email.com

   # Delete duplicates manually
   mcp-memory delete-entity --id entity-123
   ```

### Data Missing After Migration

**Issue**: Some fields lost during migration

**Solutions**:

1. **Check source system**:
   - Verify data exists in macOS Contacts or Google Contacts
   - Ensure field types are supported

2. **Check `metadata` field**:
   ```bash
   mcp-memory get-entity --id entity-123 --show-metadata
   ```

3. **Re-import from source**:
   ```bash
   # Delete entity
   mcp-memory delete-entity --id entity-123

   # Re-sync
   mcp-memory google contacts-sync -u your@email.com --direction import
   ```

### Sync Conflicts Between Sources

**Issue**: Different data in macOS vs Google

**Solutions**:

1. **Choose primary source**:
   ```bash
   # Use Google as primary
   mcp-memory google contacts-sync \
     -u your@email.com \
     --direction import

   # Then export to macOS
   mcp-memory contacts sync \
     -u your@email.com \
     --direction export
   ```

2. **Manual merge in preferred source**:
   - Edit contact in Google or macOS
   - Combine data from both versions
   - Re-sync after manual merge

3. **Use bidirectional sync with newest-wins**:
   ```bash
   # Both directions, newest modification wins
   mcp-memory google contacts-sync -u your@email.com --direction both
   mcp-memory contacts sync -u your@email.com --direction both
   ```

### Slow Migration Performance

**Issue**: Migration takes too long

**Solutions**:

1. **Disable LLM deduplication initially**:
   ```bash
   mcp-memory google contacts-sync \
     -u your@email.com \
     --no-llm  # Faster, simple rules only
   ```

2. **Increase batch size**:
   ```bash
   mcp-memory google contacts-sync \
     -u your@email.com \
     --batch-size 200  # Default: 100
   ```

3. **Migrate in phases**:
   ```bash
   # Export 100 contacts at a time
   mcp-memory google contacts-sync \
     -u your@email.com \
     --direction export \
     --limit 100 \
     --offset 0

   # Then next batch
   mcp-memory google contacts-sync \
     -u your@email.com \
     --direction export \
     --limit 100 \
     --offset 100
   ```

## Related Documentation

- **[Google Sync Overview](../features/GOOGLE_SYNC.md)**: Feature overview
- **[Google Setup Guide](./GOOGLE_SETUP_GUIDE.md)**: Initial setup
- **[Google Contacts Sync Guide](./GOOGLE_CONTACTS_SYNC_GUIDE.md)**: Contacts sync usage
- **[Contacts Sync Guide](./CONTACTS_SYNC_GUIDE.md)**: macOS Contacts sync
- **[CLI Guide](./CLI-GUIDE.md)**: Complete CLI reference

---

**Need Help?**

- **Documentation**: Check guides linked above
- **Debug Mode**: Use `DEBUG=* mcp-memory ...`
- **GitHub Issues**: [File a bug report](https://github.com/your-org/mcp-memory-ts/issues)
- **Community**: [Join our Discord](https://discord.gg/your-server)

**Last Updated**: 2025-10-09
**Version**: 1.7.0
