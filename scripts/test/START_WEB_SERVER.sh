#!/bin/bash
# Start MCP Memory Web Server for OAuth Testing
# Usage: ./START_WEB_SERVER.sh

cd "$(dirname "$0")/web"

echo "========================================"
echo "  MCP Memory Web Server"
echo "  Port: 3002"
echo "  OAuth Testing Ready"
echo "========================================"
echo ""
echo "Starting development server..."
echo "Press Ctrl+C to stop"
echo ""

npm run dev -- -p 3002
