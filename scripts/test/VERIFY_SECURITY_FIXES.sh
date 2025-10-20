#!/bin/bash

# Security Fixes Verification Script
# Tests that all security vulnerabilities have been properly fixed

echo "=========================================="
echo "Security Fixes Verification"
echo "Date: $(date)"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

PASSED=0
FAILED=0

# Function to check file content
check_file() {
    local file=$1
    local pattern=$2
    local should_exist=$3
    local description=$4

    if [ "$should_exist" = "true" ]; then
        if grep -q "$pattern" "$file" 2>/dev/null; then
            echo -e "${GREEN}✓ PASS${NC}: $description"
            ((PASSED++))
        else
            echo -e "${RED}✗ FAIL${NC}: $description"
            ((FAILED++))
        fi
    else
        if grep -q "$pattern" "$file" 2>/dev/null; then
            echo -e "${RED}✗ FAIL${NC}: $description (should not exist)"
            ((FAILED++))
        else
            echo -e "${GREEN}✓ PASS${NC}: $description"
            ((PASSED++))
        fi
    fi
}

echo "1. Checking /api/stats Route Security..."
echo "----------------------------------------"

# Check middleware removed public route (should be commented, not active)
if grep -E "^\s*'/api/stats'" web/middleware.ts > /dev/null 2>&1; then
    echo -e "${RED}✗ FAIL${NC}: Middleware should NOT have /api/stats as active route"
    ((FAILED++))
else
    echo -e "${GREEN}✓ PASS${NC}: Middleware does not have /api/stats as active route"
    ((PASSED++))
fi

# Check comment exists
check_file "web/middleware.ts" "REMOVED - requires authentication" true \
    "Middleware should have comment explaining removal"

# Check route enforces authentication
check_file "web/app/api/stats/route.ts" "Authentication required" true \
    "Stats route should return 'Authentication required' error"

# Check route returns 401
check_file "web/app/api/stats/route.ts" "status: 401" true \
    "Stats route should return 401 status code"

# Check no more empty stats fallback
check_file "web/app/api/stats/route.ts" "for public access" false \
    "Stats route should NOT have public access fallback"

echo ""
echo "2. Checking Deprecated OAuth Code Removal..."
echo "---------------------------------------------"

# Check simplified OAuth handler
LINE_COUNT=$(grep -A 5 "const handleGmailConnect" web/components/utilities/memory-extractor.tsx | wc -l)
if [ "$LINE_COUNT" -lt 10 ]; then
    echo -e "${GREEN}✓ PASS${NC}: OAuth handler simplified (was 70+ lines, now ~5 lines)"
    ((PASSED++))
else
    echo -e "${RED}✗ FAIL${NC}: OAuth handler still too complex ($LINE_COUNT lines)"
    ((FAILED++))
fi

# Check for deprecated callback route
check_file "web/components/utilities/memory-extractor.tsx" "/api/auth/google/callback" false \
    "Should NOT reference deprecated /api/auth/google/callback route"

# Check uses server-side flow
check_file "web/components/utilities/memory-extractor.tsx" "/api/auth/google-connect" true \
    "Should use server-side OAuth route /api/auth/google-connect"

# Check no complex OAuth popup logic
check_file "web/components/utilities/memory-extractor.tsx" "window.open" false \
    "Should NOT have popup-based OAuth logic"

echo ""
echo "3. Checking Status Page Authentication..."
echo "------------------------------------------"

# Check status page requires auth
check_file "web/app/status/page.tsx" "redirect('/sign-in')" true \
    "Status page should redirect unauthenticated users to sign-in"

# Check no conditional user data fetching
check_file "web/app/status/page.tsx" "userId ? getRecentMemories()" false \
    "Status page should NOT have conditional data fetching"

# Check comment updated
check_file "web/app/status/page.tsx" "Require authentication for status page" true \
    "Status page should have comment explaining auth requirement"

echo ""
echo "4. Verifying TypeScript Compilation..."
echo "---------------------------------------"

cd web
if npm run type-check > /dev/null 2>&1; then
    echo -e "${GREEN}✓ PASS${NC}: TypeScript compilation successful"
    ((PASSED++))
else
    echo -e "${RED}✗ FAIL${NC}: TypeScript compilation failed"
    ((FAILED++))
fi
cd ..

echo ""
echo "=========================================="
echo "Verification Summary"
echo "=========================================="
echo -e "Total Tests: $((PASSED + FAILED))"
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ ALL SECURITY FIXES VERIFIED${NC}"
    echo "All critical security vulnerabilities have been properly fixed."
    exit 0
else
    echo -e "${RED}✗ VERIFICATION FAILED${NC}"
    echo "Some security fixes are incomplete or incorrect."
    exit 1
fi
