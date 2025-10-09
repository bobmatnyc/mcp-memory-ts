'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';

interface ConnectionStatusProps {
  databaseStatus: 'connected' | 'disconnected' | 'checking';
  openAiStatus: 'connected' | 'disconnected' | 'checking';
}

export function ConnectionStatus({ databaseStatus, openAiStatus }: ConnectionStatusProps) {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'disconnected':
        return <XCircle className="h-5 w-5 text-red-600" />;
      case 'checking':
        return <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'connected':
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Connected</Badge>;
      case 'disconnected':
        return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Disconnected</Badge>;
      case 'checking':
        return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Checking...</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Connection Health</CardTitle>
        <CardDescription>Status of database and API connections</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between p-3 border rounded-lg">
          <div className="flex items-center gap-3">
            {getStatusIcon(databaseStatus)}
            <div>
              <p className="font-medium">Database</p>
              <p className="text-sm text-muted-foreground">Turso LibSQL</p>
            </div>
          </div>
          {getStatusBadge(databaseStatus)}
        </div>

        <div className="flex items-center justify-between p-3 border rounded-lg">
          <div className="flex items-center gap-3">
            {getStatusIcon(openAiStatus)}
            <div>
              <p className="font-medium">OpenAI API</p>
              <p className="text-sm text-muted-foreground">Embeddings Service</p>
            </div>
          </div>
          {getStatusBadge(openAiStatus)}
        </div>
      </CardContent>
    </Card>
  );
}
