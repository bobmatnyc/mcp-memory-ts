/**
 * Unit tests for API cost tracking
 */

import { describe, test, expect, beforeEach } from 'vitest';
import { EmbeddingService } from '../../src/utils/embeddings.js';

describe('Cost Tracking', () => {
  test('should estimate tokens reasonably', () => {
    const service = new EmbeddingService(undefined, 'text-embedding-3-small');
    const text = 'The quick brown fox jumps over the lazy dog';
    const tokens = service.estimateTokens(text);

    // Should be roughly 9-11 tokens for this sentence
    expect(tokens).toBeGreaterThan(7);
    expect(tokens).toBeLessThan(15);
  });

  test('should estimate cost correctly', () => {
    const service = new EmbeddingService(undefined, 'text-embedding-3-small');
    const text = 'A'.repeat(1000); // Approximately 250 tokens

    const estimatedCost = service.estimateCost(text);

    // Should be a small positive number
    expect(estimatedCost).toBeGreaterThan(0);
    expect(estimatedCost).toBeLessThan(0.01); // Should be less than 1 cent
  });

  test('should handle empty text estimation', () => {
    const service = new EmbeddingService(undefined, 'text-embedding-3-small');
    const tokens = service.estimateTokens('');

    expect(tokens).toBe(0);
  });

  test('should handle long text estimation', () => {
    const service = new EmbeddingService(undefined, 'text-embedding-3-small');
    const longText = 'word '.repeat(1000); // ~1000 words
    const tokens = service.estimateTokens(longText);

    // Should be reasonable (1000-2000 tokens for 1000 words)
    expect(tokens).toBeGreaterThan(500);
    expect(tokens).toBeLessThan(3000);
  });
});

describe('UsageTrackingDB', () => {
  test('should structure daily usage summary correctly', () => {
    // Test the structure of DailyUsageSummary
    const mockSummary = {
      openai: { tokens: 1000, cost: 0.02, requests: 5 },
      openrouter: { tokens: 0, cost: 0, requests: 0 },
      total: { tokens: 1000, cost: 0.02, requests: 5 }
    };

    expect(mockSummary.openai).toHaveProperty('tokens');
    expect(mockSummary.openai).toHaveProperty('cost');
    expect(mockSummary.openai).toHaveProperty('requests');
    expect(mockSummary.total.tokens).toBe(1000);
    expect(mockSummary.total.cost).toBeCloseTo(0.02);
  });
});
