# LOG_LEVEL Configuration Guide

**Feature**: Configurable log verbosity for MCP Memory Server
**Version**: 1.7.0+
**Status**: Production Ready

## Quick Start

Add `LOG_LEVEL` to your environment configuration to control log verbosity:

```bash
# In .env or .env.local
LOG_LEVEL=info  # Default - recommended for most users
```

Or in Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "mcp-memory-ts": {
      "command": "mcp-memory",
      "args": ["server"],
      "env": {
        "LOG_LEVEL": "info",
        "TURSO_URL": "...",
        "TURSO_AUTH_TOKEN": "...",
        "OPENAI_API_KEY": "..."
      }
    }
  }
}
```

## Log Levels

### error (Silent Mode)
**Use Case**: Production deployments, clean logs

**What's Logged**:
- ✅ Critical errors only
- ✅ Failed operations
- ✅ Database connection errors

**What's Not Logged**:
- ❌ Status updates
- ❌ Monitoring messages
- ❌ Progress information

**Example**:
```bash
LOG_LEVEL=error mcp-memory server
```

**Output**:
```
[EmbeddingUpdater] Queue processing error: Connection timeout
[EmbeddingUpdater] Failed to update embedding for memory abc-123 after 3 attempts: API rate limit
```

---

### warn (Warnings and Errors)
**Use Case**: Quiet operation with important notifications

**What's Logged**:
- ✅ All errors (from error level)
- ✅ Warnings (missing data, skipped operations)

**What's Not Logged**:
- ❌ Status updates
- ❌ Monitoring messages
- ❌ Informational messages

**Example**:
```bash
LOG_LEVEL=warn mcp-memory server
```

**Output**:
```
[EmbeddingUpdater] No embedding generated for memory xyz-789
[EmbeddingUpdater] Batch processing error: Network timeout
```

---

### info (Default - Recommended)
**Use Case**: Normal operation, balanced logging

**What's Logged**:
- ✅ All errors and warnings (from previous levels)
- ✅ Important status updates
- ✅ Monitoring start/stop
- ✅ **Smart**: Only logs changes (no spam)

**What's Not Logged**:
- ❌ Per-memory update details
- ❌ Debug information

**Example**:
```bash
LOG_LEVEL=info mcp-memory server
# Or simply omit LOG_LEVEL (info is default)
mcp-memory server
```

**Output**:
```
[MCPServer] Log level: info
[EmbeddingUpdater] Starting monitoring with 60000ms interval
[EmbeddingUpdater] Found 41 memories without embeddings
[EmbeddingUpdater] Updated 15 embeddings
(subsequent scans with same count produce no logs)
```

**Smart Logging Features**:
- First scan: Logs "Found 41 memories"
- Subsequent scans: No logs if count unchanged
- Count changes: Logs new count
- Updates: Only logs if embeddings were actually updated

---

### debug (Verbose)
**Use Case**: Development, troubleshooting, detailed diagnostics

**What's Logged**:
- ✅ Everything from all previous levels
- ✅ Per-memory update details
- ✅ Detailed operation traces
- ✅ All internal state changes

**Example**:
```bash
LOG_LEVEL=debug mcp-memory server
```

**Output**:
```
[MCPServer] Log level: debug
[EmbeddingUpdater] Starting monitoring with 60000ms interval
[EmbeddingUpdater] Found 41 memories without embeddings
[EmbeddingUpdater] Updated embedding for memory abc-123
[EmbeddingUpdater] Updated embedding for memory def-456
[EmbeddingUpdater] Updated embedding for memory ghi-789
...
[EmbeddingUpdater] Updated 41 embeddings
```

## Configuration Methods

### Method 1: Environment File (Recommended)

**File**: `.env` or `.env.local` in project root

```bash
# Logging Configuration
LOG_LEVEL=info  # Options: debug, info, warn, error

# Other configuration...
TURSO_URL=libsql://your-database.turso.io
TURSO_AUTH_TOKEN=your-token
OPENAI_API_KEY=your-key
```

**Benefits**:
- ✅ Easy to change
- ✅ Version control friendly (if using .env.local)
- ✅ Consistent across all invocations

---

### Method 2: Claude Desktop Config

**File**: `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "mcp-memory-ts": {
      "command": "mcp-memory",
      "args": ["server"],
      "env": {
        "LOG_LEVEL": "info",
        "TURSO_URL": "libsql://your-database.turso.io",
        "TURSO_AUTH_TOKEN": "your-auth-token",
        "OPENAI_API_KEY": "your-openai-key",
        "DEFAULT_USER_EMAIL": "user@example.com"
      }
    }
  }
}
```

**Benefits**:
- ✅ Specific to Claude Desktop integration
- ✅ Survives CLI reinstalls
- ✅ Independent of project files

**After changing**: Restart Claude Desktop

---

### Method 3: Command Line (One-Time)

```bash
# Temporary override for single invocation
LOG_LEVEL=debug mcp-memory server

# Or with npm
LOG_LEVEL=error npm run mcp-server
```

**Benefits**:
- ✅ Quick testing
- ✅ No file changes needed
- ✅ Overrides other settings

---

### Method 4: CLI Configuration

```bash
# Initialize with log level
mcp-memory init
# (Wizard will prompt for LOG_LEVEL)

# Or update existing config
mcp-memory update
```

**Benefits**:
- ✅ Interactive setup
- ✅ Saves to `~/.mcp-memory/config.json`
- ✅ Validates configuration

## Use Case Scenarios

### Development
**Recommended**: `LOG_LEVEL=debug`
- See everything happening
- Diagnose issues quickly
- Understand system behavior

### Testing
**Recommended**: `LOG_LEVEL=info`
- See important operations
- Verify functionality
- Clean enough for analysis

### Production (Local)
**Recommended**: `LOG_LEVEL=info`
- Balanced visibility
- No log spam
- Still catch issues

### Production (Deployed)
**Recommended**: `LOG_LEVEL=error`
- Minimal logging overhead
- Only critical issues
- Clean logs

### Troubleshooting
**Recommended**: `LOG_LEVEL=debug`
- Maximum visibility
- Detailed traces
- Find root causes

## Troubleshooting LOG_LEVEL

### "I don't see any logs"

**Cause**: LOG_LEVEL too restrictive

**Solutions**:
1. Check current LOG_LEVEL: `echo $LOG_LEVEL`
2. Set to debug: `LOG_LEVEL=debug mcp-memory server`
3. Verify environment is loading correctly
4. Check Claude Desktop logs: `~/Library/Logs/Claude/mcp*.log`

---

### "Too many logs, can't find errors"

**Cause**: LOG_LEVEL too verbose

**Solutions**:
1. Set to error: `LOG_LEVEL=error`
2. Or use warn for some context: `LOG_LEVEL=warn`
3. Restart server/Claude Desktop

---

### "Logs repeat too much"

**Solution**: Ensure using LOG_LEVEL=info (default)
- Smart logging prevents repetition
- Only logs when state changes
- v1.7.0+ includes this feature

---

### "LOG_LEVEL not working"

**Checklist**:
1. ✅ Restart Claude Desktop after config changes
2. ✅ Check spelling: must be uppercase `LOG_LEVEL`
3. ✅ Valid values: `debug`, `info`, `warn`, `error`
4. ✅ Check environment is set: `env | grep LOG_LEVEL`
5. ✅ Verify you're using v1.7.0+

## Smart Logging Behavior

### State Tracking (v1.7.0+)

The embedding updater tracks state to prevent log spam:

**First Scan**:
```
[EmbeddingUpdater] Found 41 memories without embeddings
```

**Second Scan (same count)**:
```
(no log - count unchanged)
```

**Third Scan (different count)**:
```
[EmbeddingUpdater] Found 35 memories without embeddings
```

**Benefits**:
- ✅ No repetitive messages
- ✅ Only logs meaningful changes
- ✅ Reduces log file size
- ✅ Easier to spot issues

---

### Conditional Logging

**Updates with results**:
```
[EmbeddingUpdater] Updated 15 embeddings
```

**Updates with no results**:
```
(no log - nothing to report)
```

**Benefits**:
- ✅ Only logs when actions taken
- ✅ No "Updated 0 embeddings" spam
- ✅ Focus on meaningful events

## Integration with MCP_DEBUG

### MCP_DEBUG Still Works

```bash
# Enable MCP protocol debugging
MCP_DEBUG=1 mcp-memory server
```

**Effect**: Equivalent to `LOG_LEVEL=debug` plus additional MCP protocol details

**Can Combine**:
```bash
# Both debug and MCP debugging
MCP_DEBUG=1 LOG_LEVEL=debug mcp-memory server
```

**Legacy Behavior**: MCP_DEBUG=1 without LOG_LEVEL automatically sets debug mode

## Best Practices

### ✅ DO

1. **Use info for normal operation**
   ```bash
   LOG_LEVEL=info  # Good default
   ```

2. **Use error in production**
   ```bash
   LOG_LEVEL=error  # Clean logs
   ```

3. **Use debug for troubleshooting**
   ```bash
   LOG_LEVEL=debug  # When you need details
   ```

4. **Document your choice**
   ```bash
   # Production: clean logs, errors only
   LOG_LEVEL=error
   ```

5. **Restart after changes**
   ```bash
   # Always restart Claude Desktop after config changes
   ```

---

### ❌ DON'T

1. **Don't use debug in production**
   ```bash
   LOG_LEVEL=debug  # Too verbose, performance impact
   ```

2. **Don't use error in development**
   ```bash
   LOG_LEVEL=error  # You'll miss important info
   ```

3. **Don't mix case**
   ```bash
   LOG_LEVEL=INFO   # Works but inconsistent
   LOG_LEVEL=info   # Correct
   ```

4. **Don't forget to restart**
   ```bash
   # Config changes require restart!
   ```

## Migration from v1.6.x

### No Action Required

**Automatic Defaults**:
- Missing LOG_LEVEL → defaults to `info`
- Same behavior as v1.6.x
- No breaking changes

**Optional Enhancement**:
Add LOG_LEVEL to your config for control:
```bash
LOG_LEVEL=info  # Explicit configuration
```

### Benefits of Upgrading

**v1.6.x**:
- ❌ All logs to stderr
- ❌ Repetitive messages
- ❌ No configurability

**v1.7.0+**:
- ✅ Proper log levels
- ✅ Smart state tracking
- ✅ Configurable verbosity
- ✅ Production-ready

## Support

### Getting Help

1. Check current log level:
   ```bash
   LOG_LEVEL=debug mcp-memory server
   # Should show: [MCPServer] Log level: debug
   ```

2. Review Claude Desktop logs:
   ```bash
   tail -f ~/Library/Logs/Claude/mcp*.log
   ```

3. Test different levels:
   ```bash
   for level in debug info warn error; do
     echo "Testing LOG_LEVEL=$level"
     LOG_LEVEL=$level mcp-memory server
   done
   ```

### Reporting Issues

Include this information:
- Current LOG_LEVEL setting
- Expected log output
- Actual log output
- Version: `mcp-memory --version`
- Environment: Claude Desktop or CLI

---

**Last Updated**: 2025-10-13
**Version**: 1.7.0+
**Status**: Production Ready

*Clean logs, happy developers!* 🎯
