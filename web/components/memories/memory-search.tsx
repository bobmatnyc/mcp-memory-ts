'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search } from 'lucide-react';

interface MemorySearchProps {
  onSearch: (query: string) => void;
}

export function MemorySearch({ onSearch }: MemorySearchProps) {
  const [query, setQuery] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(query);
  };

  return (
    <form onSubmit={handleSubmit} className="mb-6">
      <div className="flex gap-2">
        <Input
          placeholder="Search memories with semantic search..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1"
        />
        <Button type="submit">
          <Search className="mr-2 h-4 w-4" />
          Search
        </Button>
        {query && (
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setQuery('');
              onSearch('');
            }}
          >
            Clear
          </Button>
        )}
      </div>
    </form>
  );
}
