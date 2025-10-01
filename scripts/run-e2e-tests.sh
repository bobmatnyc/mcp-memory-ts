#!/bin/bash
# E2E Test Runner for MCP Memory Server
# Builds the project, runs E2E tests, and reports results

set -e  # Exit on error

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Project root
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}MCP Memory Server - E2E Test Runner${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Step 1: Check environment
echo -e "${YELLOW}[1/5] Checking environment...${NC}"
if [ ! -f ".env" ] && [ ! -f ".env.local" ]; then
  echo -e "${RED}ERROR: No .env or .env.local file found${NC}"
  echo "Please create .env file with required variables:"
  echo "  - TURSO_URL"
  echo "  - TURSO_AUTH_TOKEN"
  echo "  - OPENAI_API_KEY"
  exit 1
fi

# Check Node version
NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
  echo -e "${RED}ERROR: Node.js 18 or higher required (current: $(node --version))${NC}"
  exit 1
fi

echo -e "${GREEN}✓ Environment check passed${NC}"
echo ""

# Step 2: Install dependencies if needed
echo -e "${YELLOW}[2/5] Checking dependencies...${NC}"
if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  npm install
else
  echo -e "${GREEN}✓ Dependencies already installed${NC}"
fi
echo ""

# Step 3: Build the project
echo -e "${YELLOW}[3/5] Building project...${NC}"
npm run build

if [ ! -f "dist/simple-mcp-server.js" ]; then
  echo -e "${RED}ERROR: Build failed - dist/simple-mcp-server.js not found${NC}"
  exit 1
fi

echo -e "${GREEN}✓ Build completed${NC}"
echo ""

# Step 4: Run E2E tests
echo -e "${YELLOW}[4/5] Running E2E tests...${NC}"
echo ""

# Set test environment variables
export NODE_ENV=test
export MCP_DEBUG=0

# Run E2E tests with vitest
TEST_EXIT_CODE=0
npx vitest run tests/e2e/ --reporter=verbose || TEST_EXIT_CODE=$?

echo ""

# Step 5: Generate report
echo -e "${YELLOW}[5/5] Test Summary${NC}"
echo -e "${BLUE}========================================${NC}"

if [ $TEST_EXIT_CODE -eq 0 ]; then
  echo -e "${GREEN}✓ All E2E tests passed successfully!${NC}"
  echo ""
  echo "Test coverage:"
  echo "  • Server lifecycle tests"
  echo "  • JSON-RPC protocol compliance"
  echo "  • Tool execution (store, recall, get, update, delete)"
  echo "  • Error handling"
  echo "  • Integration workflows"
  echo "  • Performance & stability"
  echo ""
  echo -e "${GREEN}Ready for deployment! ✓${NC}"
else
  echo -e "${RED}✗ Some E2E tests failed${NC}"
  echo ""
  echo "Please review the test output above and fix failing tests."
  echo ""
  echo "Common issues:"
  echo "  • Database connection problems (check TURSO_URL and TURSO_AUTH_TOKEN)"
  echo "  • OpenAI API issues (check OPENAI_API_KEY)"
  echo "  • Server startup timeout (may need to increase timeout)"
  echo ""
fi

echo -e "${BLUE}========================================${NC}"

# Exit with test status
exit $TEST_EXIT_CODE
