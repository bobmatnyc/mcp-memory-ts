# Google Integration Documentation Index

This directory contains all documentation related to Google services integration (Contacts, Calendar, OAuth).

## Overview

The MCP Memory project integrates with Google services to provide seamless synchronization of contacts and calendar data. This integration uses OAuth 2.0 authentication and incremental sync capabilities.

## Setup & Configuration

### Getting Started
- [GOOGLE_SYNC_QUICK_REFERENCE.md](./GOOGLE_SYNC_QUICK_REFERENCE.md) - Quick reference guide for Google sync
- See also: [/docs/guides/GOOGLE_SETUP_GUIDE.md](../../guides/GOOGLE_SETUP_GUIDE.md) - Complete Google Cloud setup

## OAuth Authentication

### OAuth Implementation
- [GOOGLE_OAUTH_FIX_REPORT.md](./GOOGLE_OAUTH_FIX_REPORT.md) - OAuth fix implementation report
- [GOOGLE_OAUTH_FIX_SUMMARY.md](./GOOGLE_OAUTH_FIX_SUMMARY.md) - OAuth fix summary
- [GOOGLE_API_EMAIL_FIX_SUMMARY.md](./GOOGLE_API_EMAIL_FIX_SUMMARY.md) - API email permission fix

### OAuth Status & Verification
- [GOOGLE_STATUS_FIX_SUMMARY.md](./GOOGLE_STATUS_FIX_SUMMARY.md) - Status endpoint fixes

## Google Contacts Integration

### Implementation & Features
- [GOOGLE_CONTACTS_SYNC_OPTIMIZATION.md](./GOOGLE_CONTACTS_SYNC_OPTIMIZATION.md) - Sync optimization strategies
- [GOOGLE_CONTACTS_PERMISSION_FIX.md](./GOOGLE_CONTACTS_PERMISSION_FIX.md) - Permission handling fixes
- [GOOGLE_CONTACTS_ERROR_HANDLING_DEPLOYMENT.md](../../deployment/GOOGLE_CONTACTS_ERROR_HANDLING_DEPLOYMENT.md) - Error handling deployment

### Incremental Sync
- [ETAG_FIX_REPORT.md](./ETAG_FIX_REPORT.md) - ETag-based incremental sync implementation
- Uses Google's `syncToken` for efficient updates
- LLM-powered duplicate detection

### Logging & Debugging
- [GOOGLE_CONTACTS_SYNC_LOGGING_GUIDE.md](./GOOGLE_CONTACTS_SYNC_LOGGING_GUIDE.md) - Comprehensive logging guide
- [GOOGLE_CONTACTS_SYNC_LOGGING_SUMMARY.md](./GOOGLE_CONTACTS_SYNC_LOGGING_SUMMARY.md) - Logging implementation summary
- [EXAMPLE_SYNC_LOGS.md](./EXAMPLE_SYNC_LOGS.md) - Example log outputs

## Error Handling & Troubleshooting

### Error Investigation
- [GOOGLE_SYNC_ERROR_FIX_SUMMARY.md](./GOOGLE_SYNC_ERROR_FIX_SUMMARY.md) - Error fix summary
- [GOOGLE_SYNC_UNKNOWN_ERROR_INVESTIGATION.md](./GOOGLE_SYNC_UNKNOWN_ERROR_INVESTIGATION.md) - Unknown error investigation

## Implementation Details

### Web UI Integration
- [GOOGLE_WEB_UI_IMPLEMENTATION.md](./GOOGLE_WEB_UI_IMPLEMENTATION.md) - Web interface implementation
- [GOOGLE_SYNC_IMPLEMENTATION_SUMMARY.md](./GOOGLE_SYNC_IMPLEMENTATION_SUMMARY.md) - Overall implementation summary

## Related Documentation

### User Guides
- [Google Contacts Sync Guide](../../guides/GOOGLE_CONTACTS_SYNC_GUIDE.md) - User-facing guide
- [Google Calendar Sync Guide](../../guides/GOOGLE_CALENDAR_SYNC_GUIDE.md) - Calendar sync guide
- [Google Migration Guide](../../guides/GOOGLE_MIGRATION_GUIDE.md) - Migration from macOS Contacts

### Testing
- [Google OAuth Test Checklist](../../testing/GOOGLE_OAUTH_TEST_CHECKLIST.md)
- [Google Routes Audit Report](../../testing/GOOGLE_ROUTES_AUDIT_REPORT.md)
- [Google OAuth Status Fix Verification](../../testing/GOOGLE_OAUTH_STATUS_FIX_VERIFICATION.md)

### API Reference
- [Google API Reference](../../api/GOOGLE_API_REFERENCE.md) - REST API endpoints

### Deployment
- [Google Contacts Error Handling Deployment](../../deployment/GOOGLE_CONTACTS_ERROR_HANDLING_DEPLOYMENT.md)

## CLI Commands

### Authentication
```bash
# Check Google connection status
mcp-memory google auth --user-email user@example.com
```

### Google Contacts Sync
```bash
# Import from Google to MCP Memory
mcp-memory google contacts-sync --user-email user@example.com --direction import

# Export from MCP Memory to Google
mcp-memory google contacts-sync --user-email user@example.com --direction export

# Bidirectional sync with auto-merge
mcp-memory google contacts-sync --user-email user@example.com --direction both --auto-merge
```

### Google Calendar Sync
```bash
# Sync current week's calendar events
mcp-memory google calendar-sync --user-email user@example.com

# Sync specific week with entity creation
mcp-memory google calendar-sync --user-email user@example.com --week 2025-41 --create-entities
```

## Architecture

### Key Features
1. **OAuth 2.0 Authentication**: Secure token management with Clerk integration
2. **Incremental Sync**: Uses Google's syncToken for efficient updates
3. **LLM Deduplication**: GPT-4 powered duplicate detection
4. **Entity Linking**: Automatic entity creation from calendar attendees
5. **Error Recovery**: Comprehensive error handling and retry logic
6. **Logging**: Detailed logging for debugging and monitoring

### Data Flow
```
Google Services → OAuth Token → API Request → Sync Service → Database
                                                    ↓
                                            LLM Deduplication
                                                    ↓
                                            Entity Management
```

## Version History

- **v1.7.0** (Oct 2025): Initial Google integration release
  - Google Contacts sync with incremental updates
  - Google Calendar sync with week-based tracking
  - OAuth integration with Clerk
  - LLM-powered deduplication

## Best Practices

1. **Authentication**: Always verify OAuth status before sync operations
2. **Incremental Sync**: Use syncToken to minimize API calls
3. **Error Handling**: Implement retry logic with exponential backoff
4. **Logging**: Use appropriate LOG_LEVEL for production (info or error)
5. **Rate Limiting**: Respect Google API quotas and limits

## Troubleshooting

### Common Issues
1. **OAuth Errors**: Check token expiration and refresh flow
2. **Permission Errors**: Verify OAuth scopes in Google Cloud Console
3. **Sync Failures**: Review logs with LOG_LEVEL=debug
4. **Duplicate Contacts**: Adjust LLM deduplication confidence threshold

### Debug Mode
```bash
# Enable debug logging for detailed output
LOG_LEVEL=debug mcp-memory google contacts-sync --user-email user@example.com
```

---

**Last Updated**: 2025-10-20
**Feature Version**: v1.7.0+
**Status**: Production-ready
