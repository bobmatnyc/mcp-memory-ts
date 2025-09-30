/**
 * Vector embeddings utilities using OpenAI
 */

import OpenAI from 'openai';

export class EmbeddingService {
  private openai: OpenAI | null;
  private model: string;

  constructor(apiKey?: string, model = 'text-embedding-3-small') {
    const key = apiKey || process.env.OPENAI_API_KEY;
    if (key && key !== 'test-key') {
      this.openai = new OpenAI({
        apiKey: key,
      });
    } else {
      this.openai = null;
      console.warn('OpenAI API key not provided - embeddings will be disabled');
    }
    this.model = model;
  }

  /**
   * Generate embeddings for text
   */
  async generateEmbedding(text: string): Promise<number[]> {
    if (!this.openai) {
      // Return empty array when OpenAI is not available
      return [];
    }

    try {
      const response = await this.openai.embeddings.create({
        model: this.model,
        input: text.trim(),
      });

      return response.data[0]?.embedding || [];
    } catch (error) {
      console.error('Failed to generate embedding:', error);
      throw new Error(`Embedding generation failed: ${error}`);
    }
  }

  /**
   * Generate embeddings for multiple texts
   */
  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    if (!this.openai) {
      // Return empty arrays when OpenAI is not available
      return texts.map(() => []);
    }

    try {
      const response = await this.openai.embeddings.create({
        model: this.model,
        input: texts.map(text => text.trim()),
      });

      return response.data.map(item => item.embedding);
    } catch (error) {
      console.error('Failed to generate embeddings:', error);
      throw new Error(`Batch embedding generation failed: ${error}`);
    }
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  static cosineSimilarity(a: number[], b: number[]): number {
    if (!Array.isArray(a) || !Array.isArray(b)) {
      console.error('[CosineSimilarity] Invalid input: not arrays', typeof a, typeof b);
      return 0;
    }

    if (a.length !== b.length) {
      console.error('[CosineSimilarity] Vector length mismatch:', a.length, 'vs', b.length);
      return 0;
    }

    if (a.length === 0) {
      return 0;
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      const valA = a[i];
      const valB = b[i];

      // Validate that values are numbers
      if (typeof valA !== 'number' || typeof valB !== 'number') {
        console.error('[CosineSimilarity] Non-numeric values detected at index', i);
        return 0;
      }

      dotProduct += valA * valB;
      normA += valA * valA;
      normB += valB * valB;
    }

    if (normA === 0 || normB === 0) {
      if (process.env.MCP_DEBUG) {
        console.log('[CosineSimilarity] Zero norm detected:', normA, normB);
      }
      return 0;
    }

    const similarity = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));

    // OpenAI embeddings are normalized, so similarity should be between -1 and 1
    // In practice, semantic similarity is usually between 0 and 1
    if (similarity < -1.1 || similarity > 1.1) {
      console.warn('[CosineSimilarity] Unusual similarity value:', similarity);
    }

    return similarity;
  }

  /**
   * Find the most similar vectors from a list
   */
  static findMostSimilar(
    queryVector: number[],
    vectors: Array<{ vector: number[]; data: any }>,
    threshold = 0.7,
    limit = 10
  ): Array<{ similarity: number; data: any }> {
    const similarities = vectors
      .map(item => ({
        similarity: EmbeddingService.cosineSimilarity(queryVector, item.vector),
        data: item.data,
      }))
      .filter(item => item.similarity >= threshold)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);

    return similarities;
  }

  /**
   * Prepare text for embedding (clean and truncate)
   */
  static prepareTextForEmbedding(text: string, maxLength = 8000): string {
    // Clean the text
    let cleaned = text
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/[^\w\s\-.,!?;:()\[\]{}'"]/g, '') // Remove special chars
      .trim();

    // Truncate if too long
    if (cleaned.length > maxLength) {
      cleaned = cleaned.substring(0, maxLength).trim();
      // Try to end at a word boundary
      const lastSpace = cleaned.lastIndexOf(' ');
      if (lastSpace > maxLength * 0.8) {
        cleaned = cleaned.substring(0, lastSpace);
      }
    }

    return cleaned;
  }

  /**
   * Create a combined text for embedding from memory data
   */
  static createMemoryEmbeddingText(memory: {
    title: string;
    content: string;
    tags?: string[];
    memoryType?: string;
  }): string {
    const parts = [
      memory.title,
      memory.content,
    ];

    if (memory.memoryType) {
      parts.push(`Type: ${memory.memoryType}`);
    }

    if (memory.tags && memory.tags.length > 0) {
      parts.push(`Tags: ${memory.tags.join(', ')}`);
    }

    return EmbeddingService.prepareTextForEmbedding(parts.join('\n\n'));
  }

  /**
   * Create a combined text for embedding from entity data
   */
  static createEntityEmbeddingText(entity: {
    name: string;
    description?: string;
    company?: string;
    title?: string;
    notes?: string;
    tags?: string[];
  }): string {
    const parts = [entity.name];

    if (entity.description) parts.push(entity.description);
    if (entity.company) parts.push(`Company: ${entity.company}`);
    if (entity.title) parts.push(`Title: ${entity.title}`);
    if (entity.notes) parts.push(entity.notes);

    if (entity.tags && entity.tags.length > 0) {
      parts.push(`Tags: ${entity.tags.join(', ')}`);
    }

    return EmbeddingService.prepareTextForEmbedding(parts.join('\n\n'));
  }

  /**
   * Batch process embeddings with rate limiting
   */
  async generateEmbeddingsBatch(
    texts: string[],
    batchSize = 100,
    delayMs = 1000
  ): Promise<number[][]> {
    const results: number[][] = [];

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const embeddings = await this.generateEmbeddings(batch);
      results.push(...embeddings);

      // Add delay between batches to respect rate limits
      if (i + batchSize < texts.length) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    return results;
  }

  /**
   * Calculate embedding statistics
   */
  static calculateEmbeddingStats(embeddings: number[][]): {
    dimensions: number;
    count: number;
    avgMagnitude: number;
    minMagnitude: number;
    maxMagnitude: number;
  } {
    if (embeddings.length === 0) {
      return { dimensions: 0, count: 0, avgMagnitude: 0, minMagnitude: 0, maxMagnitude: 0 };
    }

    const dimensions = embeddings[0]?.length || 0;
    const magnitudes = embeddings.map(emb =>
      Math.sqrt(emb.reduce((sum, val) => sum + val * val, 0))
    );

    return {
      dimensions,
      count: embeddings.length,
      avgMagnitude: magnitudes.reduce((sum, mag) => sum + mag, 0) / magnitudes.length,
      minMagnitude: Math.min(...magnitudes),
      maxMagnitude: Math.max(...magnitudes),
    };
  }

  /**
   * Normalize vector to unit length
   */
  static normalizeVector(vector: number[]): number[] {
    const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    return magnitude > 0 ? vector.map(val => val / magnitude) : vector;
  }

  /**
   * Calculate dot product between two vectors
   */
  static dotProduct(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Vectors must have the same length');
    }
    return a.reduce((sum, val, i) => sum + val * (b[i] || 0), 0);
  }

  /**
   * Calculate Euclidean distance between two vectors
   */
  static euclideanDistance(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Vectors must have the same length');
    }
    const sumSquares = a.reduce((sum, val, i) => {
      const diff = val - (b[i] || 0);
      return sum + diff * diff;
    }, 0);
    return Math.sqrt(sumSquares);
  }
}
