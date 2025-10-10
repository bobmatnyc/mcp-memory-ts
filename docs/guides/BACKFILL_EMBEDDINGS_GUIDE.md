# Embedding Backfill Guide

This guide explains how to backfill embeddings for memories that are missing them.

## Overview

The `backfill-embeddings` script processes memories that don't have vector embeddings, generating embeddings for them in batches to avoid OpenAI API rate limits.

## Prerequisites

- OpenAI API key configured in `.env` or `.env.local`
- Database connection configured (TURSO_URL and TURSO_AUTH_TOKEN)
- Sufficient OpenAI API credits

## Basic Usage

### Default Settings

```bash
npm run backfill-embeddings
```

This will:
- Process memories in batches of 10
- Use default user email: `test@example.com`
- Wait 1000ms between batches
- Retry failed embeddings up to 3 times

### Custom Settings

```bash
# Process 20 memories per batch with 2-second delay
npm run backfill-embeddings -- --batch-size 20 --delay-ms 2000

# Use specific user email
npm run backfill-embeddings -- --user-email user@example.com

# Combine options
npm run backfill-embeddings -- --batch-size 5 --user-email user@example.com --delay-ms 1500
```

## Command Line Options

| Option | Short | Default | Description |
|--------|-------|---------|-------------|
| `--batch-size` | `-b` | 10 | Number of memories to process per batch |
| `--user-email` | `-u` | test@example.com | User email for authentication |
| `--delay-ms` | `-d` | 1000 | Delay between batches in milliseconds |
| `--help` | `-h` | - | Show help message |

## Output

The script provides real-time progress feedback:

```
Loading environment from .env.local
✅ OpenAI API key found
📧 User email: test@example.com
📦 Batch size: 10
⏱️  Delay between batches: 1000ms

✅ Database connected

📊 Found 665 memories without embeddings

🔄 Processing batch 1/67 (10 memories)...
   ✓ Generated 10 embeddings

🔄 Processing batch 2/67 (10 memories)...
   ✓ Generated 10 embeddings

...

============================================================
✅ Backfill complete!

📊 Final Statistics:
   Total memories: 665
   Successfully generated: 659
   Failed: 6
   Coverage: 99%
   Batches processed: 67

⚠️  Failed memory IDs (6):
   - abc123
   - def456
   ... and 4 more
============================================================
```

## Error Handling

### Retry Logic

The script automatically retries failed embeddings up to 3 times with exponential backoff:
- 1st retry: 1 second delay
- 2nd retry: 2 second delay
- 3rd retry: 4 second delay

### Common Errors

#### OpenAI API Key Missing

```
❌ OPENAI_API_KEY not found in environment
Make sure .env.local or .env contains OPENAI_API_KEY
```

**Solution**: Add your OpenAI API key to `.env.local`

#### Rate Limit Errors

If you encounter rate limit errors:
1. Reduce batch size: `--batch-size 5`
2. Increase delay: `--delay-ms 2000`
3. Check your OpenAI API tier limits

#### Database Connection Errors

**Solution**: Verify your database credentials in `.env.local`:
```
TURSO_URL=libsql://your-database.turso.io
TURSO_AUTH_TOKEN=your-auth-token
```

## Best Practices

### Recommended Settings by Volume

| Memories | Batch Size | Delay (ms) | Est. Time |
|----------|------------|------------|-----------|
| < 100 | 10 | 1000 | 1-2 min |
| 100-500 | 10 | 1000 | 5-10 min |
| 500-1000 | 10 | 1500 | 15-20 min |
| > 1000 | 5-10 | 2000 | 30+ min |

### OpenAI API Rate Limits

- **Free tier**: 3 RPM (requests per minute)
  - Use: `--batch-size 3 --delay-ms 20000` (20 seconds)
- **Tier 1**: 500 RPM
  - Use: `--batch-size 10 --delay-ms 1000` (default)
- **Tier 2+**: 5000 RPM
  - Use: `--batch-size 20 --delay-ms 500`

### Cost Estimation

Using `text-embedding-3-small` model:
- Cost: ~$0.00002 per 1,000 tokens
- Average memory: ~100-200 tokens
- 665 memories: ~$0.01-$0.02 total cost

## Monitoring Progress

### Check Current Coverage

```bash
# Via MCP server (if running)
# Use the "get_statistics" tool to see:
# - Total memories
# - Memories with embeddings
# - Coverage percentage
```

### Re-run After Failures

If some memories fail, you can re-run the script:
```bash
npm run backfill-embeddings
```

The script will only process memories that still don't have embeddings.

## Advanced Usage

### Processing Specific User's Memories

```bash
npm run backfill-embeddings -- --user-email alice@example.com
```

### High-Volume Processing

For databases with thousands of memories:

```bash
# Conservative approach (avoid rate limits)
npm run backfill-embeddings -- --batch-size 5 --delay-ms 2000

# Aggressive approach (if you have high API limits)
npm run backfill-embeddings -- --batch-size 50 --delay-ms 500
```

### Running in Background

```bash
# Using nohup
nohup npm run backfill-embeddings > backfill.log 2>&1 &

# Using screen
screen -S backfill
npm run backfill-embeddings
# Press Ctrl+A, then D to detach

# Using tmux
tmux new -s backfill
npm run backfill-embeddings
# Press Ctrl+B, then D to detach
```

## Troubleshooting

### Script Exits Immediately

**Issue**: Script exits without processing
**Check**:
1. Is `.env.local` or `.env` present?
2. Does it contain a valid OPENAI_API_KEY?
3. Run with `--help` to verify script is working

### All Embeddings Fail

**Issue**: Every embedding generation fails
**Check**:
1. Verify API key is valid
2. Check OpenAI account has credits
3. Test API key manually:
   ```bash
   curl https://api.openai.com/v1/models \
     -H "Authorization: Bearer YOUR_API_KEY"
   ```

### Slow Progress

**Issue**: Processing is very slow
**Causes**:
- High delay between batches
- OpenAI API rate limits
- Network latency

**Solutions**:
- Reduce `--delay-ms` if within rate limits
- Increase `--batch-size` if API tier allows
- Check network connection

### Memory Errors

**Issue**: Script crashes with out-of-memory errors
**Solutions**:
1. Reduce batch size: `--batch-size 5`
2. Ensure adequate system memory
3. Process in smaller chunks

## Integration with Workflow

### After Database Migration

```bash
# 1. Run migration
npm run migrate:schema

# 2. Verify schema
npm run verify:schema

# 3. Backfill embeddings
npm run backfill-embeddings

# 4. Verify statistics
# Use MCP server's get_statistics tool
```

### Scheduled Maintenance

For production systems, consider scheduling regular backfills:

```bash
# Cron job (daily at 2 AM)
0 2 * * * cd /path/to/mcp-memory-ts && npm run backfill-embeddings >> /var/log/backfill.log 2>&1
```

## See Also

- [Migration Guide](./MIGRATION_QUICK_START.md) - Database schema migrations
- [CLI Guide](./CLI-GUIDE.md) - MCP Memory CLI tool
- [Deployment Guide](../../DEPLOYMENT.md) - Production deployment
- [Semantic Search Analysis](../../docs/SEMANTIC-SEARCH-ANALYSIS.md) - How embeddings work

## Support

If you encounter issues:
1. Check the output logs for specific error messages
2. Review the [Common Issues](#common-errors) section
3. Verify your OpenAI API key and credits
4. Check database connectivity
5. Open an issue on GitHub with logs and configuration
