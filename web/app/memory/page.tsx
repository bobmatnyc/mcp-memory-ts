'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

export const dynamic = 'force-dynamic';
import { MemoryList } from '@/components/memories/memory-list';
import { MemorySearch } from '@/components/memories/memory-search';
import { CreateMemoryDialog } from '@/components/memories/create-memory-dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, LayoutGrid, List, AlertCircle, Settings, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';

// Import Entity type from parent types
type Entity = {
  id?: string;
  name: string;
  entityType: string;
  description?: string;
  metadata?: Record<string, unknown>;
};

type ViewMode = 'grid' | 'list';
type FilterType = 'all' | 'SYSTEM' | 'LEARNED' | 'MEMORY';
type FilterImportance = 'all' | '1' | '2' | '3' | '4';

export default function MemoryPage() {
  const [memories, setMemories] = useState([]);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingEntities, setLoadingEntities] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [filterImportance, setFilterImportance] = useState<FilterImportance>('all');
  const { toast } = useToast();

  // Read URL query parameters
  const searchParams = useSearchParams();
  const sourceFilter = searchParams.get('source'); // 'gmail'
  const weekFilter = searchParams.get('week'); // '2025-42'

  const fetchMemories = async (query?: string) => {
    setLoading(true);
    setError(null);
    try {
      // Build query params with filters
      const params = new URLSearchParams();
      params.append('limit', '50');
      if (sourceFilter) params.append('source', sourceFilter);
      if (weekFilter) params.append('week', weekFilter);

      const url = query
        ? `/api/memories/search`
        : `/api/memories?${params.toString()}`;

      const response = query
        ? await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query, limit: 50, source: sourceFilter, week: weekFilter }),
          })
        : await fetch(url);

      if (response.ok) {
        const data = await response.json();
        setMemories(data.data || []);
        setError(null);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to load memories');
        setMemories([]);
      }
    } catch (err: any) {
      console.error('Failed to fetch memories:', err);
      setError(err.message || 'Network error - failed to connect to database');
      setMemories([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchEntities = async () => {
    try {
      setLoadingEntities(true);

      // Build query params with filters
      const params = new URLSearchParams();
      params.append('limit', '100');
      if (sourceFilter) params.append('source', sourceFilter);
      if (weekFilter) params.append('week', weekFilter);

      const response = await fetch(`/api/entities?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch entities');

      const data = await response.json();
      setEntities(data.data || []);
    } catch (error) {
      console.error('Error fetching entities:', error);
      setEntities([]);
    } finally {
      setLoadingEntities(false);
    }
  };

  useEffect(() => {
    fetchMemories();
    fetchEntities();
  }, [sourceFilter, weekFilter]); // Refetch when filters change

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    fetchMemories(query);
  };

  const handleMemoryCreated = () => {
    setCreateDialogOpen(false);
    fetchMemories(searchQuery);
    toast({
      title: 'Memory created',
      description: 'Your memory has been successfully added.',
      variant: 'success',
    });
  };

  const handleMemoryDeleted = () => {
    fetchMemories(searchQuery);
    toast({
      title: 'Memory deleted',
      description: 'The memory has been removed.',
    });
  };

  // Filter memories based on selected filters
  const filteredMemories = memories.filter((memory: any) => {
    if (filterType !== 'all' && memory.memoryType !== filterType) return false;
    if (filterImportance !== 'all') {
      const importance = Math.ceil(memory.importance * 4);
      if (importance.toString() !== filterImportance) return false;
    }
    return true;
  });

  // Show error state if there's an error
  if (error && !loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="container mx-auto px-4 py-8">
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-gray-900">Memory</h1>
            <p className="mt-2 text-gray-600">Manage your AI memory collection</p>
          </div>

          <Card className="border-yellow-200 bg-yellow-50">
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <AlertCircle className="h-8 w-8 text-yellow-600 flex-shrink-0 mt-1" />
                <div className="flex-1">
                  <h2 className="text-xl font-bold text-yellow-900 mb-2">Cannot Load Memories</h2>
                  <p className="text-yellow-700 mb-4">{error}</p>
                  <div className="space-y-2 mb-6 text-sm text-yellow-800">
                    <p className="font-medium">This error typically means:</p>
                    <ul className="list-disc list-inside ml-2 space-y-1 text-yellow-700">
                      <li>Your database credentials are not configured</li>
                      <li>Your Turso auth token has expired</li>
                      <li>There's a network connectivity issue</li>
                    </ul>
                  </div>
                  <div className="flex gap-3">
                    <Link href="/settings">
                      <Button className="bg-yellow-600 hover:bg-yellow-700">
                        <Settings className="mr-2 h-4 w-4" />
                        Configure Settings
                      </Button>
                    </Link>
                    <Button variant="outline" onClick={() => fetchMemories(searchQuery)}>
                      Retry
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="mt-6 border-blue-200 bg-blue-50">
            <CardHeader>
              <CardTitle className="text-blue-900">Quick Fix</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-blue-800">
              <p>1. Go to <strong>Settings</strong> and configure your database credentials</p>
              <p>2. Use the <strong>Test Connection</strong> button to verify your setup</p>
              <p>3. Return to this page to view your memories</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-gray-900">Memory</h1>
            <p className="mt-2 text-gray-600">Manage your AI memory collection</p>
          </div>
          <Button onClick={() => setCreateDialogOpen(true)} size="lg" disabled={loading}>
            <Plus className="mr-2 h-5 w-5" />
            Create Memory
          </Button>
        </div>

        <div className="mb-6">
          <MemorySearch onSearch={handleSearch} />
        </div>

        {/* Filter Banner */}
        {(sourceFilter || weekFilter) && (
          <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <div className="flex items-center justify-between">
              <div className="text-sm">
                <span className="font-medium">Filtered by:</span>
                {sourceFilter && <span className="ml-2">Source: {sourceFilter}</span>}
                {weekFilter && <span className="ml-2">Week: {weekFilter}</span>}
              </div>
              <Link
                href="/memory"
                className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400"
              >
                Clear filters
              </Link>
            </div>
          </div>
        )}

        {/* Filters and View Controls */}
        <div className="mb-6 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3 flex-1">
            <Select value={filterType} onValueChange={(value) => setFilterType(value as FilterType)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Memory Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="SYSTEM">System</SelectItem>
                <SelectItem value="LEARNED">Learned</SelectItem>
                <SelectItem value="MEMORY">Memory</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterImportance} onValueChange={(value) => setFilterImportance(value as FilterImportance)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Importance" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Importance</SelectItem>
                <SelectItem value="4">Critical (4)</SelectItem>
                <SelectItem value="3">High (3)</SelectItem>
                <SelectItem value="2">Medium (2)</SelectItem>
                <SelectItem value="1">Low (1)</SelectItem>
              </SelectContent>
            </Select>

            <Badge variant="secondary" className="ml-2">
              {filteredMemories.length} {filteredMemories.length === 1 ? 'memory' : 'memories'}
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant={viewMode === 'grid' ? 'default' : 'outline'}
              size="icon"
              onClick={() => setViewMode('grid')}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'outline'}
              size="icon"
              onClick={() => setViewMode('list')}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <MemoryList
          memories={filteredMemories}
          loading={loading}
          onMemoryDeleted={handleMemoryDeleted}
          viewMode={viewMode}
        />

        {/* Entities Section */}
        <div className="mt-8">
          <h2 className="text-2xl font-semibold mb-4 text-gray-900">
            Entities
            {!loadingEntities && (
              <span className="text-sm font-normal text-gray-500 ml-2">
                ({entities.length})
              </span>
            )}
          </h2>

          {loadingEntities ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : entities.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {entities.map((entity) => (
                <Card key={entity.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-medium text-lg text-gray-900">{entity.name}</h3>
                      <Badge variant="secondary" className="text-xs">
                        {entity.entityType}
                      </Badge>
                    </div>
                    {entity.description && (
                      <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                        {entity.description}
                      </p>
                    )}
                    {entity.metadata && 'week_identifier' in entity.metadata && entity.metadata.week_identifier ? (
                      <div className="text-xs text-gray-500 mt-2">
                        Week: {String(entity.metadata.week_identifier)}
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="border-dashed">
              <CardContent className="py-8 text-center">
                <p className="text-gray-500">No entities found</p>
              </CardContent>
            </Card>
          )}
        </div>

        <CreateMemoryDialog
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
          onMemoryCreated={handleMemoryCreated}
        />
      </div>
    </div>
  );
}
