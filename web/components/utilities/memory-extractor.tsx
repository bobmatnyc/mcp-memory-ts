'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Mail, FolderOpen, Clock, Lock, CheckCircle2, AlertCircle, Loader2, Calendar } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ExtractionLog {
  id: string;
  week_identifier: string;
  start_date: string;
  end_date: string;
  emails_processed: number;
  memories_created: number;
  entities_created: number;
  status: 'processing' | 'completed' | 'failed';
  error_message?: string;
  created_at: string;
  completed_at?: string;
}

export function MemoryExtractor() {
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionLogs, setExtractionLogs] = useState<ExtractionLog[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(true);
  const [gmailConnected, setGmailConnected] = useState(false);
  const [gmailEmail, setGmailEmail] = useState<string | null>(null);
  const { toast } = useToast();

  // Load extraction logs on mount
  useEffect(() => {
    loadExtractionLogs();
  }, []);

  const loadExtractionLogs = async () => {
    try {
      setIsLoadingLogs(true);
      const response = await fetch('/api/gmail/extract?limit=10');
      if (!response.ok) throw new Error('Failed to load extraction logs');

      const data = await response.json();
      setExtractionLogs(data.logs || []);
    } catch (error) {
      console.error('Failed to load logs:', error);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  const handleGmailConnect = async () => {
    try {
      // Initiate Google OAuth flow
      const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
      const redirectUri = `${window.location.origin}/api/auth/google/callback`;
      const scope = 'https://www.googleapis.com/auth/gmail.readonly';

      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
        `client_id=${clientId}&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `response_type=token&` +
        `scope=${encodeURIComponent(scope)}`;

      // Open OAuth popup
      const width = 500;
      const height = 600;
      const left = (window.screen.width / 2) - (width / 2);
      const top = (window.screen.height / 2) - (height / 2);

      const popup = window.open(
        authUrl,
        'Google OAuth',
        `width=${width},height=${height},left=${left},top=${top}`
      );

      // Listen for OAuth callback
      const handleMessage = async (event: MessageEvent) => {
        if (event.data.type === 'gmail-auth-success') {
          const accessToken = event.data.accessToken;

          // Test connection
          const testResponse = await fetch('/api/gmail/test', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ gmailAccessToken: accessToken }),
          });

          const testResult = await testResponse.json();

          if (testResult.results?.gmail?.success) {
            setGmailConnected(true);
            setGmailEmail(testResult.results.gmail.email);
            localStorage.setItem('gmail_access_token', accessToken);

            toast({
              title: 'Gmail Connected',
              description: `Connected to ${testResult.results.gmail.email}`,
            });
          } else {
            throw new Error(testResult.results?.gmail?.error || 'Connection failed');
          }

          window.removeEventListener('message', handleMessage);
          popup?.close();
        }
      };

      window.addEventListener('message', handleMessage);

    } catch (error) {
      console.error('Gmail connection error:', error);
      toast({
        title: 'Connection Failed',
        description: error instanceof Error ? error.message : 'Failed to connect to Gmail',
        variant: 'destructive',
      });
    }
  };

  const handleExtractCurrentWeek = async () => {
    try {
      setIsExtracting(true);

      const accessToken = localStorage.getItem('gmail_access_token');
      if (!accessToken) {
        throw new Error('Please connect Gmail first');
      }

      toast({
        title: 'Extraction Started',
        description: 'Analyzing your emails with GPT-4...',
      });

      const response = await fetch('/api/gmail/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gmailAccessToken: accessToken,
          // OpenAI key will be used from server env
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Extraction failed');
      }

      const result = await response.json();

      if (result.skipped) {
        toast({
          title: 'Already Extracted',
          description: result.reason || 'This week has already been processed',
        });
      } else {
        toast({
          title: 'Extraction Complete',
          description: `Created ${result.memories_created} memories and ${result.entities_created} entities from ${result.emails_processed} emails`,
        });
      }

      // Reload logs
      await loadExtractionLogs();

    } catch (error) {
      console.error('Extraction error:', error);
      toast({
        title: 'Extraction Failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setIsExtracting(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

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
            {gmailConnected ? (
              <Badge variant="secondary" className="bg-green-100 text-green-800">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Connected
              </Badge>
            ) : (
              <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                Available
              </Badge>
            )}
          </div>
          <CardHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-3 bg-red-100 rounded-lg">
                <Mail className="h-6 w-6 text-red-600" />
              </div>
              <CardTitle>Gmail Integration</CardTitle>
            </div>
            <CardDescription>
              Automatically extract important information from your emails using GPT-4
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 mb-4">
              {gmailConnected && gmailEmail && (
                <div className="flex items-center gap-2 text-sm text-green-600">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>{gmailEmail}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Lock className="h-4 w-4" />
                <span>Secure OAuth authentication</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Calendar className="h-4 w-4" />
                <span>Weekly batch processing</span>
              </div>
            </div>
            <div className="space-y-2">
              {!gmailConnected ? (
                <Button className="w-full" onClick={handleGmailConnect}>
                  Connect Gmail
                </Button>
              ) : (
                <Button
                  className="w-full"
                  onClick={handleExtractCurrentWeek}
                  disabled={isExtracting}
                >
                  {isExtracting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Extracting...
                    </>
                  ) : (
                    'Extract This Week'
                  )}
                </Button>
              )}
            </div>
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

      {/* Extraction History */}
      {gmailConnected && (
        <Card>
          <CardHeader>
            <CardTitle>Extraction History</CardTitle>
            <CardDescription>
              Recent Gmail extraction batches
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingLogs ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : extractionLogs.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No extractions yet. Click "Extract This Week" to get started.
              </div>
            ) : (
              <div className="space-y-3">
                {extractionLogs.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium">Week {log.week_identifier}</span>
                        {log.status === 'completed' && (
                          <Badge variant="secondary" className="bg-green-100 text-green-800">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Completed
                          </Badge>
                        )}
                        {log.status === 'processing' && (
                          <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                            Processing
                          </Badge>
                        )}
                        {log.status === 'failed' && (
                          <Badge variant="secondary" className="bg-red-100 text-red-800">
                            <AlertCircle className="h-3 w-3 mr-1" />
                            Failed
                          </Badge>
                        )}
                      </div>
                      <div className="text-sm text-gray-600">
                        {formatDate(log.start_date)} - {formatDate(log.end_date)}
                      </div>
                      {log.status === 'completed' && (
                        <div className="text-sm text-gray-500 mt-1">
                          {log.emails_processed} emails → {log.memories_created} memories, {log.entities_created} entities
                        </div>
                      )}
                      {log.error_message && (
                        <div className="text-sm text-red-600 mt-1">
                          Error: {log.error_message}
                        </div>
                      )}
                    </div>
                    <div className="text-sm text-gray-400">
                      {formatDate(log.created_at)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Info Card */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-6">
          <div className="text-sm text-blue-800">
            <p className="font-medium mb-2">How Gmail Extraction Works</p>
            <ul className="text-blue-700 space-y-1 ml-4 list-disc">
              <li>Connect your Gmail account securely via OAuth</li>
              <li>Extract emails by week (Monday-Sunday) to avoid duplicates</li>
              <li>GPT-4 analyzes email content to identify important information</li>
              <li>Automatically creates structured memories and entity records</li>
              <li>Track extraction history and prevent duplicate processing</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
