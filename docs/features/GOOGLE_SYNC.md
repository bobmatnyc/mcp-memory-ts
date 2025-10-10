# Google Sync Integration

**Status**: Production Ready
**Version**: 1.7.0
**Last Updated**: 2025-10-09

## Overview

MCP Memory TypeScript provides comprehensive Google Workspace integration, allowing you to synchronize contacts and calendar events between MCP Memory and your Google account. This integration enhances your AI assistant's knowledge by automatically keeping your contact information and calendar events up-to-date.

## Features at a Glance

### Google Contacts Sync
- **Bidirectional Synchronization**: Import from Google, export to Google, or sync both ways
- **Incremental Updates**: Efficient syncToken-based sync that only transfers changed data
- **Smart Deduplication**: LLM-powered duplicate detection using GPT-4 for intelligent merging
- **Conflict Resolution**: Automatic resolution based on modification timestamps
- **Field Mapping**: Comprehensive mapping of all Google contact fields to MCP entities
- **Dry-Run Mode**: Preview changes before applying them

### Google Calendar Sync
- **Week-based Tracking**: Organize events by week identifier (YYYY-WW format)
- **Recurring Events**: Automatic expansion and tracking of recurring events
- **Attendee Linking**: Automatically link calendar attendees to existing entities
- **Multiple Calendars**: Support for syncing multiple Google Calendars
- **Event Querying**: Powerful filtering and search capabilities
- **Read-only Access**: Safe, non-intrusive calendar monitoring

### OAuth Authentication
- **Secure OAuth 2.0**: Industry-standard authentication with offline access
- **Automatic Token Refresh**: Seamless token renewal without user intervention
- **Scope Validation**: Verify and request only necessary permissions
- **Web Interface**: Easy connection management via settings page
- **CLI Support**: Command-line tools for authentication management

## Benefits and Use Cases

### For Personal Users
- **Keep contacts in sync**: Never manually update contacts in multiple places again
- **Calendar awareness**: Your AI assistant knows about your schedule and meetings
- **Smart deduplication**: Automatically merge duplicate contacts intelligently
- **Cross-platform**: Access your data from any device with MCP Memory

### For Teams
- **Centralized contacts**: Share contact information across team members
- **Meeting context**: AI assistants understand who attended which meetings
- **Relationship tracking**: Automatically build relationship graphs from calendar data
- **Integration workflows**: Connect with other tools and services

### For Developers
- **API-first design**: Well-documented REST API for custom integrations
- **CLI tools**: Powerful command-line interface for automation
- **Webhooks**: Real-time notifications of sync events (coming soon)
- **Extensible**: Easy to add custom sync rules and transformations

## Comparison with macOS Contacts Sync

| Feature | Google Contacts | macOS Contacts |
|---------|----------------|----------------|
| Platform | Cross-platform | macOS only |
| Incremental Sync | Yes (syncToken) | No (full sync) |
| Cloud-based | Yes | Local only |
| LLM Deduplication | Yes | Yes |
| Bidirectional | Yes | Yes |
| Calendar Integration | Yes | No |
| Mobile Access | Yes | Limited |
| Team Sharing | Yes | No |

**Recommendation**: Use Google Contacts sync for cross-platform access and team collaboration. Use macOS Contacts sync if you prefer local-only data or need integration with macOS-specific features.

## Prerequisites

Before you can use Google sync, you need:

1. **Google Account**: A Google Workspace or personal Google account
2. **Google Cloud Project**: For OAuth credentials (free tier available)
3. **MCP Memory Setup**: Complete MCP Memory installation and configuration
4. **OpenAI API Key**: Required for LLM-based deduplication (optional feature)

See the [Google Setup Guide](../guides/GOOGLE_SETUP_GUIDE.md) for detailed setup instructions.

## Security and Privacy

### Data Protection
- **OAuth 2.0**: No passwords stored; uses secure token-based authentication
- **Minimal Scopes**: Requests only necessary permissions (contacts.readonly, calendar.readonly)
- **Local Storage**: OAuth tokens stored securely in your database
- **User Isolation**: Multi-tenant architecture ensures data separation
- **Encryption**: All data encrypted in transit (HTTPS) and at rest (Turso)

### Privacy Considerations
- **Read-only Calendar**: Calendar sync is read-only; we never modify your Google Calendar
- **No External Sharing**: Your data is never shared with third parties
- **Revocable Access**: Disconnect Google at any time from settings
- **Audit Logs**: Track all sync operations for transparency
- **GDPR Compliant**: Designed with privacy regulations in mind

### Best Practices
1. **Regular audits**: Review connected accounts periodically
2. **Minimal permissions**: Only grant scopes you actually need
3. **Token rotation**: Disconnect and reconnect occasionally to refresh tokens
4. **Backup data**: Keep local backups before major sync operations
5. **Test with dry-run**: Always test sync operations with `--dry-run` first

## How It Works

### Google Contacts Sync Flow

```
┌─────────────────┐         ┌──────────────────┐         ┌─────────────────┐
│  Google         │         │  MCP Memory      │         │  Your AI        │
│  Contacts       │◄────────┤  Sync Service    │────────►│  Assistant      │
└─────────────────┘         └──────────────────┘         └─────────────────┘
        │                            │                            │
        │ 1. Request contacts        │                            │
        │    (with syncToken)        │                            │
        ├────────────────────────────►                            │
        │                            │                            │
        │ 2. Return changes only     │                            │
        │◄───────────────────────────┤                            │
        │                            │                            │
        │                            │ 3. LLM deduplication       │
        │                            ├────────────────────────────►
        │                            │                            │
        │                            │ 4. Merge suggestions       │
        │                            │◄───────────────────────────┤
        │                            │                            │
        │                            │ 5. Store entities          │
        │                            ├───────────►[Database]      │
        │                            │                            │
        │ 6. Update Google (export)  │                            │
        │◄───────────────────────────┤                            │
```

### Google Calendar Sync Flow

```
┌─────────────────┐         ┌──────────────────┐         ┌─────────────────┐
│  Google         │         │  MCP Memory      │         │  Calendar       │
│  Calendar       │◄────────┤  Sync Service    │────────►│  Events DB      │
└─────────────────┘         └──────────────────┘         └─────────────────┘
        │                            │                            │
        │ 1. Get events for week     │                            │
        │    (week identifier)       │                            │
        ├────────────────────────────►                            │
        │                            │                            │
        │ 2. Return events           │                            │
        │◄───────────────────────────┤                            │
        │                            │                            │
        │                            │ 3. Extract attendees       │
        │                            ├────────►[Entity Matcher]   │
        │                            │                            │
        │                            │ 4. Link to entities        │
        │                            │◄───────────────────────────┤
        │                            │                            │
        │                            │ 5. Store events            │
        │                            ├────────────────────────────►
```

## Getting Started

### Quick Start (5 minutes)

1. **Set up Google Cloud credentials** (one-time setup):
   ```bash
   # Follow the setup guide
   open https://console.cloud.google.com/
   ```
   See: [Google Setup Guide](../guides/GOOGLE_SETUP_GUIDE.md)

2. **Configure environment variables**:
   ```bash
   # Add to .env
   GOOGLE_CLIENT_ID=your-client-id
   GOOGLE_CLIENT_SECRET=your-client-secret
   GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback
   ```

3. **Connect your Google account** (via web interface):
   ```bash
   # Start web server
   cd web && npm run dev

   # Open settings page
   open http://localhost:3000/settings

   # Click "Connect Google Account"
   ```

4. **Sync your contacts**:
   ```bash
   # Import contacts from Google
   mcp-memory google contacts-sync \
     --user-email your-email@example.com \
     --direction import
   ```

5. **Sync your calendar**:
   ```bash
   # Sync current week's events
   mcp-memory google calendar-sync \
     --user-email your-email@example.com
   ```

### Detailed Guides

- **[Google Setup Guide](../guides/GOOGLE_SETUP_GUIDE.md)**: Step-by-step Google Cloud setup
- **[Google Contacts Sync Guide](../guides/GOOGLE_CONTACTS_SYNC_GUIDE.md)**: Complete contacts sync documentation
- **[Google Calendar Sync Guide](../guides/GOOGLE_CALENDAR_SYNC_GUIDE.md)**: Calendar sync usage and examples
- **[Google API Reference](../api/GOOGLE_API_REFERENCE.md)**: API endpoints and schemas
- **[Google Migration Guide](../guides/GOOGLE_MIGRATION_GUIDE.md)**: Migrating from other sync sources

## Troubleshooting

### Common Issues

#### OAuth Connection Failed
**Symptom**: "OAuth client not configured" error

**Solution**:
1. Verify environment variables are set:
   ```bash
   echo $GOOGLE_CLIENT_ID
   echo $GOOGLE_CLIENT_SECRET
   ```
2. Check Google Cloud Console credentials
3. Ensure redirect URI matches exactly
4. Restart application after configuration changes

#### Redirect URI Mismatch
**Symptom**: "redirect_uri_mismatch" error

**Solution**:
1. Check Google Cloud Console > Credentials
2. Verify redirect URI is exactly: `http://localhost:3000/api/auth/google/callback`
3. No trailing slash, correct protocol (http vs https)
4. Add production URI when deploying: `https://yourdomain.com/api/auth/google/callback`

#### Insufficient Permissions
**Symptom**: "Insufficient Permission: Request had insufficient authentication scopes"

**Solution**:
1. Disconnect Google account:
   ```bash
   mcp-memory google auth --disconnect --user-email your@email.com
   ```
2. Reconnect via web interface
3. Ensure you grant ALL requested permissions
4. Check OAuth consent screen scopes

#### Sync Token Expired
**Symptom**: "Sync token expired, performing full sync..."

**Solution**:
- This is normal behavior! syncToken expires after 7 days of inactivity
- System automatically falls back to full sync
- No action needed; next sync will be incremental

#### Rate Limit Exceeded
**Symptom**: "Rate limit exceeded, retry after 120s"

**Solution**:
1. Wait for the specified time (automatic retry)
2. Reduce batch size in sync options
3. Check Google Cloud Console quotas
4. Consider upgrading quota limits if needed

#### Duplicate Contacts After Sync
**Symptom**: Same contact appears multiple times

**Solution**:
1. Run deduplication manually:
   ```bash
   mcp-memory google contacts-sync \
     --user-email your@email.com \
     --direction import \
     --auto-merge \
     --threshold 90
   ```
2. Review merge suggestions before applying
3. Adjust threshold (80-95) based on your needs

#### Calendar Events Not Showing
**Symptom**: Synced but events not visible

**Solution**:
1. Verify week identifier:
   ```bash
   # Check current week
   mcp-memory google calendar-sync \
     --user-email your@email.com \
     --week $(date +%Y-%W)
   ```
2. Check calendar permissions in Google
3. Verify calendar ID is correct
4. Review sync logs for errors

### Debug Mode

Enable detailed logging for troubleshooting:

```bash
# CLI commands
DEBUG=* mcp-memory google contacts-sync --user-email your@email.com

# Web interface
# Set in .env:
LOG_LEVEL=DEBUG
MCP_DEBUG=1
```

### Support Resources

- **Documentation**: [docs/guides/](../guides/)
- **API Reference**: [docs/api/GOOGLE_API_REFERENCE.md](../api/GOOGLE_API_REFERENCE.md)
- **GitHub Issues**: [File a bug report](https://github.com/your-org/mcp-memory-ts/issues)
- **Community**: [Discuss on Discord](https://discord.gg/your-server)

## Performance Considerations

### Sync Frequency

**Contacts Sync**:
- **On-demand**: Run manually when needed
- **Daily**: Reasonable for most users
- **Hourly**: For high-frequency contact updates
- **Real-time**: Not currently supported (coming soon via webhooks)

**Calendar Sync**:
- **Weekly**: Recommended for most users
- **Daily**: For active calendar users
- **On-demand**: Before important meetings or events

### Optimization Tips

1. **Use incremental sync**: Always prefer incremental over full sync
2. **Set appropriate thresholds**: Higher threshold = fewer false positives
3. **Batch operations**: Sync multiple weeks at once for calendar
4. **Monitor quotas**: Check Google Cloud Console for API usage
5. **Cache results**: Use dry-run to validate before actual sync

### Resource Usage

- **Storage**: ~1KB per contact, ~2KB per calendar event
- **API Calls**: 1 call per sync (incremental), multiple calls (full sync)
- **Processing Time**: 1-5 seconds per 100 contacts (with LLM deduplication)
- **Network**: Minimal bandwidth (~100KB per 1000 contacts)

## Roadmap

### Coming Soon
- **Webhooks**: Real-time sync on Google data changes
- **Batch operations**: Bulk import/export for large datasets
- **Custom rules**: User-defined sync filters and transformations
- **Analytics**: Sync health metrics and insights
- **Gmail integration**: Extract contacts from email threads

### Future Enhancements
- **Google Drive**: Sync documents and files metadata
- **Google Tasks**: Task management integration
- **Google Keep**: Notes and reminders sync
- **Advanced scheduling**: Cron-like sync schedules
- **Multi-account**: Support multiple Google accounts per user

## Related Documentation

- **[Google Setup Guide](../guides/GOOGLE_SETUP_GUIDE.md)**: Initial setup and configuration
- **[Google Contacts Sync Guide](../guides/GOOGLE_CONTACTS_SYNC_GUIDE.md)**: Detailed contacts sync documentation
- **[Google Calendar Sync Guide](../guides/GOOGLE_CALENDAR_SYNC_GUIDE.md)**: Calendar sync usage guide
- **[Google API Reference](../api/GOOGLE_API_REFERENCE.md)**: API documentation
- **[CLI Guide](../guides/CLI-GUIDE.md)**: Complete CLI reference
- **[Web Interface Guide](./WEB_INTERFACE.md)**: Web UI documentation

---

**Need Help?**

If you encounter issues not covered here:
1. Check the troubleshooting section above
2. Review the detailed guides linked throughout
3. Enable debug logging for more details
4. File an issue on GitHub with logs and reproduction steps

**Last Updated**: 2025-10-09
**Version**: 1.7.0
