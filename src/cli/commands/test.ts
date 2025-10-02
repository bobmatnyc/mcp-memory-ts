/**
 * Test command - Verify MCP Memory installation and connectivity
 */

import { DatabaseConnection } from '../../database/connection.js';
import { DatabaseOperations } from '../../database/operations.js';
import { MemoryCore } from '../../core/memory-core.js';
import { MemoryType, ImportanceLevel } from '../../types/enums.js';
import { createMemory } from '../../models/index.js';
import { loadUserConfig } from '../claude-desktop.js';
import OpenAI from 'openai';
import { colors, icons, success, error, warning, info, section } from '../colors.js';

interface TestResult {
  name: string;
  passed: boolean;
  message?: string;
  optional?: boolean;
}

interface TestOptions {
  verbose?: boolean;
}

/**
 * Run a single test with error handling
 */
async function runTest(
  name: string,
  testFn: () => Promise<void>,
  optional: boolean = false
): Promise<TestResult> {
  try {
    await testFn();
    return { name, passed: true, optional };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { name, passed: false, message, optional };
  }
}

/**
 * Test database connectivity
 */
async function testDatabaseConnection(
  dbUrl: string,
  authToken: string
): Promise<DatabaseConnection> {
  const db = new DatabaseConnection({
    url: dbUrl,
    authToken,
  });
  await db.connect();
  // Test a simple query
  await db.execute('SELECT 1');
  return db;
}

/**
 * Test OpenAI API connectivity
 */
async function testOpenAIConnection(apiKey: string): Promise<void> {
  const openai = new OpenAI({ apiKey });
  // Try to list models (lightweight operation)
  await openai.models.list();
}

/**
 * Test memory operations (not used in current implementation)
 */
async function testMemoryOperations(
  memoryCore: MemoryCore,
  userEmail: string
): Promise<void> {
  // This function is kept for future use but not currently called
  throw new Error('Not implemented');
}

/**
 * Run all tests and display results
 */
export async function runTests(options: TestOptions = {}): Promise<boolean> {
  console.log(colors.title(`\n${icons.magnify} Testing MCP Memory Installation...\n`));

  const results: TestResult[] = [];
  let db: DatabaseConnection | undefined = undefined;
  let memoryCore: MemoryCore | null = null;

  try {
    // Test 1: Load configuration
    const configResult = await runTest('Configuration loaded', async () => {
      const config = loadUserConfig();
      if (!config) {
        throw new Error('No configuration found. Run "mcp-memory init" first.');
      }
    });
    results.push(configResult);
    console.log(configResult.passed ? success(configResult.name) : error(configResult.name));
    if (!configResult.passed) {
      if (configResult.message) console.log(`   ${colors.dim(configResult.message)}`);
      throw new Error('Configuration test failed');
    }

    // Load config for remaining tests
    const config = loadUserConfig()!;

    // Test 2: Database connection
    const dbResult = await runTest('Database connection established', async () => {
      db = await testDatabaseConnection(config.tursoUrl, config.tursoAuthToken);
    });
    results.push(dbResult);
    console.log(dbResult.passed ? success(dbResult.name) : error(dbResult.name));
    if (!dbResult.passed) {
      if (dbResult.message) console.log(`   ${colors.dim(dbResult.message)}`);
      throw new Error('Database connection test failed');
    }

    // Test 3: OpenAI API key validation (optional)
    if (config.openaiApiKey) {
      const openaiResult = await runTest(
        'OpenAI API key valid',
        async () => {
          await testOpenAIConnection(config.openaiApiKey);
        },
        true
      );
      results.push(openaiResult);
      console.log(openaiResult.passed ? success(openaiResult.name) : warning(openaiResult.name));
      if (!openaiResult.passed && openaiResult.message) {
        console.log(`   ${colors.dim(openaiResult.message)}`);
      }
    } else {
      const skipped: TestResult = {
        name: 'OpenAI API key valid',
        passed: false,
        optional: true,
        message: 'Skipped (no API key configured)',
      };
      results.push(skipped);
      console.log(warning(skipped.name));
      console.log(`   ${colors.dim(skipped.message!)}`);
    }

    // Initialize MemoryCore for remaining tests
    if (db) {
      memoryCore = new MemoryCore(db, config.openaiApiKey, {
        autoUpdateEmbeddings: false, // Disable for tests
      });
      await memoryCore.initialize();
    }

    // Test 4: Create test memory
    const createResult = await runTest('Created test memory', async () => {
      if (!memoryCore) {
        throw new Error('MemoryCore not initialized');
      }

      const result = await memoryCore.addMemory(
        'Test Memory - CLI Verification',
        'This is a test memory created by the MCP Memory CLI verification tool',
        MemoryType.MEMORY,
        {
          userId: config.userEmail,
          importance: ImportanceLevel.LOW,
          metadata: {
            test: true,
            timestamp: new Date().toISOString(),
          },
          tags: ['test', 'cli-verification'],
          generateEmbedding: false, // Skip embedding for faster tests
        }
      );

      if (result.status !== 'success') {
        throw new Error(`Failed to create test memory: ${result.message}`);
      }
    });
    results.push(createResult);
    console.log(createResult.passed ? success(createResult.name) : error(createResult.name));
    if (!createResult.passed && createResult.message) {
      console.log(`   ${colors.dim(createResult.message)}`);
    }

    // Test 5: Search functionality
    if (createResult.passed) {
      const searchResult = await runTest('Search functionality working', async () => {
        if (!memoryCore) {
          throw new Error('MemoryCore not initialized');
        }
        const result = await memoryCore.searchMemories('CLI verification', {
          limit: 10,
          strategy: 'composite',
          userId: config.userEmail,
        });

        if (result.status !== 'success') {
          throw new Error(`Search failed: ${result.message}`);
        }

        // The data should be an array of Memory objects
        const memories = Array.isArray(result.data) ? result.data : [];
        const foundTestMemory = memories.some((m: any) => m.tags?.includes('cli-verification'));

        if (!foundTestMemory) {
          throw new Error('Test memory not found in search results');
        }
      });
      results.push(searchResult);
      console.log(searchResult.passed ? success(searchResult.name) : error(searchResult.name));
      if (!searchResult.passed && searchResult.message) {
        console.log(`   ${colors.dim(searchResult.message)}`);
      }
    }

    // Test 6: Cleanup
    const cleanupResult = await runTest('Cleanup completed', async () => {
      if (!memoryCore) {
        throw new Error('MemoryCore not initialized');
      }

      // Find and delete all test memories
      const result = await memoryCore.searchMemories('CLI verification', {
        limit: 100,
        strategy: 'composite',
        userId: config.userEmail,
      });

      if (result.status === 'success' && Array.isArray(result.data)) {
        for (const memory of result.data) {
          if ((memory as any).tags?.includes('cli-verification')) {
            await memoryCore.deleteMemory((memory as any).id, { userId: config.userEmail });
          }
        }
      }
    });
    results.push(cleanupResult);
    console.log(cleanupResult.passed ? success(cleanupResult.name) : error(cleanupResult.name));
    if (!cleanupResult.passed && cleanupResult.message) {
      console.log(`   ${colors.dim(cleanupResult.message)}`);
    }

    // Calculate pass rate
    const requiredTests = results.filter(r => !r.optional);
    const passedRequired = requiredTests.filter(r => r.passed).length;
    const totalRequired = requiredTests.length;

    const optionalTests = results.filter(r => r.optional);
    const passedOptional = optionalTests.filter(r => r.passed).length;
    const totalOptional = optionalTests.length;

    console.log('');

    if (passedRequired === totalRequired) {
      console.log(
        colors.success(
          `${icons.success} All tests passed! Your installation is working correctly.`
        )
      );
      if (totalOptional > 0) {
        console.log(
          colors.dim(
            `   Optional tests: ${passedOptional}/${totalOptional} passed${passedOptional < totalOptional ? ' (non-critical)' : ''}`
          )
        );
      }
      console.log('');
      return true;
    } else {
      console.log(
        colors.error(
          `${icons.error} Some tests failed. Required: ${passedRequired}/${totalRequired} passed`
        )
      );
      if (totalOptional > 0) {
        console.log(colors.dim(`   Optional: ${passedOptional}/${totalOptional} passed`));
      }
      console.log('');
      console.log(section(`${icons.bulb} Troubleshooting tips:`));
      console.log(`   1. Verify your configuration: ${colors.command('mcp-memory config')}`);
      console.log(`   2. Check database connectivity and credentials`);
      console.log(`   3. Ensure the database schema is up to date`);
      console.log(`   4. Review the error messages above for specific issues`);
      console.log('');
      return false;
    }
  } catch (err) {
    console.log('');
    console.log(
      colors.error(`${icons.error} Testing aborted: ${err instanceof Error ? err.message : err}`)
    );
    console.log('');
    console.log(section(`${icons.bulb} Next steps:`));
    console.log(`   1. Run ${colors.command('mcp-memory init')} to set up configuration`);
    console.log(`   2. Verify your credentials are correct`);
    console.log(`   3. Check database connectivity`);
    console.log('');
    return false;
  } finally {
    // Cleanup connections
    if (db && typeof (db as any).disconnect === 'function') {
      try {
        await (db as DatabaseConnection).disconnect();
      } catch (err) {
        // Ignore cleanup errors
      }
    }
  }
}
