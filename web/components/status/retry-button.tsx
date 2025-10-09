'use client';

import { Button } from '@/components/ui/button';

export function RetryButton() {
  const handleRetry = () => {
    window.location.reload();
  };

  return (
    <Button variant="outline" onClick={handleRetry}>
      Retry
    </Button>
  );
}
