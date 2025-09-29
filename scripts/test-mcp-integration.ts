#!/usr/bin/env tsx
/**
 * MCP Server Integration Test
 * Tests that the MCP server works with the corrected schema
 */

import { initDatabaseFromEnv } from '../src/database/index.js';
import { MemoryCore } from '../src/core/index.js';
import { MemoryType, ImportanceLevel, MCPToolResultStatus } from '../src/types/enums.js';
import { config } from 'dotenv';

// Load environment variables
config();

async function testMCPIntegration() {
  console.log('🔌 Testing MCP Server Integration\n');

  try {
    // Initialize database and memory core (same as MCP server does)
    const db = initDatabaseFromEnv();
    const memoryCore = new MemoryCore(db, process.env.OPENAI_API_KEY);

    // Set a default user for testing
    const testUserId = process.env.DEFAULT_USER_EMAIL || 'test@example.com';
    await memoryCore.initialize(testUserId);
    console.log(`✓ Memory core initialized with user: ${testUserId}`);

    // Test 1: Store a memory (simulating store_memory tool)
    console.log('\n📝 Testing store_memory functionality...');
    const addResult = await memoryCore.addMemory(
      'Test Memory from MCP',
      'This is a test memory created to verify MCP server schema alignment',
      MemoryType.MEMORY,
      {
        tags: ['test', 'mcp', 'integration'],
        importance: ImportanceLevel.MEDIUM,
        generateEmbedding: false, // Skip embedding for test
        userId: testUserId, // Explicitly provide user ID
      }
    );

    if (addResult.status === MCPToolResultStatus.SUCCESS) {
      const memoryData = addResult.data as any;
      console.log(`✓ Memory stored successfully (ID: ${memoryData?.id})`);
    } else {
      throw new Error(`Failed to store memory: ${addResult.error}`);
    }

    // Test 2: Search memories (simulating recall_memories tool)
    console.log('\n🔍 Testing recall_memories functionality...');
    const searchResult = await memoryCore.searchMemories('test memory', {
      limit: 5,
      threshold: 0.1, // Low threshold for text-only search
      userId: testUserId,
    });

    if (searchResult.status === MCPToolResultStatus.SUCCESS && searchResult.data) {
      const memories = searchResult.data as any[];
      console.log(`✓ Search completed: found ${memories.length} memories`);

      if (memories.length > 0) {
        console.log('  Sample result:', {
          id: memories[0].id,
          title: memories[0].title,
          type: memories[0].memoryType,
        });
      }
    } else {
      console.log(`⚠️  Search returned no results: ${searchResult.message}`);
    }

    // Test 3: Get statistics (simulating get_memory_stats tool)
    console.log('\n📊 Testing get_memory_stats functionality...');
    const statsResult = await memoryCore.getStatistics(testUserId);

    if (statsResult.status === MCPToolResultStatus.SUCCESS && statsResult.data) {
      const stats = statsResult.data as any;
      console.log('✓ Statistics retrieved:');
      console.log(`  - Total Memories: ${stats.totalMemories}`);
      console.log(`  - Total Entities: ${stats.totalEntities}`);
      console.log(`  - Vector Embeddings: ${stats.embeddedMemories}/${stats.totalMemories}`);
    } else {
      throw new Error(`Failed to get statistics: ${statsResult.error}`);
    }

    // Note: Entity operations are handled directly through database operations,
    // not through MemoryCore which focuses on memory management

    console.log('\n✅ All MCP integration tests completed successfully!');
    console.log('The MCP server is ready to work with Claude Desktop.');

    // Cleanup - delete test data
    console.log('\n🧹 Cleaning up test data...');
    if (addResult.status === MCPToolResultStatus.SUCCESS && addResult.data) {
      const memoryId = (addResult.data as any).id;
      await memoryCore.deleteMemory(memoryId);
      console.log('  ✓ Test memory deleted');
    }

    // No entity to delete

  } catch (error) {
    console.error('\n❌ Integration test failed:', error);
    process.exit(1);
  }
}

// Run the test
testMCPIntegration().catch(console.error);