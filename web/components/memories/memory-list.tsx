'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Trash2, Calendar } from 'lucide-react';
import { format } from 'date-fns';

interface Memory {
  id: string;
  title: string;
  content: string;
  memoryType: string;
  importance: number;
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
}

interface MemoryListProps {
  memories: Memory[];
  loading: boolean;
  onMemoryDeleted: () => void;
  viewMode?: 'grid' | 'list';
}

export function MemoryList({ memories, loading, onMemoryDeleted, viewMode = 'grid' }: MemoryListProps) {
  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this memory?')) {
      return;
    }

    try {
      const response = await fetch(`/api/memories/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        onMemoryDeleted();
      } else {
        alert('Failed to delete memory');
      }
    } catch (error) {
      console.error('Failed to delete memory:', error);
      alert('Failed to delete memory');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="text-muted-foreground">Loading memories...</div>
      </div>
    );
  }

  if (memories.length === 0) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center text-muted-foreground">
            No memories found. Create your first memory to get started!
          </div>
        </CardContent>
      </Card>
    );
  }

  if (viewMode === 'list') {
    return (
      <div className="space-y-2">
        {memories.map((memory) => (
          <Card key={memory.id} className="hover:bg-gray-50 transition-colors">
            <CardContent className="py-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <h4 className="font-medium text-sm truncate">{memory.title || memory.content.substring(0, 50)}</h4>
                    <Badge variant="secondary" className="text-xs shrink-0">{memory.memoryType}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-1">{memory.content}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {(memory.importance * 100).toFixed(0)}%
                  </span>
                  {memory.createdAt && (
                    <span className="text-xs text-muted-foreground whitespace-nowrap hidden sm:block">
                      {format(new Date(memory.createdAt), 'MMM d, yyyy')}
                    </span>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(memory.id)}
                    className="text-destructive hover:text-destructive h-8 w-8"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {memories.map((memory) => (
        <Card key={memory.id} className="hover:shadow-md transition-shadow">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <CardTitle className="text-xl mb-2">{memory.title}</CardTitle>
                <CardDescription className="line-clamp-2">{memory.content}</CardDescription>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleDelete(memory.id)}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <Badge variant="secondary">{memory.memoryType}</Badge>
              <span>Importance: {(memory.importance * 100).toFixed(0)}%</span>
              {memory.createdAt && (
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {format(new Date(memory.createdAt), 'MMM d, yyyy')}
                </span>
              )}
            </div>
            {memory.tags && memory.tags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {memory.tags.map((tag, index) => (
                  <Badge key={index} variant="outline">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
