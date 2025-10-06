#!/usr/bin/env node
/**
 * Test MCP server search functionality end-to-end
 */

import { SimpleMCPServer } from '../src/desktop-mcp-server.js';

async function testMCPSearch() {
  console.log('=== MCP SERVER SEARCH TEST ===\n');

  const server = new SimpleMCPServer();
  await server.initialize();

  try {
    // Simulate MCP tool call for search
    const searchRequest = {
      name: 'search_memories',
      arguments: {
        query: 'memory system test',
        limit: 5
      }
    };

    console.log('Testing multi-word search via MCP tool...');
    console.log('Query:', searchRequest.arguments.query);

    const result = await server.handleToolCall(searchRequest);

    if (result.isError) {
      console.error('✗ FAIL: Search returned error:', result.content);
      process.exit(1);
    }

    const data = JSON.parse(result.content[0].text);
    console.log(`✓ PASS: Found ${data.count} results`);

    if (data.memories && data.memories.length > 0) {
      console.log('\nSample result:');
      const memory = data.memories[0];
      console.log(`  Title: ${memory.title}`);
      console.log(`  Type: ${memory.memoryType}`);
      console.log(`  Content: ${memory.content.substring(0, 80)}...`);
    }

    console.log('\n✓ MCP server search working correctly!');

  } catch (error) {
    console.error('✗ FAIL: Error testing MCP search:', error);
    process.exit(1);
  }
}

testMCPSearch().catch(console.error);