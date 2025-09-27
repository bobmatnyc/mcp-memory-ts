/**
 * Advanced vector search utilities and algorithms
 */

import { EmbeddingService } from './embeddings.js';

export interface VectorSearchResult<T = any> {
  item: T;
  score: number;
  distance?: number;
}

export interface VectorIndex<T = any> {
  id: string | number;
  vector: number[];
  data: T;
}

export class VectorSearchEngine<T = any> {
  private index: VectorIndex<T>[] = [];
  private dimensions: number = 0;

  /**
   * Add vectors to the search index
   */
  addVectors(vectors: VectorIndex<T>[]): void {
    if (vectors.length === 0) return;

    // Validate dimensions
    const firstDim = vectors[0]?.vector.length || 0;
    if (this.dimensions === 0) {
      this.dimensions = firstDim;
    } else if (this.dimensions !== firstDim) {
      throw new Error(`Vector dimension mismatch: expected ${this.dimensions}, got ${firstDim}`);
    }

    // Validate all vectors have same dimensions
    for (const vector of vectors) {
      if (vector.vector.length !== this.dimensions) {
        throw new Error(`All vectors must have ${this.dimensions} dimensions`);
      }
    }

    this.index.push(...vectors);
  }

  /**
   * Search for similar vectors using cosine similarity
   */
  searchSimilar(
    queryVector: number[],
    options: {
      limit?: number;
      threshold?: number;
      includeDistance?: boolean;
    } = {}
  ): VectorSearchResult<T>[] {
    const { limit = 10, threshold = 0.0, includeDistance = false } = options;

    if (queryVector.length !== this.dimensions) {
      throw new Error(`Query vector must have ${this.dimensions} dimensions`);
    }

    const results: VectorSearchResult<T>[] = [];

    for (const indexItem of this.index) {
      const similarity = EmbeddingService.cosineSimilarity(queryVector, indexItem.vector);
      
      if (similarity >= threshold) {
        const result: VectorSearchResult<T> = {
          item: indexItem.data,
          score: similarity,
        };

        if (includeDistance) {
          result.distance = EmbeddingService.euclideanDistance(queryVector, indexItem.vector);
        }

        results.push(result);
      }
    }

    // Sort by similarity score (descending) and limit results
    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  /**
   * Search using multiple query vectors (ensemble search)
   */
  searchEnsemble(
    queryVectors: number[][],
    weights?: number[],
    options: {
      limit?: number;
      threshold?: number;
      aggregation?: 'mean' | 'max' | 'weighted';
    } = {}
  ): VectorSearchResult<T>[] {
    const { limit = 10, threshold = 0.0, aggregation = 'mean' } = options;
    
    if (queryVectors.length === 0) return [];
    
    // Validate weights
    const actualWeights = weights || queryVectors.map(() => 1 / queryVectors.length);
    if (actualWeights.length !== queryVectors.length) {
      throw new Error('Weights array must match query vectors length');
    }

    const scoreMap = new Map<string | number, number[]>();

    // Calculate scores for each query vector
    for (let i = 0; i < queryVectors.length; i++) {
      const queryResults = this.searchSimilar(queryVectors[i]!, { limit: this.index.length });
      
      for (const result of queryResults) {
        const id = this.getItemId(result.item);
        if (!scoreMap.has(id)) {
          scoreMap.set(id, new Array(queryVectors.length).fill(0));
        }
        scoreMap.get(id)![i] = result.score;
      }
    }

    // Aggregate scores
    const aggregatedResults: VectorSearchResult<T>[] = [];
    
    for (const [id, scores] of scoreMap.entries()) {
      let finalScore: number;
      
      switch (aggregation) {
        case 'max':
          finalScore = Math.max(...scores);
          break;
        case 'weighted':
          finalScore = scores.reduce((sum, score, i) => sum + score * actualWeights[i]!, 0);
          break;
        case 'mean':
        default:
          finalScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
          break;
      }

      if (finalScore >= threshold) {
        const indexItem = this.index.find(item => this.getItemId(item.data) === id);
        if (indexItem) {
          aggregatedResults.push({
            item: indexItem.data,
            score: finalScore,
          });
        }
      }
    }

    return aggregatedResults
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  /**
   * Find approximate nearest neighbors using locality-sensitive hashing
   */
  searchApproximate(
    queryVector: number[],
    options: {
      limit?: number;
      numHashes?: number;
      bucketSize?: number;
    } = {}
  ): VectorSearchResult<T>[] {
    // Simplified LSH implementation
    // In production, consider using specialized libraries like Faiss or Annoy
    const { limit = 10, numHashes = 10, bucketSize = 100 } = options;

    // For now, fall back to exact search
    // TODO: Implement proper LSH for large-scale approximate search
    return this.searchSimilar(queryVector, { limit });
  }

  /**
   * Get statistics about the vector index
   */
  getIndexStats(): {
    size: number;
    dimensions: number;
    avgMagnitude: number;
    memoryUsage: number; // Approximate in bytes
  } {
    if (this.index.length === 0) {
      return { size: 0, dimensions: 0, avgMagnitude: 0, memoryUsage: 0 };
    }

    const vectors = this.index.map(item => item.vector);
    const stats = EmbeddingService.calculateEmbeddingStats(vectors);
    
    // Rough memory usage calculation
    const memoryUsage = this.index.length * this.dimensions * 8; // 8 bytes per float64

    return {
      size: this.index.length,
      dimensions: this.dimensions,
      avgMagnitude: stats.avgMagnitude,
      memoryUsage,
    };
  }

  /**
   * Clear the index
   */
  clear(): void {
    this.index = [];
    this.dimensions = 0;
  }

  /**
   * Remove vectors by ID
   */
  removeVectors(ids: (string | number)[]): number {
    const idsSet = new Set(ids);
    const originalLength = this.index.length;
    
    this.index = this.index.filter(item => !idsSet.has(this.getItemId(item.data)));
    
    return originalLength - this.index.length;
  }

  /**
   * Update a vector in the index
   */
  updateVector(id: string | number, newVector: number[], newData?: T): boolean {
    const index = this.index.findIndex(item => this.getItemId(item.data) === id);
    
    if (index === -1) return false;
    
    if (newVector.length !== this.dimensions) {
      throw new Error(`Vector must have ${this.dimensions} dimensions`);
    }

    this.index[index]!.vector = newVector;
    if (newData !== undefined) {
      this.index[index]!.data = newData;
    }
    
    return true;
  }

  /**
   * Get item ID for deduplication
   */
  private getItemId(item: T): string | number {
    if (typeof item === 'object' && item !== null && 'id' in item) {
      return (item as any).id;
    }
    return JSON.stringify(item);
  }
}

/**
 * Create a vector search engine from memories
 */
export function createMemoryVectorIndex<T extends { id?: string | number; embedding?: number[] }>(
  memories: T[]
): VectorSearchEngine<T> {
  const engine = new VectorSearchEngine<T>();
  
  const vectorData: VectorIndex<T>[] = memories
    .filter(memory => memory.embedding && memory.embedding.length > 0)
    .map(memory => ({
      id: memory.id || JSON.stringify(memory),
      vector: memory.embedding!,
      data: memory,
    }));

  if (vectorData.length > 0) {
    engine.addVectors(vectorData);
  }

  return engine;
}

/**
 * Hybrid search combining vector and text search
 */
export function hybridSearch<T>(
  vectorResults: VectorSearchResult<T>[],
  textResults: T[],
  options: {
    vectorWeight?: number;
    textWeight?: number;
    maxResults?: number;
  } = {}
): VectorSearchResult<T>[] {
  const { vectorWeight = 0.7, textWeight = 0.3, maxResults = 10 } = options;
  
  // Create a map to combine scores
  const scoreMap = new Map<string, { item: T; vectorScore: number; textScore: number }>();
  
  // Add vector results
  vectorResults.forEach((result, index) => {
    const id = JSON.stringify(result.item);
    scoreMap.set(id, {
      item: result.item,
      vectorScore: result.score,
      textScore: 0,
    });
  });
  
  // Add text results with position-based scoring
  textResults.forEach((item, index) => {
    const id = JSON.stringify(item);
    const textScore = Math.max(0, 1 - index / textResults.length); // Higher score for earlier results
    
    if (scoreMap.has(id)) {
      scoreMap.get(id)!.textScore = textScore;
    } else {
      scoreMap.set(id, {
        item,
        vectorScore: 0,
        textScore,
      });
    }
  });
  
  // Calculate combined scores and return results
  const combinedResults: VectorSearchResult<T>[] = Array.from(scoreMap.values())
    .map(({ item, vectorScore, textScore }) => ({
      item,
      score: vectorScore * vectorWeight + textScore * textWeight,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults);
  
  return combinedResults;
}
