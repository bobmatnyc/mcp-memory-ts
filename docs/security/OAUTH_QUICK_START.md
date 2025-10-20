# Google OAuth - Quick Start Guide

**Status**: ✅ Database migration complete, ready for testing

---

## One-Time Setup (Already Done ✅)

The database has been migrated to use Clerk IDs. Your user record:
- **User ID**: `user_33ZB97Sz4n775IAjl8pY5YZHqYd` (Clerk ID)
- **Email**: bob@matsuoka.com
- **Status**: Ready for OAuth

---

## Quick Test (3 Steps)

### Step 1: Start Web Server

Option A - Direct (Recommended):
```bash
cd /Users/masa/Projects/mcp-memory-ts
./START_WEB_SERVER.sh
```

Option B - PM2 (Alternative):
```bash
cd /Users/masa/Projects/mcp-memory-ts/web
pm2 delete mcp-memory-web-3002 2>/dev/null || true
pm2 start npm --name "mcp-memory-web-3002" -- run dev -- -p 3002
pm2 logs mcp-memory-web-3002 --lines 0  # Monitor logs
```

### Step 2: Test OAuth Flow

1. Open browser: http://localhost:3002/settings
2. Click "Connect Google Account"
3. Sign in to Google (bob@matsuoka.com)
4. Accept permissions
5. Should redirect to: `/settings?google_connected=true`

### Step 3: Verify Success

Run verification script:
```bash
cd /Users/masa/Projects/mcp-memory-ts
./TEST_OAUTH_AFTER_COMPLETE.sh
```

Expected output:
```
✅✅✅ SUCCESS! Google OAuth tokens stored!

Token details:
   Connected at: 2025-10-14T...
   Has access_token: ✓
   Has refresh_token: ✓
   Token type: Bearer
   Scope: ...

🎉 OAuth integration is working!
```

---

## What Was Fixed

### Before (Broken)
- User ID in database: `20f51f5c-1cd6-4b2f-8cb0-b98b57c2b8cf` (UUID)
- OAuth callback passes: `user_33ZB97Sz4n775IAjl8pY5YZHqYd` (Clerk ID)
- Lookup fails → "User not found" error

### After (Fixed)
- User ID in database: `user_33ZB97Sz4n775IAjl8pY5YZHqYd` (Clerk ID)
- OAuth callback passes: `user_33ZB97Sz4n775IAjl8pY5YZHqYd` (Clerk ID)
- Lookup succeeds → tokens stored ✅

---

## Success Indicators

✅ **OAuth Flow Works**:
- Redirect to `/settings?google_connected=true`
- Green "Connected" status in settings
- No "User not found" errors in logs

✅ **Tokens Stored**:
- Verification script shows tokens
- `user.metadata.googleOAuthTokens` exists
- Contains access_token and refresh_token

✅ **Sync Works**:
```bash
# Test commands should work:
mcp-memory google auth --user-email bob@matsuoka.com
mcp-memory google contacts-sync --user-email bob@matsuoka.com --direction import --dry-run
mcp-memory google calendar-sync --user-email bob@matsuoka.com
```

---

## Troubleshooting

### Web server won't start
```bash
# Check if port 3002 is in use
lsof -ti:3002 | xargs kill -9

# Try starting directly
cd /Users/masa/Projects/mcp-memory-ts/web
npm run dev -- -p 3002
```

### OAuth redirects with error
Check URL for error parameter:
- `?google_error=token_storage_failed` → Check logs
- `?google_error=token_exchange_failed` → Google API issue
- `?google_error=invalid_callback` → Missing parameters

### "User not found" in logs
Verify user ID migration:
```bash
npx tsx << 'EOF'
import { createClient } from '@libsql/client';
const client = createClient({url: process.env.TURSO_URL!, authToken: process.env.TURSO_AUTH_TOKEN!});
const r = await client.execute({sql: 'SELECT id FROM users WHERE email = ?', args: ['bob@matsuoka.com']});
console.log('Current ID:', r.rows[0]?.id);
console.log('Expected:', 'user_33ZB97Sz4n775IAjl8pY5YZHqYd');
await client.close();
EOF
```

---

## Files

| File | Purpose |
|------|---------|
| `START_WEB_SERVER.sh` | Start development server on port 3002 |
| `TEST_OAUTH_AFTER_COMPLETE.sh` | Verify tokens after OAuth flow |
| `OAUTH_TEST_INSTRUCTIONS.md` | Detailed test instructions |
| `OAUTH_VERIFICATION_REPORT.md` | Technical verification details |
| `OAUTH_VERIFICATION_SUMMARY.md` | Quick status summary |

---

## Next Steps After Success

1. **Test Contacts Sync**:
   ```bash
   mcp-memory google contacts-sync --user-email bob@matsuoka.com --direction import
   ```

2. **Test Calendar Sync**:
   ```bash
   mcp-memory google calendar-sync --user-email bob@matsuoka.com
   ```

3. **Monitor in Web Interface**:
   - View imported contacts at http://localhost:3002/dashboard
   - Check memory/entity statistics

---

**Ready**: YES ✅
**Date**: 2025-10-14
**User**: bob@matsuoka.com
**Clerk ID**: user_33ZB97Sz4n775IAjl8pY5YZHqYd
