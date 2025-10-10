'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Loader2, Users, ArrowDownToLine, ArrowUpFromLine, ArrowLeftRight, CheckCircle, XCircle } from 'lucide-react';

interface GoogleContactsSyncProps {
  onSyncComplete?: (result: SyncResult) => void;
}

interface SyncResult {
  success: boolean;
  exported: number;
  imported: number;
  updated: number;
  duplicatesFound: number;
  merged: number;
  errors: string[];
}

export function GoogleContactsSync({ onSyncComplete }: GoogleContactsSyncProps) {
  const [syncing, setSyncing] = useState(false);
  const [direction, setDirection] = useState<'import' | 'export' | 'both'>('both');
  const [dryRun, setDryRun] = useState(false);
  const [forceFull, setForceFull] = useState(false);
  const [useLLM, setUseLLM] = useState(true);
  const [result, setResult] = useState<SyncResult | null>(null);

  const handleSync = async () => {
    setSyncing(true);
    setResult(null);

    try {
      const response = await fetch('/api/google/contacts/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          direction,
          dryRun,
          forceFull,
          useLLM,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setResult(data);
        if (onSyncComplete) {
          onSyncComplete(data);
        }
      } else {
        setResult({
          success: false,
          exported: 0,
          imported: 0,
          updated: 0,
          duplicatesFound: 0,
          merged: 0,
          errors: [data.error || 'Unknown error'],
        });
      }
    } catch (error) {
      console.error('Failed to sync contacts:', error);
      setResult({
        success: false,
        exported: 0,
        imported: 0,
        updated: 0,
        duplicatesFound: 0,
        merged: 0,
        errors: [error instanceof Error ? error.message : 'Failed to sync contacts'],
      });
    } finally {
      setSyncing(false);
    }
  };

  const getDirectionIcon = () => {
    switch (direction) {
      case 'import':
        return <ArrowDownToLine className="h-4 w-4" />;
      case 'export':
        return <ArrowUpFromLine className="h-4 w-4" />;
      case 'both':
        return <ArrowLeftRight className="h-4 w-4" />;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Google Contacts Sync
        </CardTitle>
        <CardDescription>
          Sync contacts between Google and MCP Memory with LLM-powered deduplication
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Sync Direction */}
        <div className="space-y-2">
          <Label>Sync Direction</Label>
          <div className="grid grid-cols-3 gap-2">
            <Button
              variant={direction === 'import' ? 'default' : 'outline'}
              onClick={() => setDirection('import')}
              className="flex items-center gap-2"
            >
              <ArrowDownToLine className="h-4 w-4" />
              Import
            </Button>
            <Button
              variant={direction === 'export' ? 'default' : 'outline'}
              onClick={() => setDirection('export')}
              className="flex items-center gap-2"
            >
              <ArrowUpFromLine className="h-4 w-4" />
              Export
            </Button>
            <Button
              variant={direction === 'both' ? 'default' : 'outline'}
              onClick={() => setDirection('both')}
              className="flex items-center gap-2"
            >
              <ArrowLeftRight className="h-4 w-4" />
              Both
            </Button>
          </div>
        </div>

        {/* Options */}
        <div className="space-y-3 p-3 border rounded-lg bg-gray-50">
          <div className="flex items-center justify-between">
            <div>
              <Label>Dry Run Mode</Label>
              <p className="text-xs text-muted-foreground">Preview changes without applying them</p>
            </div>
            <input
              type="checkbox"
              checked={dryRun}
              onChange={(e) => setDryRun(e.target.checked)}
              className="h-4 w-4"
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>Force Full Sync</Label>
              <p className="text-xs text-muted-foreground">Sync all contacts instead of incremental</p>
            </div>
            <input
              type="checkbox"
              checked={forceFull}
              onChange={(e) => setForceFull(e.target.checked)}
              className="h-4 w-4"
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>LLM Deduplication</Label>
              <p className="text-xs text-muted-foreground">Use AI to detect and merge duplicates</p>
            </div>
            <input
              type="checkbox"
              checked={useLLM}
              onChange={(e) => setUseLLM(e.target.checked)}
              className="h-4 w-4"
            />
          </div>
        </div>

        {/* Sync Button */}
        <Button
          onClick={handleSync}
          disabled={syncing}
          className="w-full"
        >
          {syncing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Syncing Contacts...
            </>
          ) : (
            <>
              {getDirectionIcon()}
              <span className="ml-2">Sync Now</span>
            </>
          )}
        </Button>

        {/* Results */}
        {result && (
          <div className={`p-4 border rounded-lg ${result.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
            <div className="flex items-center gap-2 mb-3">
              {result.success ? (
                <>
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <h4 className="font-semibold text-green-900">Sync Completed</h4>
                </>
              ) : (
                <>
                  <XCircle className="h-5 w-5 text-red-600" />
                  <h4 className="font-semibold text-red-900">Sync Failed</h4>
                </>
              )}
            </div>

            {result.success && (
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div className="text-sm">
                  <span className="text-muted-foreground">Imported:</span>
                  <span className="ml-2 font-bold">{result.imported}</span>
                </div>
                <div className="text-sm">
                  <span className="text-muted-foreground">Exported:</span>
                  <span className="ml-2 font-bold">{result.exported}</span>
                </div>
                <div className="text-sm">
                  <span className="text-muted-foreground">Updated:</span>
                  <span className="ml-2 font-bold">{result.updated}</span>
                </div>
                <div className="text-sm">
                  <span className="text-muted-foreground">Duplicates:</span>
                  <span className="ml-2 font-bold">{result.duplicatesFound}</span>
                </div>
              </div>
            )}

            {result.errors.length > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-300">
                <p className="text-sm font-medium mb-2">Errors:</p>
                <ul className="text-sm space-y-1">
                  {result.errors.slice(0, 5).map((error, i) => (
                    <li key={i} className="text-red-700">• {error}</li>
                  ))}
                  {result.errors.length > 5 && (
                    <li className="text-red-700">... and {result.errors.length - 5} more</li>
                  )}
                </ul>
              </div>
            )}

            {dryRun && result.success && (
              <p className="mt-3 text-sm text-blue-700 font-medium">
                This was a dry run. No changes were applied.
              </p>
            )}
          </div>
        )}

        {/* Help Text */}
        <div className="text-xs text-muted-foreground space-y-1 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p><strong>Import:</strong> Sync contacts from Google to MCP Memory</p>
          <p><strong>Export:</strong> Sync entities from MCP Memory to Google Contacts</p>
          <p><strong>Both:</strong> Bidirectional sync in both directions</p>
        </div>
      </CardContent>
    </Card>
  );
}
