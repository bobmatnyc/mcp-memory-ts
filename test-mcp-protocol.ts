#!/usr/bin/env node
/**
 * MCP Protocol Integration Test
 * Tests the ACTUAL data flow through the MCP server to Claude Desktop
 *
 * This test replicates exactly how Claude Desktop interacts with the MCP server
 * to identify where data corruption occurs.
 */

import { initDatabaseFromEnv } from './src/database/index.js';
import { MemoryCore } from './src/core/index.js';
import { MCPToolResultStatus } from './src/types/enums.js';

interface TestResult {
  test: string;
  passed: boolean;
  expected: any;
  actual: any;
  details?: string;
}

const results: TestResult[] = [];

function log(message: string) {
  console.log(`[TEST] ${message}`);
}

function logResult(result: TestResult) {
  const status = result.passed ? '✅ PASS' : '❌ FAIL';
  console.log(`\n${status}: ${result.test}`);
  if (!result.passed) {
    console.log(`  Expected: ${JSON.stringify(result.expected, null, 2)}`);
    console.log(`  Actual: ${JSON.stringify(result.actual, null, 2)}`);
    if (result.details) {
      console.log(`  Details: ${result.details}`);
    }
  }
  results.push(result);
}

async function testMCPProtocol() {
  log('Starting MCP Protocol Integration Test...');

  // Initialize database and memory core (same as MCP server does)
  const db = initDatabaseFromEnv();
  const memoryCore = new MemoryCore(db, process.env.OPENAI_API_KEY);

  // Set default user for testing
  process.env.DEFAULT_USER_EMAIL = 'test@example.com';
  await memoryCore.initialize();

  log('Memory core initialized');

  // Test 1: Store a memory with specific attributes
  log('\n=== TEST 1: Store Memory with Specific Type ===');
  const storeResult = await memoryCore.addMemory(
    'Test Episodic Memory',
    'This is a test episodic memory about a specific event',
    'episodic' as any,
    {
      tags: ['test', 'episodic'],
      importance: 0.8,
      generateEmbedding: true,
    }
  );

  if (storeResult.status !== MCPToolResultStatus.SUCCESS) {
    log(`❌ Failed to store memory: ${storeResult.error}`);
    process.exit(1);
  }

  const storedMemoryId = (storeResult.data as any)?.id;
  log(`✅ Memory stored with ID: ${storedMemoryId}`);

  // Test 2: Retrieve the memory via MCP's getMemory (simulating get_memory tool)
  log('\n=== TEST 2: Retrieve Memory via MCP Protocol ===');
  const getResult = await memoryCore.getMemory(storedMemoryId);

  if (getResult.status !== MCPToolResultStatus.SUCCESS) {
    log(`❌ Failed to retrieve memory: ${getResult.error}`);
    process.exit(1);
  }

  const retrievedMemory = getResult.data as any;
  log(`Retrieved memory data structure:`);
  log(JSON.stringify(retrievedMemory, null, 2));

  // Test 2a: Check field names returned from database (should be transformed to camelCase)
  log('\n=== TEST 2a: Field Name Format ===');
  const hasSnakeCase = 'memory_type' in retrievedMemory;
  const hasCamelCase = 'memoryType' in retrievedMemory;

  logResult({
    test: 'Memory is transformed to camelCase format',
    passed: hasCamelCase && !hasSnakeCase,
    expected: 'Field: memoryType (camelCase)',
    actual: hasCamelCase ? 'Field: memoryType ✓' : hasSnakeCase ? 'Field: memory_type (not transformed!)' : 'Field missing',
    details: `Available fields: ${Object.keys(retrievedMemory).join(', ')}`,
  });

  // Test 2b: Check memory type value
  log('\n=== TEST 2b: Memory Type Integrity ===');
  const actualType = retrievedMemory.memory_type || retrievedMemory.memoryType;
  logResult({
    test: 'Memory type is preserved correctly',
    passed: actualType === 'episodic',
    expected: 'episodic',
    actual: actualType,
  });

  // Test 2c: Check metadata preservation
  log('\n=== TEST 2c: Metadata Preservation ===');
  const metadataField = retrievedMemory.metadata;
  logResult({
    test: 'Metadata is not null',
    passed: metadataField !== null,
    expected: 'non-null value',
    actual: metadataField,
  });

  // Test 2d: Check created_at field
  log('\n=== TEST 2d: Date Field Format ===');
  const createdAtField = retrievedMemory.created_at || retrievedMemory.createdAt;
  const isValidDate = createdAtField && !isNaN(new Date(createdAtField).getTime());
  logResult({
    test: 'created_at field is valid date',
    passed: isValidDate,
    expected: 'Valid ISO date string',
    actual: createdAtField,
  });

  // Test 3: Simulate MCP server's display formatting (from simple-mcp-server.ts line 397-398)
  log('\n=== TEST 3: MCP Server Display Formatting ===');

  // This is the EXACT code from simple-mcp-server.ts line 397-398
  const mcpDisplayType = retrievedMemory.memoryType || 'semantic';
  const mcpDisplayCreated = new Date(retrievedMemory.createdAt).toLocaleDateString();

  logResult({
    test: 'MCP server displays correct type',
    passed: mcpDisplayType === 'episodic',
    expected: 'episodic',
    actual: mcpDisplayType,
    details: 'MCP uses retrievedMemory.memoryType (camelCase) but DB returns memory_type (snake_case)',
  });

  logResult({
    test: 'MCP server displays valid date',
    passed: mcpDisplayCreated !== 'Invalid Date',
    expected: 'Valid date string',
    actual: mcpDisplayCreated,
    details: 'MCP uses retrievedMemory.createdAt (camelCase) but DB returns created_at (snake_case)',
  });

  // Test 4: Search memories and check formatting
  log('\n=== TEST 4: Search Memories Result Formatting ===');
  const searchResult = await memoryCore.searchMemories('episodic memory', {
    limit: 5,
    threshold: 0.3,
  });

  if (searchResult.status === MCPToolResultStatus.SUCCESS && searchResult.data) {
    const memories = searchResult.data as any[];
    if (memories.length > 0) {
      const firstMemory = memories[0];
      log(`First search result structure:`);
      log(JSON.stringify(firstMemory, null, 2));

      const searchDisplayType = firstMemory.memoryType || 'semantic';
      const searchDisplayCreated = new Date(firstMemory.createdAt).toLocaleDateString();

      logResult({
        test: 'Search results display correct type',
        passed: searchDisplayType === 'episodic',
        expected: 'episodic',
        actual: searchDisplayType,
        details: `Available fields: ${Object.keys(firstMemory).join(', ')}`,
      });

      logResult({
        test: 'Search results display valid date',
        passed: searchDisplayCreated !== 'Invalid Date',
        expected: 'Valid date string',
        actual: searchDisplayCreated,
      });
    }
  }

  // Test 5: Check importance field
  log('\n=== TEST 5: Importance Value Format ===');
  const importanceValue = retrievedMemory.importance;
  logResult({
    test: 'Importance is a decimal (0-1)',
    passed: typeof importanceValue === 'number' && importanceValue >= 0 && importanceValue <= 1,
    expected: '0.8 (decimal between 0-1)',
    actual: importanceValue,
    details: `Type: ${typeof importanceValue}`,
  });

  // Summary
  log('\n\n=== TEST SUMMARY ===');
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  log(`Total tests: ${results.length}`);
  log(`Passed: ${passed}`);
  log(`Failed: ${failed}`);

  if (failed > 0) {
    log('\n❌ FAILURE: Some tests failed!');
    log('\nPlease review the failed tests above for details.');
  } else {
    log('\n✅ SUCCESS: All tests passed!');
    log('\nThe data transformation is working correctly:');
    log('- Database snake_case fields are properly transformed to camelCase');
    log('- Memory types are preserved correctly');
    log('- Dates are formatted properly');
    log('- Metadata is preserved');
    log('- Importance values maintain decimal format (0-1)');
  }

  // Cleanup
  await memoryCore.deleteMemory(storedMemoryId);
  log('\n✅ Test memory deleted');

  process.exit(failed > 0 ? 1 : 0);
}

// Run the test
testMCPProtocol().catch(error => {
  console.error('Test failed with error:', error);
  process.exit(1);
});