#!/bin/bash
#
# Start Remote MCP Server with PM2
#
# This script deploys the remote MCP server on port 3003 as a production service.
# The server provides HTTP-based MCP protocol access with authentication.
#
# Usage:
#   ./scripts/start-remote-mcp.sh
#

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== Remote MCP Server Deployment ===${NC}"
echo ""

# Check if we're in the project root
if [ ! -f "package.json" ]; then
  echo -e "${RED}Error: Must run from project root directory${NC}"
  exit 1
fi

# Check if dist exists, build if needed
if [ ! -d "dist" ]; then
  echo -e "${YELLOW}Build not found. Building project...${NC}"
  npm run build
  echo ""
fi

# Ensure logs directory exists
if [ ! -d "logs" ]; then
  echo -e "${YELLOW}Creating logs directory...${NC}"
  mkdir -p logs
  echo ""
fi

# Check if PM2 is installed
if ! command -v pm2 &> /dev/null; then
  echo -e "${RED}Error: PM2 is not installed. Install with: npm install -g pm2${NC}"
  exit 1
fi

# Check if remote MCP server is already running
if pm2 list | grep -q "mcp-memory-remote"; then
  echo -e "${YELLOW}Remote MCP server is already running. Restarting...${NC}"
  pm2 restart ecosystem.remote-mcp.config.cjs
else
  echo -e "${GREEN}Starting remote MCP server on port 3003...${NC}"
  pm2 start ecosystem.remote-mcp.config.cjs
fi

echo ""
echo -e "${GREEN}=== PM2 Status ===${NC}"
pm2 list

echo ""
echo -e "${GREEN}=== Recent Logs ===${NC}"
pm2 logs mcp-memory-remote --lines 10 --nostream

echo ""
echo -e "${GREEN}=== Health Check ===${NC}"
echo "Waiting 3 seconds for server to start..."
sleep 3

# Test health endpoint
echo -e "${YELLOW}Testing health endpoint...${NC}"
HEALTH_RESPONSE=$(curl -s http://localhost:3003/health || echo "Failed to connect")

if echo "$HEALTH_RESPONSE" | grep -q "ok"; then
  echo -e "${GREEN}✓ Health check passed${NC}"
  echo "$HEALTH_RESPONSE" | jq . 2>/dev/null || echo "$HEALTH_RESPONSE"
else
  echo -e "${RED}✗ Health check failed${NC}"
  echo "$HEALTH_RESPONSE"
fi

echo ""
echo -e "${GREEN}=== Deployment Complete ===${NC}"
echo ""
echo "Server is running on: http://localhost:3003"
echo ""
echo "Useful commands:"
echo "  pm2 logs mcp-memory-remote         - View logs"
echo "  pm2 restart mcp-memory-remote      - Restart server"
echo "  pm2 stop mcp-memory-remote         - Stop server"
echo "  curl http://localhost:3003/health  - Health check"
echo ""
echo "Test MCP endpoint:"
echo "  curl -X POST http://localhost:3003/mcp \\"
echo "    -H \"Content-Type: application/json\" \\"
echo "    -d '{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"tools/list\"}'"
echo ""
