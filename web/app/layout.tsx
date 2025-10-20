import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { ClerkProvider } from '@clerk/nextjs';
import { Toaster } from '@/components/ui/toaster';
import { Navbar } from '@/components/layout/navbar';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'MCP Memory - AI Memory Service',
  description: 'Cloud-based vector memory service for AI assistants',
};

// Validate Clerk configuration
if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
  console.error('[Layout] Missing NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY - authentication will not work');
}
if (!process.env.CLERK_SECRET_KEY) {
  console.error('[Layout] Missing CLERK_SECRET_KEY - authentication will not work');
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className={inter.className}>
          <Navbar />
          {children}
          <Toaster />
        </body>
      </html>
    </ClerkProvider>
  );
}
