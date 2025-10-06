#!/bin/bash

# MCP Memory Web Interface Setup Script
# This script automates the setup process for the Next.js web interface

set -e

echo "========================================="
echo "MCP Memory Web Interface Setup"
echo "========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}Error: Must be run from the project root directory${NC}"
    exit 1
fi

# Check if web directory exists
if [ ! -d "web" ]; then
    echo -e "${RED}Error: web directory not found${NC}"
    exit 1
fi

echo "Step 1: Installing web dependencies..."
echo ""
cd web
npm install
cd ..
echo -e "${GREEN}✓ Dependencies installed${NC}"
echo ""

# Check if .env.local exists
if [ ! -f "web/.env.local" ]; then
    echo "Step 2: Creating .env.local template..."
    echo ""

    # Generate random secret
    SECRET=$(openssl rand -base64 32)

    cat > web/.env.local << EOF
# Database (from parent project)
TURSO_URL=${TURSO_URL:-libsql://your-database.turso.io}
TURSO_AUTH_TOKEN=${TURSO_AUTH_TOKEN:-your-auth-token}

# OpenAI
OPENAI_API_KEY=${OPENAI_API_KEY:-your-openai-api-key}

# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=${SECRET}

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
EOF

    echo -e "${GREEN}✓ Created web/.env.local with random NEXTAUTH_SECRET${NC}"
    echo -e "${YELLOW}⚠ You must configure Google OAuth credentials manually${NC}"
    echo ""
else
    echo "Step 2: .env.local already exists, skipping..."
    echo ""
fi

echo "Step 3: Running type check..."
echo ""
cd web
if npm run type-check; then
    echo -e "${GREEN}✓ Type check passed${NC}"
else
    echo -e "${YELLOW}⚠ Type check warnings (non-fatal)${NC}"
fi
cd ..
echo ""

echo "========================================="
echo -e "${GREEN}Setup Complete!${NC}"
echo "========================================="
echo ""
echo "Next steps:"
echo ""
echo "1. Configure Google OAuth:"
echo "   - Go to: https://console.cloud.google.com/"
echo "   - Create OAuth 2.0 credentials"
echo "   - Add redirect URI: http://localhost:3000/api/auth/callback/google"
echo "   - Update GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in web/.env.local"
echo ""
echo "2. Verify database credentials in web/.env.local"
echo ""
echo "3. Start development server:"
echo "   cd web && npm run dev"
echo "   OR"
echo "   npm run web:dev"
echo ""
echo "4. Open http://localhost:3000 in your browser"
echo ""
echo "For detailed setup instructions, see:"
echo "   web/SETUP.md"
echo "   WEB_INTERFACE.md"
echo ""
