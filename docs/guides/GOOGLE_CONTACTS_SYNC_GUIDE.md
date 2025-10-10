# Google Contacts Sync Guide

**Version**: 1.7.0
**Status**: Production Ready
**Last Updated**: 2025-10-09

## Table of Contents

- [Overview](#overview)
- [Quick Start](#quick-start)
- [How It Works](#how-it-works)
- [CLI Usage](#cli-usage)
- [Web UI Usage](#web-ui-usage)
- [Sync Directions](#sync-directions)
- [LLM Deduplication](#llm-deduplication)
- [Dry-Run Mode](#dry-run-mode)
- [Conflict Resolution](#conflict-resolution)
- [Field Mapping](#field-mapping)
- [Best Practices](#best-practices)
- [Advanced Usage](#advanced-usage)
- [Troubleshooting](#troubleshooting)

## Overview

Google Contacts sync provides bidirectional synchronization between your Google Contacts and MCP Memory entities. Unlike traditional import/export tools, this sync system:

- **Intelligently compares both sides** and syncs only what changed
- **Uses syncToken for incremental updates** (only changed contacts, not full sync every time)
- **Detects and merges duplicates** using GPT-4 powered analysis
- **Resolves conflicts automatically** based on modification timestamps
- **Maintains relationship integrity** between contacts and other entities

### Key Features

✅ **Incremental Sync**: After first sync, only transfers changed contacts
✅ **Bidirectional**: Import from Google, export to Google, or both
✅ **Smart Deduplication**: AI-powered duplicate detection with confidence scoring
✅ **Conflict Resolution**: Automatic resolution using timestamps or manual review
✅ **Dry-Run Mode**: Preview all changes before applying them
✅ **Field Preservation**: Comprehensive field mapping maintains all contact data
✅ **Progress Tracking**: Real-time progress updates for large syncs

## Quick Start

### Prerequisites

Before syncing contacts, ensure:

1. **Google account connected**: Complete [Google Setup Guide](./GOOGLE_SETUP_GUIDE.md)
2. **OAuth scopes granted**: `contacts` scope must be authorized
3. **Environment configured**: `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` set

### Basic Import

Import all contacts from Google to MCP Memory:

```bash
mcp-memory google contacts-sync \
  --user-email your-email@example.com \
  --direction import
```

### Basic Export

Export all MCP Memory entities to Google Contacts:

```bash
mcp-memory google contacts-sync \
  --user-email your-email@example.com \
  --direction export
```

### Bidirectional Sync

Sync changes in both directions:

```bash
mcp-memory google contacts-sync \
  --user-email your-email@example.com \
  --direction both
```

## How It Works

### Sync Token Mechanism

Google Contacts API supports **incremental sync** using syncTokens:

```
First Sync:
  ┌─────────────────┐
  │ Google Contacts │
  │  (all 1000)     │
  └────────┬────────┘
           │ Full sync
           ▼
  ┌─────────────────┐
  │  MCP Memory     │
  │  (1000 added)   │
  └────────┬────────┘
           │ Save syncToken
           ▼
        [Token: abc123]

Subsequent Syncs:
  ┌─────────────────┐
  │ Google Contacts │
  │  (5 changed)    │
  └────────┬────────┘
           │ Incremental sync
           │ (using token: abc123)
           ▼
  ┌─────────────────┐
  │  MCP Memory     │
  │  (5 updated)    │
  └────────┬────────┘
           │ Save new syncToken
           ▼
        [Token: def456]
```

**Benefits**:
- ⚡ **Much faster**: Only transfers changed contacts
- 📊 **Less bandwidth**: Reduces network usage by 95%+
- 💰 **Quota friendly**: Fewer API calls
- 🔄 **Always current**: Maintains up-to-date sync state

**Note**: syncToken expires after 7 days of inactivity. If expired, sync automatically falls back to full sync.

### Sync Flow

```
┌──────────────────────────────────────────────────────────────┐
│                    GOOGLE CONTACTS SYNC                       │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│  Phase 1: Fetch Contacts                                     │
│  • Load from Google (with syncToken if available)            │
│  • Load from MCP Memory                                      │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│  Phase 2: Match Contacts                                     │
│  • Match by email (primary identifier)                       │
│  • Match by phone (fallback)                                 │
│  • Match by name (last resort)                               │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│  Phase 3: Detect Duplicates (LLM)                           │
│  • Analyze similar contacts                                  │
│  • Generate confidence scores (0-100%)                       │
│  • Suggest merges above threshold                            │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│  Phase 4: Resolve Conflicts                                  │
│  • Compare modification timestamps                           │
│  • Apply conflict resolution strategy                        │
│  • Merge field-by-field if needed                            │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│  Phase 5: Apply Changes                                      │
│  • Import new contacts from Google                           │
│  • Export new entities to Google                             │
│  • Update modified contacts                                  │
│  • Save syncToken for next sync                              │
└──────────────────────────────────────────────────────────────┘
```

## CLI Usage

### Command Syntax

```bash
mcp-memory google contacts-sync [options]
```

### Required Options

| Option | Description | Example |
|--------|-------------|---------|
| `--user-email <email>` | User email or ID for MCP Memory | `--user-email bob@example.com` |
| `-u <email>` | Short form of `--user-email` | `-u bob@example.com` |

### Sync Options

| Option | Default | Description |
|--------|---------|-------------|
| `-d, --direction <dir>` | `both` | Sync direction: `import`, `export`, or `both` |
| `--dry-run` | `false` | Preview changes without applying |
| `--auto-merge` | `false` | Automatically merge duplicates above threshold |
| `--threshold <num>` | `90` | Deduplication confidence threshold (0-100) |
| `--no-llm` | `false` | Disable LLM deduplication (use simple rules) |
| `--force-full` | `false` | Force full sync (ignore syncToken) |
| `--batch-size <num>` | `100` | Number of contacts per batch |

### Examples

#### Import with Dry Run

Preview what would be imported:

```bash
mcp-memory google contacts-sync \
  --user-email bob@example.com \
  --direction import \
  --dry-run
```

Output:
```
🔄 Google Contacts Sync (DRY RUN)

📥 Incremental sync (using syncToken)...
📊 Fetched 15 contacts from Google (changed since last sync)
🔍 Processing contacts...

Preview Changes:
  ✅ Would import: 12 contacts
  ✅ Would update: 3 contacts
  ⚠️  Duplicates detected: 2 contacts

Duplicates:
  1. "John Smith" vs "John D. Smith" (85% match)
     → Suggested action: Merge (use --auto-merge)
  2. "Acme Corp" vs "Acme Corporation" (92% match)
     → Suggested action: Auto-merge (confidence above threshold)

✅ Dry run complete - no changes made
Run without --dry-run to apply changes
```

#### Auto-Merge Duplicates

Automatically merge duplicates with confidence ≥ 90%:

```bash
mcp-memory google contacts-sync \
  --user-email bob@example.com \
  --direction import \
  --auto-merge \
  --threshold 90
```

Output:
```
🔄 Google Contacts Sync

📥 Incremental sync...
📊 Fetched 15 contacts from Google
🔍 Detecting duplicates...
🤖 LLM deduplication: Found 3 potential duplicates

Auto-merging duplicates:
  ✅ Merged "Acme Corp" + "Acme Corporation" (92% confidence)
  ✅ Merged "Bob Johnson" + "Robert Johnson" (94% confidence)
  ⏭️  Skipped "John Smith" + "John D. Smith" (85% - below threshold)

✅ Sync Complete:
  Imported: 10 new contacts
  Updated: 3 contacts
  Merged: 2 duplicates
  Skipped: 1 duplicate (below threshold)
```

#### Export to Google

Export MCP Memory entities to Google Contacts:

```bash
mcp-memory google contacts-sync \
  --user-email bob@example.com \
  --direction export
```

Output:
```
🔄 Google Contacts Sync

📤 Exporting to Google...
📊 Found 45 MCP entities to export
🔍 Checking for existing Google contacts...

Export Progress:
  ✅ Created 30 new Google contacts
  ✅ Updated 15 existing Google contacts
  ⏭️  Skipped 0 contacts

✅ Export Complete:
  Created: 30
  Updated: 15
  Total synced: 45
```

#### Bidirectional Sync

Sync both directions with auto-merge:

```bash
mcp-memory google contacts-sync \
  --user-email bob@example.com \
  --direction both \
  --auto-merge
```

Output:
```
🔄 Google Contacts Sync

🔄 Bidirectional sync...

📥 IMPORT PHASE:
  📊 Fetched 8 contacts from Google (incremental)
  ✅ Imported 5 new contacts
  ✅ Updated 3 contacts
  🤖 Merged 1 duplicate

📤 EXPORT PHASE:
  📊 Found 12 MCP entities to export
  ✅ Created 10 new Google contacts
  ✅ Updated 2 existing Google contacts

✅ Sync Complete:
  Total imported: 8
  Total exported: 12
  Duplicates merged: 1
```

#### Lower Threshold for Aggressive Merging

Merge duplicates with ≥ 80% confidence:

```bash
mcp-memory google contacts-sync \
  --user-email bob@example.com \
  --direction import \
  --auto-merge \
  --threshold 80
```

**Warning**: Lower thresholds may cause false positives. Review merge suggestions carefully.

#### Force Full Sync

Ignore syncToken and perform full sync:

```bash
mcp-memory google contacts-sync \
  --user-email bob@example.com \
  --direction import \
  --force-full
```

Use this when:
- syncToken is corrupted or lost
- You want to re-validate all contacts
- Testing sync logic

## Web UI Usage

### Accessing the Sync Interface

1. Open MCP Memory web interface: `http://localhost:3000`
2. Navigate to **Settings** → **Integrations** → **Google**
3. Ensure Google account is connected (green status indicator)

### Sync Controls

The web interface provides a visual sync interface:

**Import from Google**:
1. Click **Sync from Google** button
2. Select options:
   - ☑️ Enable dry-run mode (recommended first time)
   - ☑️ Auto-merge duplicates
   - 🎚️ Set confidence threshold (slider: 80-95%)
3. Click **Start Import**
4. Monitor progress bar and live updates
5. Review summary when complete

**Export to Google**:
1. Click **Sync to Google** button
2. Select entities to export (or choose "All")
3. Review preview of changes
4. Click **Confirm Export**
5. Monitor progress
6. Verify in Google Contacts

**Bidirectional Sync**:
1. Click **Sync Both Ways** button
2. Configure options for both directions
3. Review preview showing import and export actions
4. Click **Start Sync**
5. View detailed results for each phase

### Progress Indicators

The web UI shows real-time progress:

```
╔══════════════════════════════════════════════════════════╗
║  Google Contacts Sync                                    ║
╠══════════════════════════════════════════════════════════╣
║                                                          ║
║  Phase: Importing contacts                               ║
║  Progress: ███████████░░░░░░░░░ 55% (110/200)          ║
║                                                          ║
║  ✓ Fetched contacts from Google                         ║
║  ✓ Detected 5 duplicates                                ║
║  ⏳ Importing contacts... (110/200)                      ║
║  ⏸️ Pending: Export to Google                            ║
║                                                          ║
╚══════════════════════════════════════════════════════════╝
```

### Sync History

View past sync operations:

1. Navigate to **Settings** → **Sync History**
2. See table of all syncs:
   - Date/time
   - Direction
   - Results (imported/exported/merged)
   - Status (success/failed/partial)
3. Click on a sync to view detailed logs

## Sync Directions

### Import Only (`--direction import`)

**Use case**: You manage contacts in Google and want to import them to MCP Memory

**Behavior**:
- Fetches contacts from Google
- Creates new entities in MCP Memory
- Updates existing entities if Google contact is newer
- Does NOT modify Google Contacts

**Example**:
```bash
mcp-memory google contacts-sync -u bob@example.com --direction import
```

**Result**:
```
Google Contacts (source)  →  MCP Memory (destination)
   150 contacts            →  138 imported, 12 duplicates
```

### Export Only (`--direction export`)

**Use case**: You manage entities in MCP Memory and want to export to Google

**Behavior**:
- Fetches entities from MCP Memory
- Creates new contacts in Google
- Updates existing Google contacts if MCP entity is newer
- Does NOT modify MCP Memory entities

**Example**:
```bash
mcp-memory google contacts-sync -u bob@example.com --direction export
```

**Result**:
```
MCP Memory (source)  →  Google Contacts (destination)
   200 entities      →  180 exported, 20 updated
```

### Bidirectional (`--direction both`)

**Use case**: You manage contacts in both places and want them in sync

**Behavior**:
1. **Import phase**: Import changes from Google
2. **Export phase**: Export changes to Google
3. **Conflict resolution**: Newest modification wins (or use custom strategy)

**Example**:
```bash
mcp-memory google contacts-sync -u bob@example.com --direction both
```

**Result**:
```
Google ←→ MCP Memory
  Import: 15 contacts
  Export: 12 entities
  Updated: 8 on each side
  Merged: 3 duplicates
```

## LLM Deduplication

### How It Works

The deduplication system uses GPT-4 to analyze potential duplicates:

```
┌─────────────────────────────────────────────────────────┐
│  Candidate Pair                                         │
├─────────────────────────────────────────────────────────┤
│  Contact A:                                             │
│    Name: John Smith                                     │
│    Email: jsmith@acme.com                              │
│    Phone: (555) 123-4567                               │
│    Company: Acme Corp                                   │
│                                                         │
│  Contact B:                                             │
│    Name: John D. Smith                                  │
│    Email: john.smith@acme.com                          │
│    Phone: +1-555-123-4567                              │
│    Company: Acme Corporation                            │
└─────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│  LLM Analysis (GPT-4)                                   │
├─────────────────────────────────────────────────────────┤
│  Similarities:                                          │
│  • Same first/last name                                 │
│  • Phone numbers match (different formats)              │
│  • Email domains match (acme.com)                       │
│  • Company names similar (Acme)                         │
│                                                         │
│  Differences:                                           │
│  • Middle initial present in B only                     │
│  • Email usernames differ slightly                      │
│                                                         │
│  Confidence: 94%                                        │
│  Recommendation: MERGE                                  │
│  Reason: Same person, different data entry styles       │
└─────────────────────────────────────────────────────────┘
```

### Confidence Scores

| Score | Meaning | Action |
|-------|---------|--------|
| 95-100% | Definitely the same | Auto-merge recommended |
| 85-94% | Very likely the same | Auto-merge with caution |
| 70-84% | Probably the same | Manual review recommended |
| 50-69% | Possibly the same | Manual review required |
| 0-49% | Probably different | Keep separate |

### Deduplication Options

**Enable with auto-merge** (threshold: 90%):
```bash
mcp-memory google contacts-sync \
  -u bob@example.com \
  --auto-merge \
  --threshold 90
```

**Lower threshold for aggressive merging** (80%):
```bash
mcp-memory google contacts-sync \
  -u bob@example.com \
  --auto-merge \
  --threshold 80
```

**Disable LLM, use simple rules only**:
```bash
mcp-memory google contacts-sync \
  -u bob@example.com \
  --no-llm
```

Simple rules (without LLM):
- Exact email match → 100% (merge)
- Exact phone match → 90% (merge)
- Exact name match → 70% (review)
- Similar name + same company → 60% (review)

### Merge Strategies

When merging duplicates, the system combines data:

**Field-level merge**:
- **Email**: Keep all unique emails
- **Phone**: Keep all unique phone numbers
- **Name**: Use most complete version
- **Company**: Use most recent
- **Notes**: Concatenate with separator
- **Custom fields**: Preserve all

**Example merge**:
```
Contact A:                Contact B:
  Name: John Smith          Name: John D. Smith
  Email: jsmith@acme.com    Email: john.smith@gmail.com
  Phone: (555) 123-4567     Phone: (555) 987-6543
  Company: Acme Corp        Company: Acme Corporation
  Notes: VIP customer       Notes: Prefers email

Merged Result:
  Name: John D. Smith (more complete)
  Emails:
    - jsmith@acme.com (work)
    - john.smith@gmail.com (personal)
  Phones:
    - (555) 123-4567 (mobile)
    - (555) 987-6543 (work)
  Company: Acme Corporation (most recent)
  Notes: VIP customer | Prefers email
```

## Dry-Run Mode

Always test syncs with dry-run before applying changes:

```bash
mcp-memory google contacts-sync \
  --user-email bob@example.com \
  --direction both \
  --dry-run
```

**Dry-run output shows**:
- What WOULD be imported/exported (but isn't)
- Duplicate detection results
- Conflict resolution decisions
- Estimated changes

**Benefits**:
- ✅ Safe testing without data changes
- ✅ Validate sync configuration
- ✅ Preview merge operations
- ✅ Estimate sync duration

**Example output**:
```
🔄 Google Contacts Sync (DRY RUN)

IMPORT PREVIEW:
  Would import: 15 contacts
  Would update: 8 contacts
  Duplicates to merge: 3

EXPORT PREVIEW:
  Would export: 12 entities
  Would update: 5 Google contacts
  Conflicts to resolve: 2

DUPLICATES:
  1. "John Smith" + "John D. Smith" (94% confidence)
     → Would merge: Yes (above threshold)
     → Primary: John D. Smith (more recent)

  2. "Acme Corp" + "Acme Corporation" (88% confidence)
     → Would merge: Yes (above threshold)
     → Primary: Acme Corporation (more complete)

  3. "Bob Inc" + "Bob's Company" (75% confidence)
     → Would skip: No (below threshold)

CONFLICTS:
  1. "Alice Johnson"
     → Google: Updated 2025-10-08 10:30
     → MCP:    Updated 2025-10-09 09:15
     → Resolution: Use MCP version (newer)

  2. "Beta Corp"
     → Google: Updated 2025-10-09 14:00
     → MCP:    Updated 2025-10-09 13:45
     → Resolution: Use Google version (newer)

✅ Dry run complete - no changes made
Run without --dry-run to apply 40 total changes
```

## Conflict Resolution

When the same contact is modified in both places, conflicts arise:

### Conflict Detection

A conflict occurs when:
1. Contact exists in both Google and MCP Memory
2. Both have been modified since last sync
3. Modifications differ

### Resolution Strategies

**1. Newest Wins (Default)**

Use the most recently modified version:

```bash
# Implicit (default behavior)
mcp-memory google contacts-sync -u bob@example.com
```

Example:
```
Google:  "Alice" updated 2025-10-08 10:00
MCP:     "Alice" updated 2025-10-09 14:30
Result:  Use MCP version (newer timestamp)
```

**2. Oldest Wins**

Preserve the original data:

```bash
# Configure in web UI or API call
# CLI doesn't directly support this yet
```

**3. Field-level Merge**

Combine fields intelligently:

```bash
# Use --auto-merge with high threshold
mcp-memory google contacts-sync \
  -u bob@example.com \
  --auto-merge \
  --threshold 95
```

Example:
```
Google version:
  Name: Alice Johnson
  Email: alice@example.com
  Phone: (555) 111-1111

MCP version:
  Name: Alice M. Johnson
  Email: alice@example.com
  Phone: (555) 222-2222
  Company: Tech Corp

Merged result:
  Name: Alice M. Johnson (more complete)
  Email: alice@example.com (same)
  Phones:
    - (555) 111-1111 (from Google)
    - (555) 222-2222 (from MCP)
  Company: Tech Corp (only in MCP)
```

## Field Mapping

### Google Contact → MCP Entity

| Google Field | MCP Field | Notes |
|--------------|-----------|-------|
| `names[0].displayName` | `name` | Primary display name |
| `emailAddresses[*].value` | `email` (primary) | First email becomes primary |
| `phoneNumbers[*].value` | `phone_numbers[]` | All phones mapped |
| `organizations[0].name` | `organization` | First organization |
| `organizations[0].title` | `metadata.jobTitle` | Job title |
| `addresses[*]` | `metadata.addresses[]` | All addresses |
| `biographies[0].value` | `metadata.notes` | Biography/notes |
| `urls[*].value` | `metadata.urls[]` | Websites |
| `photos[0].url` | `metadata.photoUrl` | Profile photo |
| `birthdays[0]` | `metadata.birthday` | Birthday |
| `relations[*]` | `metadata.relations[]` | Relationships |

### MCP Entity → Google Contact

| MCP Field | Google Field | Notes |
|-----------|--------------|-------|
| `name` | `names[0].displayName` | Display name |
| `email` | `emailAddresses[0]` | Primary email (type: work) |
| `phone_numbers[*]` | `phoneNumbers[*]` | All phone numbers |
| `organization` | `organizations[0].name` | Company name |
| `metadata.jobTitle` | `organizations[0].title` | Job title |
| `metadata.addresses[*]` | `addresses[*]` | All addresses |
| `metadata.notes` | `biographies[0].value` | Notes field |
| `metadata.urls[*]` | `urls[*]` | Websites |
| `metadata.photoUrl` | `photos[0].url` | Profile photo URL |
| `metadata.birthday` | `birthdays[0]` | Birthday |

### Field Preservation

All fields are preserved during sync. Fields not mapped are stored in `metadata` for future use.

## Best Practices

### Before First Sync

1. **Backup your data**:
   ```bash
   # Export Google Contacts to CSV
   # Visit: https://contacts.google.com → Export

   # Backup MCP Memory entities
   mcp-memory export-entities -u bob@example.com -o backup.json
   ```

2. **Run dry-run first**:
   ```bash
   mcp-memory google contacts-sync \
     -u bob@example.com \
     --dry-run
   ```

3. **Review duplicates manually**:
   - Check duplicate report
   - Verify merge suggestions
   - Adjust threshold if needed

### Regular Syncing

1. **Use incremental sync**:
   - Let syncToken do its job
   - Only use `--force-full` when needed

2. **Set reasonable threshold**:
   - Start with 90% (recommended)
   - Adjust based on your data quality
   - Higher = fewer false positives

3. **Monitor sync results**:
   ```bash
   # Check last sync status
   mcp-memory google auth --user-email bob@example.com
   ```

### Performance Optimization

1. **Batch size optimization**:
   ```bash
   # For large contact lists (1000+), increase batch size
   mcp-memory google contacts-sync \
     -u bob@example.com \
     --batch-size 200
   ```

2. **Disable LLM for quick syncs**:
   ```bash
   # Skip LLM deduplication if you don't have duplicates
   mcp-memory google contacts-sync \
     -u bob@example.com \
     --no-llm
   ```

3. **Schedule syncs during off-hours**:
   ```bash
   # Cron example: Daily at 2 AM
   0 2 * * * mcp-memory google contacts-sync -u bob@example.com
   ```

### Data Quality

1. **Clean up before syncing**:
   - Remove obvious duplicates manually
   - Fix malformed phone numbers
   - Standardize company names

2. **Use consistent formatting**:
   - Phone: `(555) 123-4567` or `+1-555-123-4567`
   - Email: Lowercase preferred
   - Names: Proper capitalization

3. **Review merge results**:
   - Check merged contacts after sync
   - Undo incorrect merges if needed
   - Adjust threshold for next sync

## Advanced Usage

### Custom Sync Workflow

Combine multiple options for complex workflows:

```bash
#!/bin/bash
# advanced-sync.sh - Custom sync workflow

USER_EMAIL="bob@example.com"

# Step 1: Dry-run to preview
echo "🔍 Step 1: Preview changes..."
mcp-memory google contacts-sync \
  -u $USER_EMAIL \
  --direction both \
  --dry-run

# Step 2: Ask for confirmation
read -p "Continue with sync? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Sync cancelled"
    exit 1
fi

# Step 3: Import with auto-merge
echo "📥 Step 2: Importing from Google..."
mcp-memory google contacts-sync \
  -u $USER_EMAIL \
  --direction import \
  --auto-merge \
  --threshold 90

# Step 4: Export to Google
echo "📤 Step 3: Exporting to Google..."
mcp-memory google contacts-sync \
  -u $USER_EMAIL \
  --direction export

# Step 5: Verify sync
echo "✅ Step 4: Verification..."
mcp-memory google auth -u $USER_EMAIL

echo "🎉 Sync complete!"
```

### Programmatic Access

Use the API for custom integrations:

```typescript
import { GoogleContactsSyncService } from 'mcp-memory-ts';

const syncService = new GoogleContactsSyncService();

// Perform sync
const result = await syncService.sync({
  userId: 'bob@example.com',
  direction: 'both',
  autoMerge: true,
  threshold: 90,
  dryRun: false,
});

console.log(`Imported: ${result.imported}`);
console.log(`Exported: ${result.exported}`);
console.log(`Merged: ${result.merged}`);
```

See [Google API Reference](../api/GOOGLE_API_REFERENCE.md) for complete API documentation.

## Troubleshooting

### Sync Fails with "Token Invalid"

**Error**:
```
Error: Invalid OAuth token
```

**Solution**:
```bash
# Reconnect Google account
mcp-memory google auth --user-email bob@example.com

# Or via web interface:
# Visit http://localhost:3000/settings
# Click "Reconnect Google"
```

### Duplicates Not Detected

**Issue**: Expected duplicates not found by LLM

**Solutions**:

1. **Lower the threshold**:
   ```bash
   mcp-memory google contacts-sync \
     -u bob@example.com \
     --auto-merge \
     --threshold 80  # Lower from 90
   ```

2. **Check LLM is enabled**:
   ```bash
   # Don't use --no-llm flag
   mcp-memory google contacts-sync -u bob@example.com
   ```

3. **Verify OpenAI API key**:
   ```bash
   echo $OPENAI_API_KEY  # Should show your key
   ```

### Sync is Very Slow

**Issue**: Sync takes a long time (>5 minutes for 100 contacts)

**Solutions**:

1. **Use incremental sync** (not full):
   ```bash
   # Remove --force-full flag
   mcp-memory google contacts-sync -u bob@example.com
   ```

2. **Disable LLM if not needed**:
   ```bash
   mcp-memory google contacts-sync \
     -u bob@example.com \
     --no-llm
   ```

3. **Increase batch size**:
   ```bash
   mcp-memory google contacts-sync \
     -u bob@example.com \
     --batch-size 200
   ```

### Wrong Contact Updated

**Issue**: Sync updated the wrong contact

**Solution**:

1. **Check matching logic**:
   - Email is the primary identifier
   - Ensure emails are unique and correct

2. **Review conflict resolution**:
   - Check timestamps on both sides
   - Newest modification wins by default

3. **Manual correction**:
   ```bash
   # Delete incorrect entity
   mcp-memory delete-entity --id <entity-id>

   # Re-sync
   mcp-memory google contacts-sync -u bob@example.com
   ```

### Missing Fields After Sync

**Issue**: Some contact fields missing after sync

**Solution**:

1. **Check field mapping** (see [Field Mapping](#field-mapping) section)

2. **Verify source has data**:
   - Open contact in Google Contacts
   - Verify field exists

3. **Check metadata**:
   ```bash
   # View entity details
   mcp-memory get-entity --id <entity-id>

   # Missing fields may be in metadata
   ```

## Related Documentation

- **[Google Sync Overview](../features/GOOGLE_SYNC.md)**: Feature overview and benefits
- **[Google Setup Guide](./GOOGLE_SETUP_GUIDE.md)**: Initial setup instructions
- **[Google Calendar Sync Guide](./GOOGLE_CALENDAR_SYNC_GUIDE.md)**: Calendar sync documentation
- **[Google API Reference](../api/GOOGLE_API_REFERENCE.md)**: API documentation
- **[CLI Guide](./CLI-GUIDE.md)**: Complete CLI reference

---

**Need Help?**

- **Documentation**: Check the guides linked above
- **Debug Mode**: Use `DEBUG=* mcp-memory google contacts-sync ...`
- **GitHub Issues**: [File a bug report](https://github.com/your-org/mcp-memory-ts/issues)
- **Community**: [Join our Discord](https://discord.gg/your-server)

**Last Updated**: 2025-10-09
**Version**: 1.7.0
