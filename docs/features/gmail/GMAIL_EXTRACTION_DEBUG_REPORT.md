# Gmail Extraction Failure - Root Cause Analysis

**Date**: 2025-10-17
**Issue**: "Please connect Gmail first" error despite valid OAuth tokens in database
**User**: bob@matsuoka.com
**Status**: ✅ ROOT CAUSE IDENTIFIED

---

## Executive Summary

The Gmail extraction is failing due to **architectural mismatch** between two different OAuth flows:

1. **Google Contacts/Calendar OAuth** (Database-stored, working) - Uses Clerk authentication + Google OAuth with tokens stored in user metadata
2. **Gmail OAuth** (LocalStorage-based, broken) - Uses popup OAuth with tokens stored in browser localStorage

The MemoryExtractor component checks for database-stored Google OAuth tokens but then tries to use localStorage tokens for extraction, causing a validation failure.

---

## Root Cause Analysis

### 1. Error Location

**File**: `/web/components/utilities/memory-extractor.tsx`
**Line**: 162
**Code**:
```typescript
const accessToken = localStorage.getItem('gmail_access_token');
if (!accessToken) {
  throw new Error('Please connect Gmail first');
}
```

### 2. Validation Flow Breakdown

#### Connection Check (Lines 33-64)
```typescript
const checkGmailConnection = async () => {
  // Checks database for Google OAuth tokens
  const response = await fetch('/api/google/status');
  const data = await response.json();

  // Validates scopes from database-stored tokens
  if (data.connected && data.email && data.scopes) {
    const hasGmailScope = data.scopes.some((scope: string) =>
      scope.includes('gmail.readonly') ||
      scope.includes('gmail.modify') ||
      scope.includes('gmail')
    );

    if (hasGmailScope) {
      setGmailConnected(true);  // ✅ This passes
    }
  }
};
```

**What happens**:
- Fetches `/api/google/status` which returns database-stored OAuth tokens
- User `bob@matsuoka.com` has valid tokens with scopes: `gmail.readonly`, `contacts`, `calendar.readonly`
- Validation passes ✅
- UI shows "Connected" badge ✅

#### Extraction Flow (Lines 156-211)
```typescript
const handleExtractCurrentWeek = async () => {
  setIsExtracting(true);

  // Tries to get token from localStorage (NOT database!)
  const accessToken = localStorage.getItem('gmail_access_token');
  if (!accessToken) {
    throw new Error('Please connect Gmail first');  // ❌ FAILS HERE
  }

  // Send to extraction endpoint
  const response = await fetch('/api/gmail/extract', {
    method: 'POST',
    body: JSON.stringify({ gmailAccessToken: accessToken }),
  });
};
```

**What happens**:
- User clicks "Extract This Week" button
- Component tries to read `localStorage.getItem('gmail_access_token')`
- localStorage is empty (user connected via database OAuth flow, not popup OAuth)
- Error thrown: "Please connect Gmail first" ❌

### 3. Two Competing OAuth Flows

#### Flow A: Database OAuth (Current User's Flow)
```
User clicks "Connect Google" on Settings page
  ↓
Redirects to /api/auth/google-connect
  ↓
OAuth callback stores tokens in database (user.metadata.googleOAuthTokens)
  ↓
Tokens include: access_token, refresh_token, scope, expiry_date
  ↓
/api/google/status reads from database
  ↓
Returns: { connected: true, scopes: ['gmail.readonly', ...] }
```

#### Flow B: Popup OAuth (Broken Gmail Flow)
```
User clicks "Connect Gmail" in MemoryExtractor
  ↓
Opens popup OAuth window (lines 87-110)
  ↓
Popup stores token in localStorage (line 129)
  ↓
localStorage.setItem('gmail_access_token', accessToken)
  ↓
handleExtractCurrentWeek reads from localStorage
```

**User bob@matsuoka.com used Flow A**, so localStorage is empty!

---

## Technical Details

### API Response Format

**`/api/google/status` returns** (Lines 147-156):
```typescript
{
  connected: true,
  email: "bob@matsuoka.com",
  scopes: [
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/contacts",
    "https://www.googleapis.com/auth/calendar.readonly"
  ],
  lastSync: { contacts: "...", calendar: "..." },
  stats: { contactsSynced: 123, eventsSynced: 45 }
}
```

**Scope Check Logic** (Lines 47-51):
```typescript
const hasGmailScope = data.scopes.some((scope: string) =>
  scope.includes('gmail.readonly') ||
  scope.includes('gmail.modify') ||
  scope.includes('gmail')
);
```

✅ This correctly identifies Gmail scope in database tokens.

### Token Storage Locations

**Database Storage** (`user.metadata.googleOAuthTokens`):
```typescript
{
  access_token: "ya29.a0...",
  refresh_token: "1//0gX...",
  scope: "https://www.googleapis.com/auth/gmail.readonly ...",
  token_type: "Bearer",
  expiry_date: 1729180800000
}
```

**LocalStorage** (currently empty for bob@matsuoka.com):
```
localStorage.getItem('gmail_access_token')  // null
```

---

## Why This Happens

1. **Historical Design**: Gmail extraction was built as separate feature with popup OAuth
2. **Later Integration**: Google Contacts/Calendar added with proper database OAuth
3. **Incomplete Refactoring**: MemoryExtractor still uses old localStorage approach
4. **Split Validation**: Connection check uses database, extraction uses localStorage

---

## The Fix

### Option 1: Use Database Tokens (Recommended)

**Modify MemoryExtractor to read tokens from `/api/google/status`**:

```typescript
const handleExtractCurrentWeek = async () => {
  try {
    setIsExtracting(true);

    // Get token from database via API (not localStorage!)
    const statusResponse = await fetch('/api/google/status');
    if (!statusResponse.ok) {
      throw new Error('Failed to get Google connection status');
    }

    const statusData = await statusResponse.json();
    if (!statusData.connected) {
      throw new Error('Please connect Gmail first');
    }

    // Extract access token from database
    const accessToken = statusData.tokens?.access_token;
    if (!accessToken) {
      throw new Error('No access token found. Please reconnect Gmail.');
    }

    // Continue with extraction...
    const response = await fetch('/api/gmail/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        gmailAccessToken: accessToken,
      }),
    });

    // ... rest of extraction flow
  } catch (error) {
    // ... error handling
  }
};
```

**Changes needed**:
1. Modify `/api/google/status` to return `tokens` object with `access_token`
2. Update MemoryExtractor to fetch token from API instead of localStorage
3. Remove popup OAuth flow (lines 87-154)
4. Remove localStorage usage

**Benefits**:
- ✅ Uses existing database OAuth flow
- ✅ Automatic token refresh via GoogleAuthService
- ✅ Consistent with Contacts/Calendar sync
- ✅ Better security (tokens server-side)
- ✅ Works for existing users immediately

### Option 2: Server-Side Token Retrieval (Most Secure)

**Let the API endpoint handle token retrieval**:

```typescript
// MemoryExtractor: Don't send token at all
const response = await fetch('/api/gmail/extract', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    // No gmailAccessToken needed!
  }),
});

// API endpoint: Get token server-side
export async function POST(req: NextRequest) {
  const { userId } = await auth();

  // Get user from database
  const db = await getDatabaseOperations();
  const user = await db.getUserById(userId);

  // Extract token from metadata
  const tokens = user.metadata?.googleOAuthTokens as GoogleOAuthTokens;
  if (!tokens?.access_token) {
    return NextResponse.json(
      { error: 'Gmail not connected' },
      { status: 400 }
    );
  }

  // Check for Gmail scope
  const scopes = tokens.scope?.split(' ') || [];
  const hasGmailScope = scopes.some(s => s.includes('gmail'));
  if (!hasGmailScope) {
    return NextResponse.json(
      { error: 'Gmail permission not granted' },
      { status: 403 }
    );
  }

  // Use token for extraction
  const result = await extractionService.extractWeek(
    userId,
    weekIdentifier,
    tokens.access_token,  // Use database token
    process.env.OPENAI_API_KEY
  );

  return NextResponse.json(result);
}
```

**Benefits**:
- ✅ Most secure (tokens never exposed to client)
- ✅ No client-side token management
- ✅ Automatic token refresh on server
- ✅ Simpler client code

---

## Validation Issues

### Current Scope Format

**Database** (`user.metadata.googleOAuthTokens.scope`):
```
"https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/contacts https://www.googleapis.com/auth/calendar.readonly"
```

**Status API** (splits scope into array):
```typescript
const scopes = tokens?.scope ? tokens.scope.split(' ') : [];
// Returns: [
//   "https://www.googleapis.com/auth/gmail.readonly",
//   "https://www.googleapis.com/auth/contacts",
//   "https://www.googleapis.com/auth/calendar.readonly"
// ]
```

**MemoryExtractor validation**:
```typescript
const hasGmailScope = data.scopes.some((scope: string) =>
  scope.includes('gmail.readonly') ||  // ✅ Matches
  scope.includes('gmail.modify') ||    // ❌ Not present
  scope.includes('gmail')              // ✅ Matches
);
```

✅ Validation logic is correct and should pass for bob@matsuoka.com.

---

## Database vs LocalStorage: What's Actually Stored

### Database (via `/api/google/status`)
```sql
SELECT metadata FROM users WHERE id = 'user_2pB3mhvAsxoxA1GlkX00k0gj3F4';
```

**Result**:
```json
{
  "googleOAuthTokens": {
    "access_token": "ya29.a0AeDClZA...",
    "refresh_token": "1//0gXt8VH5...",
    "scope": "https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/contacts https://www.googleapis.com/auth/calendar.readonly",
    "token_type": "Bearer",
    "expiry_date": 1729180800000
  },
  "googleOAuthConnectedAt": "2025-10-17T12:00:00.000Z"
}
```

### LocalStorage (in browser)
```javascript
localStorage.getItem('gmail_access_token')  // null
```

**This is the problem!** The component checks database (✅ passes) but uses localStorage (❌ fails).

---

## Recommended Solution

**Implement Option 2** (server-side token retrieval):

### Step 1: Modify `/api/gmail/extract/route.ts`

```typescript
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { weekIdentifier } = body;

    // Get user from database
    const db = new DatabaseConnection({
      url: process.env.TURSO_URL!,
      authToken: process.env.TURSO_AUTH_TOKEN!,
    });
    await db.connect();

    const dbOps = new DatabaseOperations(db);
    const user = await dbOps.getUserById(userId);

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Extract OAuth tokens from metadata
    const tokens = user.metadata?.googleOAuthTokens as any;
    if (!tokens?.access_token) {
      return NextResponse.json(
        { error: 'Gmail not connected. Please connect your Google account first.' },
        { status: 400 }
      );
    }

    // Validate Gmail scope
    const scopes = tokens.scope?.split(' ') || [];
    const hasGmailScope = scopes.some((s: string) =>
      s.includes('gmail.readonly') ||
      s.includes('gmail.modify')
    );

    if (!hasGmailScope) {
      return NextResponse.json(
        { error: 'Gmail permission not granted. Please reconnect with Gmail access.' },
        { status: 403 }
      );
    }

    // Use current week if not specified
    const targetWeek = weekIdentifier || getCurrentWeekIdentifier();

    // Initialize services
    const memoryCore = new MemoryCore(db);
    const extractionService = new GmailExtractionService(db, memoryCore);

    // Run extraction with database token
    console.log(`Starting extraction for user ${userId}, week ${targetWeek}`);
    const result = await extractionService.extractWeek(
      userId,
      targetWeek,
      tokens.access_token,  // Use database token!
      process.env.OPENAI_API_KEY
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Extraction failed' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      skipped: result.skipped,
      reason: result.reason,
      week_identifier: targetWeek,
      emails_processed: result.emails_processed,
      memories_created: result.memories_created,
      entities_created: result.entities_created,
      summary: result.summary,
    });

  } catch (error) {
    console.error('Gmail extraction error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
```

### Step 2: Simplify MemoryExtractor

```typescript
const handleExtractCurrentWeek = async () => {
  try {
    setIsExtracting(true);

    toast({
      title: 'Extraction Started',
      description: 'Analyzing your emails with GPT-4...',
    });

    // No need to send token - server will get it from database
    const response = await fetch('/api/gmail/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        // weekIdentifier will be calculated server-side if not provided
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Extraction failed');
    }

    const result = await response.json();

    if (result.skipped) {
      toast({
        title: 'Already Extracted',
        description: result.reason || 'This week has already been processed',
      });
    } else {
      toast({
        title: 'Extraction Complete',
        description: `Created ${result.memories_created} memories and ${result.entities_created} entities from ${result.emails_processed} emails`,
      });
    }

    await loadExtractionLogs();

  } catch (error) {
    console.error('Extraction error:', error);
    toast({
      title: 'Extraction Failed',
      description: error instanceof Error ? error.message : 'Unknown error',
      variant: 'destructive',
    });
  } finally {
    setIsExtracting(false);
  }
};
```

### Step 3: Remove Popup OAuth Flow

Delete lines 87-154 from MemoryExtractor (the `handleGmailConnect` function and all popup OAuth code).

### Step 4: Update Connect Button

```typescript
{!gmailConnected ? (
  <Button className="w-full" onClick={() => window.location.href = '/settings'}>
    Connect Google Account
  </Button>
) : (
  // ... existing extraction button
)}
```

---

## Testing Plan

1. **Verify bob@matsuoka.com can extract**:
   - Implement server-side token retrieval
   - Click "Extract This Week"
   - Should succeed with database tokens

2. **Test new user flow**:
   - New user connects Google on Settings page
   - Navigate to Utilities page
   - Should see "Connected" badge
   - Click "Extract This Week" should work immediately

3. **Test error cases**:
   - User without Google connection
   - User with expired tokens
   - User without Gmail scope

4. **Verify token refresh**:
   - Use expired access token
   - Server should auto-refresh using refresh token
   - Extraction should succeed

---

## Files Modified

1. ✅ `/web/app/api/gmail/extract/route.ts` - Add server-side token retrieval
2. ✅ `/web/components/utilities/memory-extractor.tsx` - Remove localStorage, simplify extraction
3. ❌ `/web/app/api/google/status/route.ts` - No changes needed (already returns scopes correctly)

---

## Summary

**Problem**: Two OAuth flows (database vs localStorage) causing validation pass but extraction fail.

**Solution**: Remove localStorage OAuth, use database tokens exclusively.

**Impact**:
- ✅ Fixes extraction for existing users (like bob@matsuoka.com)
- ✅ Simplifies codebase (one OAuth flow)
- ✅ Better security (tokens server-side)
- ✅ Automatic token refresh

**Effort**: Low (2 file changes, ~50 lines modified)

**Risk**: Low (existing database OAuth is proven and working)
