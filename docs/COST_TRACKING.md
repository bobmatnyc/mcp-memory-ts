# API Cost Tracking

This MCP memory server now includes comprehensive API cost tracking for OpenAI and OpenRouter usage.

## Features

- **Real-time cost tracking** for all embedding generation operations
- **Token estimation** before API calls using tiktoken
- **Daily/monthly usage reports** via MCP tool
- **Per-user cost attribution** for multi-tenant environments
- **Automatic recording** of all API usage with metadata

## Database Schema

A new table `api_usage_tracking` stores all API usage data:

```sql
CREATE TABLE IF NOT EXISTS api_usage_tracking (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  api_provider TEXT NOT NULL CHECK(api_provider IN ('openai', 'openrouter')),
  model TEXT NOT NULL,
  tokens_used INTEGER NOT NULL DEFAULT 0,
  cost_usd REAL NOT NULL,
  operation_type TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  date TEXT NOT NULL,
  metadata TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

Indexes are automatically created for:
- `(user_id, date)` - Fast per-user daily lookups
- `(api_provider, date)` - Provider-specific aggregations
- `(date)` - Global daily statistics

## Using the MCP Tool

### Get Daily Costs

Use the `get_daily_costs` tool to retrieve usage and cost information:

```json
{
  "name": "get_daily_costs",
  "arguments": {
    "date": "2025-10-01"
  }
}
```

If `date` is not provided, it defaults to today.

### Example Response

```
📊 Daily API Cost Report - 2025-10-01
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

OpenAI (Embeddings):
  • Requests: 15
  • Tokens: 4,532
  • Cost: $0.0001

OpenRouter:
  • Requests: 0
  • Tokens: 0
  • Cost: $0.0000

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total Daily Cost: $0.0001
Total Requests: 15
Total Tokens: 4,532
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Cost Information in Logs

All embedding operations now include cost information in stderr logs:

```
[EmbeddingService] ✅ Successfully generated embedding: 1536 dimensions, 42 tokens, $0.000001, 234ms
```

## Pricing

Current pricing (as of implementation):

- **OpenAI text-embedding-3-small**: $0.02 per 1M tokens
- **OpenRouter**: Varies by model (tracked automatically when implemented)

## Token Estimation

Before making API calls, you can estimate costs:

```typescript
import { EmbeddingService } from './utils/embeddings.js';

const service = new EmbeddingService(apiKey);
const text = "Your content here...";

// Estimate tokens
const estimatedTokens = service.estimateTokens(text);
console.log(`Estimated tokens: ${estimatedTokens}`);

// Estimate cost
const estimatedCost = service.estimateCost(text);
console.log(`Estimated cost: $${estimatedCost.toFixed(6)}`);
```

## Programmatic Access

### UsageTrackingDB API

```typescript
import { UsageTrackingDB } from './database/usage-tracking.js';

const tracker = new UsageTrackingDB(db);

// Get daily usage
const today = '2025-10-01';
const dailyUsage = await tracker.getDailyUsage(userId, today);

// Get monthly usage
const monthlyUsage = await tracker.getMonthlyUsage(userId, '2025-10');

// Get all-time usage
const allTimeUsage = await tracker.getAllTimeUsage(userId);

// Get date range usage
const rangeUsage = await tracker.getUserUsageByDateRange(
  userId,
  '2025-10-01',
  '2025-10-31'
);
```

### DailyUsageSummary Structure

```typescript
interface DailyUsageSummary {
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
```

## Implementation Details

### Automatic Tracking

Cost tracking is automatically enabled when:
1. A database connection is provided to `EmbeddingService`
2. The `OPENAI_API_KEY` environment variable is set

### What Gets Tracked

For each embedding generation:
- **User ID**: For multi-tenant attribution
- **API Provider**: `openai` or `openrouter`
- **Model**: e.g., `text-embedding-3-small`
- **Tokens Used**: Actual count from API response
- **Cost USD**: Calculated based on provider pricing
- **Operation Type**: e.g., `embedding`
- **Timestamp**: Unix timestamp in milliseconds
- **Date**: ISO date string (YYYY-MM-DD)
- **Metadata**: Duration, batch size, etc.

### Performance Impact

- Minimal overhead: ~1-2ms per operation
- Non-blocking: Usage recording failures don't affect embedding generation
- Indexed queries: Fast aggregation even with large datasets

## Migration from Existing Installation

If you have an existing installation:

1. The `api_usage_tracking` table will be created automatically on next startup
2. Existing memories will not have cost tracking (only new operations)
3. No data migration required

## Privacy Considerations

- Only metadata is stored (no actual content)
- User IDs are hashed (if using API key authentication)
- Can be disabled by not providing database connection to EmbeddingService

## Troubleshooting

### Cost tracking not working?

1. Verify database connection is passed to EmbeddingService:
   ```typescript
   new EmbeddingService(apiKey, model, db)
   ```

2. Check that table was created:
   ```sql
   SELECT name FROM sqlite_master WHERE type='table' AND name='api_usage_tracking';
   ```

3. Verify user ID is available:
   ```typescript
   console.error('User ID:', userId);
   ```

### No data showing in reports?

1. Ensure embeddings have been generated since installation
2. Check correct date format: `YYYY-MM-DD`
3. Verify user ID matches

## Future Enhancements

Potential additions:
- Cost budget alerts and limits
- Weekly/monthly cost reports via email
- Cost breakdown by memory type or entity
- Export cost data to CSV/JSON
- Integration with billing systems
- OpenRouter cost tracking (when implemented)

## Testing

Run cost tracking tests:

```bash
npm test -- tests/unit/cost-tracking.test.ts
```

## Files Modified/Added

**New Files:**
- `src/database/usage-tracking.ts` - Usage tracking database operations
- `tests/unit/cost-tracking.test.ts` - Unit tests
- `docs/COST_TRACKING.md` - This documentation

**Modified Files:**
- `src/database/schema.ts` - Added `api_usage_tracking` table
- `src/utils/embeddings.ts` - Enhanced with cost tracking
- `src/core/memory-core.ts` - Pass userId to embeddings
- `src/desktop-mcp-server.ts` - Added `get_daily_costs` tool
- `package.json` - Added `tiktoken` dependency

## Support

For issues or questions about cost tracking:
1. Check this documentation
2. Review implementation in `src/database/usage-tracking.ts`
3. Examine test cases in `tests/unit/cost-tracking.test.ts`
