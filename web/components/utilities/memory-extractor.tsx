'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Mail, FolderOpen, Clock, Lock } from 'lucide-react';

export function MemoryExtractor() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Memory Extractor</h2>
        <p className="text-gray-600">
          Extract and import memories from external sources automatically
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Gmail Integration */}
        <Card className="relative overflow-hidden">
          <div className="absolute top-4 right-4">
            <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
              Coming Soon
            </Badge>
          </div>
          <CardHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-3 bg-red-100 rounded-lg">
                <Mail className="h-6 w-6 text-red-600" />
              </div>
              <CardTitle>Gmail Integration</CardTitle>
            </div>
            <CardDescription>
              Automatically extract important information from your emails and save them as memories
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 mb-4">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Clock className="h-4 w-4" />
                <span>Planned for future release</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Lock className="h-4 w-4" />
                <span>Secure OAuth authentication</span>
              </div>
            </div>
            <Button className="w-full" disabled>
              Configure Gmail
            </Button>
          </CardContent>
        </Card>

        {/* Google Drive Integration */}
        <Card className="relative overflow-hidden">
          <div className="absolute top-4 right-4">
            <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
              Coming Soon
            </Badge>
          </div>
          <CardHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-3 bg-blue-100 rounded-lg">
                <FolderOpen className="h-6 w-6 text-blue-600" />
              </div>
              <CardTitle>Google Drive Integration</CardTitle>
            </div>
            <CardDescription>
              Extract content from documents, spreadsheets, and presentations in your Drive
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 mb-4">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Clock className="h-4 w-4" />
                <span>Planned for future release</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Lock className="h-4 w-4" />
                <span>Secure OAuth authentication</span>
              </div>
            </div>
            <Button className="w-full" disabled>
              Configure Google Drive
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Info Card */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-6">
          <div className="text-sm text-blue-800">
            <p className="font-medium mb-2">What is Memory Extractor?</p>
            <p className="text-blue-700">
              Memory Extractor will allow you to automatically import information from external sources like Gmail and Google Drive.
              The system will use AI to identify important information and save it as structured memories in your database.
              This feature is currently in development and will be available in a future release.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
