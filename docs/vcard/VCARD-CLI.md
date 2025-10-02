# vCard CLI - Import/Export Contacts

The MCP Memory TypeScript project includes a CLI tool for importing and exporting entities (contacts) in vCard format (RFC 6350).

## Features

- ✅ Export entities to vCard 3.0 or 4.0 format
- ✅ Import vCard files to create entities
- ✅ Support for all standard vCard fields
- ✅ Custom MCP properties (entity type, importance, etc.)
- ✅ Merge/update existing entities
- ✅ Dry-run mode for safe testing
- ✅ Multi-tenant user isolation
- ✅ Batch import/export

## Installation

```bash
# Install dependencies
npm install

# Build the project
npm run build

# (Optional) Link CLI globally
npm link
```

## Quick Start

```bash
# List available entity and person types
npm run cli:types

# Export entities to vCard
npm run cli:export -- --user-email user@example.com -o contacts.vcf

# Import vCard file (dry run)
npm run cli:import -- contacts.vcf --user-email user@example.com --dry-run

# Import vCard file (actual import)
npm run cli:import -- contacts.vcf --user-email user@example.com
```

## Commands

### 1. List Types

Display available entity types, person types, and importance levels.

```bash
npm run cli:types

# Or directly
npm run cli -- list-types
```

**Output:**
```
=== Entity Types ===
  PERSON: person
  ORGANIZATION: organization
  PROJECT: project
  CONCEPT: concept
  LOCATION: location
  EVENT: event

=== Person Types ===
  ME: me
  FAMILY: family
  FRIEND: friend
  COLLEAGUE: colleague
  CLIENT: client
  OTHER: other

=== Importance Levels ===
  1: LOW
  2: MEDIUM
  3: HIGH
  4: CRITICAL
```

### 2. Export vCard

Export entities to vCard format.

```bash
npm run cli -- export-vcard --user-email <email> [options]
```

**Options:**

| Option | Description | Default |
|--------|-------------|---------|
| `--user-email <email>` | User email or ID (required) | - |
| `-o, --output <file>` | Output file path | `entities.vcf` |
| `-t, --entity-type <type>` | Filter by entity type | `person` |
| `-f, --format <version>` | vCard version (3.0 or 4.0) | `4.0` |
| `-a, --all` | Export all entity types | `false` |

**Examples:**

```bash
# Export all person entities
npm run cli -- export-vcard --user-email user@example.com

# Export to custom file
npm run cli -- export-vcard --user-email user@example.com -o my-contacts.vcf

# Export all entity types
npm run cli -- export-vcard --user-email user@example.com --all

# Export in vCard 3.0 format
npm run cli -- export-vcard --user-email user@example.com -f 3.0

# Export organizations only
npm run cli -- export-vcard --user-email user@example.com -t organization
```

### 3. Import vCard

Import vCard files to create entities.

```bash
npm run cli -- import-vcard <file> --user-email <email> [options]
```

**Options:**

| Option | Description | Default |
|--------|-------------|---------|
| `<file>` | vCard file to import (required) | - |
| `--user-email <email>` | User email or ID (required) | - |
| `-t, --entity-type <type>` | Set entity type | `person` |
| `-p, --person-type <type>` | Set person type | - |
| `-i, --importance <level>` | Set importance (1-4) | `2` |
| `--tags <tags>` | Add tags (comma-separated) | - |
| `--dry-run` | Preview without saving | `false` |
| `--merge` | Skip existing entities by name/email | `false` |

**Examples:**

```bash
# Import contacts (dry run)
npm run cli -- import-vcard contacts.vcf --user-email user@example.com --dry-run

# Import contacts (actual)
npm run cli -- import-vcard contacts.vcf --user-email user@example.com

# Import with specific person type
npm run cli -- import-vcard contacts.vcf --user-email user@example.com -p colleague

# Import with tags
npm run cli -- import-vcard contacts.vcf --user-email user@example.com --tags work,tech

# Import with merge (skip existing)
npm run cli -- import-vcard contacts.vcf --user-email user@example.com --merge

# Import with high importance
npm run cli -- import-vcard contacts.vcf --user-email user@example.com -i 3
```

## vCard Format

### Standard Fields

The CLI supports all standard vCard fields:

| vCard Property | Entity Field | Description |
|---------------|--------------|-------------|
| `FN` | `name` | Formatted Name (required) |
| `N` | - | Structured Name |
| `EMAIL` | `email` | Email address |
| `TEL` | `phone` | Phone number |
| `ADR` | `address` | Address |
| `ORG` | `company` | Organization |
| `TITLE` | `title` | Job title |
| `URL` | `website` | Website URL |
| `NOTE` | `notes` | Notes |
| `CATEGORIES` | `tags` | Tags/Categories |

### Custom MCP Properties

The CLI extends vCard with custom properties (X- prefix):

| Property | Entity Field | Description |
|----------|--------------|-------------|
| `X-MCP-ENTITY-TYPE` | `entityType` | Entity type (person, organization, etc.) |
| `X-MCP-PERSON-TYPE` | `personType` | Person type (colleague, friend, etc.) |
| `X-MCP-IMPORTANCE` | `importance` | Importance level (1-4) |
| `X-MCP-SOCIAL-MEDIA` | `socialMedia` | Social media handles |
| `X-MCP-RELATIONSHIPS` | `relationships` | Relationship descriptions |
| `X-MCP-LAST-INTERACTION` | `lastInteraction` | Last interaction timestamp |
| `X-MCP-INTERACTION-COUNT` | `interactionCount` | Interaction count |

### Example vCard

```
BEGIN:VCARD
VERSION:4.0
FN:John Doe
N:Doe;John;;;
EMAIL:john.doe@example.com
TEL:+1-555-1234
ADR:;;123 Main St;San Francisco;CA;94102;USA
ORG:Acme Corporation
TITLE:Software Engineer
URL:https://johndoe.com
NOTE:Met at tech conference 2024. Interested in AI and ML.
CATEGORIES:tech,colleague,ai
X-MCP-ENTITY-TYPE:person
X-MCP-PERSON-TYPE:colleague
X-MCP-IMPORTANCE:3
X-MCP-SOCIAL-MEDIA:@johndoe
END:VCARD
```

## Environment Setup

Set these environment variables:

```bash
# Required
TURSO_URL=libsql://your-database.turso.io
TURSO_AUTH_TOKEN=your-auth-token

# Optional
DEFAULT_USER_EMAIL=user@example.com
```

Or create a `.env` file in the project root.

## Use Cases

### 1. Backup Contacts

```bash
# Export all contacts to backup
npm run cli -- export-vcard --user-email user@example.com --all -o backup-$(date +%Y%m%d).vcf
```

### 2. Import from Phone/Email Client

Most email clients and phone apps can export contacts in vCard format. Simply export and import:

```bash
# Use --merge to skip duplicates by name/email
npm run cli -- import-vcard phone-contacts.vcf --user-email user@example.com --merge
```

### 3. Share Contacts

Export specific types of contacts to share:

```bash
# Export work colleagues
npm run cli -- export-vcard --user-email user@example.com -t person -o colleagues.vcf
```

### 4. Migrate Between Accounts

```bash
# Export from old account
npm run cli -- export-vcard --user-email old@example.com -o export.vcf

# Import to new account
npm run cli -- import-vcard export.vcf --user-email new@example.com
```

### 5. Bulk Import with Tags

```bash
# Import conference contacts with tags
npm run cli -- import-vcard conference-2024.vcf --user-email user@example.com \
  --tags conference,2024,networking -p colleague
```

## Testing

A test script is provided to verify CLI functionality:

```bash
# Run tests
./test-vcard-cli.sh
```

This will:
1. List available types
2. Show help for export/import
3. Test vCard parsing with dry-run
4. Verify CLI installation

## Troubleshooting

### "User not found" error

Ensure the user exists in the database:

```bash
# The user email must match an existing user
# Check your database or create user first
```

### Database connection failed

Check environment variables:

```bash
# Verify credentials
echo $TURSO_URL
echo $TURSO_AUTH_TOKEN

# Or load from .env
source .env
```

### Import failed: Invalid vCard

Validate your vCard file:
- Must contain `BEGIN:VCARD` and `END:VCARD`
- Must contain `FN` (Formatted Name)
- Check for proper escaping (\\, \\n, \\,, \\;)

### Merge behavior

The merge feature skips existing entities by matching:
1. Email (exact match, case-insensitive)
2. Name (exact match, case-insensitive)

When `--merge` is used, entities with matching name or email will be skipped, preventing duplicates. Without `--merge`, all vCards will be imported as new entities.

## Advanced Usage

### Custom TypeScript Script

```typescript
import { parseVCard } from './vcard/parser.js';
import { vcardToEntity } from './vcard/mapper.js';
import { generateVCard } from './vcard/generator.js';

// Parse vCard
const vcards = parseVCard(vcardText);

// Convert to entities
const entities = vcards.map(vcard =>
  vcardToEntity(vcard, userId, { importance: 3 })
);

// Generate vCard
const vcardText = generateVCard(vcards, '4.0');
```

### Programmatic Import

```typescript
import { importVCard } from './cli/commands/import.js';

const result = await importVCard({
  userId: 'user@example.com',
  inputPath: 'contacts.vcf',
  entityType: EntityType.PERSON,
  importance: ImportanceLevel.MEDIUM,
  dryRun: false,
  merge: true,
});

console.log(`Imported: ${result.imported}, Updated: ${result.updated}`);
```

## Integration with npm scripts

Add to `package.json`:

```json
{
  "scripts": {
    "export-contacts": "npm run cli -- export-vcard --user-email $USER_EMAIL",
    "import-contacts": "npm run cli -- import-vcard contacts.vcf --user-email $USER_EMAIL",
    "backup-contacts": "npm run cli -- export-vcard --user-email $USER_EMAIL --all -o backup.vcf"
  }
}
```

## Related Documentation

- [RFC 6350 - vCard Format Specification](https://www.rfc-editor.org/rfc/rfc6350.html)
- [MCP Memory TypeScript README](./README.md)
- [Entity Types and Schema](./src/types/enums.ts)

## Support

For issues, questions, or contributions, please open an issue on GitHub.
