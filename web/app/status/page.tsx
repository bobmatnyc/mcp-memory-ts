import { Navbar } from '@/components/layout/navbar';
import { StatsCard } from '@/components/stats/stats-card';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { auth } from '@clerk/nextjs/server';
import { Database, Brain, Users, Activity, TrendingUp, Clock, AlertCircle, Settings } from 'lucide-react';
import { redirect } from 'next/navigation';
import { format } from 'date-fns';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

async function getStats() {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3004'}/api/stats`, {
      cache: 'no-store',
    });
    if (response.ok) {
      const data = await response.json();
      return { success: true, data: data.data };
    } else {
      const errorData = await response.json();
      return { success: false, error: errorData.error || 'Failed to fetch statistics' };
    }
  } catch (error: any) {
    console.error('Failed to fetch stats:', error);
    return { success: false, error: error.message || 'Network error - failed to connect to database' };
  }
}

async function getRecentMemories() {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3004'}/api/memories?limit=10`, {
      cache: 'no-store',
    });
    if (response.ok) {
      const data = await response.json();
      return { success: true, data: data.data || [] };
    } else {
      return { success: false, data: [] };
    }
  } catch (error) {
    console.error('Failed to fetch recent memories:', error);
    return { success: false, data: [] };
  }
}

const IMPORTANCE_LABELS: Record<number, { label: string; color: string }> = {
  1: { label: 'LOW', color: 'bg-gray-100 text-gray-800' },
  2: { label: 'MEDIUM', color: 'bg-blue-100 text-blue-800' },
  3: { label: 'HIGH', color: 'bg-orange-100 text-orange-800' },
  4: { label: 'CRITICAL', color: 'bg-red-100 text-red-800' },
};

export default async function StatusPage() {
  const { userId } = auth();

  if (!userId) {
    redirect('/');
  }

  const [statsResult, memoriesResult] = await Promise.all([getStats(), getRecentMemories()]);

  // If there's an error fetching stats, show error page
  if (!statsResult.success) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-3xl mx-auto">
            <Card className="border-red-200 bg-red-50">
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <AlertCircle className="h-8 w-8 text-red-600 flex-shrink-0 mt-1" />
                  <div className="flex-1">
                    <h2 className="text-2xl font-bold text-red-900 mb-2">Database Connection Error</h2>
                    <p className="text-red-700 mb-4">{statsResult.error}</p>
                    <div className="space-y-3 mb-6">
                      <p className="text-sm text-red-800 font-medium">Common causes:</p>
                      <ul className="list-disc list-inside text-sm text-red-700 space-y-1 ml-2">
                        <li>Database credentials not configured</li>
                        <li>Invalid Turso database URL or auth token</li>
                        <li>Expired authentication token</li>
                        <li>Network connectivity issues</li>
                      </ul>
                    </div>
                    <div className="flex gap-3">
                      <Link href="/settings">
                        <Button className="bg-red-600 hover:bg-red-700">
                          <Settings className="mr-2 h-4 w-4" />
                          Configure Settings
                        </Button>
                      </Link>
                      <Button variant="outline" onClick={() => window.location.reload()}>
                        Retry
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="mt-6 border-blue-200 bg-blue-50">
              <CardHeader>
                <CardTitle className="text-blue-900">Troubleshooting Steps</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-blue-800">
                <div>
                  <p className="font-medium">1. Verify Your Credentials</p>
                  <p className="text-blue-700 ml-4">Go to Settings and check your Turso database URL and auth token</p>
                </div>
                <div>
                  <p className="font-medium">2. Test Your Connection</p>
                  <p className="text-blue-700 ml-4">Use the "Test Connection" button in Settings to verify connectivity</p>
                </div>
                <div>
                  <p className="font-medium">3. Check Token Expiration</p>
                  <p className="text-blue-700 ml-4">Turso tokens may expire - generate a new one if needed</p>
                </div>
                <div>
                  <p className="font-medium">4. Verify Database Status</p>
                  <p className="text-blue-700 ml-4">Check your Turso dashboard to ensure the database is active</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  const stats = statsResult.data;
  const recentMemories = memoriesResult.data;

  // Calculate memory importance distribution
  const importanceDistribution = recentMemories.reduce((acc: Record<number, number>, memory: any) => {
    const importance = Math.ceil(memory.importance * 4);
    acc[importance] = (acc[importance] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900">Status Dashboard</h1>
          <p className="mt-2 text-gray-600">Overview of your AI memory system</p>
        </div>

        {/* Main Stats Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
          <StatsCard
            title="Total Memories"
            value={stats?.totalMemories || 0}
            description="Stored in vector database"
            icon={Database}
          />
          <StatsCard
            title="Total Entities"
            value={stats?.totalEntities || 0}
            description="People, organizations, projects"
            icon={Users}
          />
          <StatsCard
            title="Interactions"
            value={stats?.totalInteractions || 0}
            description="Conversation history"
            icon={Activity}
          />
          <StatsCard
            title="Embedding Coverage"
            value={stats?.embeddingCoverage || '0%'}
            description="Memories with embeddings"
            icon={Brain}
          />
        </div>

        {/* Two Column Layout */}
        <div className="grid gap-6 md:grid-cols-2 mb-8">
          {/* Memory Types Breakdown */}
          {stats?.memoriesByType && Object.keys(stats.memoriesByType).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Memory Types Distribution</CardTitle>
                <CardDescription>Breakdown by memory type</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(stats.memoriesByType).map(([type, count]) => {
                    const total = stats.totalMemories || 1;
                    const percentage = ((count as number / total) * 100).toFixed(0);
                    return (
                      <div key={type} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">{type}</Badge>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-sm text-muted-foreground">{percentage}%</div>
                          <div className="text-sm font-medium">{count as number}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Importance Distribution */}
          {Object.keys(importanceDistribution).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Importance Levels</CardTitle>
                <CardDescription>Distribution by importance</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[4, 3, 2, 1].map((level) => {
                    const count = importanceDistribution[level] || 0;
                    const config = IMPORTANCE_LABELS[level];
                    return (
                      <div key={level} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge className={config.color}>{config.label}</Badge>
                        </div>
                        <div className="text-sm font-medium">{count}</div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Entity Stats */}
        {stats?.entitiesByType && Object.keys(stats.entitiesByType).length > 0 && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Entity Types</CardTitle>
              <CardDescription>Distribution of entities by type</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {Object.entries(stats.entitiesByType).map(([type, count]) => (
                  <div key={type} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="text-sm font-medium capitalize">{type.toLowerCase()}</div>
                    <div className="text-2xl font-bold">{count as number}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Recent Memories */}
        {recentMemories.length > 0 && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Recent Memories
              </CardTitle>
              <CardDescription>Last 10 memories added to the system</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recentMemories.map((memory: any) => (
                  <div key={memory.id} className="border-b last:border-0 pb-3 last:pb-0">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-sm truncate">{memory.title || memory.content.substring(0, 50)}</h4>
                        <p className="text-sm text-muted-foreground line-clamp-1 mt-1">
                          {memory.content}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant="outline" className="text-xs">{memory.memoryType}</Badge>
                          {memory.createdAt && (
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(memory.createdAt), 'MMM d, yyyy h:mm a')}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={IMPORTANCE_LABELS[Math.ceil(memory.importance * 4)]?.color || 'bg-gray-100'}>
                          {Math.ceil(memory.importance * 100)}%
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Vector Search Health */}
        {stats?.vectorSearchHealth && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Vector Search Health
              </CardTitle>
              <CardDescription>Status of semantic search capabilities</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="text-sm font-medium">Status</div>
                    <Badge variant={stats.vectorSearchHealth.enabled ? 'default' : 'secondary'}>
                      {stats.vectorSearchHealth.enabled ? 'Enabled' : 'Disabled'}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="text-sm font-medium">Valid Embeddings</div>
                    <div className="text-lg font-bold">
                      {stats.vectorSearchHealth.memoriesWithValidEmbeddings}
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="text-sm font-medium">Missing Embeddings</div>
                    <div className="text-lg font-bold">
                      {stats.vectorSearchHealth.memoriesWithoutEmbeddings}
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="text-sm font-medium">Coverage</div>
                    <div className="text-lg font-bold">
                      {stats.vectorSearchHealth.coveragePercentage}%
                    </div>
                  </div>
                </div>
              </div>
              {stats.vectorSearchHealth.recommendation && (
                <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-800">{stats.vectorSearchHealth.recommendation}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
