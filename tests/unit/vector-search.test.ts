/**
 * Unit tests for VectorSearchEngine
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { VectorSearchEngine, createMemoryVectorIndex, hybridSearch } from '../../src/utils/vector-search.js';

describe('VectorSearchEngine', () => {
  let engine: VectorSearchEngine<{ id: number; name: string }>;

  beforeEach(() => {
    engine = new VectorSearchEngine();
  });

  describe('addVectors', () => {
    it('should add vectors to the index', () => {
      const vectors = [
        { id: 1, vector: [1, 0, 0], data: { id: 1, name: 'item1' } },
        { id: 2, vector: [0, 1, 0], data: { id: 2, name: 'item2' } },
      ];

      engine.addVectors(vectors);
      const stats = engine.getIndexStats();

      expect(stats.size).toBe(2);
      expect(stats.dimensions).toBe(3);
    });

    it('should validate vector dimensions', () => {
      const vectors1 = [{ id: 1, vector: [1, 0, 0], data: { id: 1, name: 'item1' } }];
      const vectors2 = [{ id: 2, vector: [1, 0], data: { id: 2, name: 'item2' } }];

      engine.addVectors(vectors1);

      expect(() => engine.addVectors(vectors2)).toThrow('Vector dimension mismatch');
    });

    it('should handle empty vector array', () => {
      engine.addVectors([]);
      const stats = engine.getIndexStats();

      expect(stats.size).toBe(0);
      expect(stats.dimensions).toBe(0);
    });
  });

  describe('searchSimilar', () => {
    beforeEach(() => {
      const vectors = [
        { id: 1, vector: [1, 0, 0], data: { id: 1, name: 'item1' } },
        { id: 2, vector: [0, 1, 0], data: { id: 2, name: 'item2' } },
        { id: 3, vector: [0.9, 0.1, 0], data: { id: 3, name: 'item3' } },
        { id: 4, vector: [0, 0, 1], data: { id: 4, name: 'item4' } },
      ];
      engine.addVectors(vectors);
    });

    it('should find similar vectors', () => {
      const queryVector = [1, 0, 0];
      const results = engine.searchSimilar(queryVector, { limit: 2 });

      expect(results).toHaveLength(2);
      expect(results[0]?.item.name).toBe('item1');
      expect(results[0]?.score).toBeCloseTo(1, 5);
      expect(results[1]?.item.name).toBe('item3');
    });

    it('should filter by threshold', () => {
      const queryVector = [1, 0, 0];
      // item1 [1,0,0] has similarity 1.0
      // item3 [0.9,0.1,0] has similarity 0.9/sqrt(0.82) ≈ 0.9939
      // Both should pass threshold 0.95
      const results = engine.searchSimilar(queryVector, { threshold: 0.95 });

      expect(results).toHaveLength(2);
      expect(results[0]?.item.name).toBe('item1');
      expect(results[1]?.item.name).toBe('item3');
    });

    it('should include distance when requested', () => {
      const queryVector = [1, 0, 0];
      const results = engine.searchSimilar(queryVector, { 
        limit: 1, 
        includeDistance: true 
      });

      expect(results[0]?.distance).toBeDefined();
      expect(results[0]?.distance).toBe(0);
    });

    it('should validate query vector dimensions', () => {
      const queryVector = [1, 0]; // Wrong dimensions

      expect(() => engine.searchSimilar(queryVector)).toThrow(
        'Query vector must have 3 dimensions'
      );
    });
  });

  describe('searchEnsemble', () => {
    beforeEach(() => {
      const vectors = [
        { id: 1, vector: [1, 0, 0], data: { id: 1, name: 'item1' } },
        { id: 2, vector: [0, 1, 0], data: { id: 2, name: 'item2' } },
        { id: 3, vector: [0, 0, 1], data: { id: 3, name: 'item3' } },
      ];
      engine.addVectors(vectors);
    });

    it('should combine multiple query vectors', () => {
      const queryVectors = [
        [1, 0, 0], // Similar to item1
        [0, 1, 0], // Similar to item2
      ];

      const results = engine.searchEnsemble(queryVectors, undefined, { limit: 3 });

      expect(results).toHaveLength(3);
      // item1 and item2 should have higher scores due to exact matches
      expect(results[0]?.score).toBeGreaterThan(results[2]?.score);
    });

    it('should use weighted aggregation', () => {
      const queryVectors = [
        [1, 0, 0], // Similar to item1
        [0, 1, 0], // Similar to item2
      ];
      const weights = [0.8, 0.2]; // Favor first query

      const results = engine.searchEnsemble(queryVectors, weights, { 
        aggregation: 'weighted',
        limit: 2 
      });

      expect(results).toHaveLength(2);
      expect(results[0]?.item.name).toBe('item1'); // Should be favored due to higher weight
    });

    it('should handle empty query vectors', () => {
      const results = engine.searchEnsemble([]);
      expect(results).toHaveLength(0);
    });

    it('should validate weights length', () => {
      const queryVectors = [[1, 0, 0], [0, 1, 0]];
      const weights = [0.5]; // Wrong length

      expect(() => engine.searchEnsemble(queryVectors, weights)).toThrow(
        'Weights array must match query vectors length'
      );
    });
  });

  describe('removeVectors', () => {
    beforeEach(() => {
      const vectors = [
        { id: 1, vector: [1, 0, 0], data: { id: 1, name: 'item1' } },
        { id: 2, vector: [0, 1, 0], data: { id: 2, name: 'item2' } },
        { id: 3, vector: [0, 0, 1], data: { id: 3, name: 'item3' } },
      ];
      engine.addVectors(vectors);
    });

    it('should remove vectors by ID', () => {
      const removed = engine.removeVectors([1, 3]);

      expect(removed).toBe(2);
      expect(engine.getIndexStats().size).toBe(1);

      const results = engine.searchSimilar([0, 1, 0]);
      expect(results).toHaveLength(1);
      expect(results[0]?.item.name).toBe('item2');
    });

    it('should return 0 for non-existent IDs', () => {
      const removed = engine.removeVectors([999]);
      expect(removed).toBe(0);
      expect(engine.getIndexStats().size).toBe(3);
    });
  });

  describe('updateVector', () => {
    beforeEach(() => {
      const vectors = [
        { id: 1, vector: [1, 0, 0], data: { id: 1, name: 'item1' } },
      ];
      engine.addVectors(vectors);
    });

    it('should update existing vector', () => {
      const success = engine.updateVector(1, [0, 1, 0], { id: 1, name: 'updated' });

      expect(success).toBe(true);

      const results = engine.searchSimilar([0, 1, 0]);
      expect(results[0]?.item.name).toBe('updated');
      expect(results[0]?.score).toBeCloseTo(1, 5);
    });

    it('should return false for non-existent ID', () => {
      const success = engine.updateVector(999, [0, 1, 0]);
      expect(success).toBe(false);
    });

    it('should validate vector dimensions', () => {
      expect(() => engine.updateVector(1, [1, 0])).toThrow(
        'Vector must have 3 dimensions'
      );
    });
  });

  describe('clear', () => {
    it('should clear the index', () => {
      const vectors = [
        { id: 1, vector: [1, 0, 0], data: { id: 1, name: 'item1' } },
      ];
      engine.addVectors(vectors);

      engine.clear();

      const stats = engine.getIndexStats();
      expect(stats.size).toBe(0);
      expect(stats.dimensions).toBe(0);
    });
  });
});

describe('createMemoryVectorIndex', () => {
  it('should create vector index from memories', () => {
    const memories = [
      { id: 1, title: 'Memory 1', embedding: [1, 0, 0] },
      { id: 2, title: 'Memory 2', embedding: [0, 1, 0] },
      { id: 3, title: 'Memory 3' }, // No embedding
    ];

    const engine = createMemoryVectorIndex(memories);
    const stats = engine.getIndexStats();

    expect(stats.size).toBe(2); // Only memories with embeddings
    expect(stats.dimensions).toBe(3);
  });

  it('should handle empty memories array', () => {
    const engine = createMemoryVectorIndex([]);
    const stats = engine.getIndexStats();

    expect(stats.size).toBe(0);
  });
});

describe('hybridSearch', () => {
  it('should combine vector and text search results', () => {
    const vectorResults = [
      { item: { id: 1, title: 'Vector Match 1' }, score: 0.9 },
      { item: { id: 2, title: 'Vector Match 2' }, score: 0.8 },
    ];

    const textResults = [
      { id: 3, title: 'Text Match 1' },
      { id: 1, title: 'Vector Match 1' }, // Overlap
      { id: 4, title: 'Text Match 2' },
    ];

    const results = hybridSearch(vectorResults, textResults, {
      vectorWeight: 0.7,
      textWeight: 0.3,
      maxResults: 4,
    });

    expect(results).toHaveLength(4);
    
    // Item 1 should have highest score (vector + text)
    const item1 = results.find(r => (r.item as any).id === 1);
    expect(item1?.score).toBeGreaterThan(0.8);
  });

  it('should handle empty results', () => {
    const results = hybridSearch([], []);
    expect(results).toHaveLength(0);
  });

  it('should respect max results limit', () => {
    const vectorResults = [
      { item: { id: 1 }, score: 0.9 },
      { item: { id: 2 }, score: 0.8 },
    ];

    const textResults = [
      { id: 3 },
      { id: 4 },
      { id: 5 },
    ];

    const results = hybridSearch(vectorResults, textResults, { maxResults: 2 });
    expect(results).toHaveLength(2);
  });
});
