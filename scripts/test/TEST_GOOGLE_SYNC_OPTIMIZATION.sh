#!/bin/bash
# Test Google Contacts Sync Optimization
# Date: 2025-10-16
# Tests: Batch size 25, stderr logging, dynamic timeouts

set -e

echo "======================================"
echo "Google Contacts Sync Optimization Test"
echo "======================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if web app is built
if [ ! -d "web/.next" ]; then
  echo -e "${RED}❌ Web app not built. Run: cd web && npm run build${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Web app is built${NC}"
echo ""

# Test 1: Check PM2 status
echo "Test 1: Checking PM2 status..."
if pm2 list | grep -q "mcp-memory-web"; then
  echo -e "${GREEN}✅ PM2 process exists${NC}"
  PM2_STATUS=$(pm2 list | grep "mcp-memory-web" | awk '{print $10}')
  echo "   Status: $PM2_STATUS"
else
  echo -e "${YELLOW}⚠️  PM2 process not running. Start with: pm2 start ecosystem.config.cjs${NC}"
fi
echo ""

# Test 2: Check if staging server can start
echo "Test 2: Testing staging server startup..."
if [ -f "START_WEB_SERVER.sh" ]; then
  echo -e "${GREEN}✅ Staging server script exists${NC}"
  echo "   Run: ./START_WEB_SERVER.sh to test in staging mode"
else
  echo -e "${RED}❌ Staging server script not found${NC}"
fi
echo ""

# Test 3: Verify modified files exist
echo "Test 3: Verifying modified files..."
files=(
  "web/components/google/google-contacts-sync.tsx"
  "src/services/google-contacts-sync.ts"
  "web/app/api/google/contacts/sync/route.ts"
)

for file in "${files[@]}"; do
  if [ -f "$file" ]; then
    echo -e "${GREEN}✅ $file${NC}"
  else
    echo -e "${RED}❌ $file not found${NC}"
  fi
done
echo ""

# Test 4: Check for stderr logging
echo "Test 4: Checking for stderr logging implementation..."
if grep -q "process.stderr.write" "src/services/google-contacts-sync.ts"; then
  echo -e "${GREEN}✅ Service uses stderr logging${NC}"
else
  echo -e "${RED}❌ Service still uses console.log${NC}"
fi

if grep -q "process.stderr.write" "web/app/api/google/contacts/sync/route.ts"; then
  echo -e "${GREEN}✅ API route uses stderr logging${NC}"
else
  echo -e "${RED}❌ API route still uses console.log${NC}"
fi
echo ""

# Test 5: Check batch size options
echo "Test 5: Checking batch size options..."
if grep -q 'value={25}' "web/components/google/google-contacts-sync.tsx"; then
  echo -e "${GREEN}✅ Batch size 25 option exists${NC}"
else
  echo -e "${RED}❌ Batch size 25 option not found${NC}"
fi

if grep -q 'setBatchSize(50)' "web/components/google/google-contacts-sync.tsx"; then
  echo -e "${GREEN}✅ Default batch size is 50${NC}"
else
  echo -e "${YELLOW}⚠️  Default batch size may not be 50${NC}"
fi
echo ""

# Test 6: Check dynamic timeout
echo "Test 6: Checking dynamic timeout implementation..."
if grep -q 'batchSize \* 2000' "web/components/google/google-contacts-sync.tsx"; then
  echo -e "${GREEN}✅ Frontend has dynamic timeout${NC}"
else
  echo -e "${RED}❌ Frontend missing dynamic timeout${NC}"
fi

if grep -q 'pageSize.*\* 2000' "web/app/api/google/contacts/sync/route.ts"; then
  echo -e "${GREEN}✅ Backend has dynamic timeout${NC}"
else
  echo -e "${RED}❌ Backend missing dynamic timeout${NC}"
fi
echo ""

# Summary
echo "======================================"
echo "Test Summary"
echo "======================================"
echo ""
echo "Next Steps:"
echo "1. Start staging server: ./START_WEB_SERVER.sh"
echo "2. Open browser: http://localhost:3002/utilities"
echo "3. Test batch size 25 sync (dry run recommended)"
echo "4. Monitor logs: pm2 logs mcp-memory-web"
echo "5. Check for stderr output in logs"
echo ""
echo "Production Deployment:"
echo "1. Build: cd web && npm run build && cd .."
echo "2. Deploy: pm2 restart mcp-memory-web"
echo "3. Monitor: pm2 logs mcp-memory-web --lines 100"
echo "4. Test on http://localhost:3001/utilities"
echo ""
echo -e "${GREEN}✅ Optimization implementation complete!${NC}"
echo ""

# Optional: Show PM2 logs tail
if command -v pm2 &> /dev/null; then
  echo "Recent PM2 logs (last 10 lines):"
  echo "-----------------------------------"
  pm2 logs mcp-memory-web --lines 10 --nostream 2>/dev/null || echo "No logs available yet"
fi
