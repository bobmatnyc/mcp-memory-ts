# Gmail Extraction Setup Guide

This guide will help you set up the Gmail memory extraction feature that uses GPT-4 to automatically extract facts, insights, and entities from your emails.

## Overview

The Gmail extraction system:
- Fetches emails from Gmail using OAuth2 authentication
- Processes emails in weekly batches (Monday-Sunday)
- Uses GPT-4 to extract meaningful information
- Creates structured memories and entity records
- Tracks processed weeks to prevent duplicates

## Prerequisites

1. **Google Cloud Project**: You need a Google Cloud project with Gmail API enabled
2. **OpenAI API Key**: Required for GPT-4 analysis (server-side)
3. **Turso Database**: For storing extraction logs and results

## Step 1: Set Up Google Cloud Project

### 1.1 Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click "Select a project" → "New Project"
3. Enter a project name (e.g., "MCP Memory Gmail")
4. Click "Create"

### 1.2 Enable Gmail API

1. In your project, go to "APIs & Services" → "Library"
2. Search for "Gmail API"
3. Click on it and click "Enable"

### 1.3 Create OAuth 2.0 Credentials

1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "OAuth client ID"
3. If prompted, configure the OAuth consent screen:
   - **User Type**: External
   - **App name**: Your app name
   - **User support email**: Your email
   - **Developer contact**: Your email
   - Add scopes: `https://www.googleapis.com/auth/gmail.readonly`
   - Add test users (your Gmail address)
   - Click "Save and Continue"

4. Create OAuth Client ID:
   - **Application type**: Web application
   - **Name**: MCP Memory Web
   - **Authorized JavaScript origins**:
     - `http://localhost:3000` (development)
     - `https://yourdomain.com` (production)
   - **Authorized redirect URIs**:
     - `http://localhost:3000/api/auth/google/callback` (development)
     - `https://yourdomain.com/api/auth/google/callback` (production)
   - Click "Create"

5. **Save your Client ID** - you'll need this in the next step

### 1.4 Publish OAuth Consent Screen (Optional)

For production use with multiple users:

1. Go to "OAuth consent screen"
2. Fill in all required information
3. Click "Publish App"
4. Submit for verification (may take several days)

For testing, you can skip this and add specific test users instead.

## Step 2: Configure Environment Variables

### 2.1 Web Application Environment

Add to `/web/.env.local`:

```bash
# Google OAuth
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-client-id-here.apps.googleusercontent.com

# OpenAI (for GPT-4 extraction)
OPENAI_API_KEY=your-openai-api-key

# Database (Turso)
TURSO_URL=libsql://your-database.turso.io
TURSO_AUTH_TOKEN=your-auth-token

# Clerk (existing)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your-clerk-key
CLERK_SECRET_KEY=your-clerk-secret
```

### 2.2 Root Environment (for CLI/MCP)

Add to `/.env`:

```bash
OPENAI_API_KEY=your-openai-api-key
TURSO_URL=libsql://your-database.turso.io
TURSO_AUTH_TOKEN=your-auth-token
```

## Step 3: Run Database Migration

The extraction feature requires a new database table to track processed weeks.

```bash
# Navigate to project root
cd /Users/masa/Projects/managed/mcp-memory-ts

# Install dependencies if needed
npm install googleapis

# Run migration
npx tsx scripts/migrate-gmail-extraction-log.ts
```

Expected output:
```
🔄 Connecting to database...
🔄 Running migration: gmail_extraction_log table...
✅ Migration completed successfully!

Created:
  - gmail_extraction_log table
  - idx_gmail_extraction_user_week index
  - idx_gmail_extraction_user_status index
  - idx_gmail_extraction_created index

✅ All done!
```

## Step 4: Install Required Dependencies

```bash
# Install Google APIs client
npm install googleapis

# Install OpenAI SDK (if not already installed)
npm install openai

# For web interface
cd web
npm install
```

## Step 5: Update TypeScript Path Aliases

Ensure your `web/tsconfig.json` includes path aliases for the new modules:

```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./*"],
      "@/lib/mcp-memory/*": ["../src/*"]
    }
  }
}
```

## Step 6: Test the Integration

### 6.1 Start the Web Interface

```bash
cd web
npm run dev
```

### 6.2 Navigate to Memory Extractor

1. Open browser to `http://localhost:3000`
2. Sign in with Clerk
3. Go to "Utilities" → "Memory Extractor"

### 6.3 Connect Gmail

1. Click "Connect Gmail"
2. OAuth popup will open
3. Sign in to your Google account
4. Grant permissions to read Gmail
5. You should see "Connected" status with your email

### 6.4 Extract Current Week

1. Click "Extract This Week"
2. The system will:
   - Fetch emails from the current week
   - Analyze them with GPT-4
   - Create memories and entities
   - Show results in extraction history

## Usage

### Weekly Extraction Workflow

1. **Manual Trigger**: Click "Extract This Week" in the web interface
2. **Automatic Processing**:
   - Fetches emails from Monday-Sunday of current week
   - Batches emails (10 per batch) to avoid token limits
   - GPT-4 analyzes content and extracts:
     - Important facts and insights
     - People mentioned (with contact details if available)
     - Organizations and companies
     - Projects and initiatives
     - Key dates and events
   - Creates structured memory and entity records
   - Links entities to related memories

3. **Duplicate Prevention**: The system tracks processed weeks and skips already-extracted periods

### Extraction Results

Each extraction creates:
- **Memories**: Facts, insights, decisions, events
- **Entities**: People, organizations, projects
- **Extraction Log**: Tracks processed weeks and results

Example extraction log entry:
```
Week 2025-42
Oct 14, 2025 - Oct 20, 2025
15 emails → 23 memories, 8 entities
Status: Completed
```

## API Endpoints

The following API endpoints are available:

### POST `/api/gmail/extract`
Extract memories from Gmail for a specific week

**Request:**
```json
{
  "weekIdentifier": "2025-42",  // Optional, defaults to current week
  "gmailAccessToken": "ya29.a0...",
  "openaiApiKey": "sk-..."  // Optional, uses server env
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
  "summary": "Analyzed 15 emails. Extracted 23 memories..."
}
```

### GET `/api/gmail/extract`
Get extraction logs

**Query params:**
- `limit`: Number of logs to return (default: 50)
- `week`: Specific week identifier

**Response:**
```json
{
  "logs": [
    {
      "id": "uuid",
      "week_identifier": "2025-42",
      "emails_processed": 15,
      "memories_created": 23,
      "entities_created": 8,
      "status": "completed",
      "created_at": "2025-10-08T12:00:00Z"
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

## Database Schema

The `gmail_extraction_log` table:

```sql
CREATE TABLE gmail_extraction_log (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  week_identifier TEXT NOT NULL,  -- Format: YYYY-WW
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  emails_processed INTEGER DEFAULT 0,
  memories_created INTEGER DEFAULT 0,
  entities_created INTEGER DEFAULT 0,
  status TEXT DEFAULT 'processing',  -- processing, completed, failed
  error_message TEXT,
  created_at TEXT NOT NULL,
  completed_at TEXT,
  UNIQUE(user_id, week_identifier)
);
```

## Troubleshooting

### OAuth Errors

**Error**: "redirect_uri_mismatch"
- **Solution**: Ensure redirect URI in Google Cloud Console exactly matches your callback URL

**Error**: "Access blocked: This app's request is invalid"
- **Solution**: Add your Google account as a test user in OAuth consent screen

### Gmail API Errors

**Error**: "Insufficient Permission"
- **Solution**: Ensure Gmail API is enabled and OAuth scope includes `gmail.readonly`

**Error**: "Daily Limit Exceeded"
- **Solution**: Google has daily API limits. Wait 24 hours or request quota increase.

### Extraction Errors

**Error**: "OpenAI API error: Rate limit exceeded"
- **Solution**:
  - Reduce batch size in extraction service
  - Wait a few minutes between extractions
  - Upgrade OpenAI API tier

**Error**: "No emails found for this week"
- **Solution**: This is normal if you have no emails in the selected week

### Missing Dependencies

**Error**: "Cannot find module 'googleapis'"
- **Solution**: Run `npm install googleapis` in project root

## Security Considerations

1. **OAuth Tokens**:
   - Access tokens are stored in browser localStorage
   - Tokens expire after 1 hour
   - Never commit tokens to version control

2. **API Keys**:
   - OpenAI API key should be in `.env` or `.env.local`
   - Never expose API keys in client-side code
   - Use environment variables for all secrets

3. **User Isolation**:
   - All data is scoped to authenticated Clerk user
   - Database queries include user_id filtering
   - OAuth tokens are user-specific

4. **Rate Limiting**:
   - Gmail API: 250 quota units per user per second
   - OpenAI API: Varies by tier
   - Implement exponential backoff for retries

## Cost Estimates

### Gmail API
- **Free tier**: 1 billion quota units/day
- **Typical extraction**: ~5-10 units per email
- **Cost**: Free for most users

### OpenAI API (GPT-4)
- **Model**: gpt-4-turbo-preview
- **Input**: ~$0.01 per 1K tokens
- **Output**: ~$0.03 per 1K tokens
- **Typical extraction**:
  - 10 emails = ~2000 input tokens + 500 output tokens
  - Cost: ~$0.035 per batch
  - Weekly cost: ~$0.15-0.50 depending on email volume

### Turso Database
- **Free tier**: 500 rows, 9GB total storage
- **Extraction logs**: Minimal storage impact
- **Cost**: Free for typical usage

## Future Enhancements

Planned features:
- [ ] Automatic scheduled extractions (weekly cron job)
- [ ] Email filtering by label/folder
- [ ] Custom extraction prompts
- [ ] Export extraction results
- [ ] Bulk historical extraction
- [ ] Google Drive document extraction
- [ ] Slack message extraction

## Support

For issues or questions:
- Check troubleshooting section above
- Review API endpoint documentation
- Check browser console for errors
- Review server logs for detailed error messages

## References

- [Google Gmail API Documentation](https://developers.google.com/gmail/api)
- [Google OAuth 2.0 Guide](https://developers.google.com/identity/protocols/oauth2)
- [OpenAI API Documentation](https://platform.openai.com/docs)
- [Clerk Authentication](https://clerk.com/docs)
