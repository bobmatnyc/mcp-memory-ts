# vCard CLI - Add this to README.md

## 🔄 vCard Import/Export

The MCP Memory TypeScript project includes a powerful CLI for importing and exporting contacts in vCard format.

### Quick Start

```bash
# List available types
npm run cli:types

# Export entities to vCard
npm run cli:export -- --user-email user@example.com -o contacts.vcf

# Import vCard file
npm run cli:import -- contacts.vcf --user-email user@example.com --dry-run
```

### Features

- ✅ Export entities to vCard 3.0/4.0 format
- ✅ Import vCard files from any app (phone, email client, CRM)
- ✅ Custom MCP properties (entity type, importance, etc.)
- ✅ Smart merge to prevent duplicates
- ✅ Dry-run mode for safe testing
- ✅ Multi-tenant support

### Documentation

See [VCARD-CLI.md](./VCARD-CLI.md) for comprehensive documentation.

### Example

Export your contacts:

```bash
npm run cli -- export-vcard --user-email user@example.com -o backup.vcf
```

Import from your phone:

```bash
npm run cli -- import-vcard phone-contacts.vcf --user-email user@example.com --merge
```

### Use Cases

- Backup and restore contacts
- Migrate between accounts
- Import from phone/email clients
- Share contact lists
- Bulk import with custom tags

For detailed usage, see the [vCard CLI Documentation](./VCARD-CLI.md).

---

## Insert this section into README.md after the installation section
