# MCP Memory CLI Guide

A practical single-user CLI tool for managing MCP Memory TypeScript with Claude Desktop.

## Installation

### Local Development (npm link)

```bash
# Build the project
npm run build-full

# Link globally
npm link

# Now you can use the CLI
mcp-memory --help
```

### From npm (future)

```bash
npm install -g mcp-memory-ts
```

## Quick Start

### 1. Initialize Configuration

Run the interactive setup wizard:

```bash
mcp-memory init
```

This will prompt you for:
- User email (default: bob@matsuoka.com)
- Turso database URL
- Turso auth token
- OpenAI API key

The wizard validates your credentials and saves them to `~/.mcp-memory/config.json`.

### 2. Build the Server

```bash
npm run build-full
```

### 3. Install to Claude Desktop

```bash
mcp-memory install
```

This will:
- Create/update Claude Desktop configuration at `~/Library/Application Support/Claude/claude_desktop_config.json`
- Back up existing configuration
- Configure the MCP server with your credentials
- Add the `mcp-memory-ts` server entry

### 4. Restart Claude Desktop

After installation, restart Claude Desktop to load the MCP server.

## Commands

### Configuration Management

#### Initialize Configuration
```bash
mcp-memory init
```
Interactive wizard to set up user configuration.

#### Show Configuration
```bash
mcp-memory config
```
Display current configuration (hides sensitive data).

### Claude Desktop Integration

#### Install MCP Server
```bash
mcp-memory install [platform]
```
Install and configure MCP memory server. Platform defaults to `claude-desktop`.

#### Update Configuration
```bash
mcp-memory update [platform]
```
Update MCP server configuration with current user settings.

#### Check Status
```bash
mcp-memory status [platform]
```
Check installation status and configuration.

#### Uninstall
```bash
mcp-memory uninstall [platform]
```
Remove MCP memory server from specified platform (preserves user config).

### vCard Management

#### Export Entities to vCard
```bash
mcp-memory export-vcard --user-email bob@matsuoka.com -o contacts.vcf
```

Options:
- `--user-email <email>` - User email (required)
- `-o, --output <file>` - Output file path (default: entities.vcf)
- `-t, --entity-type <type>` - Filter by entity type
- `-f, --format <version>` - vCard version: 3.0 or 4.0 (default: 4.0)
- `-a, --all` - Export all entity types

#### Import vCard
```bash
mcp-memory import-vcard contacts.vcf --user-email bob@matsuoka.com
```

Options:
- `--user-email <email>` - User email (required)
- `-t, --entity-type <type>` - Set entity type
- `-p, --person-type <type>` - Set person type
- `-i, --importance <level>` - Set importance level (1-4)
- `--tags <tags>` - Add tags (comma-separated)
- `--dry-run` - Preview without saving
- `--merge` - Merge with existing by name/email

#### List Types
```bash
mcp-memory list-types
```
Show available entity types, person types, and importance levels.

### Google Integration Commands

#### Google Authentication Status
```bash
mcp-memory google auth --user-email bob@matsuoka.com
```

Check Google account connection status and manage authentication.

Options:
- `--user-email <email>` - User email (required)
- `-u <email>` - Short form of --user-email
- `--disconnect` - Disconnect Google account and revoke access

#### Google Contacts Sync
```bash
mcp-memory google contacts-sync --user-email bob@matsuoka.com
```

Synchronize contacts between MCP Memory and Google Contacts with LLM-based deduplication.

Options:
- `--user-email <email>` - User email (required)
- `-u <email>` - Short form of --user-email
- `-d, --direction <dir>` - Sync direction: import, export, or both (default: both)
- `--dry-run` - Preview changes without applying
- `--auto-merge` - Automatically merge duplicates above threshold
- `--threshold <number>` - Deduplication confidence threshold 0-100 (default: 90)
- `--no-llm` - Disable LLM deduplication (use simple rules only)
- `--force-full` - Force full sync (ignore syncToken)
- `--batch-size <number>` - Contacts per batch (default: 100)

Examples:
```bash
# Import from Google with auto-merge
mcp-memory google contacts-sync -u bob@matsuoka.com --direction import --auto-merge

# Dry run to preview changes
mcp-memory google contacts-sync -u bob@matsuoka.com --dry-run

# Bidirectional sync with conservative merging
mcp-memory google contacts-sync -u bob@matsuoka.com --direction both --threshold 95
```

#### Google Calendar Sync
```bash
mcp-memory google calendar-sync --user-email bob@matsuoka.com
```

Sync calendar events from Google Calendar (read-only) organized by week.

Options:
- `--user-email <email>` - User email (required)
- `-u <email>` - Short form of --user-email
- `-w, --week <identifier>` - Week identifier in YYYY-WW format (default: current week)
- `--weeks <list>` - Comma-separated list of weeks to sync
- `--calendar-ids <list>` - Comma-separated calendar IDs (default: primary)
- `--create-entities` - Auto-create entities for unknown attendees
- `--skip-recurring` - Skip recurring event expansion
- `--max-events <number>` - Maximum events per week (default: 1000)

Examples:
```bash
# Sync current week
mcp-memory google calendar-sync -u bob@matsuoka.com

# Sync specific week with entity creation
mcp-memory google calendar-sync -u bob@matsuoka.com --week 2025-41 --create-entities

# Sync multiple weeks
mcp-memory google calendar-sync -u bob@matsuoka.com --weeks 2025-40,2025-41,2025-42
```

### macOS Contacts Sync

#### Bidirectional Contact Sync
```bash
mcp-memory contacts sync --user-email bob@matsuoka.com
```

Synchronize contacts between MCP Memory and macOS Contacts app with LLM-based deduplication.

Options:
- `--user-email <email>` - User email (required)
- `-d, --direction <dir>` - Sync direction: export, import, or both (default: both)
- `--dry-run` - Preview changes without making them
- `--auto-merge` - Automatically merge duplicates when confidence >= threshold
- `--threshold <number>` - Deduplication confidence threshold 0-100 (default: 90)
- `--no-llm` - Disable LLM-based deduplication (use simple rules only)

Examples:
```bash
# Import from macOS Contacts
mcp-memory contacts sync -u bob@matsuoka.com --direction import

# Export to macOS Contacts
mcp-memory contacts sync -u bob@matsuoka.com --direction export

# Bidirectional sync with auto-merge
mcp-memory contacts sync -u bob@matsuoka.com --direction both --auto-merge
```

## File Locations

### User Configuration
```
~/.mcp-memory/config.json
```

Contains:
- User email
- Turso database credentials
- OpenAI API key

### Claude Desktop Configuration
```
~/Library/Application Support/Claude/claude_desktop_config.json
```

Claude Desktop's MCP server configuration file.

### Backup
```
~/Library/Application Support/Claude/claude_desktop_config.json.backup
```

Automatic backup created before modifying Claude Desktop config.

## Workflow Example

```bash
# 1. First time setup
mcp-memory init

# 2. Build the project
npm run build-full

# 3. Install to Claude Desktop
mcp-memory install

# 4. Restart Claude Desktop

# 5. Verify installation
mcp-memory status

# 6. (Optional) Export contacts
mcp-memory export-vcard --user-email bob@matsuoka.com -o my-contacts.vcf
```

## Updating

When you make changes to the code:

```bash
# 1. Rebuild
npm run build-full

# 2. Update Claude Desktop config
mcp-memory update

# 3. Restart Claude Desktop
```

## Troubleshooting

### "User configuration not found"
Run `mcp-memory init` to create your configuration.

### "MCP server not found"
Run `npm run build-full` to compile the server.

### "Claude Desktop config not found"
Make sure Claude Desktop is installed at the standard location.

### Server not working in Claude Desktop
1. Check status: `mcp-memory status`
2. Verify all checkmarks are green
3. Restart Claude Desktop
4. Check Claude Desktop logs

### Configuration Changes Not Applied
After running `init` or `update`, you must restart Claude Desktop for changes to take effect.

## Development

### Building
```bash
# Simple build (MCP server only)
npm run build

# Full build (includes CLI)
npm run build-full
```

### Testing Locally
```bash
# Link for development
npm link

# Test commands
mcp-memory --help
mcp-memory status
```

### Unlinking
```bash
npm unlink -g mcp-memory-ts
```

## Environment Variables

The CLI reads from `~/.mcp-memory/config.json`, which is created by the `init` command.

For direct server usage, you can also use `.env` or `.env.local`:

```bash
TURSO_URL=libsql://your-database.turso.io
TURSO_AUTH_TOKEN=your-auth-token
OPENAI_API_KEY=your-openai-key
DEFAULT_USER_EMAIL=bob@matsuoka.com
LOG_LEVEL=INFO
```

## Features

- **Single-user mode**: Optimized for individual use
- **Interactive setup**: Friendly wizard for configuration
- **Credential validation**: Tests connections during setup
- **Safe updates**: Backs up configs before modification
- **Status checking**: Easy verification of installation
- **Claude Desktop integration**: Seamless MCP server management

## Next Steps

After successful installation, the MCP memory server will be available in Claude Desktop with these tools:
- `add_memory` - Store conversation memories
- `search_memories` - Semantic search across memories
- `create_entity` - Create people/organizations/projects
- `get_entity` - Retrieve entity details
- `search_entities` - Find entities
- And more...

See the main README for full MCP server capabilities.

## Related Documentation

- **[Google Setup Guide](./GOOGLE_SETUP_GUIDE.md)**: Set up Google Contacts and Calendar sync
- **[Google Contacts Sync Guide](./GOOGLE_CONTACTS_SYNC_GUIDE.md)**: Detailed contacts sync documentation
- **[Google Calendar Sync Guide](./GOOGLE_CALENDAR_SYNC_GUIDE.md)**: Calendar sync usage guide
- **[Google Migration Guide](./GOOGLE_MIGRATION_GUIDE.md)**: Migrate from macOS Contacts to Google
- **[Contacts Sync Guide](./CONTACTS_SYNC_GUIDE.md)**: macOS Contacts sync documentation
- **[Google API Reference](../api/GOOGLE_API_REFERENCE.md)**: Web API documentation
