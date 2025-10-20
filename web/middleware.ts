import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { hasRequiredCredentials } from './lib/user-metadata';
import { NextResponse } from 'next/server';

const isPublicRoute = createRouteMatcher([
  '/',
  '/api/health',
  '/api/health/openai',
  // '/api/stats' REMOVED - requires authentication
]);
const isSettingsRoute = createRouteMatcher(['/settings', '/api/settings']);

export default clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request)) {
    const { userId } = await auth();

    if (!userId) {
      await auth.protect();
      return;
    }

    // Allow access to settings page and API
    if (isSettingsRoute(request)) {
      return;
    }

    // Check if user has configured credentials
    const hasCredentials = await hasRequiredCredentials(userId);

    if (!hasCredentials) {
      // Redirect to settings if credentials not configured
      const settingsUrl = new URL('/settings', request.url);
      return NextResponse.redirect(settingsUrl);
    }
  }
});

export const config = {
  matcher: ['/((?!.+\\.[\\w]+$|_next).*)', '/', '/(api|trpc)(.*)'],
};
