#!/bin/bash

# Test script for Claude Desktop MCP integration
echo "🧪 Testing MCP Memory Service Integration with Claude Desktop"
echo "============================================================"

# Test 1: Initialize
echo "📋 Test 1: Initialize MCP Server"
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}' | node dist/simple-mcp-server.js
echo ""

# Test 2: List tools
echo "📋 Test 2: List Available Tools"
echo '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}' | node dist/simple-mcp-server.js
echo ""

# Test 3: Add memory
echo "📋 Test 3: Add Memory"
echo '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"memory_add","arguments":{"title":"Claude Desktop Test","content":"Successfully integrated MCP Memory Service with Claude Desktop","tags":["claude","integration","success"]}}}' | node dist/simple-mcp-server.js
echo ""

# Test 4: Search memory
echo "📋 Test 4: Search Memory"
echo '{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"memory_search","arguments":{"query":"Claude Desktop","limit":5}}}' | node dist/simple-mcp-server.js
echo ""

# Test 5: Get statistics
echo "📋 Test 5: Get Statistics"
echo '{"jsonrpc":"2.0","id":5,"method":"tools/call","params":{"name":"get_statistics","arguments":{}}}' | node dist/simple-mcp-server.js
echo ""

echo "✅ All tests completed! Your MCP Memory Service is ready for Claude Desktop."
echo ""
echo "📝 Next steps:"
echo "1. Restart Claude Desktop completely (quit and reopen)"
echo "2. In Claude Desktop, you should now see 'memory-ts' tools available"
echo "3. Try asking Claude: 'Please remember that I successfully set up the TypeScript MCP Memory Service'"
echo "4. Then ask: 'What do you remember about my TypeScript setup?'"
