# Test Scripts

This directory contains manual test scripts for verifying specific features and fixes.

## Available Test Scripts

### Google Integration Tests

#### TEST_ALL_GOOGLE_ROUTES.sh
Comprehensive test of all Google API routes including OAuth, Contacts, and Calendar endpoints.

**Usage:**
```bash
./scripts/test/TEST_ALL_GOOGLE_ROUTES.sh
```

**Tests:**
- OAuth status endpoint
- Google Contacts sync endpoints
- Google Calendar sync endpoints
- Error handling and edge cases

#### TEST_GOOGLE_STATUS_FIX.sh
Verify Google OAuth status endpoint functionality.

**Usage:**
```bash
./scripts/test/TEST_GOOGLE_STATUS_FIX.sh
```

**Tests:**
- OAuth connection status
- Token validity checking
- Error response handling

#### TEST_GOOGLE_SYNC_OPTIMIZATION.sh
Test Google sync optimization and performance improvements.

**Usage:**
```bash
./scripts/test/TEST_GOOGLE_SYNC_OPTIMIZATION.sh
```

**Tests:**
- Incremental sync performance
- Batch processing efficiency
- Rate limiting compliance

### OAuth Tests

#### TEST_OAUTH_AFTER_COMPLETE.sh
Complete OAuth flow testing from start to finish.

**Usage:**
```bash
./scripts/test/TEST_OAUTH_AFTER_COMPLETE.sh
```

**Tests:**
- OAuth initiation
- Authorization flow
- Token exchange
- Token refresh
- Scope verification

### Security Tests

#### test-security-fixes.sh
Comprehensive security testing suite.

**Usage:**
```bash
./scripts/test/test-security-fixes.sh
```

**Tests:**
- User isolation verification
- Authentication enforcement
- SQL injection prevention
- XSS protection
- CSRF protection

#### VERIFY_SECURITY_FIXES.sh
Verify specific security fixes and patches.

**Usage:**
```bash
./scripts/test/VERIFY_SECURITY_FIXES.sh
```

**Tests:**
- Security patch verification
- Vulnerability scanning
- Penetration testing scenarios

### Sync Tests

#### test-sync-with-logs.sh
Test synchronization features with detailed logging.

**Usage:**
```bash
./scripts/test/test-sync-with-logs.sh
```

**Tests:**
- Contact sync with logging
- Progress tracking
- Error handling
- Log output verification

### Web Server

#### START_WEB_SERVER.sh
Start the web interface development server on staging port.

**Usage:**
```bash
./scripts/test/START_WEB_SERVER.sh
```

**Options:**
- Starts on port 3002 (staging)
- Development mode with hot reload
- Full API integration

## Running Tests

### Prerequisites

1. **Environment Setup:**
   ```bash
   # Ensure .env file is configured
   cp .env.example .env
   # Edit .env with your credentials
   ```

2. **Build Project:**
   ```bash
   npm run build-full
   ```

3. **Install Dependencies:**
   ```bash
   npm install
   cd web && npm install
   ```

### Running Individual Tests

```bash
# Make scripts executable
chmod +x scripts/test/*.sh

# Run specific test
./scripts/test/TEST_GOOGLE_STATUS_FIX.sh

# Run with verbose output
bash -x ./scripts/test/TEST_GOOGLE_STATUS_FIX.sh
```

### Running All Tests

```bash
# Run automated test suite
npm test

# Run with coverage
npm run test:coverage

# Pre-deployment tests
npm run pre-deploy
```

## Test Categories

### Unit Tests
- Core memory operations
- Database operations
- Utility functions
- Run via: `npm test`

### Integration Tests
- API endpoint testing
- Database integration
- External service integration
- Run via: `npm run test:integration`

### Manual Tests
- Scripts in this directory
- Feature-specific verification
- Run individually as needed

### E2E Tests
- Full workflow testing
- User journey testing
- Run via: `npm run test:e2e`

## Test Configuration

### Environment Variables

```bash
# Test Configuration
TEST_USER_EMAIL=test@example.com
TEST_TURSO_URL=libsql://test-db.turso.io
TEST_TURSO_AUTH_TOKEN=test-token

# Google Test Configuration
TEST_GOOGLE_CLIENT_ID=test-client-id
TEST_GOOGLE_CLIENT_SECRET=test-client-secret

# Clerk Test Configuration
TEST_CLERK_SECRET_KEY=test-clerk-key
```

### Test Database

For safe testing, use a separate test database:

```bash
# Create test database on Turso
turso db create mcp-memory-test

# Get credentials
turso db show mcp-memory-test

# Set in .env.test
TEST_TURSO_URL=libsql://mcp-memory-test.turso.io
TEST_TURSO_AUTH_TOKEN=your-test-token
```

## Test Output

### Log Files

Test logs are written to:
- `logs/test-*.log` - Individual test logs
- `logs/test-results.log` - Aggregated results
- `.claude-mpm/logs/` - MCP server logs

### Viewing Logs

```bash
# View test logs
tail -f logs/test-*.log

# View MCP logs
tail -f .claude-mpm/logs/claude-mpm.log

# View web server logs
pm2 logs mcp-memory-web
```

## Debugging Failed Tests

### Enable Debug Mode

```bash
# Enable debug logging
export LOG_LEVEL=debug
export MCP_DEBUG=1

# Run test
./scripts/test/TEST_GOOGLE_STATUS_FIX.sh
```

### Check Logs

```bash
# Check for errors
grep ERROR logs/test-*.log

# Check for warnings
grep WARN logs/test-*.log

# Full log review
less logs/test-results.log
```

### Common Issues

#### Port Already in Use
```bash
# Find process using port
lsof -i :3002

# Kill process
kill -9 <PID>

# Or use different port
PORT=3003 ./scripts/test/START_WEB_SERVER.sh
```

#### Database Connection Errors
```bash
# Verify database credentials
npm run verify:schema

# Check Turso status
turso db show mcp-memory

# Test connection
npm run test:db-connection
```

#### Authentication Failures
```bash
# Check OAuth tokens
npm run check:oauth-tokens

# Re-authenticate
mcp-memory google auth --user-email user@example.com

# Verify Clerk configuration
npm run verify:clerk-config
```

## Test Coverage

Current coverage: **95.2%** (20/21 tests passing)

### Coverage Report

```bash
# Generate coverage report
npm run test:coverage

# View HTML report
open coverage/index.html
```

### Coverage Goals
- **Core modules**: 95%+ coverage
- **API routes**: 90%+ coverage
- **Database operations**: 95%+ coverage
- **Integration tests**: 80%+ coverage

## CI/CD Integration

### GitHub Actions

Tests run automatically on:
- Pull requests
- Commits to main branch
- Release tags

### Pre-commit Hooks

```bash
# Install pre-commit hooks
npm run prepare

# Hooks run:
# - Linting
# - Type checking
# - Unit tests
```

## Contributing

### Adding New Tests

1. Create test script in `scripts/test/`
2. Make executable: `chmod +x scripts/test/new-test.sh`
3. Add documentation to this README
4. Update test suite if needed

### Test Script Template

```bash
#!/bin/bash
# Test: Description of what this tests
# Usage: ./scripts/test/test-name.sh

set -e  # Exit on error

echo "Starting test: Test Name"

# Setup
export TEST_ENV=testing

# Run tests
echo "Running test cases..."
# Test code here

# Cleanup
echo "Cleaning up..."
# Cleanup code here

echo "Test completed successfully!"
```

## Related Documentation

- [Testing Documentation Index](../../docs/testing/INDEX.md)
- [Deployment Guide](../../docs/deployment/INDEX.md)
- [Development Guide](../../docs/development/README.md)

---

**Last Updated**: 2025-10-20
**Test Framework**: Vitest + Bash Scripts
**Coverage**: 95.2%
