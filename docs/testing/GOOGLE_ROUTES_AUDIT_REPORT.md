# Google Routes - sessionClaims Bug Audit Report

## Executive Summary

**Critical Finding**: 4 additional routes have the same `sessionClaims?.email` bug that was fixed in `/api/google/status/route.ts`.

**Impact**: All these routes will fail with TypeError when trying to access user data, causing silent failures and always returning error responses.

## Affected Routes

### 1. `/web/app/api/google/calendar/sync/route.ts` (Line 24)
**Function**: POST - Sync Google Calendar events
**Impact**: Cannot sync calendar events
**Severity**: HIGH

### 2. `/web/app/api/google/calendar/events/route.ts` (Line 22)
**Function**: GET - Retrieve calendar events
**Impact**: Cannot retrieve calendar events
**Severity**: HIGH

### 3. `/web/app/api/google/contacts/sync/route.ts` (Line 22)
**Function**: POST - Sync Google Contacts
**Impact**: Cannot sync contacts
**Severity**: HIGH

### 4. `/web/app/api/google/disconnect/route.ts` (Line 20)
**Function**: POST - Disconnect Google OAuth
**Impact**: Cannot disconnect Google account
**Severity**: MEDIUM

## Bug Pattern

All affected routes use:
```typescript
const { userId, sessionClaims } = await auth();
const userEmail = sessionClaims?.email as string;  // ❌ Always undefined
```

## Required Fix Pattern

Replace with:
```typescript
const { userId } = await auth();

if (!userId) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

// Get Clerk user data to retrieve email
const { currentUser } = await import('@clerk/nextjs/server');
const clerkUser = await currentUser();

if (!clerkUser || !clerkUser.emailAddresses || clerkUser.emailAddresses.length === 0) {
  console.error('[RouteName] No email found for Clerk user:', userId);
  return NextResponse.json({ error: 'User email not found' }, { status: 400 });
}

const userEmail = clerkUser.emailAddresses[0].emailAddress;
console.log('[RouteName] Processing request for user:', { userId, email: userEmail });
```

## Recommended Actions

### Option 1: Fix All Routes Now (Recommended)
**Pros**:
- Complete fix in single deployment
- Consistent codebase
- All Google features working

**Cons**:
- Requires testing all 5 routes
- Larger change surface

### Option 2: Fix Routes Incrementally
**Pros**:
- Smaller changes per deployment
- Can prioritize by severity

**Cons**:
- Multiple deployments needed
- Users still experience bugs until all fixed

## Priority Order

If fixing incrementally, use this order:

1. **High Priority** (User-facing features):
   - `/api/google/contacts/sync/route.ts` - Contact sync
   - `/api/google/calendar/sync/route.ts` - Calendar sync
   - `/api/google/calendar/events/route.ts` - Event retrieval

2. **Medium Priority** (Less frequent):
   - `/api/google/disconnect/route.ts` - Disconnect

3. **Complete** (Already fixed):
   - `/api/google/status/route.ts` - Status check ✅

## Testing Checklist

After fixing each route, verify:

- [ ] No TypeError in logs when calling the endpoint
- [ ] User email is retrieved correctly
- [ ] Endpoint returns expected data/response
- [ ] Error handling works for invalid users
- [ ] Logs show [RouteName] prefixed messages

## Estimated Impact

### Before Fix
- **Calendar Sync**: Broken (TypeError on every request)
- **Calendar Events**: Broken (TypeError on every request)
- **Contacts Sync**: Broken (TypeError on every request)
- **Disconnect**: Broken (TypeError on every request)
- **Status Check**: ✅ Fixed

### After Fix
- **Calendar Sync**: Working
- **Calendar Events**: Working
- **Contacts Sync**: Working
- **Disconnect**: Working
- **Status Check**: ✅ Working

## Additional Recommendations

### Code Review
Audit all routes for similar patterns:
```bash
grep -r "sessionClaims" web/app/api/ --include="*.ts" --include="*.tsx"
```

### Automated Testing
Add integration tests that verify:
1. Email retrieval works correctly
2. Routes don't throw TypeError
3. Error responses are proper HTTP codes

### Documentation
Update developer documentation:
1. Add "Common Pitfalls" section about Clerk email access
2. Provide code snippets for correct patterns
3. Document why `sessionClaims?.email` doesn't work

---

**Status**: 1/5 routes fixed (20% complete)
**Priority**: HIGH - Fix remaining routes ASAP
**Next Steps**: Fix all 4 remaining routes using same pattern as status route
