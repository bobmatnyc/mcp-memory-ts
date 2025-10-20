'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { UserButton, useUser, SignInButton } from '@clerk/nextjs';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export function Navbar() {
  const pathname = usePathname();
  const { user, isLoaded } = useUser();

  // Debug logging for authentication status
  useEffect(() => {
    if (isLoaded) {
      console.log('[Navbar] Auth status:', {
        isLoaded,
        hasUser: !!user,
        userEmail: user?.emailAddresses[0]?.emailAddress,
        pathname,
      });
    }
  }, [isLoaded, user, pathname]);

  // Don't show navbar on home page for unauthenticated users
  if (pathname === '/' && !user) {
    return null;
  }

  const navItems = [
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/memory', label: 'Memory' },
    { href: '/sync', label: 'Sync' },
    { href: '/utilities', label: 'Utilities' },
    { href: '/settings', label: 'Settings' },
    { href: '/status', label: 'Status' },
  ];

  return (
    <nav className="border-b bg-white sticky top-0 z-50 shadow-sm">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-8">
            <Link href={user ? '/dashboard' : '/'} className="text-xl font-bold text-primary">
              MCP Memory
            </Link>
            {user && (
              <div className="flex space-x-4">
                {navItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'px-3 py-2 rounded-md text-sm font-medium transition-colors',
                      pathname === item.href
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                    )}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center space-x-4">
            {!isLoaded ? (
              // Show loading spinner while Clerk is initializing
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                <span className="text-sm text-muted-foreground">Loading...</span>
              </div>
            ) : user ? (
              // User is authenticated - show email and UserButton
              <>
                <div className="text-sm text-muted-foreground hidden md:block">
                  {user.emailAddresses[0]?.emailAddress}
                </div>
                <UserButton
                  afterSignOutUrl="/"
                  appearance={{
                    elements: {
                      avatarBox: "h-8 w-8"
                    }
                  }}
                />
              </>
            ) : (
              // User is not authenticated - show Sign In button
              <SignInButton mode="modal">
                <Button
                  variant="default"
                  size="default"
                  className="flex items-center gap-2"
                >
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"
                    />
                  </svg>
                  Sign In
                </Button>
              </SignInButton>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
