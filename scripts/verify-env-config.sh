#!/bin/bash

# Environment Configuration Verification Script
# Checks that all required environment variables are properly configured

set -e

echo "🔍 Verifying Environment Configuration..."
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check functions
check_file() {
    local file=$1
    if [ -f "$file" ]; then
        echo -e "${GREEN}✓${NC} $file exists"
        return 0
    else
        echo -e "${RED}✗${NC} $file missing"
        return 1
    fi
}

check_env_var() {
    local var=$1
    local file=$2
    if grep -q "^${var}=" "$file" 2>/dev/null; then
        local value=$(grep "^${var}=" "$file" | cut -d'=' -f2-)
        if [ -n "$value" ] && [ "$value" != "your-"* ]; then
            echo -e "${GREEN}✓${NC} $var is set"
            return 0
        else
            echo -e "${YELLOW}⚠${NC}  $var has placeholder value"
            return 1
        fi
    else
        echo -e "${RED}✗${NC} $var not found"
        return 1
    fi
}

# Check environment files
echo "📄 Checking Environment Files:"
check_file ".env.example" || true
check_file ".env.development" || true
check_file ".env.production" || true
echo ""

# Check .gitignore
echo "🔒 Checking .gitignore:"
if grep -q "^\.env$" .gitignore && grep -q "^\.env\.\*$" .gitignore; then
    echo -e "${GREEN}✓${NC} .env files are gitignored"
else
    echo -e "${RED}✗${NC} .env files may not be properly gitignored"
fi
echo ""

# Check development environment
if [ -f ".env.development" ]; then
    echo "🔧 Checking Development Environment (.env.development):"
    
    REQUIRED_VARS=(
        "TURSO_URL"
        "TURSO_AUTH_TOKEN"
        "OPENAI_API_KEY"
        "CLERK_SECRET_KEY"
        "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"
        "NODE_ENV"
        "LOG_LEVEL"
        "REMOTE_MCP_PORT"
        "CORS_ORIGIN"
    )
    
    dev_ok=0
    for var in "${REQUIRED_VARS[@]}"; do
        check_env_var "$var" ".env.development" || dev_ok=1
    done
    
    if [ $dev_ok -eq 0 ]; then
        echo -e "${GREEN}✓${NC} Development environment is properly configured"
    else
        echo -e "${YELLOW}⚠${NC}  Development environment has issues"
    fi
    echo ""
fi

# Check production environment
if [ -f ".env.production" ]; then
    echo "🚀 Checking Production Environment (.env.production):"
    
    REQUIRED_VARS=(
        "TURSO_URL"
        "TURSO_AUTH_TOKEN"
        "OPENAI_API_KEY"
        "CLERK_SECRET_KEY"
        "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"
        "NODE_ENV"
        "LOG_LEVEL"
        "CORS_ORIGIN"
        "ALLOWED_ORIGINS"
        "RATE_LIMIT_REQUESTS_PER_MINUTE"
    )
    
    prod_ok=0
    for var in "${REQUIRED_VARS[@]}"; do
        check_env_var "$var" ".env.production" || prod_ok=1
    done
    
    # Check security settings
    echo ""
    echo "🔐 Checking Production Security Settings:"
    
    if grep -q "^ALLOW_DEV_AUTH=false" ".env.production"; then
        echo -e "${GREEN}✓${NC} ALLOW_DEV_AUTH is disabled"
    else
        echo -e "${RED}✗${NC} ALLOW_DEV_AUTH should be false in production"
        prod_ok=1
    fi
    
    if grep -q "^MCP_DEBUG=0" ".env.production"; then
        echo -e "${GREEN}✓${NC} MCP_DEBUG is disabled"
    else
        echo -e "${YELLOW}⚠${NC}  MCP_DEBUG should be 0 in production"
    fi
    
    if grep -q "^ENABLE_DEBUG_ENDPOINTS=false" ".env.production"; then
        echo -e "${GREEN}✓${NC} Debug endpoints are disabled"
    else
        echo -e "${YELLOW}⚠${NC}  Debug endpoints should be disabled in production"
    fi
    
    # Check CORS is not permissive
    if grep -q "^CORS_ORIGIN=\*" ".env.production"; then
        echo -e "${RED}✗${NC} CORS_ORIGIN should not be '*' in production"
        prod_ok=1
    else
        echo -e "${GREEN}✓${NC} CORS_ORIGIN is restricted"
    fi
    
    echo ""
    if [ $prod_ok -eq 0 ]; then
        echo -e "${GREEN}✓${NC} Production environment is properly configured"
    else
        echo -e "${RED}✗${NC} Production environment has issues"
    fi
    echo ""
fi

# Check Vercel configuration
echo "☁️  Checking Vercel Configuration:"
if [ -f "vercel.json" ]; then
    echo -e "${GREEN}✓${NC} vercel.json exists"
    
    # Check for security headers
    if grep -q "X-Content-Type-Options" vercel.json; then
        echo -e "${GREEN}✓${NC} Security headers configured"
    else
        echo -e "${YELLOW}⚠${NC}  Security headers may be missing"
    fi
    
    # Check for CORS headers
    if grep -q "Access-Control-Allow-Origin" vercel.json; then
        echo -e "${GREEN}✓${NC} CORS headers configured"
    else
        echo -e "${YELLOW}⚠${NC}  CORS headers may be missing"
    fi
else
    echo -e "${RED}✗${NC} vercel.json missing"
fi
echo ""

# Check middleware
echo "🛡️  Checking Middleware:"
if [ -f "src/middleware/mcp-auth.ts" ]; then
    echo -e "${GREEN}✓${NC} Authentication middleware exists"
else
    echo -e "${RED}✗${NC} Authentication middleware missing"
fi

if [ -f "src/middleware/rate-limiter.ts" ]; then
    echo -e "${GREEN}✓${NC} Rate limiter middleware exists"
else
    echo -e "${YELLOW}⚠${NC}  Rate limiter middleware missing"
fi
echo ""

# Check documentation
echo "📚 Checking Documentation:"
check_file "DEPLOYMENT.md" || true
check_file "VERCEL_ENV_SETUP.md" || true
check_file "CONFIGURATION_SUMMARY.md" || true
echo ""

# Final summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📊 Configuration Verification Complete!"
echo ""
echo "Next steps:"
echo "1. Review any warnings or errors above"
echo "2. Update missing or placeholder values"
echo "3. For production deployment:"
echo "   - Run: npm run setup:vercel"
echo "   - Run: npm run deploy:vercel production"
echo "4. Configure Clerk webhook in dashboard"
echo ""
echo "📖 See DEPLOYMENT.md for detailed instructions"
echo ""
