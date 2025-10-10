# Google Sync Setup Guide

**Version**: 1.7.0
**Difficulty**: Beginner
**Time to Complete**: 15-20 minutes
**Last Updated**: 2025-10-09

## Overview

This guide walks you through setting up Google Contacts and Calendar sync for MCP Memory. By the end, you'll have:

- Google Cloud project with necessary APIs enabled
- OAuth 2.0 credentials configured
- MCP Memory connected to your Google account
- First successful contacts and calendar sync

## Prerequisites

Before you begin, ensure you have:

- **Google Account**: Personal or Google Workspace account
- **MCP Memory Installed**: Complete basic MCP Memory setup
- **Command Line Access**: Terminal or command prompt
- **Web Browser**: For OAuth authentication flow
- **Node.js 18+**: For running MCP Memory commands

## Step 1: Google Cloud Console Setup

### 1.1 Create a Google Cloud Project

1. Navigate to [Google Cloud Console](https://console.cloud.google.com/)
2. Click **Select a project** dropdown (top bar)
3. Click **New Project**
4. Enter project details:
   - **Project name**: `mcp-memory-sync` (or your preferred name)
   - **Organization**: Leave as-is (or select your organization)
5. Click **Create**
6. Wait for project creation (30-60 seconds)

**Note**: If you already have a Google Cloud project, you can use an existing one instead of creating a new one.

### 1.2 Enable Required APIs

You need to enable two APIs for Google sync to work:

**Option A: Using the Console (Recommended for beginners)**

1. In Google Cloud Console, click **☰ Menu** → **APIs & Services** → **Library**
2. Search for "Google People API"
   - Click on the result
   - Click **Enable**
   - Wait for activation (~10 seconds)
3. Click **← Back to Library**
4. Search for "Google Calendar API"
   - Click on the result
   - Click **Enable**
   - Wait for activation (~10 seconds)

**Option B: Using gcloud CLI (For advanced users)**

```bash
# Install gcloud CLI if not already installed
# See: https://cloud.google.com/sdk/docs/install

# Authenticate
gcloud auth login

# Set project
gcloud config set project mcp-memory-sync

# Enable APIs
gcloud services enable people.googleapis.com
gcloud services enable calendar-json.googleapis.com
```

**Verification**: Navigate to **APIs & Services** → **Dashboard** and verify both APIs are listed as enabled.

### 1.3 Create OAuth 2.0 Credentials

1. In Google Cloud Console, navigate to:
   - **☰ Menu** → **APIs & Services** → **Credentials**

2. Click **+ Create Credentials** → **OAuth client ID**

3. If prompted to configure OAuth consent screen:
   - Click **Configure Consent Screen**
   - Follow steps in section 1.4 below
   - Return here after completing consent screen setup

4. Configure OAuth client:
   - **Application type**: Select **Web application**
   - **Name**: `MCP Memory Web Client`

5. Add authorized redirect URIs:
   - Click **+ ADD URI** under "Authorized redirect URIs"
   - For local development, add:
     ```
     http://localhost:3000/api/auth/google/callback
     ```
   - For production (optional, add later):
     ```
     https://yourdomain.com/api/auth/google/callback
     ```

6. Click **Create**

7. **Save your credentials**:
   - A dialog appears with **Client ID** and **Client Secret**
   - Click **Download JSON** (optional, for backup)
   - Copy both values to a secure location (you'll need them in Step 2)

**Important**: Keep your Client Secret secure. Never commit it to version control or share it publicly.

### 1.4 Configure OAuth Consent Screen

1. Navigate to **APIs & Services** → **OAuth consent screen**

2. Choose user type:
   - **External**: For personal Google accounts (most users)
   - **Internal**: For Google Workspace organizations only

3. Click **Create**

4. Fill in **App information**:
   - **App name**: `MCP Memory`
   - **User support email**: Your email address
   - **App logo**: (Optional) Upload a logo
   - **Application home page**: (Optional) `https://github.com/your-org/mcp-memory-ts`

5. Fill in **Developer contact information**:
   - **Email addresses**: Your email address

6. Click **Save and Continue**

7. **Configure Scopes**:
   - Click **Add or Remove Scopes**
   - Search and select the following scopes:
     ```
     .../auth/contacts
     .../auth/calendar.readonly
     ```
   - Click **Update**
   - Click **Save and Continue**

8. **Add Test Users** (for External apps in testing):
   - Click **+ Add Users**
   - Enter your Google account email
   - Click **Add**
   - Click **Save and Continue**

9. Review summary and click **Back to Dashboard**

**Note for External Apps**: Your app will be in "Testing" mode and limited to 100 users. To publish for public use, click "Publish App" (requires verification for sensitive scopes).

### 1.5 Verify Setup

Check that everything is configured correctly:

1. **APIs Enabled**:
   - Navigate to **APIs & Services** → **Dashboard**
   - Verify "Google People API" and "Google Calendar API" are listed

2. **OAuth Client Created**:
   - Navigate to **APIs & Services** → **Credentials**
   - Verify your OAuth 2.0 Client ID is listed
   - Verify redirect URI is correct

3. **Consent Screen Configured**:
   - Navigate to **APIs & Services** → **OAuth consent screen**
   - Verify status shows "Testing" or "In Production"

## Step 2: MCP Memory Configuration

### 2.1 Locate Configuration File

MCP Memory supports two configuration methods:

**Option A: Environment Variables (Recommended)**

Create or edit `.env` in your MCP Memory project root:

```bash
cd /path/to/mcp-memory-ts
nano .env  # or use your preferred editor
```

**Option B: Web Interface Environment**

For web interface deployment, also create `web/.env.local`:

```bash
cd web
nano .env.local
```

### 2.2 Add Google Credentials

Add the following to your `.env` file:

```bash
# Google OAuth Configuration
GOOGLE_CLIENT_ID=your-client-id-from-step-1.3
GOOGLE_CLIENT_SECRET=your-client-secret-from-step-1.3
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback

# For production deployment, use:
# GOOGLE_REDIRECT_URI=https://yourdomain.com/api/auth/google/callback
```

**Replace placeholders**:
- `your-client-id-from-step-1.3`: The Client ID from Google Cloud Console
- `your-client-secret-from-step-1.3`: The Client Secret from Google Cloud Console

**Example**:
```bash
GOOGLE_CLIENT_ID=123456789-abc123def456.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-aBcDeFgHiJkLmNoPqRsTuVwXyZ
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback
```

### 2.3 Add Web Interface Configuration

If using the web interface, also add to `web/.env.local`:

```bash
# Application URL
NEXT_PUBLIC_APP_URL=http://localhost:3000

# For production:
# NEXT_PUBLIC_APP_URL=https://yourdomain.com
```

### 2.4 Verify Configuration

Test that environment variables are loaded correctly:

```bash
# From project root
node -e "require('dotenv').config(); console.log('Client ID:', process.env.GOOGLE_CLIENT_ID ? '✓ Set' : '✗ Missing');"
node -e "require('dotenv').config(); console.log('Client Secret:', process.env.GOOGLE_CLIENT_SECRET ? '✓ Set' : '✗ Missing');"
node -e "require('dotenv').config(); console.log('Redirect URI:', process.env.GOOGLE_REDIRECT_URI);"
```

Expected output:
```
Client ID: ✓ Set
Client Secret: ✓ Set
Redirect URI: http://localhost:3000/api/auth/google/callback
```

## Step 3: Connect Your Google Account

### 3.1 Start Web Interface (Recommended)

The easiest way to connect is via the web interface:

```bash
# Navigate to web directory
cd web

# Install dependencies (if not done already)
npm install

# Start development server
npm run dev
```

Expected output:
```
  ▲ Next.js 14.0.0
  - Local:        http://localhost:3000
  - Ready in 2.1s
```

### 3.2 Authenticate via Web UI

1. Open your browser to `http://localhost:3000`

2. Navigate to **Settings** page (or click **Connect Google** on dashboard)

3. Find the **Google Integration** section

4. Click **Connect Google Account** button

5. You'll be redirected to Google's OAuth consent screen

6. Review permissions being requested:
   - View your contacts
   - View your calendar events
   - (Optional) Read your emails

7. Click **Continue** or **Allow**

8. You'll be redirected back to MCP Memory with a success message

**Success**: You should see "Google account connected successfully" and your Google email displayed.

### 3.3 Alternative: CLI Authentication

If you prefer command-line authentication:

```bash
# Check authentication status
mcp-memory google auth --user-email your-email@example.com

# This will provide a URL to open in your browser
# Follow the OAuth flow as described above
```

### 3.4 Verify Connection

Check that OAuth tokens are stored:

```bash
# Check connection status
mcp-memory google auth --user-email your-email@example.com
```

Expected output:
```
✅ Google Account Connected

Email: your-email@example.com
Scopes: contacts, calendar.readonly
Token Valid: Yes
Expires: 2025-10-16 14:30:00
```

## Step 4: First Sync

### 4.1 Test Contacts Sync (Dry Run)

Before importing real data, test with a dry run:

```bash
mcp-memory google contacts-sync \
  --user-email your-email@example.com \
  --direction import \
  --dry-run
```

Expected output:
```
🔄 Google Contacts Sync (DRY RUN)

📥 Full sync (first time)...
📊 Fetched 150 contacts from Google
🔍 Found 12 potential duplicates

Preview:
  Would import: 150 contacts
  Would update: 0 contacts
  Duplicates to review: 12

✅ Dry run complete - no changes made
```

**Review the output**:
- Check the number of contacts to be imported
- Review duplicate count (if any)
- Ensure numbers look reasonable

### 4.2 Import Contacts

If the dry run looks good, perform the actual import:

```bash
mcp-memory google contacts-sync \
  --user-email your-email@example.com \
  --direction import
```

Expected output:
```
🔄 Google Contacts Sync

📥 Full sync (first time)...
📊 Fetched 150 contacts from Google
🔍 Processing contacts...
✅ Created 138 new entities
✅ Updated 0 entities
⚠️  Skipped 12 duplicates (use --auto-merge to merge)

✅ Sync Complete:
  Imported: 138
  Updated: 0
  Duplicates: 12

💡 Next sync will be incremental (syncToken saved)
```

**What happened**:
- 138 contacts were created as new entities
- 12 duplicates were detected and skipped
- A syncToken was saved for future incremental syncs

### 4.3 Sync Calendar Events

Sync the current week's calendar events:

```bash
mcp-memory google calendar-sync \
  --user-email your-email@example.com
```

Expected output:
```
📅 Google Calendar Sync

📊 Syncing week 2025-41 (Oct 7 - Oct 13)
📊 Fetched 8 events from Google Calendar
🔗 Linking attendees to entities...
✅ Linked 12 attendees to 8 existing entities

✅ Week 2025-41 Sync Complete:
  Events imported: 8
  Attendees linked: 12
  New entities created: 0
```

**What happened**:
- 8 calendar events were imported for the current week
- 12 attendees were automatically linked to existing contact entities
- Events are now queryable in MCP Memory

### 4.4 Verify Data

Check that data was imported correctly:

**Verify contacts**:
```bash
# List entities (should include Google contacts)
mcp-memory list entities --user-email your-email@example.com --limit 10
```

**Verify calendar events** (via web interface):
1. Open `http://localhost:3000/dashboard`
2. Look for "Recent Calendar Events" section
3. Verify events are displayed

## Step 5: Ongoing Sync

### 5.1 Incremental Sync

After the initial sync, subsequent syncs will be much faster (incremental):

```bash
# Sync contacts (only changes since last sync)
mcp-memory google contacts-sync \
  --user-email your-email@example.com \
  --direction import
```

Expected output:
```
🔄 Google Contacts Sync

🔄 Incremental sync (using syncToken)...
📊 Fetched 3 contacts from Google (changed since last sync)
✅ Updated 2 entities
✅ Created 1 new entity

✅ Sync Complete:
  Imported: 1
  Updated: 2
  Duplicates: 0
```

**Benefits**:
- Only transfers changed data (faster, less bandwidth)
- Preserves API quotas
- Maintains sync history

### 5.2 Bidirectional Sync

To sync changes in both directions:

```bash
# Sync both ways
mcp-memory google contacts-sync \
  --user-email your-email@example.com \
  --direction both
```

This will:
1. Import changes from Google to MCP Memory
2. Export changes from MCP Memory to Google
3. Resolve conflicts using timestamps

### 5.3 Scheduled Sync

Set up automatic sync using cron or task scheduler:

**macOS/Linux (cron)**:
```bash
# Edit crontab
crontab -e

# Add daily sync at 9 AM
0 9 * * * cd /path/to/mcp-memory-ts && mcp-memory google contacts-sync --user-email your@email.com --direction both >> /tmp/sync.log 2>&1
```

**Windows (Task Scheduler)**:
1. Open Task Scheduler
2. Create Basic Task
3. Name: "MCP Memory Google Sync"
4. Trigger: Daily at 9:00 AM
5. Action: Start a program
   - Program: `cmd.exe`
   - Arguments: `/c cd C:\path\to\mcp-memory-ts && mcp-memory google contacts-sync --user-email your@email.com --direction both`

## Troubleshooting

### Issue: "OAuth client not configured"

**Error message**:
```
Error: The OAuth client was not found.
```

**Solution**:
1. Verify environment variables:
   ```bash
   echo $GOOGLE_CLIENT_ID
   echo $GOOGLE_CLIENT_SECRET
   ```
2. If empty, check `.env` file exists and is in the correct location
3. Restart your terminal/application after editing `.env`
4. Try loading explicitly: `source .env`

### Issue: "Redirect URI mismatch"

**Error message**:
```
Error: redirect_uri_mismatch
The redirect URI in the request: http://localhost:3000/api/auth/google/callback
does not match the ones authorized for the OAuth client.
```

**Solution**:
1. Go to [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials
2. Click on your OAuth 2.0 Client ID
3. Under "Authorized redirect URIs", verify it shows exactly:
   ```
   http://localhost:3000/api/auth/google/callback
   ```
4. Check for:
   - No trailing slash
   - Correct protocol (http not https for localhost)
   - Correct port (3000)
5. Save changes and wait 5 minutes for propagation

### Issue: "Access denied: insufficient permissions"

**Error message**:
```
Error: Insufficient Permission: Request had insufficient authentication scopes.
```

**Solution**:
1. Disconnect Google account:
   ```bash
   mcp-memory google auth --disconnect --user-email your@email.com
   ```
2. Reconnect via web interface
3. Ensure you click "Allow" for ALL requested permissions
4. Check that scopes include: `contacts` and `calendar.readonly`

### Issue: Port 3000 already in use

**Error message**:
```
Error: listen EADDRINUSE: address already in use :::3000
```

**Solution**:
```bash
# Option 1: Find and kill the process using port 3000
lsof -ti:3000 | xargs kill -9

# Option 2: Use a different port
cd web
npm run dev -- -p 3001

# Then update redirect URI to:
# http://localhost:3001/api/auth/google/callback
```

### Issue: No contacts imported

**Symptom**: Sync completes but 0 contacts imported

**Solution**:
1. Check Google Contacts has contacts:
   - Visit [contacts.google.com](https://contacts.google.com)
   - Verify contacts exist
2. Check scope permissions:
   ```bash
   mcp-memory google auth --user-email your@email.com
   # Should show "Scopes: contacts, calendar.readonly"
   ```
3. Try with verbose logging:
   ```bash
   DEBUG=* mcp-memory google contacts-sync --user-email your@email.com
   ```

## Next Steps

Now that you have Google sync set up:

1. **Explore sync options**: Read the [Google Contacts Sync Guide](./GOOGLE_CONTACTS_SYNC_GUIDE.md)
2. **Set up calendar sync**: See [Google Calendar Sync Guide](./GOOGLE_CALENDAR_SYNC_GUIDE.md)
3. **Configure automation**: Set up scheduled syncs
4. **Review duplicates**: Use deduplication features to merge duplicates
5. **Try the API**: Explore programmatic access via [Google API Reference](../api/GOOGLE_API_REFERENCE.md)

## Related Documentation

- **[Google Sync Overview](../features/GOOGLE_SYNC.md)**: Feature overview and benefits
- **[Google Contacts Sync Guide](./GOOGLE_CONTACTS_SYNC_GUIDE.md)**: Detailed contacts sync documentation
- **[Google Calendar Sync Guide](./GOOGLE_CALENDAR_SYNC_GUIDE.md)**: Calendar sync usage guide
- **[CLI Guide](./CLI-GUIDE.md)**: Complete CLI reference
- **[Web Interface Guide](../features/WEB_INTERFACE.md)**: Web UI documentation

## Support

Need help? Here's how to get support:

1. **Check documentation**: Review the guides linked above
2. **Enable debug logging**: Use `DEBUG=*` for detailed output
3. **Review logs**: Check `~/.mcp-memory/logs/` for error details
4. **GitHub Issues**: [File a bug report](https://github.com/your-org/mcp-memory-ts/issues)
5. **Community**: [Join our Discord](https://discord.gg/your-server)

---

**Congratulations!** 🎉

You've successfully set up Google sync for MCP Memory. Your contacts and calendar events are now integrated with your AI assistant!

**Last Updated**: 2025-10-09
**Version**: 1.7.0
