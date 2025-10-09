import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Settings, Wrench, ArrowRight } from 'lucide-react';

export function NavCards() {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card className="hover:shadow-lg transition-shadow">
        <CardHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 bg-blue-100 rounded-lg">
              <Settings className="h-6 w-6 text-blue-600" />
            </div>
            <CardTitle className="text-2xl">Settings</CardTitle>
          </div>
          <CardDescription className="text-base">
            Configure your database credentials, OpenAI API key, and other system settings
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/settings">
            <Button className="w-full" size="lg">
              Manage Settings
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </CardContent>
      </Card>

      <Card className="hover:shadow-lg transition-shadow">
        <CardHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 bg-purple-100 rounded-lg">
              <Wrench className="h-6 w-6 text-purple-600" />
            </div>
            <CardTitle className="text-2xl">Utilities</CardTitle>
          </div>
          <CardDescription className="text-base">
            Browse memories, search content, and use memory extraction tools
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/utilities">
            <Button className="w-full" size="lg" variant="outline">
              Open Utilities
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
