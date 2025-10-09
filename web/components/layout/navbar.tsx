'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { UserButton, useUser, SignInButton } from '@clerk/nextjs';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export function Navbar() {
  const pathname = usePathname();
  const { user, isLoaded } = useUser();

  // Don't show navbar on home page for unauthenticated users
  if (pathname === '/' && !user) {
    return null;
  }

  const navItems = [
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/utilities', label: 'Utilities' },
    { href: '/settings', label: 'Settings' },
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
            {isLoaded && user ? (
              <>
                <div className="text-sm text-muted-foreground hidden md:block">
                  {user?.emailAddresses[0]?.emailAddress}
                </div>
                <UserButton afterSignOutUrl="/" />
              </>
            ) : (
              <SignInButton mode="modal">
                <Button variant="default">Sign In</Button>
              </SignInButton>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
