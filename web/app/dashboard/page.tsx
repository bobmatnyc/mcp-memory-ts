import { ConnectionStatus } from '@/components/dashboard/connection-status';
import { QuickStats } from '@/components/dashboard/quick-stats';
import { NavCards } from '@/components/dashboard/nav-cards';
import { Card, CardContent } from '@/components/ui/card';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

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
      return { success: false, data: null };
    }
  } catch (error: any) {
    console.error('Failed to fetch stats:', error);
    return { success: false, data: null };
  }
}

async function checkOpenAiConnection() {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3004'}/api/health/openai`, {
      cache: 'no-store',
    });
    return response.ok;
  } catch (error) {
    console.error('Failed to check OpenAI connection:', error);
    return false;
  }
}

export default async function DashboardPage() {
  const { userId, sessionClaims } = auth();

  if (!userId) {
    redirect('/');
  }

  const userEmail = sessionClaims?.email as string || 'Unknown User';

  const [statsResult, openAiConnected] = await Promise.all([
    getStats(),
    checkOpenAiConnection(),
  ]);

  const stats = statsResult.data;
  const databaseStatus = statsResult.success ? 'connected' : 'disconnected';
  const openAiStatus = openAiConnected ? 'connected' : 'disconnected';

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900">Welcome Back</h1>
          <p className="mt-2 text-gray-600">
            Hello, <span className="font-medium">{userEmail}</span>
          </p>
        </div>

        {/* Connection Health */}
        <div className="mb-8">
          <ConnectionStatus
            databaseStatus={databaseStatus}
            openAiStatus={openAiStatus}
          />
        </div>

        {/* Quick Stats */}
        {stats && (
          <div className="mb-8">
            <QuickStats
              totalMemories={stats.totalMemories || 0}
              totalEntities={stats.totalEntities || 0}
              totalInteractions={stats.totalInteractions || 0}
              embeddingCoverage={stats.embeddingCoverage || '0%'}
            />
          </div>
        )}

        {/* No Stats Available */}
        {!stats && (
          <Card className="mb-8 border-yellow-200 bg-yellow-50">
            <CardContent className="pt-6">
              <p className="text-yellow-800 text-center">
                Unable to load statistics. Please check your database connection in Settings.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Navigation Cards */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Quick Actions</h2>
          <NavCards />
        </div>

        {/* System Info */}
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="pt-6">
            <div className="text-center text-sm text-blue-800">
              <p className="font-medium mb-2">MCP Memory TypeScript v1.3.0</p>
              <p className="text-blue-700">
                Cloud-based vector memory service for AI assistants via Model Context Protocol
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
