import { StatsCard } from '@/components/stats/stats-card';
import { Database, Users, Activity, Brain } from 'lucide-react';

interface QuickStatsProps {
  totalMemories: number;
  totalEntities: number;
  totalInteractions: number;
  embeddingCoverage: string;
}

export function QuickStats({
  totalMemories,
  totalEntities,
  totalInteractions,
  embeddingCoverage,
}: QuickStatsProps) {
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
      <StatsCard
        title="Total Memories"
        value={totalMemories}
        description="Stored in database"
        icon={Database}
      />
      <StatsCard
        title="Total Entities"
        value={totalEntities}
        description="People & organizations"
        icon={Users}
      />
      <StatsCard
        title="Interactions"
        value={totalInteractions}
        description="Conversation history"
        icon={Activity}
      />
      <StatsCard
        title="Embedding Coverage"
        value={embeddingCoverage}
        description="Memories with embeddings"
        icon={Brain}
      />
    </div>
  );
}
