/**
 * Rate Limiting Middleware
 * Implements token bucket algorithm for API rate limiting
 */

export interface RateLimitConfig {
  requestsPerMinute: number;
  windowMs: number;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: number;
  retryAfter?: number;
}

/**
 * Simple in-memory rate limiter using token bucket algorithm
 */
export class RateLimiter {
  private buckets: Map<string, { tokens: number; lastRefill: number }> = new Map();
  private config: RateLimitConfig;

  constructor(config: Partial<RateLimitConfig> = {}) {
    this.config = {
      requestsPerMinute: parseInt(process.env.RATE_LIMIT_REQUESTS_PER_MINUTE || '100'),
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000'),
      skipSuccessfulRequests: false,
      skipFailedRequests: false,
      ...config,
    };

    // Cleanup old buckets every 5 minutes
    // eslint-disable-next-line no-undef
    setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  /**
   * Check if a request should be allowed
   */
  checkLimit(key: string): RateLimitInfo {
    const now = Date.now();
    let bucket = this.buckets.get(key);

    // Create new bucket if doesn't exist
    if (!bucket) {
      bucket = {
        tokens: this.config.requestsPerMinute,
        lastRefill: now,
      };
      this.buckets.set(key, bucket);
    }

    // Refill tokens based on time elapsed
    const timeSinceLastRefill = now - bucket.lastRefill;
    const refillRate = this.config.requestsPerMinute / this.config.windowMs;
    const tokensToAdd = timeSinceLastRefill * refillRate;

    bucket.tokens = Math.min(this.config.requestsPerMinute, bucket.tokens + tokensToAdd);
    bucket.lastRefill = now;

    // Check if request can be allowed
    const hasTokens = bucket.tokens >= 1;
    if (hasTokens) {
      bucket.tokens -= 1;
    }

    const remaining = Math.floor(bucket.tokens);
    const reset = Math.ceil((this.config.requestsPerMinute - bucket.tokens) / refillRate + now);
    const retryAfter = hasTokens ? undefined : Math.ceil((1 - bucket.tokens) / refillRate / 1000);

    return {
      limit: this.config.requestsPerMinute,
      remaining: Math.max(0, remaining),
      reset,
      retryAfter,
    };
  }

  /**
   * Consume a token for a request
   */
  async consume(key: string): Promise<boolean> {
    const info = this.checkLimit(key);
    return info.remaining >= 0;
  }

  /**
   * Get rate limit info without consuming a token
   */
  getInfo(key: string): RateLimitInfo {
    const bucket = this.buckets.get(key);
    if (!bucket) {
      return {
        limit: this.config.requestsPerMinute,
        remaining: this.config.requestsPerMinute,
        reset: Date.now() + this.config.windowMs,
      };
    }

    return this.checkLimit(key);
  }

  /**
   * Reset rate limit for a key
   */
  reset(key: string): void {
    this.buckets.delete(key);
  }

  /**
   * Cleanup old buckets
   */
  private cleanup(): void {
    const now = Date.now();
    const maxAge = this.config.windowMs * 2;

    for (const [key, bucket] of this.buckets.entries()) {
      if (now - bucket.lastRefill > maxAge) {
        this.buckets.delete(key);
      }
    }
  }

  /**
   * Get current bucket count (for monitoring)
   */
  getBucketCount(): number {
    return this.buckets.size;
  }
}

/**
 * Create rate limit headers for HTTP response
 */
export function createRateLimitHeaders(info: RateLimitInfo): Record<string, string> {
  const headers: Record<string, string> = {
    'X-RateLimit-Limit': info.limit.toString(),
    'X-RateLimit-Remaining': info.remaining.toString(),
    'X-RateLimit-Reset': info.reset.toString(),
  };

  if (info.retryAfter !== undefined) {
    headers['Retry-After'] = info.retryAfter.toString();
  }

  return headers;
}

/**
 * Default rate limiter instance
 */
export const defaultRateLimiter = new RateLimiter();
