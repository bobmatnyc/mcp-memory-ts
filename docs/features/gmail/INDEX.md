# Gmail Integration Documentation Index

This directory contains all documentation related to Gmail extraction and email memory integration.

## Overview

The Gmail integration provides automated extraction of important information from emails, creating structured memories and entities from email content. This feature is currently in active development.

## Implementation Documentation

### Core Implementation
- [GMAIL_EXTRACTION_IMPLEMENTATION.md](./GMAIL_EXTRACTION_IMPLEMENTATION.md) - Core Gmail extraction implementation
- [GMAIL_EXTRACTION_DATABASE_TOKEN_FIX.md](./GMAIL_EXTRACTION_DATABASE_TOKEN_FIX.md) - Database token handling fixes

### Extraction & Retry Logic
- [EXTRACTION_RETRY_FIX.md](./EXTRACTION_RETRY_FIX.md) - Retry mechanism implementation
- [EXTRACTION_RETRY_IMPLEMENTATION_SUMMARY.md](./EXTRACTION_RETRY_IMPLEMENTATION_SUMMARY.md) - Retry implementation summary

### Debugging & Reports
- [GMAIL_EXTRACTION_DEBUG_REPORT.md](./GMAIL_EXTRACTION_DEBUG_REPORT.md) - Debug report and findings

## Related Testing Documentation

Testing documentation for Gmail features is located in `/docs/testing/`:
- [GMAIL_FILTER_TEST_REPORT.md](../../testing/GMAIL_FILTER_TEST_REPORT.md) - Filter testing report
- [GMAIL_TEST_SUMMARY.md](../../testing/GMAIL_TEST_SUMMARY.md) - Overall testing summary
- [VERIFY_GMAIL_EXTRACTION_FIX.md](../../testing/VERIFY_GMAIL_EXTRACTION_FIX.md) - Extraction verification
- [EXTRACTION_RETRY_VERIFICATION.md](../../testing/EXTRACTION_RETRY_VERIFICATION.md) - Retry verification

## Related Deployment Documentation

Deployment documentation for Gmail features:
- [GMAIL_EXTRACTION_DEPLOYMENT_REPORT.md](../../deployment/GMAIL_EXTRACTION_DEPLOYMENT_REPORT.md) - Deployment report

## Features (In Development)

### Email Extraction
- Automated email scanning and filtering
- Important information extraction using LLM
- Entity creation from email participants
- Memory creation from email content

### Token Management
- Secure Gmail API token storage
- Token refresh handling
- Multi-user token isolation

### Retry Logic
- Failed extraction retry mechanism
- Exponential backoff for rate limiting
- Error recovery and logging

## Architecture

### Data Flow
```
Gmail API → Email Fetch → Content Filter → LLM Extraction → Memory/Entity Creation
                ↓                                               ↓
          Token Manager                                   Database Storage
```

### Components
1. **Gmail Client**: API communication and authentication
2. **Extraction Service**: Email processing and filtering
3. **Retry Manager**: Failed extraction handling
4. **Token Manager**: OAuth token management
5. **Memory Creator**: Structured data storage

## Configuration

### Environment Variables
```bash
# Gmail API Configuration (uses Google OAuth)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# OAuth scopes required
# - https://www.googleapis.com/auth/gmail.readonly
# - https://www.googleapis.com/auth/gmail.modify (for marking as read)
```

### Database Schema
```sql
-- Gmail extraction logs
CREATE TABLE gmail_extraction_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  email_id TEXT NOT NULL,
  status TEXT NOT NULL,  -- 'success', 'failed', 'skipped'
  extracted_at TIMESTAMP,
  retry_count INTEGER DEFAULT 0,
  error_message TEXT
);
```

## CLI Commands (Planned)

```bash
# Extract emails from Gmail
mcp-memory gmail extract --user-email user@example.com

# Extract with date range
mcp-memory gmail extract --user-email user@example.com --from 2025-01-01 --to 2025-01-31

# Retry failed extractions
mcp-memory gmail retry --user-email user@example.com
```

## Development Status

### ✅ Completed
- Gmail API client implementation
- Token storage and management
- Basic email extraction
- Database schema for extraction logs
- Retry mechanism for failed extractions

### 🚧 In Progress
- Email filtering optimization
- LLM extraction prompt engineering
- Batch processing for large mailboxes
- UI for extraction management

### 📋 Planned
- Email thread tracking
- Attachment processing
- Smart filtering (important emails only)
- Extraction scheduling and automation
- User-configurable extraction rules

## Best Practices

1. **OAuth Scopes**: Use minimal required scopes (gmail.readonly + gmail.modify)
2. **Rate Limiting**: Respect Gmail API quotas (use batch processing)
3. **Privacy**: Only extract emails marked as important by user
4. **Storage**: Store minimal email metadata, not full content
5. **Retry Logic**: Implement exponential backoff for API errors

## Troubleshooting

### Common Issues

#### Authentication Errors
```bash
# Check Gmail OAuth status
mcp-memory google auth --user-email user@example.com

# Re-authenticate if needed
# Visit web interface to reconnect Google account
```

#### Extraction Failures
```bash
# Enable debug logging
LOG_LEVEL=debug mcp-memory gmail extract --user-email user@example.com

# Check extraction logs
SELECT * FROM gmail_extraction_logs WHERE status = 'failed';
```

#### Rate Limiting
- Reduce batch size in extraction configuration
- Increase delay between API requests
- Use exponential backoff for retries

## Related Documentation

### Google Integration
- [Google OAuth Setup](../../guides/GOOGLE_SETUP_GUIDE.md)
- [Google Integration Index](../google/INDEX.md)

### Testing
- [Gmail Test Reports](../../testing/INDEX.md#gmail-integration)

### Deployment
- [Gmail Deployment Guide](../../deployment/INDEX.md#feature-specific-deployments)

## Support & Feedback

Gmail extraction is an active development feature. For issues or feature requests:
1. Check debug logs with `LOG_LEVEL=debug`
2. Review extraction logs in database
3. File issue on GitHub repository
4. Check web interface for extraction status

---

**Last Updated**: 2025-10-20
**Feature Status**: Beta (Active Development)
**Version**: 1.6.0+
