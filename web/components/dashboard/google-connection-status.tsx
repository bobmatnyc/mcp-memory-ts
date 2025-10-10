'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle, Loader2, Calendar, Users, Mail } from 'lucide-react';

interface GoogleConnectionStatusProps {
  onConnect?: () => void;
  onDisconnect?: () => void;
}

interface GoogleStatus {
  connected: boolean;
  email?: string;
  lastSync?: {
    contacts?: string;
    calendar?: string;
  };
  stats?: {
    contactsSynced?: number;
    eventsSynced?: number;
  };
}

export function GoogleConnectionStatus({ onConnect, onDisconnect }: GoogleConnectionStatusProps) {
  const [status, setStatus] = useState<GoogleStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);

  useEffect(() => {
    checkGoogleStatus();
  }, []);

  const checkGoogleStatus = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/google/status');
      if (response.ok) {
        const data = await response.json();
        setStatus(data);
      } else {
        setStatus({ connected: false });
      }
    } catch (error) {
      console.error('Failed to check Google status:', error);
      setStatus({ connected: false });
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = () => {
    if (onConnect) {
      onConnect();
    } else {
      window.location.href = '/api/auth/google-connect';
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect your Google account? This will stop all Google sync operations.')) {
      return;
    }

    setDisconnecting(true);
    try {
      const response = await fetch('/api/google/disconnect', {
        method: 'POST',
      });

      if (response.ok) {
        setStatus({ connected: false });
        if (onDisconnect) {
          onDisconnect();
        }
      } else {
        const data = await response.json();
        alert(`Failed to disconnect: ${data.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Failed to disconnect Google:', error);
      alert('Failed to disconnect Google account');
    } finally {
      setDisconnecting(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Google Integration</CardTitle>
          <CardDescription>Loading connection status...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center p-4">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              Google Integration
              {status?.connected ? (
                <CheckCircle className="h-5 w-5 text-green-600" />
              ) : (
                <XCircle className="h-5 w-5 text-gray-400" />
              )}
            </CardTitle>
            <CardDescription>
              {status?.connected
                ? 'Connected and ready to sync'
                : 'Connect your Google account to sync contacts and calendar'}
            </CardDescription>
          </div>
          <Badge variant={status?.connected ? 'success' : 'outline'}>
            {status?.connected ? 'Connected' : 'Not Connected'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {status?.connected ? (
          <>
            {/* Connected Account */}
            <div className="p-3 border rounded-lg bg-green-50">
              <div className="flex items-center gap-3">
                <Mail className="h-5 w-5 text-green-600" />
                <div>
                  <p className="font-medium text-green-900">Connected Account</p>
                  <p className="text-sm text-green-700">{status.email || 'Unknown'}</p>
                </div>
              </div>
            </div>

            {/* Sync Statistics */}
            {status.stats && (
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 border rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <Users className="h-4 w-4 text-blue-600" />
                    <p className="text-sm font-medium">Contacts Synced</p>
                  </div>
                  <p className="text-2xl font-bold">{status.stats.contactsSynced || 0}</p>
                </div>
                <div className="p-3 border rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <Calendar className="h-4 w-4 text-purple-600" />
                    <p className="text-sm font-medium">Events Tracked</p>
                  </div>
                  <p className="text-2xl font-bold">{status.stats.eventsSynced || 0}</p>
                </div>
              </div>
            )}

            {/* Last Sync Times */}
            {status.lastSync && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-700">Last Sync</p>
                {status.lastSync.contacts && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Contacts:</span>
                    <span>{new Date(status.lastSync.contacts).toLocaleString()}</span>
                  </div>
                )}
                {status.lastSync.calendar && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Calendar:</span>
                    <span>{new Date(status.lastSync.calendar).toLocaleString()}</span>
                  </div>
                )}
              </div>
            )}

            {/* Disconnect Button */}
            <Button
              onClick={handleDisconnect}
              disabled={disconnecting}
              variant="outline"
              className="w-full border-red-300 text-red-700 hover:bg-red-50"
            >
              {disconnecting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Disconnecting...
                </>
              ) : (
                'Disconnect Google Account'
              )}
            </Button>
          </>
        ) : (
          <>
            {/* Not Connected State */}
            <div className="text-center py-6">
              <p className="text-muted-foreground mb-4">
                Connect your Google account to enable:
              </p>
              <ul className="text-sm text-left space-y-2 mb-6 max-w-md mx-auto">
                <li className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-blue-600" />
                  <span>Bidirectional contact sync with LLM deduplication</span>
                </li>
                <li className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-purple-600" />
                  <span>Calendar event tracking and attendee linking</span>
                </li>
                <li className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-green-600" />
                  <span>Gmail entity extraction (if configured)</span>
                </li>
              </ul>
              <Button onClick={handleConnect} className="w-full">
                Connect Google Account
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
