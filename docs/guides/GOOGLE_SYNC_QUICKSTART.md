# Google Sync Quick Start Guide

**Version**: 1.0.0
**Target**: Developers starting implementation
**Time to Complete**: 30 minutes

## Prerequisites

Before starting, ensure you have:

- [x] Node.js 18+ installed
- [x] MCP Memory TypeScript project cloned
- [x] Google Cloud Console access
- [x] Turso database configured
- [x] Basic understanding of OAuth 2.0

## Step 1: Google Cloud Setup (10 minutes)

### 1.1 Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click **Create Project**
3. Name: `mcp-memory-sync`
4. Click **Create**

### 1.2 Enable Required APIs

```bash
# Navigate to APIs & Services > Library
# Enable the following:

1. Google People API
2. Google Calendar API
```

Or via gcloud CLI:

```bash
gcloud services enable people.googleapis.com
gcloud services enable calendar-json.googleapis.com
```

### 1.3 Create OAuth 2.0 Credentials

1. Go to **APIs & Services** > **Credentials**
2. Click **Create Credentials** > **OAuth client ID**
3. Application type: **Web application**
4. Name: `MCP Memory Web`
5. **Authorized redirect URIs**:
   - Development: `http://localhost:3000/api/auth/google/callback`
   - Production: `https://yourdomain.com/api/auth/google/callback`
6. Click **Create**
7. Copy **Client ID** and **Client Secret**

### 1.4 Configure OAuth Consent Screen

1. Go to **OAuth consent screen**
2. User Type: **External** (or Internal if Google Workspace)
3. App name: `MCP Memory`
4. User support email: `your-email@example.com`
5. Scopes: Add the following:
   - `.../auth/contacts`
   - `.../auth/calendar.readonly`
   - `.../auth/gmail.readonly`
6. Test users: Add your email
7. Click **Save and Continue**

## Step 2: Environment Setup (5 minutes)

### 2.1 Update .env File

Add to your `.env`:

```bash
# Google OAuth Configuration
GOOGLE_CLIENT_ID=your-client-id-from-step-1.3
GOOGLE_CLIENT_SECRET=your-client-secret-from-step-1.3
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback

# For production, use:
# GOOGLE_REDIRECT_URI=https://yourdomain.com/api/auth/google/callback
```

### 2.2 Update web/.env.local

Add to `web/.env.local`:

```bash
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Production:
# NEXT_PUBLIC_APP_URL=https://yourdomain.com
```

### 2.3 Verify Environment

```bash
# Check environment variables are loaded
node -e "require('dotenv').config(); console.log(process.env.GOOGLE_CLIENT_ID)"

# Should output your client ID
```

## Step 3: Database Migration (5 minutes)

### 3.1 Create Migration Script

Already created in the architecture! Just run:

```bash
# Create calendar_events table
tsx scripts/migrate-google-calendar.ts
```

Expected output:

```
🔄 Creating calendar_events table...
✅ Calendar events table created
✅ Indexes created
✅ Migration complete
```

### 3.2 Verify Schema

```bash
# Check table exists
tsx scripts/verify-google-sync.ts
```

Expected output:

```
✅ calendar_events table exists
✅ Indexes verified
✅ Foreign keys valid
```

## Step 4: OAuth Flow Test (5 minutes)

### 4.1 Start Development Server

```bash
# Terminal 1: Start web interface
cd web
npm run dev

# Terminal 2: Keep this open for logs
```

### 4.2 Test OAuth Connection

1. Open browser: `http://localhost:3000`
2. Navigate to Settings or Dashboard
3. Click **Connect Google Account**
4. You should be redirected to Google consent screen
5. Grant permissions
6. You should be redirected back with success message

### 4.3 Verify Token Storage

```bash
# Check user metadata contains tokens
tsx -e "
import { DatabaseConnection } from './src/database/connection.js';
import { DatabaseOperations } from './src/database/operations.js';

(async () => {
  const db = await DatabaseConnection.getInstance();
  const ops = new DatabaseOperations(db);
  const user = await ops.getUserByEmail('your-email@example.com');

  console.log('OAuth tokens stored:', !!user?.metadata?.googleOAuthTokens);
  console.log('Scopes granted:', user?.metadata?.googleOAuthTokens?.scope);
})();
"
```

Expected output:

```
OAuth tokens stored: true
Scopes granted: https://www.googleapis.com/auth/contacts https://www.googleapis.com/auth/calendar.readonly
```

## Step 5: Test Google Contacts Sync (5 minutes)

### 5.1 Dry-Run Import

```bash
# Preview what would be imported
mcp-memory google-contacts-sync \
  --user-email your-email@example.com \
  --direction import \
  --dry-run
```

Expected output:

```
🔄 Google Contacts Sync

📥 Full sync...
📊 Fetched 150 contacts from Google
🔍 Found 12 potential duplicates

✅ Sync Complete:
  Exported: 0
  Imported: 150 (DRY RUN - not saved)
  Updated: 0
  Duplicates: 12
```

### 5.2 Actual Import

```bash
# Actually import contacts
mcp-memory google-contacts-sync \
  --user-email your-email@example.com \
  --direction import
```

Expected output:

```
🔄 Google Contacts Sync

🔄 Incremental sync... (using syncToken)
📊 Fetched 5 contacts from Google (changes since last sync)
🔍 Found 0 potential duplicates

✅ Sync Complete:
  Exported: 0
  Imported: 2
  Updated: 3
  Duplicates: 0

Next sync will be incremental (syncToken stored)
```

### 5.3 Verify Entities Created

```bash
# Check entities were created
tsx -e "
import { DatabaseConnection } from './src/database/connection.js';
import { DatabaseOperations } from './src/database/operations.js';

(async () => {
  const db = await DatabaseConnection.getInstance();
  const ops = new DatabaseOperations(db);
  const entities = await ops.getEntitiesByUserId('your-email@example.com', 10);

  console.log(`Found ${entities.length} entities`);
  entities.slice(0, 3).forEach(e => {
    console.log(`- ${e.name} (${e.email})`);
  });
})();
"
```

## Step 6: Test Calendar Sync (5 minutes)

### 6.1 Sync Current Week

```bash
# Sync current week's calendar events
mcp-memory google-calendar-sync \
  --user-email your-email@example.com
```

Expected output:

```
📅 Google Calendar Sync

📊 Fetched 12 events for week 2025-41
🔗 Linked 8 attendees to existing entities

✅ Week 2025-41 Sync Complete:
  Events Imported: 12
  Entities Linked: 8
```

### 6.2 Verify Events Stored

```bash
# Check events were stored
tsx -e "
import { DatabaseConnection } from './src/database/connection.js';
import { CalendarOperations } from './src/database/calendar-operations.js';

(async () => {
  const db = await DatabaseConnection.getInstance();
  const calOps = new CalendarOperations(db);
  const events = await calOps.getEventsForWeek('your-email@example.com', '2025-41');

  console.log(`Found ${events.length} events for week 2025-41`);
  events.slice(0, 3).forEach(e => {
    console.log(`- ${e.summary} (${e.startTime})`);
  });
})();
"
```

## Common Issues & Solutions

### Issue 1: "OAuth client not configured"

**Error**:
```
Error: The OAuth client was not found.
```

**Solution**:
```bash
# Verify environment variables are set
echo $GOOGLE_CLIENT_ID
echo $GOOGLE_CLIENT_SECRET

# If empty, reload .env
source .env
```

### Issue 2: "Redirect URI mismatch"

**Error**:
```
Error: redirect_uri_mismatch
```

**Solution**:
1. Check Google Cloud Console > Credentials
2. Ensure redirect URI exactly matches: `http://localhost:3000/api/auth/google/callback`
3. No trailing slash, correct protocol (http vs https)

### Issue 3: "Access denied: insufficient permissions"

**Error**:
```
Error: Insufficient Permission: Request had insufficient authentication scopes.
```

**Solution**:
1. Revoke tokens: `mcp-memory google-revoke --user-email your-email@example.com`
2. Re-connect via web interface
3. Ensure you grant ALL requested permissions

### Issue 4: "Sync token expired"

**Error**:
```
⚠️  Sync token expired, performing full sync...
```

**Solution**:
- This is normal! syncToken expires after 7 days
- The system automatically falls back to full sync
- No action needed

### Issue 5: "Rate limit exceeded"

**Error**:
```
Error: Rate limit exceeded, retry after 120s
```

**Solution**:
- Wait for the specified time (automatic retry)
- Or reduce batch size in sync options
- Check Google Cloud Console for quota limits

## Next Steps

### Development

1. **Implement Web UI for Sync**:
   ```typescript
   // web/app/dashboard/page.tsx
   <Button onClick={async () => {
     const res = await fetch('/api/google-sync/contacts', {
       method: 'POST',
       body: JSON.stringify({ direction: 'import' })
     });
     const result = await res.json();
     toast.success(`Imported ${result.imported} contacts`);
   }}>
     Sync Google Contacts
   </Button>
   ```

2. **Add Automatic Sync**:
   ```typescript
   // Schedule weekly sync
   setInterval(async () => {
     await syncService.sync({
       userId: 'user@example.com',
       direction: 'both'
     });
   }, 7 * 24 * 60 * 60 * 1000); // Weekly
   ```

3. **Monitor Sync Health**:
   ```bash
   # Check sync statistics
   tsx scripts/sync-stats.ts
   ```

### Testing

1. **Run Unit Tests**:
   ```bash
   npm test -- google
   ```

2. **Run Integration Tests**:
   ```bash
   npm run test:integration -- google
   ```

3. **Performance Test**:
   ```bash
   npm run test:perf -- google-contacts-sync
   ```

### Deployment

1. **Update Production Environment**:
   ```bash
   # Add to Vercel/Netlify environment variables
   GOOGLE_CLIENT_ID=your-prod-client-id
   GOOGLE_CLIENT_SECRET=your-prod-secret
   GOOGLE_REDIRECT_URI=https://yourdomain.com/api/auth/google/callback
   ```

2. **Update OAuth Consent Screen**:
   - Change from "Testing" to "In Production"
   - Add production redirect URIs

3. **Deploy**:
   ```bash
   npm run build-full
   vercel deploy --prod
   ```

## Quick Reference Commands

### OAuth Management

```bash
# Connect Google account (web)
open http://localhost:3000/api/auth/google

# Revoke access
mcp-memory google-revoke --user-email user@example.com

# Check connection status
mcp-memory google-status --user-email user@example.com
```

### Sync Operations

```bash
# Google Contacts - Dry run
mcp-memory google-contacts-sync -u user@example.com --dry-run

# Google Contacts - Import
mcp-memory google-contacts-sync -u user@example.com --direction import

# Google Contacts - Export
mcp-memory google-contacts-sync -u user@example.com --direction export

# Google Contacts - Bidirectional
mcp-memory google-contacts-sync -u user@example.com --direction both

# Google Contacts - Force full sync
mcp-memory google-contacts-sync -u user@example.com --force-full

# Google Calendar - Current week
mcp-memory google-calendar-sync -u user@example.com

# Google Calendar - Specific week
mcp-memory google-calendar-sync -u user@example.com --week 2025-41
```

### Debugging

```bash
# Enable debug logging
DEBUG=* mcp-memory google-contacts-sync -u user@example.com

# Check syncToken
tsx -e "
import { DatabaseConnection } from './src/database/connection.js';
import { DatabaseOperations } from './src/database/operations.js';
(async () => {
  const db = await DatabaseConnection.getInstance();
  const ops = new DatabaseOperations(db);
  const user = await ops.getUserByEmail('user@example.com');
  console.log('syncToken:', user?.metadata?.googleContactsSyncToken);
})();
"

# Check API quotas (Google Cloud Console)
open https://console.cloud.google.com/apis/dashboard
```

## Success Checklist

After completing this quickstart, you should have:

- [x] Google Cloud project configured
- [x] OAuth 2.0 credentials created
- [x] Database schema migrated
- [x] OAuth flow working (tokens stored)
- [x] Google Contacts import successful
- [x] Google Calendar sync working
- [x] CLI commands functional
- [x] Web interface connected

## Resources

- [Architecture Docs](../architecture/GOOGLE_SYNC_ARCHITECTURE.md)
- [Sequence Diagrams](../architecture/GOOGLE_SYNC_FLOWS.md)
- [Implementation Plan](./GOOGLE_SYNC_IMPLEMENTATION_PLAN.md)
- [Google People API Docs](https://developers.google.com/people)
- [Google Calendar API Docs](https://developers.google.com/calendar)
- [OAuth 2.0 Guide](https://developers.google.com/identity/protocols/oauth2)

## Support

If you encounter issues:

1. Check the [Common Issues](#common-issues--solutions) section above
2. Review error logs: `~/.mcp-memory/logs/`
3. Enable debug mode: `DEBUG=* mcp-memory ...`
4. Check Google Cloud Console for API errors
5. File an issue on GitHub with logs and error details

---

**Congratulations!** 🎉

You've successfully set up Google Contacts and Calendar sync. The system is now ready for:
- Incremental syncs (using syncToken)
- LLM-powered deduplication
- Weekly calendar tracking
- Entity relationship mapping

Next: Implement the web UI for user-facing sync controls!
