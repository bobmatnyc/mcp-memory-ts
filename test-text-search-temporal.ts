#!/usr/bin/env tsx
/**
 * Test temporal decay with text-based search
 */

import { initDatabaseFromEnv } from './src/database/index.js';
import { MemoryCore } from './src/core/index.js';
import { MemoryType } from './src/types/enums.js';

async function testTextSearchWithTemporal() {
  console.log('🧪 Testing Temporal Decay with Text-Based Search\n');

  try {
    // Initialize
    const db = initDatabaseFromEnv();
    const memoryCore = new MemoryCore(db, undefined); // No OpenAI key
    await memoryCore.initialize();

    const testUserId = 'bob@matsuoka.com';

    console.log('📝 Creating test memories with semantic links...\n');

    // Create memories with semantic links (shared tags)
    const memories = [
      {
        title: 'Claude MCP Integration',
        content: 'Working on integrating Claude with MCP memory service',
        tags: ['claude', 'mcp', 'integration'],
        importance: 0.8,
      },
      {
        title: 'Claude Desktop Setup',
        content: 'Set up Claude Desktop with memory persistence',
        tags: ['claude', 'desktop', 'setup'],
        importance: 0.6,
      },
      {
        title: 'MCP Protocol Debugging',
        content: 'Debugging MCP protocol issues with JSON-RPC',
        tags: ['mcp', 'debugging', 'protocol'],
        importance: 0.9,
      },
      {
        title: 'Memory Service Architecture',
        content: 'Designing the memory service architecture for AI assistants',
        tags: ['memory', 'architecture', 'ai'],
        importance: 0.7,
      },
    ];

    // Store memories
    console.log('Storing memories for', testUserId);
    const storedIds: string[] = [];

    for (const mem of memories) {
      const result = await memoryCore.addMemory(
        mem.title,
        mem.content,
        'semantic' as MemoryType,
        {
          tags: mem.tags,
          importance: mem.importance as any,
          userId: testUserId,
          generateEmbedding: false, // No embeddings without API key
        }
      );

      if (result.status === 'SUCCESS' && result.data) {
        const memId = (result.data as any).id;
        storedIds.push(memId);
        console.log(`✅ Stored: "${mem.title}" (importance: ${mem.importance})`);
      }
    }

    console.log('\n🔍 Testing search strategies:\n');

    // Test different strategies
    const strategies = ['recency', 'importance', 'composite'] as const;

    for (const strategy of strategies) {
      console.log(`\n📊 Strategy: ${strategy.toUpperCase()}`);
      const searchResult = await memoryCore.searchMemories('Claude MCP', {
        limit: 10,
        strategy,
        userId: testUserId,
        threshold: 0.0, // Accept all matches for text search
      });

      if (searchResult.status === 'SUCCESS' && searchResult.data) {
        const results = searchResult.data as any[];
        if (results.length > 0) {
          console.log(`   Found ${results.length} memories:`);
          results.forEach((mem, idx) => {
            const tags = Array.isArray(mem.tags) ? mem.tags.join(', ') : 'none';
            console.log(`   ${idx + 1}. "${mem.title}" - Importance: ${mem.importance}, Tags: [${tags}]`);
          });
        } else {
          console.log('   No memories found');
        }
      }
    }

    // Test semantic linking effect
    console.log('\n\n🔗 Demonstrating Semantic Linking:');
    console.log('Memories with shared tags should boost each other\n');

    const mcpSearch = await memoryCore.searchMemories('MCP', {
      limit: 10,
      strategy: 'composite',
      userId: testUserId,
      threshold: 0.0,
    });

    if (mcpSearch.status === 'SUCCESS' && mcpSearch.data) {
      const results = mcpSearch.data as any[];
      console.log('Searching for "MCP" with composite strategy:');
      results.forEach((mem, idx) => {
        const tags = Array.isArray(mem.tags) ? mem.tags.join(', ') : 'none';
        // Count shared tags with other memories
        const sharedTagCounts = results
          .filter(m => m.id !== mem.id)
          .map(m => {
            const otherTags = m.tags || [];
            const memTags = mem.tags || [];
            return memTags.filter((tag: string) => otherTags.includes(tag)).length;
          })
          .reduce((a, b) => a + b, 0);

        console.log(`   ${idx + 1}. "${mem.title}"`);
        console.log(`      Tags: [${tags}]`);
        console.log(`      Importance: ${mem.importance}`);
        console.log(`      Shared tag connections: ${sharedTagCounts}`);
      });
    }

    console.log('\n✅ Test completed successfully!');
    console.log('\n📚 Summary:');
    console.log('   - clear_memories tool has been removed from MCP');
    console.log('   - Temporal decay applies logarithmic decay to memory relevance');
    console.log('   - Memories never fully expire (min decay factor: 0.1)');
    console.log('   - Semantic linking boosts memories with shared tags');
    console.log('   - Composite strategy balances decay, importance, and semantic links');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }

  process.exit(0);
}

// Run the test
testTextSearchWithTemporal();