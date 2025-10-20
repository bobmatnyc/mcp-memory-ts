'use client';

export const dynamic = 'force-dynamic';
import { useUser } from '@clerk/nextjs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Settings, User, Database, Key, Info } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function SettingsPage() {
  const { user } = useUser();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto space-y-6">
          <div>
            <h1 className="text-3xl font-bold">Settings</h1>
            <p className="text-muted-foreground mt-2">
              Manage your account preferences and configuration
            </p>
          </div>

          {/* Account Information */}
          <Card className="border-blue-200 bg-blue-50">
            <CardHeader>
              <CardTitle className="text-blue-900 flex items-center gap-2">
                <User className="h-5 w-5" />
                Account Information
              </CardTitle>
              <CardDescription>
                Your personal account details
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center p-3 bg-white rounded-lg border border-blue-200">
                <span className="font-medium text-sm text-blue-900">Email:</span>
                <span className="font-mono text-sm">{user?.primaryEmailAddress?.emailAddress || 'Not available'}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-white rounded-lg border border-blue-200">
                <span className="font-medium text-sm text-blue-900">Name:</span>
                <span className="text-sm">{user?.fullName || 'Not set'}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-white rounded-lg border border-blue-200">
                <span className="font-medium text-sm text-blue-900">User ID:</span>
                <span className="font-mono text-xs text-gray-600">{user?.id || 'N/A'}</span>
              </div>
            </CardContent>
          </Card>

          {/* Database Configuration */}
          <Card className="border-purple-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Database Configuration
              </CardTitle>
              <CardDescription>
                Database connection and storage settings
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
                  <div>
                    <p className="font-medium text-sm">Database Provider</p>
                    <p className="text-xs text-muted-foreground">Turso/LibSQL</p>
                  </div>
                  <Badge variant="secondary" className="bg-green-100 text-green-800">
                    Active
                  </Badge>
                </div>
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-800">
                    <strong>Note:</strong> Database credentials are configured at the server level
                    by the administrator. Contact your system administrator to modify database settings.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* API Keys */}
          <Card className="border-green-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                API Configuration
              </CardTitle>
              <CardDescription>
                External service API keys and credentials
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
                  <div>
                    <p className="font-medium text-sm">OpenAI API</p>
                    <p className="text-xs text-muted-foreground">Required for embeddings and AI features</p>
                  </div>
                  <Badge variant="secondary" className="bg-green-100 text-green-800">
                    Configured
                  </Badge>
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
                  <div>
                    <p className="font-medium text-sm">Google OAuth</p>
                    <p className="text-xs text-muted-foreground">For Google services integration</p>
                  </div>
                  <Badge variant="secondary" className="bg-green-100 text-green-800">
                    Configured
                  </Badge>
                </div>
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-800">
                    <strong>Note:</strong> API keys are configured at the server level for security.
                    Contact your administrator to update API credentials.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Sync & Integrations Link */}
          <Card className="border-indigo-200 bg-indigo-50">
            <CardHeader>
              <CardTitle className="text-indigo-900 flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Sync & Integrations
              </CardTitle>
              <CardDescription>
                Configure synchronization with external services
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-indigo-800 mb-4">
                Looking for Google Contacts, Calendar, or Gmail sync settings?
                These have been moved to the dedicated Sync section for easier access.
              </p>
              <Link href="/sync">
                <Button className="w-full bg-indigo-600 hover:bg-indigo-700">
                  Go to Sync & Integrations
                  <Settings className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Help & Information */}
          <Card className="border-gray-200">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Info className="h-5 w-5" />
                Help & Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm text-muted-foreground">
                <div>
                  <h4 className="font-medium text-foreground mb-1">Server-Side Configuration</h4>
                  <p>
                    Most system settings (database, API keys, authentication) are managed at the
                    server level for security and consistency across all users.
                  </p>
                </div>
                <div>
                  <h4 className="font-medium text-foreground mb-1">User Preferences</h4>
                  <p>
                    Your personal preferences and integration settings can be managed from their
                    respective pages (Sync, Dashboard, etc.).
                  </p>
                </div>
                <div>
                  <h4 className="font-medium text-foreground mb-1">Need Help?</h4>
                  <p>
                    Contact your system administrator for server configuration changes or
                    consult the documentation for user-level settings.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
