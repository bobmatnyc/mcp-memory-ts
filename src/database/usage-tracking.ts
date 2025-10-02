/**
 * API usage tracking database operations
 */

import type { DatabaseConnection } from './connection.js';

export interface UsageRecord {
  id: string;
  userId: string;
  apiProvider: 'openai' | 'openrouter';
  model: string;
  tokensUsed: number;
  costUsd: number;
  operationType: string;
  timestamp: number;
  date: string;
  metadata?: Record<string, any>;
}

export interface DailyUsageSummary {
  openai: {
    tokens: number;
    cost: number;
    requests: number;
  };
  openrouter: {
    tokens: number;
    cost: number;
    requests: number;
  };
  total: {
    tokens: number;
    cost: number;
    requests: number;
  };
}

export class UsageTrackingDB {
  constructor(private db: DatabaseConnection) {}

  async recordUsage(record: Omit<UsageRecord, 'id'>): Promise<string> {
    const id = crypto.randomUUID();

    await this.db.execute(
      `
        INSERT INTO api_usage_tracking (
          id, user_id, api_provider, model, tokens_used,
          cost_usd, operation_type, timestamp, date, metadata
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        id,
        record.userId,
        record.apiProvider,
        record.model,
        record.tokensUsed,
        record.costUsd,
        record.operationType,
        record.timestamp,
        record.date,
        record.metadata ? JSON.stringify(record.metadata) : null,
      ]
    );

    return id;
  }

  async getDailyUsage(userId: string, date: string): Promise<DailyUsageSummary> {
    const results = await this.db.execute(
      `
        SELECT
          api_provider,
          SUM(tokens_used) as total_tokens,
          SUM(cost_usd) as total_cost,
          COUNT(*) as request_count
        FROM api_usage_tracking
        WHERE user_id = ? AND date = ?
        GROUP BY api_provider
      `,
      [userId, date]
    );

    const usage: DailyUsageSummary = {
      openai: { tokens: 0, cost: 0, requests: 0 },
      openrouter: { tokens: 0, cost: 0, requests: 0 },
      total: { tokens: 0, cost: 0, requests: 0 },
    };

    for (const row of results.rows) {
      const provider = row.api_provider as string;
      const tokens = Number(row.total_tokens) || 0;
      const cost = Number(row.total_cost) || 0;
      const requests = Number(row.request_count) || 0;

      if (provider === 'openai') {
        usage.openai = { tokens, cost, requests };
      } else if (provider === 'openrouter') {
        usage.openrouter = { tokens, cost, requests };
      }

      usage.total.tokens += tokens;
      usage.total.cost += cost;
      usage.total.requests += requests;
    }

    return usage;
  }

  async getMonthlyUsage(userId: string, yearMonth: string): Promise<any[]> {
    const results = await this.db.execute(
      `
        SELECT
          date,
          api_provider,
          SUM(tokens_used) as daily_tokens,
          SUM(cost_usd) as daily_cost,
          COUNT(*) as daily_requests
        FROM api_usage_tracking
        WHERE user_id = ? AND date LIKE ?
        GROUP BY date, api_provider
        ORDER BY date DESC
      `,
      [userId, `${yearMonth}%`]
    );

    return results.rows.map(row => ({
      date: row.date,
      provider: row.api_provider,
      tokens: Number(row.daily_tokens) || 0,
      cost: Number(row.daily_cost) || 0,
      requests: Number(row.daily_requests) || 0,
    }));
  }

  async getAllTimeUsage(userId: string): Promise<DailyUsageSummary> {
    const results = await this.db.execute(
      `
        SELECT
          api_provider,
          SUM(tokens_used) as total_tokens,
          SUM(cost_usd) as total_cost,
          COUNT(*) as request_count
        FROM api_usage_tracking
        WHERE user_id = ?
        GROUP BY api_provider
      `,
      [userId]
    );

    const usage: DailyUsageSummary = {
      openai: { tokens: 0, cost: 0, requests: 0 },
      openrouter: { tokens: 0, cost: 0, requests: 0 },
      total: { tokens: 0, cost: 0, requests: 0 },
    };

    for (const row of results.rows) {
      const provider = row.api_provider as string;
      const tokens = Number(row.total_tokens) || 0;
      const cost = Number(row.total_cost) || 0;
      const requests = Number(row.request_count) || 0;

      if (provider === 'openai') {
        usage.openai = { tokens, cost, requests };
      } else if (provider === 'openrouter') {
        usage.openrouter = { tokens, cost, requests };
      }

      usage.total.tokens += tokens;
      usage.total.cost += cost;
      usage.total.requests += requests;
    }

    return usage;
  }

  async getUserUsageByDateRange(
    userId: string,
    startDate: string,
    endDate: string
  ): Promise<DailyUsageSummary> {
    const results = await this.db.execute(
      `
        SELECT
          api_provider,
          SUM(tokens_used) as total_tokens,
          SUM(cost_usd) as total_cost,
          COUNT(*) as request_count
        FROM api_usage_tracking
        WHERE user_id = ? AND date >= ? AND date <= ?
        GROUP BY api_provider
      `,
      [userId, startDate, endDate]
    );

    const usage: DailyUsageSummary = {
      openai: { tokens: 0, cost: 0, requests: 0 },
      openrouter: { tokens: 0, cost: 0, requests: 0 },
      total: { tokens: 0, cost: 0, requests: 0 },
    };

    for (const row of results.rows) {
      const provider = row.api_provider as string;
      const tokens = Number(row.total_tokens) || 0;
      const cost = Number(row.total_cost) || 0;
      const requests = Number(row.request_count) || 0;

      if (provider === 'openai') {
        usage.openai = { tokens, cost, requests };
      } else if (provider === 'openrouter') {
        usage.openrouter = { tokens, cost, requests };
      }

      usage.total.tokens += tokens;
      usage.total.cost += cost;
      usage.total.requests += requests;
    }

    return usage;
  }
}
