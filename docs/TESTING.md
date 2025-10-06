# Testing Guide - MCP Memory TypeScript

## Overview

This project uses a comprehensive testing strategy to ensure reliability, protocol compliance, and backward compatibility.

## Test Structure

```
tests/
├── unit/                    # Unit tests for individual components
├── integration/             # Integration tests for database and core functionality
└── e2e/                     # End-to-end tests for MCP server
    ├── mcp-server.e2e.test.ts    # Comprehensive E2E tests
    └── regression.test.ts         # Backward compatibility tests
```

## Test Types

### Unit Tests
- Test individual functions and methods
- Fast execution (< 100ms per test)
- Mock external dependencies
- Location: `tests/unit/`

### Integration Tests
- Test database operations
- Test vector search functionality
- Test memory core operations
- Real database connections (test instance)
- Location: `tests/integration/`

### E2E Tests
- Test complete MCP server lifecycle
- Test JSON-RPC protocol compliance
- Test all tool executions
- Real server process with stdio communication
- Location: `tests/e2e/`

## Running Tests

### All Tests
```bash
npm test
```

### Unit Tests Only
```bash
npm test tests/unit/
```

### Integration Tests
```bash
npm run test:integration
```

### E2E Tests
```bash
# Using the test runner script (recommended)
./scripts/run-e2e-tests.sh

# Or directly with vitest
npm test tests/e2e/
```

### Regression Tests
```bash
npm test tests/e2e/regression.test.ts
```

### Test Coverage
```bash
npm run test:coverage
```

## E2E Test Suite

### Coverage Areas

The E2E test suite provides comprehensive coverage across:

#### A. Server Lifecycle Tests
- Server initialization and startup
- Tool listing
- Ping/health checks
- Prompts and resources endpoints
- Graceful shutdown

#### B. JSON-RPC Protocol Compliance
- Valid JSON-RPC 2.0 response format
- Proper `jsonrpc: "2.0"` and `id` fields
- Method not found errors (`-32601`)
- Internal error handling (`-32603`)
- Parse error handling (`-32700`)

#### C. Tool Execution Tests
All MCP tools are tested:
- `store_memory` - Create new memories
- `recall_memories` - Semantic search
- `get_memory` - Retrieve by ID
- `update_memory` - Modify existing memory
- `delete_memory` - Remove memory
- `get_memory_stats` - Statistics
- `update_missing_embeddings` - Manual embedding generation

#### D. Error Handling Tests
- Missing required parameters
- Invalid parameter types
- Invalid memory IDs
- Empty queries
- Database failures
- API failures

#### E. Integration Tests
- Full memory lifecycle (store → recall → update → delete)
- Concurrent request handling
- Data consistency verification
- Multi-step workflows

#### F. Performance & Stability Tests
- Large content handling (10KB+)
- Rapid sequential requests
- Memory leak detection
- Connection pool management

## Regression Tests

Ensures backward compatibility and prevents known issues:

### Stdio Communication
- Direct stdin/stdout communication
- Multiple rapid writes
- Response handling

### Environment Variables
- `.env` file loading
- Environment variable priority
- Required variable validation

### Claude Desktop Integration
- Tool schema format compatibility
- Tool result format
- Error response format

### Backward Compatibility
- Legacy memory type format
- Decimal importance values (0-1)
- Metadata object handling
- Tags array handling

### Known Issues Prevention
- Malformed JSON handling
- Missing API keys
- Race conditions
- Concurrent operations

## Writing New Tests

### E2E Test Example

```typescript
import { describe, it, expect } from 'vitest';

describe('My Feature E2E Tests', () => {
  it('should perform expected behavior', async () => {
    const response = await client.callTool('my_tool', {
      param: 'value',
    });

    expect(response.jsonrpc).toBe('2.0');
    expect(response.result).toBeDefined();
    expect(response.result.isError).toBe(false);
  });
});
```

### Integration Test Example

```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import { MemoryCore } from '../src/core/memory-core';

describe('My Feature Integration Tests', () => {
  let memoryCore: MemoryCore;

  beforeAll(async () => {
    // Setup
    memoryCore = new MemoryCore(db, apiKey);
    await memoryCore.initialize();
  });

  it('should integrate correctly', async () => {
    const result = await memoryCore.someMethod();
    expect(result.status).toBe('SUCCESS');
  });
});
```

## Test Configuration

### Vitest Configuration
Located in `vitest.config.ts`:

```typescript
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
  },
});
```

### Environment Variables for Tests
Create `.env.test` or use `.env`:

```bash
TURSO_URL=libsql://test-database.turso.io
TURSO_AUTH_TOKEN=your-test-token
OPENAI_API_KEY=your-api-key
DEFAULT_USER_EMAIL=test@example.com
NODE_ENV=test
MCP_DEBUG=0
```

## Debugging Tests

### Enable Debug Logging
```bash
MCP_DEBUG=1 npm test tests/e2e/
```

### Run Single Test
```bash
npm test tests/e2e/mcp-server.e2e.test.ts -t "should respond to initialize"
```

### Watch Mode
```bash
npm test -- --watch
```

### Inspect Mode
```bash
node --inspect-brk node_modules/.bin/vitest run tests/e2e/
```

## CI/CD Integration

### Pre-Deployment Testing
```bash
npm run pre-deploy
```

This runs:
1. TypeScript compilation
2. All unit tests
3. Integration tests
4. Regression tests

### GitHub Actions Example
```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
      - run: npm run build
      - run: npm test
      - run: ./scripts/run-e2e-tests.sh
```

## Common Test Failures

### Server Startup Timeout
**Issue**: E2E tests timeout during server startup

**Solutions**:
- Check database connection
- Verify environment variables
- Increase `SERVER_STARTUP_TIMEOUT`
- Check for port conflicts

### Database Connection Errors
**Issue**: Tests fail with "Failed to connect to database"

**Solutions**:
- Verify `TURSO_URL` and `TURSO_AUTH_TOKEN`
- Check network connectivity
- Ensure test database exists
- Review database permissions

### Embedding Generation Failures
**Issue**: Tests fail during embedding generation

**Solutions**:
- Verify `OPENAI_API_KEY` is valid
- Check API rate limits
- Ensure API key has embeddings access
- Review fallback mechanisms

### Race Conditions
**Issue**: Intermittent failures in concurrent tests

**Solutions**:
- Review transaction handling
- Add proper locking mechanisms
- Increase timeouts for async operations
- Use test isolation

## Best Practices

1. **Test Isolation**: Each test should be independent
2. **Cleanup**: Always clean up test data
3. **Timeouts**: Set appropriate timeouts for async operations
4. **Assertions**: Use specific assertions, avoid generic checks
5. **Error Messages**: Provide clear error messages for failures
6. **Mocking**: Mock external dependencies in unit tests
7. **Real Data**: Use real data in integration/E2E tests
8. **Coverage**: Aim for >80% code coverage
9. **Performance**: Keep unit tests fast (<100ms)
10. **Documentation**: Document complex test scenarios

## Test Maintenance

### Adding New Tools
When adding a new MCP tool:

1. Add tool definition to `desktop-mcp-server.ts`
2. Add E2E test in `mcp-server.e2e.test.ts`
3. Add regression test if needed
4. Update this documentation

### Updating Schemas
When changing tool schemas:

1. Update schema in server
2. Update integration tests
3. Add regression test for old schema
4. Document breaking changes

### Performance Monitoring
Monitor test performance over time:

```bash
npm test -- --reporter=verbose --outputFile=test-results.json
```

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [MCP Protocol Specification](https://modelcontextprotocol.io/)
- [JSON-RPC 2.0 Specification](https://www.jsonrpc.org/specification)
- [Project README](../README.md)
- [Claude Desktop Integration Guide](../CLAUDE.md)

## Troubleshooting

### Q: Tests pass locally but fail in CI
**A**: Check environment variables, database access, and network connectivity in CI environment.

### Q: E2E tests are flaky
**A**: Increase timeouts, ensure proper server startup, check for race conditions.

### Q: How to test Claude Desktop integration?
**A**: Use regression tests and manual testing with Claude Desktop app.

### Q: Tests are too slow
**A**: Parallelize tests, optimize database operations, use mocking where appropriate.

## Contributing

When contributing tests:

1. Follow existing test patterns
2. Ensure tests are deterministic
3. Add clear descriptions
4. Cover edge cases
5. Update documentation
6. Run full test suite before submitting

## Support

For test-related issues:
1. Check this documentation
2. Review test output and logs
3. Enable debug mode (`MCP_DEBUG=1`)
4. Check GitHub issues
5. Create detailed bug report

---

**Last Updated**: 2025-10-01
**Test Coverage Goal**: 80%+
**Current E2E Tests**: 40+ test cases
