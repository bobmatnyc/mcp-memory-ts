#!/bin/bash
# E2E Setup Verification Script
# Verifies that all E2E test components are properly configured

set -e

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "========================================="
echo "E2E Test Setup Verification"
echo "========================================="
echo ""

# Check 1: Build artifacts
echo -n "Checking build artifacts... "
if [ -f "dist/simple-mcp-server.js" ]; then
  echo -e "${GREEN}✓${NC}"
else
  echo -e "${RED}✗ Missing dist/simple-mcp-server.js${NC}"
  exit 1
fi

# Check 2: Test files
echo -n "Checking E2E test files... "
if [ -f "tests/e2e/mcp-server.e2e.test.ts" ] && [ -f "tests/e2e/regression.test.ts" ]; then
  echo -e "${GREEN}✓${NC}"
else
  echo -e "${RED}✗ Missing E2E test files${NC}"
  exit 1
fi

# Check 3: Test runner script
echo -n "Checking test runner script... "
if [ -x "scripts/run-e2e-tests.sh" ]; then
  echo -e "${GREEN}✓${NC}"
else
  echo -e "${RED}✗ Missing or non-executable run-e2e-tests.sh${NC}"
  exit 1
fi

# Check 4: Documentation
echo -n "Checking documentation... "
if [ -f "docs/TESTING.md" ]; then
  echo -e "${GREEN}✓${NC}"
else
  echo -e "${RED}✗ Missing docs/TESTING.md${NC}"
  exit 1
fi

# Check 5: Environment variables
echo -n "Checking environment variables... "
if [ -f ".env" ] || [ -f ".env.local" ]; then
  if grep -q "DEFAULT_USER_EMAIL" .env 2>/dev/null || grep -q "DEFAULT_USER_EMAIL" .env.local 2>/dev/null; then
    echo -e "${GREEN}✓${NC}"
  else
    echo -e "${YELLOW}⚠ DEFAULT_USER_EMAIL not set in .env${NC}"
  fi
else
  echo -e "${RED}✗ No .env file found${NC}"
  exit 1
fi

# Check 6: Claude Desktop config
echo -n "Checking Claude Desktop config... "
CLAUDE_CONFIG="$HOME/Library/Application Support/Claude/claude_desktop_config.json"
if [ -f "$CLAUDE_CONFIG" ]; then
  if grep -q "memory-ts" "$CLAUDE_CONFIG"; then
    if grep -q '"command": "node"' "$CLAUDE_CONFIG"; then
      echo -e "${GREEN}✓${NC}"
    else
      echo -e "${YELLOW}⚠ Not using direct node execution${NC}"
    fi
  else
    echo -e "${YELLOW}⚠ memory-ts not configured${NC}"
  fi
else
  echo -e "${YELLOW}⚠ Claude Desktop config not found${NC}"
fi

# Check 7: npm scripts
echo -n "Checking npm scripts... "
if grep -q "test:e2e" package.json; then
  echo -e "${GREEN}✓${NC}"
else
  echo -e "${RED}✗ test:e2e script not found${NC}"
  exit 1
fi

echo ""
echo "========================================="
echo -e "${GREEN}All checks passed!${NC}"
echo "========================================="
echo ""
echo "You can now:"
echo "  • Run E2E tests: npm run test:e2e"
echo "  • Run regression tests: npx vitest run tests/e2e/regression.test.ts"
echo "  • Restart Claude Desktop to load new config"
echo ""
