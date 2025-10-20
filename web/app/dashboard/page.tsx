import { ConnectionStatus } from '@/components/dashboard/connection-status';
import { QuickStats } from '@/components/dashboard/quick-stats';
import { NavCards } from '@/components/dashboard/nav-cards';
import { Card, CardContent } from '@/components/ui/card';
import { auth, currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { getUserEmail, getDatabase } from '@/lib/auth';

export const dynamic = 'force-dynamic';

async function getStats() {
  try {
    const database = await getDatabase();
    const userEmail = await getUserEmail();

    if (!database || !userEmail) {
      return { success: false, data: null };
    }

    const stats = await database.getStatistics(userEmail);
    return { success: true, data: stats };
  } catch (error: any) {
    console.error('Failed to fetch stats:', error);
    return { success: false, data: null };
  }
}

async function checkOpenAiConnection() {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    return !!apiKey;
  } catch (error) {
    console.error('Failed to check OpenAI connection:', error);
    return false;
  }
}

export default async function DashboardPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect('/');
  }

  // Get full user object from Clerk
  const user = await currentUser();

  // Build display name with proper fallbacks
  const displayName = user?.fullName
    || user?.firstName
    || user?.primaryEmailAddress?.emailAddress?.split('@')[0]
    || 'User';

  const userEmail = user?.primaryEmailAddress?.emailAddress || '';

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
            Hello, <span className="font-medium">{displayName}</span>
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
                Unable to load statistics. Auto-connection failed - please check your database credentials in Settings.
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
