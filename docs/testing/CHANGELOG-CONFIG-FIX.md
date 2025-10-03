# Config Auto-Loading Fix

## Problem
After running `mcp-memory init` to save configuration to `~/.mcp-memory/config.json`, other CLI commands (like `vcard export`, `contacts sync`, etc.) would fail with:
```
TURSO_URL and TURSO_AUTH_TOKEN environment variables are required
```

This happened because the CLI wasn't loading the saved configuration file before executing commands.

## Solution
Implemented automatic configuration loading at CLI startup:

### Changes Made

1. **Added `loadConfigToEnv()` function** in `src/cli/claude-desktop.ts`:
   - Loads configuration from `~/.mcp-memory/config.json`
   - Sets environment variables (`TURSO_URL`, `TURSO_AUTH_TOKEN`, `OPENAI_API_KEY`, `DEFAULT_USER_EMAIL`)
   - Silently returns if config file doesn't exist (allows using `.env` or system env vars)
   - Existing environment variables take precedence over config file values

2. **Modified `src/cli/index.ts`** to call `loadConfigToEnv()` at startup:
   - Added import for `loadConfigToEnv`
   - Called immediately after `dotenv.config()` and before command parsing
   - Ensures all commands have access to configuration

### Behavior

**Priority order for environment variables:**
1. System environment variables (highest priority)
2. `.env` file (via `dotenv.config()`)
3. `~/.mcp-memory/config.json` (via `loadConfigToEnv()`)
4. None (commands will fail with appropriate error)

**Silent fallback:**
- If `~/.mcp-memory/config.json` doesn't exist, no error is shown
- This allows users to continue using `.env` or system environment variables

### Testing

Verified with clean environment test:
```bash
# Without config loading (BEFORE fix):
env -i NODE_ENV=test PATH="$PATH" mcp-memory vcard export --user-email test@example.com
# ✗ FAILED: "TURSO_URL and TURSO_AUTH_TOKEN environment variables are required"

# With config loading (AFTER fix):
env -i NODE_ENV=test PATH="$PATH" mcp-memory vcard export --user-email test@example.com
# ✓ SUCCESS: Loads config from ~/.mcp-memory/config.json and executes command
```

### User Experience

**Before fix:**
```bash
$ mcp-memory init
# ... saves config to ~/.mcp-memory/config.json ...

$ mcp-memory vcard export --user-email test@example.com
# ✗ Error: TURSO_URL and TURSO_AUTH_TOKEN environment variables are required
```

**After fix:**
```bash
$ mcp-memory init
# ... saves config to ~/.mcp-memory/config.json ...

$ mcp-memory vcard export --user-email test@example.com
# ✓ Works! Config is automatically loaded
```

## Files Modified

- `src/cli/claude-desktop.ts` - Added `loadConfigToEnv()` function
- `src/cli/index.ts` - Added config loading at startup

## Backward Compatibility

✓ Fully backward compatible:
- Users with `.env` files: Continue working as before
- Users with system env vars: Continue working as before
- Users with `~/.mcp-memory/config.json`: Now works automatically
- Users with no config: Get appropriate error messages

## Code Quality

- **LOC Impact**: +18 lines added (config loading function and startup call)
- **Type Safety**: Fully typed with TypeScript
- **Error Handling**: Silent fallback if config doesn't exist
- **Documentation**: Added inline comments explaining behavior
- **Testing**: Verified with manual testing in clean environment
