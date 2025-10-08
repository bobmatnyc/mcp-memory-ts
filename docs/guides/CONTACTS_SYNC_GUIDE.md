# macOS Contacts Bidirectional Sync Guide

## Quick Command Reference

**Sync from MCP Memory to macOS Contacts:**
```bash
mcp-memory contacts sync --direction export --user-email YOUR_EMAIL
```

**Sync from macOS Contacts to MCP Memory:**
```bash
mcp-memory contacts sync --direction import --user-email YOUR_EMAIL
```

**Bidirectional sync (both ways):**
```bash
mcp-memory contacts sync --direction both --user-email YOUR_EMAIL
```

## Overview

The MCP Memory TypeScript CLI includes a comprehensive contacts synchronization system that provides **true bidirectional sync** between MCP Memory entities and macOS Contacts app. This feature uses advanced LLM-based deduplication to intelligently merge duplicate contacts.

## Key Features

### 1. True Bidirectional Sync
- **Not just import/export**: Compares both sides and syncs only what's changed
- **Timestamp-based conflict resolution**: Uses modification dates to determine which side has newer data
- **Intelligent merging**: Combines data from both sources when appropriate

### 2. UID-based Matching
- **Persistent tracking**: MCP Memory entity UUID stored in macOS contacts (X-MCP-UUID field)
- **Reliable identification**: Once synced, contacts are tracked by UUID for accurate matching
- **Multi-level fallback**: Falls back to email → phone → name matching if UUID not present

### 3. LLM-based Deduplication
- **ChatGPT-4 powered**: Uses OpenAI's GPT-4o model to detect duplicate contacts
- **Intelligent analysis**: Considers name variations, email domains, phone formatting, organizations
- **Confidence scoring**: Returns 0-100% confidence score with reasoning
- **Configurable threshold**: Set minimum confidence level for automatic merging (default: 90%)

### 4. Conflict Resolution Strategies
- **Newest wins** (default): Use most recently modified data
- **Oldest wins**: Preserve original data
- **Merge**: Combine data from both sources intelligently
- **Manual prompt**: Skip conflicts requiring user review

### 5. Comprehensive Sync Phases

The sync process executes in 6 distinct phases:

1. **Load contacts** from both MCP Memory and macOS Contacts
2. **Match by identifiers** (UUID → email → phone → name)
3. **Sync matched pairs** (compare timestamps, update older side)
4. **Deduplicate with LLM** (find and merge duplicates)
5. **Create new contacts** (import from macOS to MCP Memory)
6. **Export to macOS** (export MCP entities to Contacts)

## Usage

### Basic Sync Command

```bash
mcp-memory contacts sync --user-email user@example.com
```

This performs a full bidirectional sync using default settings.

### Command Options

```bash
mcp-memory contacts sync [options]

Required:
  --user-email <email>        User email or ID for MCP Memory

Options:
  -d, --direction <direction> Sync direction: export, import, or both (default: "both")
  --dry-run                   Preview changes without making them
  --auto-merge                Automatically merge duplicates when confidence >= threshold
  --threshold <number>        Deduplication confidence threshold 0-100 (default: "90")
  --no-llm                    Disable LLM-based deduplication (use simple rules only)
  -h, --help                  Display help for command
```

### Examples

#### Full bidirectional sync with auto-merge
```bash
mcp-memory contacts sync \
  --user-email bob@matsuoka.com \
  --auto-merge
```

#### Dry run to preview changes
```bash
mcp-memory contacts sync \
  --user-email bob@matsuoka.com \
  --dry-run \
  --auto-merge
```

#### Export only (MCP Memory → macOS Contacts)
```bash
mcp-memory contacts sync \
  --user-email bob@matsuoka.com \
  --direction export
```

**Note**: The `export` direction means MCP Memory → macOS Contacts (exporting FROM MCP Memory TO Contacts).

#### Import only (macOS Contacts → MCP Memory)
```bash
mcp-memory contacts sync \
  --user-email bob@matsuoka.com \
  --direction import
```

**Note**: The `import` direction means macOS Contacts → MCP Memory (importing FROM Contacts TO MCP Memory).

#### Lower threshold for more aggressive deduplication
```bash
mcp-memory contacts sync \
  --user-email bob@matsuoka.com \
  --auto-merge \
  --threshold 80
```

#### Disable LLM deduplication (use simple rules only)
```bash
mcp-memory contacts sync \
  --user-email bob@matsuoka.com \
  --no-llm
```

## Configuration

### Initial Setup

Run the initialization wizard to configure sync settings:

```bash
mcp-memory init
```

This will prompt for:
- Turso database credentials
- OpenAI API key (required for LLM deduplication)
- Advanced sync configuration (optional)

### Advanced Sync Configuration

During initialization, you can configure:

1. **Deduplication threshold** (0-100): Confidence level for automatic merging
2. **Enable LLM deduplication**: Use ChatGPT-4 for intelligent duplicate detection
3. **Conflict resolution strategy**: newest, oldest, or merge
4. **Auto-merge**: Automatically merge duplicates above threshold

Configuration is saved to `~/.mcp-memory/config.json`:

```json
{
  "userEmail": "bob@matsuoka.com",
  "tursoUrl": "libsql://your-database.turso.io",
  "tursoAuthToken": "your-token",
  "openaiApiKey": "sk-...",
  "sync": {
    "deduplication": {
      "threshold": 90,
      "chatgptModel": "gpt-4o",
      "enableLLMDeduplication": true,
      "maxRetries": 3,
      "retryDelayMs": 1000
    },
    "conflictResolution": {
      "strategy": "newest",
      "autoMerge": true
    }
  }
}
```

## How It Works

### Phase 1: Load Contacts

The sync system loads contacts from both sources:

**MCP Memory:**
- Queries database for all entities of type `PERSON` for the specified user
- Includes all metadata (UUID, email, phone, organization, etc.)

**macOS Contacts:**
- Uses AppleScript to export all contacts as vCard format
- Parses vCard data including custom X-MCP-UUID fields
- Extracts UUID from NOTE field if present

### Phase 2: Match Contacts

Contacts are matched using a multi-level strategy:

1. **UUID Match** (100% confidence)
   - Matches X-MCP-UUID custom field
   - Also checks NOTE field for `[MCP-UUID: xxx-xxx-xxx]` format

2. **Email Match** (95% confidence)
   - Exact email address match (case-insensitive)

3. **Phone Match** (90% confidence)
   - Normalized phone number match (strips formatting)

4. **Name Match** (70% confidence)
   - Exact name match (case-insensitive)

### Phase 3: Sync Matched Pairs

For each matched pair:

1. **Check for conflicts**: Compare key fields (name, email, phone, organization)
2. **Resolve conflict** using configured strategy:
   - **Newest**: Compare timestamps, use most recent
   - **Oldest**: Compare timestamps, use least recent
   - **Merge**: Intelligently combine data from both sides
3. **Update older side** with newer data
4. **Log action**: Report what was updated

### Phase 4: Deduplicate with LLM

For unmatched contacts, the system finds potential duplicates:

1. **Calculate preliminary score** (0-100) using rule-based matching:
   - Name similarity (exact, overlap, initials)
   - Email domain match
   - Organization match
   - Phone similarity
   - Title match

2. **Filter candidates** (only pairs with score > 20)

3. **Check with ChatGPT-4** for each potential duplicate:
   ```
   Compare these two contacts and determine if they represent the same person.

   Contact A:
   Name: John Smith
   Email: john@example.com
   Phone: (555) 123-4567
   Organization: Acme Corp

   Contact B:
   Name: J. Smith
   Email: jsmith@example.com
   Phone: 555-123-4567
   Organization: Acme Corporation
   ```

4. **Receive LLM response**:
   ```json
   {
     "confidence": 85,
     "reasoning": "Different email addresses but same name pattern, phone, and similar organization",
     "isDuplicate": true
   }
   ```

5. **Merge if confidence >= threshold** and auto-merge enabled

### Phase 5: Create New Contacts

Import new contacts from macOS Contacts that don't match any MCP entity:

1. **Validate vCard data** (required fields present)
2. **Convert to entity format** (map vCard fields to MCP entity)
3. **Create entity** in MCP Memory database
4. **Tag as imported** (`imported-from-contacts` tag)

### Phase 6: Export to macOS

Export MCP entities that don't exist in macOS Contacts:

1. **Convert to vCard format** with X-MCP-UUID field
2. **Create contact** in macOS Contacts via AppleScript
3. **Embed MCP UUID** in NOTE field for tracking

## LLM Deduplication Details

### ChatGPT Prompt

The system uses this prompt for duplicate detection:

```
Compare these two contacts and determine if they represent the same person.
Return ONLY a JSON object with this exact format:
{
  "confidence": <0-100>,
  "reasoning": "<brief explanation>",
  "isDuplicate": <true/false>
}

Contact A:
[contact data]

Contact B:
[contact data]

Consider:
- Name variations (nicknames, middle names, maiden names, initials)
- Email domain matches (same company/organization)
- Phone number formatting differences
- Similar organizations or titles
- Address proximity

Confidence scale:
- 100: Exact match (same email or phone)
- 90-99: Very likely same person (multiple matching fields)
- 70-89: Probably same person (name match + one other field)
- 50-69: Possibly same person (similar name)
- 0-49: Probably different people
```

### Confidence Threshold Guidelines

- **90-100%**: Very confident matches, safe for auto-merge
- **80-89%**: Likely duplicates, consider reviewing manually
- **70-79%**: Possible duplicates, manual review recommended
- **Below 70%**: Probably different people

### Rate Limiting & Retries

The system handles OpenAI API rate limits gracefully:

- **Exponential backoff**: Retry with increasing delays (1s, 2s, 4s)
- **Max retries**: 3 attempts per request
- **Batch delays**: 200ms delay between requests to avoid rate limits
- **Fallback**: If LLM fails, uses simple rule-based matching

## Conflict Resolution

### Merge Strategy (Recommended)

The merge strategy intelligently combines data:

- **Name**: Prefer external (user may have updated in Contacts)
- **Email**: Collect unique emails from both sides
- **Phone**: Collect unique phones from both sides
- **Organization**: Prefer non-empty value
- **Title**: Prefer non-empty value
- **Address**: Prefer external (more likely updated)
- **Notes**: Combine both if different
- **Tags**: Merge unique tags
- **MCP-specific fields**: Always keep from MCP side

### Newest Strategy

Compares `updatedAt` timestamps:
- If external is newer: Update MCP entity
- If MCP is newer: Update external contact
- If same or no timestamps: Fall back to merge

### Oldest Strategy

Preserves original data:
- Uses least recently modified version
- Useful for maintaining historical accuracy

## Output & Reporting

### Console Output

The sync process provides detailed console output:

```
🤖 macOS Contacts Sync - Bidirectional
User: bob@matsuoka.com
Direction: both
Dry run: NO
Deduplication: LLM-based (threshold: 90%)
Conflict resolution: newest (auto-merge)

✓ Found user: bob@matsuoka.com (user_123)

🔄 Loading contacts...
  MCP entities: 150
  macOS contacts: 145

🔄 Matching contacts...
  Matched (by UID): 120
  Matched (by email): 15
  Matched (by phone): 5
  Matched (by name): 3
  Unmatched MCP: 7
  Unmatched macOS: 2

🔄 Syncing matched contacts...
🔄 Updated macOS: John Smith
🔄 Updated MCP: Jane Doe
...

🔍 Finding duplicates...
  Found 3 potential duplicate pairs

🔍 Checking 3 potential duplicates with LLM...
  Progress: 3/3 checked...

⚠ Duplicate found (92%): John Smith = J. Smith
  Different email addresses but same name pattern, phone, and organization
  ✓ Merged successfully

○ Not duplicate (45%): Bob Wilson ≠ Robert Williams
  Different last names and no shared contact info

🔄 Creating new contacts...
✓ Imported: Alice Johnson
✓ Exported: Charlie Brown

=== Sync Summary ===
Matched & synced: 5
Duplicates merged: 1
Imported from macOS: 1
Exported to macOS: 1
Skipped: 1
Failed: 0
```

### Sync Result Object

The function returns a detailed result:

```typescript
{
  success: boolean;
  exported: number;      // Contacts exported to macOS
  imported: number;      // Contacts imported from macOS
  updated: number;       // Matched contacts synced
  merged: number;        // Duplicates merged
  failed: number;        // Failed operations
  skipped: number;       // Skipped (conflicts, low confidence)
  errors: string[];      // Error messages
  duplicatesFound: number; // Potential duplicates found
}
```

## Best Practices

### 1. Start with Dry Run

Always preview changes first:

```bash
mcp-memory contacts sync --user-email bob@matsuoka.com --dry-run --auto-merge
```

### 2. Backup Your Data

Before syncing:
- Export MCP entities: `mcp-memory vcard export --user-email bob@matsuoka.com -o backup.vcf`
- Backup macOS Contacts: File → Export → Export vCard

### 3. Gradual Threshold Adjustment

Start with high threshold (90%) and lower gradually:
- 90%: Very conservative, few merges
- 85%: Balanced, good for most use cases
- 80%: More aggressive, may catch more duplicates
- 75%: Very aggressive, review carefully

### 4. Review Merge Results

After auto-merge, review merged contacts in macOS Contacts to ensure accuracy.

### 5. Regular Syncing

Run sync regularly to keep both systems in sync:
- Weekly sync for active contacts
- Monthly for less active datasets
- After bulk imports or exports

### 6. Monitor API Usage

LLM deduplication uses OpenAI API:
- Each duplicate check = 1 API call (≈200 tokens)
- 100 potential duplicates ≈ $0.01-0.02
- Monitor usage in OpenAI dashboard

## Troubleshooting

### "User not found" Error

**Cause**: User email not in MCP Memory database

**Solution**: Verify user email or use user ID instead

### "OpenAI API key not found" Error

**Cause**: Missing or invalid OpenAI API key

**Solution**:
```bash
# Run init to set API key
mcp-memory init

# Or set environment variable
export OPENAI_API_KEY=sk-...
```

### "Rate limit exceeded" Error

**Cause**: Too many OpenAI API requests

**Solution**:
- Wait 60 seconds and retry
- Reduce number of duplicates (use --no-llm for simple dedup)
- Increase `retryDelayMs` in config

### Duplicate Not Detected

**Cause**: Confidence below threshold or insufficient similarity

**Solution**:
- Lower threshold: `--threshold 80`
- Check contact data completeness (missing email/phone reduces confidence)
- Review preliminary score in output

### "AppleScript execution failed" Error

**Cause**: macOS Contacts app not accessible

**Solution**:
- Grant terminal permissions: System Settings → Privacy & Security → Automation
- Ensure Contacts app is not locked
- Close and reopen Contacts app

### Contacts Not Syncing

**Cause**: Various issues (conflicts, validation errors, etc.)

**Solution**:
- Check error messages in output
- Use `--dry-run` to preview issues
- Review failed contacts in summary

## Technical Details

### File Structure

```
src/
├── cli/
│   └── commands/
│       └── contacts-sync.ts      # Main sync implementation
├── utils/
│   ├── contact-matching.ts       # UID and fuzzy matching
│   ├── deduplication.ts          # LLM-based duplicate detection
│   └── conflict-resolution.ts    # Conflict resolution strategies
├── types/
│   └── sync-config.ts            # Configuration types
└── vcard/
    ├── generator.ts              # vCard generation with X-MCP-UUID
    ├── parser.ts                 # vCard parsing with UUID extraction
    └── mapper.ts                 # Entity ↔ vCard conversion
```

### Data Flow

```
┌─────────────────┐         ┌──────────────────┐
│  MCP Memory DB  │         │  macOS Contacts  │
└────────┬────────┘         └────────┬─────────┘
         │                           │
         ├─── Load entities ─────────┤
         │                           │
         ├─── Match by UUID ─────────┤
         │                           │
         ├─── Match by email ────────┤
         │                           │
         ├─── Match by phone ────────┤
         │                           │
         ├─── Match by name ─────────┤
         │                           │
         ├─── Sync matched pairs ────┤
         │    (timestamp comparison) │
         │                           │
         ├─── Find duplicates ───────┤
         │    (preliminary scoring)  │
         │                           │
         ├─── Check with LLM ────────┤
         │    (confidence scoring)   │
         │                           │
         ├─── Merge duplicates ──────┤
         │    (auto-merge if >= 90%) │
         │                           │
         ├─── Import new contacts ───┤
         │    (macOS → MCP)          │
         │                           │
         └─── Export new entities ───┘
              (MCP → macOS)
```

### Performance Characteristics

- **Load**: Fast (< 1s for 1000 contacts)
- **Match**: Fast (< 1s for 1000 contacts)
- **Sync**: Fast (< 1s per contact)
- **LLM dedup**: Moderate (≈1s per check, batched with delays)
- **Import/Export**: Moderate (≈0.5s per contact via AppleScript)

**Total sync time estimate:**
- 100 contacts, 10 duplicates: 30-45 seconds
- 500 contacts, 50 duplicates: 2-3 minutes
- 1000 contacts, 100 duplicates: 4-5 minutes

### UUID Storage

MCP UUID is stored in macOS Contacts in two ways:

1. **X-MCP-UUID custom field** (preferred):
   ```
   X-MCP-UUID:entity_abc123
   ```

2. **NOTE field** (fallback):
   ```
   Great colleague!

   [MCP-UUID: entity_abc123]
   ```

Both methods ensure reliable tracking across syncs.

## API Integration

### Programmatic Usage

The sync functionality can be used programmatically:

```typescript
import { syncContacts } from 'mcp-memory-ts/cli/commands/contacts-sync';

const result = await syncContacts({
  userId: 'bob@matsuoka.com',
  direction: 'both',
  dryRun: false,
  autoMerge: true,
  threshold: 90,
  noLlm: false,
});

console.log(`Synced ${result.updated} contacts`);
console.log(`Merged ${result.merged} duplicates`);
console.log(`Imported ${result.imported} new contacts`);
console.log(`Exported ${result.exported} new entities`);
```

## Future Enhancements

Potential improvements for future versions:

- [ ] Batch AppleScript operations for faster export
- [ ] Support for contact groups/tags
- [ ] Image/photo synchronization
- [ ] Incremental sync (track last sync time)
- [ ] Conflict resolution UI for manual review
- [ ] Support for other platforms (Google Contacts, Outlook)
- [ ] Advanced LLM features (entity extraction, relationship inference)
- [ ] Sync statistics dashboard
- [ ] Scheduled automatic sync

## Support

For issues or questions:
- Check troubleshooting section above
- Review sync output for error messages
- Use `--dry-run` to preview issues
- Open issue on GitHub repository

---

**Last Updated**: 2025-10-03
**Version**: 1.2.1+
**Status**: Production-ready

*True bidirectional sync with LLM-based deduplication for intelligent contact management.*
