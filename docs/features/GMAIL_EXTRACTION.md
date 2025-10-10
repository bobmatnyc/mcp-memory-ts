# Gmail Memory Extraction Feature

## Overview

The Gmail Memory Extraction feature automatically extracts facts, insights, and entities from your Gmail emails using GPT-4 intelligence. It processes emails in weekly batches, creating structured memories and entity records while preventing duplicate processing.

## Key Features

### 1. **Intelligent Content Extraction**
- Uses GPT-4 to analyze email content
- Extracts important facts, decisions, events, and insights
- Identifies people, organizations, and projects
- Creates structured memory and entity records

### 2. **Weekly Batch Processing**
- Processes emails by week (Monday-Sunday)
- Prevents duplicate extraction with tracking
- Handles 10-100+ emails per week efficiently
- Batches API calls to avoid token limits

### 3. **Entity Recognition**
- Automatically identifies people mentioned in emails
- Extracts contact information when available
- Recognizes organizations and companies
- Tracks projects and initiatives
- Links entities to related memories

### 4. **Smart Deduplication**
- Tracks processed weeks in database
- Skips already-extracted periods
- Merges duplicate entities by name
- Consolidates information across emails

### 5. **Web Interface Integration**
- Visual connection status
- One-click extraction
- Real-time extraction history
- Progress tracking and error reporting

## Architecture

### Components

```
┌─────────────────────────────────────────────────────────┐
│                    Web Interface                         │
│  (components/utilities/memory-extractor.tsx)             │
└───────────────────┬─────────────────────────────────────┘
                    │
                    ↓
┌─────────────────────────────────────────────────────────┐
│                   API Routes                             │
│  /api/gmail/extract - Extraction endpoint                │
│  /api/gmail/test    - Connection test                    │
│  /api/auth/google/callback - OAuth callback              │
└───────────────────┬─────────────────────────────────────┘
                    │
                    ↓
┌─────────────────────────────────────────────────────────┐
│            GmailExtractionService                        │
│  Orchestrates the extraction process                     │
│  - Checks for duplicates                                 │
│  - Creates extraction logs                               │
│  - Coordinates Gmail + GPT-4                             │
│  - Saves results to database                             │
└───────────┬───────────────────┬─────────────────────────┘
            │                   │
            ↓                   ↓
┌──────────────────┐  ┌──────────────────────┐
│  GmailClient     │  │  GmailExtractor      │
│  - OAuth2 auth   │  │  - GPT-4 analysis    │
│  - Fetch emails  │  │  - Content parsing   │
│  - Date filtering│  │  - Entity extraction │
└──────────────────┘  └──────────────────────┘
            │                   │
            ↓                   ↓
┌─────────────────────────────────────────────────────────┐
│                      Database                            │
│  - gmail_extraction_log (tracking)                       │
│  - memories (extracted facts)                            │
│  - entities (people, orgs, projects)                     │
└─────────────────────────────────────────────────────────┘
```

### Data Flow

1. **User initiates extraction** → Web UI
2. **OAuth authentication** → Google Gmail API
3. **Fetch emails** → Gmail API (date filtered)
4. **Analyze content** → GPT-4 (batched)
5. **Extract structured data** → Memories + Entities
6. **Save to database** → Turso/LibSQL
7. **Update tracking** → Extraction log
8. **Display results** → Web UI

## Database Schema

### gmail_extraction_log Table

```sql
CREATE TABLE gmail_extraction_log (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  week_identifier TEXT NOT NULL,        -- Format: YYYY-WW
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  emails_processed INTEGER DEFAULT 0,
  memories_created INTEGER DEFAULT 0,
  entities_created INTEGER DEFAULT 0,
  status TEXT DEFAULT 'processing',     -- processing, completed, failed
  error_message TEXT,
  created_at TEXT NOT NULL,
  completed_at TEXT,
  UNIQUE(user_id, week_identifier)
);
```

**Indexes:**
- `idx_gmail_extraction_user_week` - Fast duplicate checking
- `idx_gmail_extraction_user_status` - Status filtering
- `idx_gmail_extraction_created` - History sorting

## File Structure

### Core Implementation

```
src/
├── integrations/
│   └── gmail-client.ts                 # Gmail API client
├── services/
│   ├── gmail-extractor.ts              # GPT-4 extraction service
│   └── gmail-extraction-service.ts     # Orchestration service
└── types/
    └── base.ts                         # Shared type definitions

web/
├── app/api/
│   ├── gmail/
│   │   ├── extract/route.ts            # Extraction API
│   │   └── test/route.ts               # Connection test API
│   └── auth/google/callback/route.ts   # OAuth callback
└── components/utilities/
    └── memory-extractor.tsx            # UI component

scripts/
└── migrate-gmail-extraction-log.ts     # Database migration

docs/guides/
├── GMAIL_EXTRACTION_SETUP.md           # Full setup guide
└── GMAIL_EXTRACTION_QUICKSTART.md      # Quick start guide
```

## API Endpoints

### POST `/api/gmail/extract`
Extract memories from Gmail

**Request:**
```json
{
  "weekIdentifier": "2025-42",          // Optional, defaults to current
  "gmailAccessToken": "ya29.a0...",     // Required
  "openaiApiKey": "sk-..."              // Optional, uses server env
}
```

**Response:**
```json
{
  "success": true,
  "week_identifier": "2025-42",
  "emails_processed": 15,
  "memories_created": 23,
  "entities_created": 8,
  "summary": "Analyzed 15 emails. Extracted 23 memories (5 high-importance)..."
}
```

### GET `/api/gmail/extract`
Get extraction logs

**Query params:**
- `limit`: Number of logs (default: 50)
- `week`: Specific week identifier

**Response:**
```json
{
  "logs": [
    {
      "id": "uuid",
      "week_identifier": "2025-42",
      "start_date": "2025-10-14T00:00:00Z",
      "end_date": "2025-10-20T23:59:59Z",
      "emails_processed": 15,
      "memories_created": 23,
      "entities_created": 8,
      "status": "completed",
      "created_at": "2025-10-15T10:30:00Z",
      "completed_at": "2025-10-15T10:32:15Z"
    }
  ]
}
```

### POST `/api/gmail/test`
Test Gmail and OpenAI connections

**Request:**
```json
{
  "gmailAccessToken": "ya29.a0...",
  "openaiApiKey": "sk-..."
}
```

**Response:**
```json
{
  "success": true,
  "results": {
    "gmail": {
      "success": true,
      "email": "user@gmail.com"
    },
    "openai": {
      "success": true,
      "model": "gpt-4-turbo-preview"
    }
  }
}
```

## Extraction Process

### 1. Week Identification
- Uses ISO week numbering (YYYY-WW format)
- Week starts Monday, ends Sunday
- Example: "2025-42" = Week 42 of 2025

### 2. Email Fetching
- Queries Gmail API for date range
- Excludes spam and trash
- Fetches up to 100 emails by default
- Retrieves full message content

### 3. GPT-4 Analysis
- Processes in batches of 10 emails
- Analyzes subject, body, participants
- Extracts structured information
- Assigns importance levels (1-5)

### 4. Memory Creation
- **Type**: MEMORY (facts/events) or LEARNED (patterns/insights)
- **Importance**: 1=low, 2=medium, 3=high, 4=critical, 5=essential
- **Tags**: Auto-generated for searchability
- **Metadata**: Includes source, date, sender

### 5. Entity Extraction
- **People**: Name, email, company, title, role
- **Organizations**: Name, description, industry
- **Projects**: Name, description, status

### 6. Deduplication
- Merges entities with same name (case-insensitive)
- Combines information from multiple mentions
- Preserves highest importance level

## Configuration

### Required Environment Variables

```bash
# Google OAuth (web/.env.local)
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com

# OpenAI (root .env or web/.env.local)
OPENAI_API_KEY=sk-your-openai-key

# Database (root .env)
TURSO_URL=libsql://your-database.turso.io
TURSO_AUTH_TOKEN=your-auth-token
```

### Google Cloud Setup

1. Create project in Google Cloud Console
2. Enable Gmail API
3. Create OAuth 2.0 credentials
4. Configure authorized redirect URIs
5. Add test users (for development)

See [GMAIL_EXTRACTION_SETUP.md](../guides/GMAIL_EXTRACTION_SETUP.md) for details.

## Usage Examples

### Extract Current Week

```typescript
const response = await fetch('/api/gmail/extract', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    gmailAccessToken: 'ya29.a0...',
  }),
});

const result = await response.json();
console.log(`Created ${result.memories_created} memories`);
```

### Get Extraction History

```typescript
const response = await fetch('/api/gmail/extract?limit=10');
const { logs } = await response.json();

logs.forEach(log => {
  console.log(`Week ${log.week_identifier}: ${log.emails_processed} emails`);
});
```

### Test Connections

```typescript
const response = await fetch('/api/gmail/test', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    gmailAccessToken: 'ya29.a0...',
    openaiApiKey: 'sk-...',
  }),
});

const { results } = await response.json();
if (results.gmail.success && results.openai.success) {
  console.log('All systems ready!');
}
```

## Cost Analysis

### Gmail API
- **Free tier**: 1 billion quota units/day
- **Cost per email**: ~5-10 quota units
- **Monthly cost**: $0 (free for typical usage)

### OpenAI API
- **Model**: gpt-4-turbo-preview
- **Input tokens**: ~$0.01 per 1K tokens
- **Output tokens**: ~$0.03 per 1K tokens
- **Per email**: ~200 input + 50 output tokens
- **Batch of 10**: ~2000 input + 500 output = ~$0.035
- **Weekly estimate**: $0.15-0.50 (10-100 emails)

### Total Monthly Cost
- **Light usage** (50 emails/week): ~$0.60/month
- **Medium usage** (200 emails/week): ~$2.50/month
- **Heavy usage** (500 emails/week): ~$6.00/month

## Performance

### Benchmarks
- **Email fetch**: ~0.5-1 second per email
- **GPT-4 analysis**: ~5-10 seconds per batch (10 emails)
- **Database save**: ~0.1 seconds per record
- **Total time**: ~1-2 minutes for 50 emails

### Optimization Strategies
1. Batch processing (10 emails per GPT-4 call)
2. Parallel email fetching
3. Async database operations
4. Client-side caching of extraction logs

## Security

### OAuth Security
- Access tokens stored in browser localStorage
- Tokens expire after 1 hour
- Refresh flow handled by Google
- Tokens never sent to server logs

### API Key Security
- OpenAI key stored in server environment
- Never exposed to client-side code
- Scoped to server-side API routes

### Data Privacy
- All data scoped to authenticated user
- User isolation enforced at database level
- No cross-user data access
- Extraction logs are user-specific

## Troubleshooting

### Common Issues

**"redirect_uri_mismatch"**
- Ensure Google Console redirect URI matches exactly
- Check for http vs https
- Verify port numbers

**"Access blocked: This app's request is invalid"**
- Add your account as test user
- Publish OAuth consent screen (for production)

**"Rate limit exceeded"**
- Wait a few minutes
- Reduce batch size
- Upgrade OpenAI tier

**"No emails found"**
- Normal if no emails in selected week
- Check Gmail filters
- Verify date range

## Future Enhancements

### Planned Features
- [ ] Automatic scheduled extractions (weekly cron)
- [ ] Custom extraction prompts per user
- [ ] Email filtering by label/folder
- [ ] Bulk historical extraction (all past emails)
- [ ] Export extraction results to JSON/CSV
- [ ] Advanced entity relationship mapping
- [ ] Multi-language support
- [ ] Slack/Discord integration

### Performance Improvements
- [ ] Streaming GPT-4 responses
- [ ] Progressive result display
- [ ] Background job processing
- [ ] Redis caching layer

## References

- [Setup Guide](../guides/GMAIL_EXTRACTION_SETUP.md)
- [Quick Start](../guides/GMAIL_EXTRACTION_QUICKSTART.md)
- [Gmail API Docs](https://developers.google.com/gmail/api)
- [OpenAI API Docs](https://platform.openai.com/docs)
