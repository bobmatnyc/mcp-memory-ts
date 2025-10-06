'use client';

import { useState, useEffect } from 'react';
import { Navbar } from '@/components/layout/navbar';
import { MemoryList } from '@/components/memories/memory-list';
import { MemorySearch } from '@/components/memories/memory-search';
import { CreateMemoryDialog } from '@/components/memories/create-memory-dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, LayoutGrid, List, AlertCircle, Settings } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';

type ViewMode = 'grid' | 'list';
type FilterType = 'all' | 'SYSTEM' | 'LEARNED' | 'MEMORY';
type FilterImportance = 'all' | '1' | '2' | '3' | '4';

export default function MemoryPage() {
  const [memories, setMemories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [filterImportance, setFilterImportance] = useState<FilterImportance>('all');
  const { toast } = useToast();

  const fetchMemories = async (query?: string) => {
    setLoading(true);
    setError(null);
    try {
      const url = query
        ? `/api/memories/search`
        : `/api/memories?limit=50`;

      const response = query
        ? await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query, limit: 50 }),
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

  useEffect(() => {
    fetchMemories();
  }, []);

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
        <Navbar />
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
      <Navbar />
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

        <CreateMemoryDialog
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
          onMemoryCreated={handleMemoryCreated}
        />
      </div>
    </div>
  );
}
