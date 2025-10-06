import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { SignInButton } from '@clerk/nextjs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export const dynamic = 'force-dynamic';

export default function HomePage() {
  const { userId } = auth();

  if (userId) {
    redirect('/status');
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-3xl font-bold">MCP Memory</CardTitle>
          <CardDescription>Sign in to access your AI memory service</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <SignInButton mode="modal">
            <Button className="w-full" size="lg">
              Sign In
            </Button>
          </SignInButton>

          <div className="text-center text-sm text-muted-foreground">
            By signing in, you agree to our Terms of Service and Privacy Policy
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
