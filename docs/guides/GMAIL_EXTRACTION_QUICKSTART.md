# Gmail Extraction Quick Start

Get Gmail memory extraction up and running in 15 minutes.

## Prerequisites

- Google account with Gmail
- OpenAI API key (for GPT-4)
- Running MCP Memory web interface

## 1. Install Dependencies

```bash
# In project root
npm install googleapis

# In web directory (if needed)
cd web
npm install
```

## 2. Set Up Google OAuth

### Get Google Client ID

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable Gmail API:
   - "APIs & Services" → "Library"
   - Search "Gmail API" → Enable
4. Create OAuth credentials:
   - "APIs & Services" → "Credentials"
   - "Create Credentials" → "OAuth client ID"
   - Application type: Web application
   - Authorized redirect URIs: `http://localhost:3000/api/auth/google/callback`
   - Save the Client ID

### Configure Environment

Add to `/web/.env.local`:

```bash
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
OPENAI_API_KEY=sk-your-openai-key
```

## 3. Run Database Migration

```bash
npm run migrate:gmail
```

## 4. Start Web Interface

```bash
cd web
npm run dev
```

## 5. Use Gmail Extraction

1. Open `http://localhost:3000` in browser
2. Navigate to "Utilities" → "Memory Extractor"
3. Click "Connect Gmail"
4. Authorize in OAuth popup
5. Click "Extract This Week"
6. View results in extraction history

## What Gets Extracted?

GPT-4 analyzes your emails and creates:

- **Memories**: Important facts, decisions, events, insights
- **Entities**: People (with contact info), organizations, projects
- **Relationships**: Automatic linking between entities and memories

## Example Output

**Email:**
```
From: john@acme.com
Subject: Q4 Planning Meeting - Action Items

Hi Team,

Great meeting today! Here are the action items:
1. Sarah will lead the customer research initiative
2. Launch date confirmed for December 15th
3. Budget approved: $50K for marketing

Best,
John
```

**Extracted:**

**Memories:**
- "Q4 Planning Meeting - Launch date confirmed for December 15th" (importance: 4)
- "Q4 budget approved: $50K for marketing" (importance: 3)

**Entities:**
- John (Person, email: john@acme.com, company: Acme Corp)
- Sarah (Person, mentioned as research lead)

## Weekly Processing

- Extracts Monday-Sunday of current week
- Prevents duplicate processing
- Processes ~10-100 emails per week typically
- Cost: ~$0.15-0.50 per week in OpenAI API usage

## Next Steps

- Review [Full Setup Guide](./GMAIL_EXTRACTION_SETUP.md) for production deployment
- Configure OAuth consent screen for multiple users
- Set up automatic weekly extraction (coming soon)

## Troubleshooting

**"redirect_uri_mismatch" error**
- Ensure redirect URI in Google Console matches exactly: `http://localhost:3000/api/auth/google/callback`

**"No emails found"**
- Normal if you have no emails this week
- Try a different week or check Gmail filters

**"Extraction failed"**
- Check OpenAI API key is valid
- Ensure you have API credits
- Review browser console for detailed errors

## Support

See [GMAIL_EXTRACTION_SETUP.md](./GMAIL_EXTRACTION_SETUP.md) for detailed documentation.
