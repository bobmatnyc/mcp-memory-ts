'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectSeparator,
} from '@/components/ui/select';
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
  const [selectedWeek, setSelectedWeek] = useState<string | null>(() => {
    // Will be set properly after logs load
    return null;
  });
  const { toast } = useToast();

  // Check Gmail connection status from database
  const checkGmailConnection = async () => {
    try {
      // Check if user has Google OAuth connection with Gmail scope
      const response = await fetch('/api/google/status');
      if (!response.ok) {
        console.log('Google status check failed:', response.status);
        return;
      }

      const data = await response.json();
      console.log('Google status response:', data);

      if (data.connected && data.email && data.scopes) {
        // Check if scopes include gmail.readonly
        const hasGmailScope = data.scopes.some((scope: string) =>
          scope.includes('gmail.readonly') ||
          scope.includes('gmail.modify') ||
          scope.includes('gmail')
        );

        if (hasGmailScope) {
          setGmailConnected(true);
          setGmailEmail(data.email);
          console.log('Gmail scope detected for:', data.email);
        } else {
          console.log('Google connected but no Gmail scope. Available scopes:', data.scopes);
        }
      }
    } catch (error) {
      console.error('Failed to check Gmail connection:', error);
    }
  };

  // Load extraction logs and check connection on mount
  useEffect(() => {
    checkGmailConnection();
    loadExtractionLogs();
  }, []);

  // Set default to most recent unextracted week
  useEffect(() => {
    if (extractionLogs.length === 0 || selectedWeek !== null) return;

    const pastWeeks = generatePastWeeks();
    const firstUnextracted = pastWeeks.find(week => !week.isProcessed);

    if (firstUnextracted) {
      setSelectedWeek(firstUnextracted.value);
    }
  }, [extractionLogs, selectedWeek]);

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

  const generatePastWeeks = () => {
    const weeks: Array<{ value: string; label: string; isProcessed: boolean }> = [];
    const today = new Date();

    for (let i = 0; i < 12; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - (i * 7));

      // Calculate week identifier (ISO week format: YYYY-WW)
      const year = date.getFullYear();
      const startOfYear = new Date(year, 0, 1);
      const dayOfYear = Math.floor((date.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
      const weekNum = Math.ceil((dayOfYear + startOfYear.getDay() + 1) / 7);
      const weekId = `${year}-${weekNum.toString().padStart(2, '0')}`;

      // Check if this week has been processed
      const isProcessed = extractionLogs.some(
        log => log.week_identifier === weekId && log.status === 'completed'
      );

      weeks.push({
        value: weekId,
        label: `Week ${weekId} (${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})`,
        isProcessed,
      });
    }

    return weeks;
  };

  const handleGmailConnect = async () => {
    // Use server-side OAuth flow
    window.location.href = '/api/auth/google-connect';
  };

  const handleExtractWeek = async (weekIdentifier?: string | null) => {
    try {
      setIsExtracting(true);

      // No localStorage check needed - server retrieves tokens from database!
      if (!gmailConnected) {
        throw new Error('Please connect Gmail first in Settings');
      }

      toast({
        title: 'Extraction Started',
        description: 'Analyzing your emails with GPT-4...',
      });

      const response = await fetch('/api/gmail/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          weekIdentifier: weekIdentifier || undefined, // Use selected week or default to current
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

      // Reload logs to show updated status
      await loadExtractionLogs();

      // Reset selected week after successful extraction
      setSelectedWeek(null);

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
                <>
                  <div className="space-y-3">
                    {/* Week Selector */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Select Week to Extract
                      </label>
                      <Select
                        value={selectedWeek || 'current'}
                        onValueChange={(value) => setSelectedWeek(value === 'current' ? null : value)}
                        disabled={isExtracting}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue>
                            {selectedWeek
                              ? `Week ${selectedWeek}`
                              : 'This Week (Current)'}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="current">This Week (Current)</SelectItem>
                          <SelectSeparator />
                          {generatePastWeeks().map(week => (
                            <SelectItem
                              key={week.value}
                              value={week.value}
                              disabled={week.isProcessed}
                            >
                              {week.label} {week.isProcessed && '✓ Extracted'}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Extract Button */}
                    <Button
                      className="w-full"
                      onClick={() => handleExtractWeek(selectedWeek)}
                      disabled={isExtracting || !gmailConnected}
                    >
                      {isExtracting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Extracting...
                        </>
                      ) : (
                        selectedWeek ? `Extract Week ${selectedWeek}` : 'Extract This Week'
                      )}
                    </Button>
                  </div>
                  <Button
                    variant="outline"
                    className="w-full text-xs"
                    onClick={handleGmailConnect}
                  >
                    Reconnect Gmail
                  </Button>
                </>
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
            <CardTitle>Recent Extractions</CardTitle>
            <CardDescription>
              5 most recent Gmail extractions
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingLogs ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : extractionLogs.filter(log => log.status === 'completed').slice(0, 5).length > 0 ? (
              <div className="space-y-2">
                {extractionLogs
                  .filter(log => log.status === 'completed')
                  .slice(0, 5)
                  .map((log) => (
                    <Link
                      key={log.id}
                      href={`/memory?source=gmail&week=${log.week_identifier}`}
                      className="block p-3 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium text-sm">
                            Week {log.week_identifier}
                          </div>
                          <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                            {log.emails_processed} emails → {log.memories_created} memories, {log.entities_created} entities
                          </div>
                        </div>
                        <svg
                          className="w-5 h-5 text-gray-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 5l7 7-7 7"
                          />
                        </svg>
                      </div>
                    </Link>
                  ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400 py-8 text-center">
                No extraction history yet. Extract a week to get started!
              </p>
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
