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
mcp-memory claude-desktop install
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
mcp-memory claude-desktop install
```
Install and configure MCP memory server in Claude Desktop.

#### Update Configuration
```bash
mcp-memory claude-desktop update
```
Update MCP server configuration with current user settings.

#### Check Status
```bash
mcp-memory claude-desktop status
```
Check installation status and configuration.

#### Uninstall
```bash
mcp-memory claude-desktop uninstall
```
Remove MCP memory server from Claude Desktop (preserves user config).

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
mcp-memory claude-desktop install

# 4. Restart Claude Desktop

# 5. Verify installation
mcp-memory claude-desktop status

# 6. (Optional) Export contacts
mcp-memory export-vcard --user-email bob@matsuoka.com -o my-contacts.vcf
```

## Updating

When you make changes to the code:

```bash
# 1. Rebuild
npm run build-full

# 2. Update Claude Desktop config
mcp-memory claude-desktop update

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
1. Check status: `mcp-memory claude-desktop status`
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
mcp-memory claude-desktop status
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
