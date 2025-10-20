'use client';

// Cache buster: log component load time
console.log(`[GoogleContactsSync Component] Loaded at: ${new Date().toISOString()}, Build ID: ${Math.random().toString(36).substr(2, 9)}`);

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
  nextPageToken?: string;
  hasMore?: boolean;
  totalProcessed?: number;
  totalAvailable?: number;
}

interface SyncProgress {
  current: number;
  total: string | number;
  status: string;
  batchNumber: number;
  totalBatches?: number; // Total expected batches based on totalAvailable / batchSize
}

export function GoogleContactsSync({ onSyncComplete }: GoogleContactsSyncProps) {
  const [syncing, setSyncing] = useState(false);
  const [direction, setDirection] = useState<'import' | 'export' | 'both'>('both');
  const [dryRun, setDryRun] = useState(false);
  const [forceFull, setForceFull] = useState(false);
  const [useLLM, setUseLLM] = useState(true);
  const [useBatchMode, setUseBatchMode] = useState(false);
  const [batchSize, setBatchSize] = useState(50); // Default to 50 for safety
  const [result, setResult] = useState<SyncResult | null>(null);
  const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null);
  const [cancelRequested, setCancelRequested] = useState(false);
  const [batchHistory, setBatchHistory] = useState<Array<{
    batchNumber: number;
    imported: number;
    exported: number;
    updated: number;
    duration: number;
  }>>([]);

  const handleSync = async () => {
    console.log('[BUTTON CLICK] ===== Sync button clicked =====', {
      timestamp: new Date().toISOString(),
      useBatchMode,
      batchSize,
      direction,
      dryRun,
    });

    const requestId = `frontend-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();

    console.log(`[GoogleContactsSync Frontend][${requestId}] ===== SYNC STARTED =====`, {
      timestamp: new Date().toISOString(),
      direction,
      dryRun,
      forceFull,
      useLLM,
      useBatchMode,
      batchSize,
    });

    console.log(`[STATE DEBUG][${requestId}] Current component state:`, {
      syncing,
      cancelRequested,
      direction,
      dryRun,
      forceFull,
      useLLM,
      useBatchMode,
      batchSize,
    });

    setSyncing(true);
    setResult(null);
    setCancelRequested(false);
    setSyncProgress(null);
    setBatchHistory([]); // Clear history on new sync

    console.log(`[STATE DEBUG][${requestId}] State updated, about to branch based on useBatchMode:`, useBatchMode);

    // If batch mode is enabled, use batch processing
    if (useBatchMode) {
      console.log(`[BRANCH DEBUG][${requestId}] Entering BATCH MODE - calling handleBatchSync`);
      await handleBatchSync(requestId);
      return;
    }

    // Otherwise, use traditional full sync
    console.log(`[BRANCH DEBUG][${requestId}] Entering FULL SYNC MODE - calling handleFullSync`);
    await handleFullSync(requestId, startTime);
  };

  const handleFullSync = async (requestId: string, startTime: number) => {

    try {
      const requestBody = {
        direction,
        dryRun,
        forceFull,
        useLLM,
      };

      console.log(`[GoogleContactsSync Frontend][${requestId}] Preparing fetch request`, {
        url: '/api/google/contacts/sync',
        method: 'POST',
        body: requestBody,
      });

      const fetchStartTime = Date.now();
      const response = await fetch('/api/google/contacts/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });
      const fetchDuration = Date.now() - fetchStartTime;

      console.log(`[GoogleContactsSync Frontend][${requestId}] Fetch completed (${fetchDuration}ms)`, {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
        contentType: response.headers.get('content-type'),
        contentLength: response.headers.get('content-length'),
      });

      // Read response as text first to inspect it
      console.log(`[GoogleContactsSync Frontend][${requestId}] Reading response body...`);
      const responseText = await response.text();
      console.log(`[GoogleContactsSync Frontend][${requestId}] Response body received`, {
        length: responseText.length,
        preview: responseText.substring(0, 300),
        lastChars: responseText.length > 300 ? responseText.substring(responseText.length - 100) : '',
      });

      // Try to parse JSON
      let data: SyncResult;
      try {
        console.log(`[GoogleContactsSync Frontend][${requestId}] Parsing JSON...`);
        data = JSON.parse(responseText);
        console.log(`[GoogleContactsSync Frontend][${requestId}] JSON parsed successfully`, {
          success: data.success,
          exported: data.exported,
          imported: data.imported,
          updated: data.updated,
          errorCount: data.errors?.length || 0,
        });
      } catch (parseError) {
        console.error(`[GoogleContactsSync Frontend][${requestId}] JSON PARSE ERROR`, {
          error: parseError instanceof Error ? parseError.message : String(parseError),
          responseText: responseText.substring(0, 500),
          responseLength: responseText.length,
          isHTML: responseText.trim().startsWith('<'),
          firstChar: responseText.charAt(0),
          lastChar: responseText.charAt(responseText.length - 1),
        });

        throw new Error(
          `Failed to parse response: ${parseError instanceof Error ? parseError.message : 'Unknown parse error'}. ` +
          `Response preview: ${responseText.substring(0, 100)}`
        );
      }

      if (response.ok) {
        console.log(`[GoogleContactsSync Frontend][${requestId}] Sync successful`, data);
        setResult(data);
        if (onSyncComplete) {
          onSyncComplete(data);
        }
      } else {
        // Handle errors (array) format
        const errorMessage = (Array.isArray(data.errors) && data.errors.length > 0 ? data.errors[0] : null) ||
                            'Unknown error occurred';

        console.error(`[GoogleContactsSync Frontend][${requestId}] Sync failed (HTTP ${response.status})`, {
          status: response.status,
          statusText: response.statusText,
          error: errorMessage,
          fullResponse: data,
        });

        setResult({
          success: false,
          exported: 0,
          imported: 0,
          updated: 0,
          duplicatesFound: 0,
          merged: 0,
          errors: [errorMessage],
        });
      }

      const duration = Date.now() - startTime;
      console.log(`[GoogleContactsSync Frontend][${requestId}] ===== SYNC COMPLETED (${duration}ms) =====`);
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`[GoogleContactsSync Frontend][${requestId}] ===== SYNC FAILED (${duration}ms) =====`, {
        error: error instanceof Error ? {
          name: error.name,
          message: error.message,
          stack: error.stack,
        } : error,
        timestamp: new Date().toISOString(),
      });

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

  const handleBatchSync = async (requestId: string) => {
    let pageToken: string | undefined;
    let totalImported = 0;
    let totalUpdated = 0;
    let totalExported = 0;
    let batchNumber = 1;
    let totalBatches: number | undefined; // Track total batches across iterations
    const allErrors: string[] = [];

    console.log(`[GoogleContactsSync Frontend][${requestId}] Starting batch sync mode`);

    setSyncProgress({
      current: 0,
      total: '?',
      status: 'Initializing...',
      batchNumber: 0,
    });

    try {
      do {
        // Check if cancel was requested
        if (cancelRequested) {
          console.log(`[GoogleContactsSync Frontend][${requestId}] Batch sync cancelled by user`);
          setResult({
            success: false,
            exported: totalExported,
            imported: totalImported,
            updated: totalUpdated,
            duplicatesFound: 0,
            merged: 0,
            errors: ['Sync cancelled by user'],
          });
          return;
        }

        console.log(`[GoogleContactsSync Frontend][${requestId}] Processing batch ${batchNumber}...`, {
          pageToken: pageToken ? 'present' : 'first batch',
          currentProgress: `${totalImported + totalUpdated} contacts`,
        });

        // Update progress BEFORE fetch (preserve totalBatches if we have it)
        setSyncProgress({
          current: totalImported + totalUpdated,
          total: '?',
          status: `Processing batch ${batchNumber}${totalBatches ? ` of ${totalBatches}` : ' (calculating total...)'}`,
          batchNumber,
          totalBatches, // Preserve from previous batch
        });

        console.log(`[GoogleContactsSync Frontend][${requestId}] Progress display updated (before fetch)`, {
          batchNumber,
          totalBatches: totalBatches || 'unknown',
          current: totalImported + totalUpdated,
          displayWillShow: totalBatches ? `Batch ${batchNumber} of ${totalBatches}` : `Batch ${batchNumber}`,
        });

        const requestBody = {
          direction,
          dryRun,
          forceFull: false, // Always false for batch mode
          useLLM,
          pageToken,
          pageSize: batchSize,
        };

        // Validate batchSize before timeout calculation
        if (!batchSize || batchSize <= 0) {
          throw new Error(`Invalid batch size: ${batchSize}. Must be a positive number.`);
        }

        // Calculate timeout: give backend plenty of time for Google API operations
        // Batch operations include: network latency, Google API calls, LLM dedup, database writes
        // Formula: 4 seconds per contact + 2 minute buffer, capped at 4min 40s (below 5min Next.js limit)
        const timeoutMs = Math.min(batchSize * 4000 + 120000, 280000);

        // VERIFY the timeout calculation is correct
        console.log(`[TIMEOUT CALC DEBUG] Inputs:`, {
          batchSize,
          formula: 'Math.min(batchSize * 4000 + 120000, 280000)',
          calculation: `Math.min(${batchSize} * 4000 + 120000, 280000)`,
          result: timeoutMs,
          resultSeconds: Math.round(timeoutMs / 1000),
        });

        console.log(`[GoogleContactsSync Frontend][${requestId}] Creating AbortController for batch ${batchNumber}`, {
          batchSize,
          timeoutMs,
          timeoutSeconds: Math.round(timeoutMs / 1000),
        });

        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
          const reason = `Batch ${batchNumber} timed out after ${Math.round(timeoutMs / 1000)} seconds (batch size: ${batchSize})`;
          console.error(`[GoogleContactsSync Frontend][${requestId}] ${reason}`);
          controller.abort(reason);
        }, timeoutMs);

        try {
          // Log JUST BEFORE making the fetch request
          console.log(`[FETCH DEBUG][${requestId}] ===== ABOUT TO CALL FETCH =====`, {
            batchNumber,
            url: '/api/google/contacts/sync',
            method: 'POST',
            requestBody,
            timeoutMs,
            timeoutSeconds: Math.round(timeoutMs / 1000),
            timestamp: new Date().toISOString(),
          });

          const fetchStartTime = Date.now();

          console.log(`[FETCH DEBUG][${requestId}] fetch() call initiated at ${fetchStartTime}`);

          const response = await fetch('/api/google/contacts/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
            signal: controller.signal,
          });

          const fetchDuration = Date.now() - fetchStartTime;
          clearTimeout(timeoutId);

          console.log(`[FETCH DEBUG][${requestId}] fetch() returned after ${fetchDuration}ms`, {
            status: response.status,
            ok: response.ok,
            statusText: response.statusText,
            headers: {
              contentType: response.headers.get('content-type'),
              contentLength: response.headers.get('content-length'),
            },
          });

          console.log(`[GoogleContactsSync Frontend][${requestId}] Batch ${batchNumber} completed, timeout cleared`, {
            duration: fetchDuration,
            timeoutWas: timeoutMs,
            ok: response.ok,
            status: response.status,
          });

          const responseText = await response.text();
          let data: SyncResult;

          try {
            data = JSON.parse(responseText);

            // Log detailed response structure AFTER parsing
            console.log(`[BATCH ${batchNumber} RESPONSE DEBUG]`, {
              responseOk: response.ok,
              status: response.status,
              dataKeys: Object.keys(data),
              imported: data.imported,
              exported: data.exported,
              updated: data.updated,
              totalAvailable: data.totalAvailable,
              hasMore: data.hasMore,
              nextPageToken: data.nextPageToken ? 'present' : 'missing',
              errorsCount: data.errors?.length || 0,
            });
          } catch (parseError) {
            console.error(`[GoogleContactsSync Frontend][${requestId}] Batch ${batchNumber} JSON parse error`, {
              error: parseError instanceof Error ? parseError.message : String(parseError),
              responsePreview: responseText.substring(0, 300),
            });
            throw new Error(`Failed to parse batch ${batchNumber} response`);
          }

          if (!response.ok) {
            const errorMessage = (Array.isArray(data.errors) && data.errors.length > 0 ? data.errors[0] : null) ||
                                `Batch ${batchNumber} failed`;
            console.error(`[GoogleContactsSync Frontend][${requestId}] Batch ${batchNumber} failed`, {
              status: response.status,
              error: errorMessage,
            });
            allErrors.push(errorMessage);
            break;
          }

          // Accumulate results
          const batchImported = data.imported || 0;
          const batchExported = data.exported || 0;
          const batchUpdated = data.updated || 0;

          totalImported += batchImported;
          totalUpdated += batchUpdated;
          totalExported += batchExported;
          allErrors.push(...(data.errors || []));

          // Track batch completion time and add to history
          const batchDuration = Date.now() - fetchStartTime;
          setBatchHistory(prev => [...prev, {
            batchNumber,
            imported: batchImported,
            exported: batchExported,
            updated: batchUpdated,
            duration: batchDuration,
          }]);

          // Calculate and preserve total batches if we have totalAvailable
          if (data.totalAvailable && !totalBatches) {
            totalBatches = Math.ceil(data.totalAvailable / batchSize);
            console.log(`[GoogleContactsSync Frontend][${requestId}] Calculated total batches: ${totalBatches} (${data.totalAvailable} contacts / ${batchSize} batch size)`);
          }

          // Update progress AFTER fetch with actual results
          setSyncProgress({
            current: totalImported + totalUpdated,
            total: data.totalAvailable || '?',
            status: `Batch ${batchNumber} complete`,
            batchNumber,
            totalBatches, // Now we have it from this batch or previous
          });

          console.log(`[GoogleContactsSync Frontend][${requestId}] Batch ${batchNumber} results`, {
            imported: data.imported,
            updated: data.updated,
            exported: data.exported,
            hasMore: data.hasMore,
            totalSoFar: totalImported + totalUpdated,
            totalAvailable: data.totalAvailable,
            totalBatches,
          });

          console.log(`[GoogleContactsSync Frontend][${requestId}] Progress display updated (after fetch)`, {
            batchNumber,
            totalBatches: totalBatches || 'unknown',
            current: totalImported + totalUpdated,
            total: data.totalAvailable || '?',
            displayWillShow: totalBatches ? `Batch ${batchNumber} of ${totalBatches}` : `Batch ${batchNumber}`,
          });

          // Check if there are more pages
          pageToken = data.nextPageToken;
          if (!data.hasMore) {
            console.log(`[GoogleContactsSync Frontend][${requestId}] All batches complete`);
            break;
          }

          batchNumber++;

          // Small delay between batches to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (fetchError) {
          clearTimeout(timeoutId); // Prevent timeout from firing after error

          const errorMessage = fetchError instanceof Error ? fetchError.message : String(fetchError);
          const isAbortError = fetchError instanceof DOMException && fetchError.name === 'AbortError';

          console.error(`[GoogleContactsSync Frontend][${requestId}] Batch ${batchNumber} fetch error`, {
            error: errorMessage,
            isAbortError,
            batchSize,
            timeoutMs,
            timeoutSeconds: Math.round(timeoutMs / 1000),
            errorType: fetchError?.constructor?.name,
            errorName: fetchError instanceof Error ? fetchError.name : 'unknown',
          });

          if (isAbortError) {
            allErrors.push(
              `Batch ${batchNumber} was aborted. ` +
              `This could indicate: ` +
              `(1) Network timeout after ${Math.round(timeoutMs / 1000)}s, ` +
              `(2) Server not responding, or ` +
              `(3) Request cancelled. ` +
              `Try with a smaller batch size or check server logs.`
            );
          } else {
            allErrors.push(`Batch ${batchNumber}: ${errorMessage}`);
          }
          break;
        }

      } while (pageToken && !cancelRequested);

      // Final result
      const finalResult: SyncResult = {
        success: true,
        exported: totalExported,
        imported: totalImported,
        updated: totalUpdated,
        duplicatesFound: 0,
        merged: 0,
        errors: allErrors,
      };

      console.log(`[GoogleContactsSync Frontend][${requestId}] Batch sync completed`, finalResult);

      setResult(finalResult);
      setSyncProgress({
        current: totalImported + totalUpdated,
        total: totalImported + totalUpdated,
        status: 'Complete!',
        batchNumber,
        totalBatches: batchNumber, // Final batch count
      });

      if (onSyncComplete) {
        onSyncComplete(finalResult);
      }

    } catch (error) {
      console.error(`[GoogleContactsSync Frontend][${requestId}] Batch sync error`, {
        error: error instanceof Error ? error.message : String(error),
        batchNumber,
      });

      setResult({
        success: false,
        exported: totalExported,
        imported: totalImported,
        updated: totalUpdated,
        duplicatesFound: 0,
        merged: 0,
        errors: [...allErrors, error instanceof Error ? error.message : 'Batch sync failed'],
      });
    } finally {
      setSyncing(false);
      setSyncProgress(null);
    }
  };

  const handleCancelSync = () => {
    console.log('[GoogleContactsSync Frontend] Cancel requested');
    setCancelRequested(true);
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
              <Label>Batch Mode</Label>
              <p className="text-xs text-muted-foreground">Process large contact lists in batches to avoid timeouts</p>
            </div>
            <input
              type="checkbox"
              checked={useBatchMode}
              onChange={(e) => setUseBatchMode(e.target.checked)}
              className="h-4 w-4"
            />
          </div>

          {useBatchMode && (
            <div className="flex items-center justify-between pl-4 border-l-2 border-blue-300">
              <div>
                <Label>Batch Size</Label>
                <p className="text-xs text-muted-foreground">Contacts per batch (25-100 recommended)</p>
              </div>
              <select
                value={batchSize}
                onChange={(e) => setBatchSize(Number(e.target.value))}
                className="h-8 px-2 border rounded"
              >
                <option value={25}>25 (Slowest, safest)</option>
                <option value={50}>50 (Recommended)</option>
                <option value={100}>100 (Faster)</option>
                <option value={150}>150 (Fast)</option>
              </select>
            </div>
          )}

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

          {!useBatchMode && (
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
          )}

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

        {/* Progress Indicator */}
        {syncing && syncProgress && (
          <div className="p-4 border rounded-lg bg-blue-50 border-blue-200">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{syncProgress.status}</span>
                <span className="text-sm text-muted-foreground">
                  Batch {syncProgress.batchNumber}
                  {syncProgress.totalBatches ? ` of ${syncProgress.totalBatches}` : ''}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>Processed: {syncProgress.current}</span>
                <span className="text-muted-foreground">
                  {syncProgress.total !== '?' ? `of ${syncProgress.total}` : ''}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{
                    width: syncProgress.total !== '?'
                      ? `${(syncProgress.current / Number(syncProgress.total)) * 100}%`
                      : '50%'
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Batch History */}
        {syncing && useBatchMode && batchHistory.length > 0 && (
          <div className="p-3 border rounded-lg bg-gray-50 max-h-48 overflow-y-auto">
            <h4 className="text-sm font-medium mb-2">Completed Batches:</h4>
            <div className="space-y-1 text-xs">
              {batchHistory.map((batch, i) => (
                <div key={i} className="flex items-center justify-between py-1 border-b last:border-0">
                  <span className="font-medium">Batch {batch.batchNumber}</span>
                  <span className="text-muted-foreground">
                    +{batch.imported + batch.exported + batch.updated} contacts
                    {' • '}
                    {Math.round(batch.duration / 1000)}s
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Sync Button */}
        <div className="grid grid-cols-1 gap-2">
          <Button
            onClick={handleSync}
            disabled={syncing}
            className="w-full"
          >
            {syncing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {useBatchMode && syncProgress ? (
                  <span>
                    Batch {syncProgress.batchNumber}
                    {syncProgress.totalBatches ? ` of ${syncProgress.totalBatches}` : ' (calculating total...)'}
                    {' • '}
                    {syncProgress.current > 0 ? `${syncProgress.current} processed` : 'Starting...'}
                  </span>
                ) : (
                  <span>{useBatchMode ? 'Processing Batches...' : 'Syncing Contacts...'}</span>
                )}
              </>
            ) : (
              <>
                {getDirectionIcon()}
                <span className="ml-2">{useBatchMode ? 'Start Batch Sync' : 'Sync Now'}</span>
              </>
            )}
          </Button>
          {syncing && useBatchMode && (
            <Button
              onClick={handleCancelSync}
              variant="outline"
              className="w-full"
            >
              Cancel Sync
            </Button>
          )}
        </div>

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
          {useBatchMode && (
            <p className="mt-2 text-blue-700">
              <strong>Batch Mode:</strong> Large contact lists will be processed in batches to avoid timeouts.
              Each batch completes within 60 seconds. You can cancel at any time.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
