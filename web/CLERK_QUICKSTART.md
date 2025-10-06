# Clerk Authentication - Quick Start Guide

This guide will help you get the MCP Memory web interface running with Clerk authentication.

## Prerequisites

- Node.js 18+ installed
- Turso database credentials
- OpenAI API key
- Clerk account (free tier available)

## Step 1: Install Dependencies

```bash
cd web
npm install
```

## Step 2: Configure Environment Variables

### Option A: Use Test Environment (Provided)

Copy the test environment file:

```bash
cp .env.local.example .env.local
```

The test Clerk keys are already included in `.env.local`:

```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_<your_publishable_key>
CLERK_SECRET_KEY=sk_test_<your_secret_key>
```

Just add your database and OpenAI credentials:

```env
TURSO_URL=libsql://your-database.turso.io
TURSO_AUTH_TOKEN=your-auth-token
OPENAI_API_KEY=your-openai-api-key
```

### Option B: Use Your Own Clerk Account

1. Sign up at https://clerk.com
2. Create a new application
3. Get your API keys from the dashboard
4. Update `.env.local`:

```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_your_key
CLERK_SECRET_KEY=sk_test_your_key
```

## Step 3: Configure Clerk Settings (Optional)

If using your own Clerk account:

1. Go to https://dashboard.clerk.com
2. Select your application
3. Configure authentication methods:
   - Enable Email/Password
   - Enable Google (recommended)
   - Enable other providers as needed
4. Customize appearance (optional):
   - Update colors to match your brand
   - Customize sign-in page

## Step 4: Run Development Server

```bash
npm run dev
```

Visit http://localhost:3000

## Step 5: Test Authentication

1. **Landing Page**: You should see a "Sign In" button
2. **Click Sign In**: Clerk modal appears
3. **Create Account**:
   - Use email/password or Google
   - Follow Clerk's signup flow
4. **Dashboard**: After sign in, you're redirected to dashboard
5. **Profile**: Click your profile picture in navbar to see user menu

## Authentication Flow

```
User visits / (landing page)
         ↓
Not authenticated → Sign In button → Clerk modal
         ↓
User signs in with Clerk
         ↓
Clerk creates session
         ↓
App gets user email from Clerk
         ↓
App creates user in MCP Memory database
         ↓
User redirected to /dashboard
         ↓
User can access memories, entities, etc.
```

## User Management

### View Users
Go to Clerk Dashboard → Users to see all signed-up users

### Manage Users
- Block/unblock users
- Delete users
- View user activity
- Export user data

### User Isolation
Each user's data is isolated by email address in the MCP Memory database. Different Clerk users will see different memories.

## Environment-Specific Setup

### Development (localhost)
Use `.env.local` with test keys provided

### Production (deployed)
Use `.env.production` with production keys:

```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_<your_publishable_key>
CLERK_SECRET_KEY=sk_live_<your_secret_key>
```

## Troubleshooting

### Issue: "Clerk is not configured"
- Check that environment variables are set
- Restart dev server after changing .env files
- Verify keys start with `pk_test_` or `pk_live_`

### Issue: "User email not found"
- Ensure user has verified email in Clerk
- Check Clerk dashboard for user's email addresses
- User must have at least one email address

### Issue: "Unauthorized" errors in API
- Check middleware configuration in `middleware.ts`
- Verify API routes are not in public routes list
- Check browser console for auth errors

### Issue: Build fails
- Run `npm install` to ensure dependencies are installed
- Clear `.next` folder: `rm -rf .next`
- Rebuild: `npm run build`

## API Integration

API routes automatically get user authentication:

```typescript
// Example: API route with Clerk auth
import { getUserEmail } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const userEmail = await getUserEmail(); // Clerk user's email
    // userEmail is automatically extracted from Clerk session

    // Your API logic here...

  } catch (error) {
    // User not authenticated
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }
}
```

## Component Usage

### Using Clerk Components

```typescript
// Sign in button
import { SignInButton } from '@clerk/nextjs';

<SignInButton mode="modal">
  <button>Sign In</button>
</SignInButton>

// User button (profile menu)
import { UserButton } from '@clerk/nextjs';

<UserButton afterSignOutUrl="/" />

// Check user state
import { useUser } from '@clerk/nextjs';

function MyComponent() {
  const { isSignedIn, user } = useUser();

  if (!isSignedIn) return <div>Please sign in</div>;

  return <div>Hello {user.firstName}!</div>;
}
```

## Next Steps

1. **Customize Appearance**: Update Clerk theme in dashboard
2. **Add More Providers**: Enable GitHub, Microsoft, etc.
3. **Set Up Webhooks**: Get notified of user events
4. **Configure Multi-Factor Auth**: Add extra security
5. **Review Analytics**: Check Clerk dashboard for usage stats

## Resources

- **Clerk Documentation**: https://clerk.com/docs
- **Clerk Dashboard**: https://dashboard.clerk.com
- **Next.js + Clerk Guide**: https://clerk.com/docs/quickstarts/nextjs
- **API Reference**: https://clerk.com/docs/reference/backend-api

## Support

- **Clerk Support**: support@clerk.com
- **Project Issues**: GitHub Issues
- **Documentation**: See CLERK_MIGRATION.md for detailed changes

---

**Last Updated**: 2025-10-03
**Clerk Version**: 5.7.5
