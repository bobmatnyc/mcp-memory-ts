#!/bin/bash

# Test Vercel Setup Script
# Verifies that all configuration files and dependencies are correct

set -e

echo "🧪 Testing Vercel deployment setup..."

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Run this script from the project root."
    exit 1
fi

echo "✅ Project root directory confirmed"

# Check required files exist
REQUIRED_FILES=(
    "vercel.json"
    "tsconfig.vercel.json"
    ".env.example"
    ".env.production"
    "api/index.ts"
    "api/middleware/cors.ts"
    "api/middleware/clerk-auth.ts"
    "api/auth/webhook.ts"
    "examples/python-client.py"
    "scripts/deploy-vercel.sh"
    "scripts/setup-vercel-env.sh"
    "DEPLOYMENT.md"
)

echo "📁 Checking required files..."
for file in "${REQUIRED_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "  ✅ $file"
    else
        echo "  ❌ $file (missing)"
        exit 1
    fi
done

# Check package.json scripts
echo "📋 Checking package.json scripts..."
REQUIRED_SCRIPTS=(
    "build:vercel"
    "deploy:vercel"
    "setup:vercel"
)

for script in "${REQUIRED_SCRIPTS[@]}"; do
    if npm run | grep -q "$script"; then
        echo "  ✅ $script"
    else
        echo "  ❌ $script (missing)"
        exit 1
    fi
done

# Check dependencies
echo "📦 Checking required dependencies..."
REQUIRED_DEPS=(
    "@vercel/node"
    "@clerk/clerk-sdk-node"
    "svix"
)

for dep in "${REQUIRED_DEPS[@]}"; do
    if npm list "$dep" &>/dev/null; then
        echo "  ✅ $dep"
    else
        echo "  ❌ $dep (missing - run npm install)"
        exit 1
    fi
done

# Test TypeScript compilation
echo "🔧 Testing TypeScript compilation..."
if npm run build:vercel &>/dev/null; then
    echo "  ✅ TypeScript compilation successful"
else
    echo "  ❌ TypeScript compilation failed"
    npm run build:vercel
    exit 1
fi

# Test linting
echo "🔍 Testing code quality..."
if npm run lint &>/dev/null; then
    echo "  ✅ Linting passed"
else
    echo "  ⚠️  Linting issues found (run npm run lint:fix)"
fi

# Check vercel.json syntax
echo "📄 Validating vercel.json..."
if python3 -m json.tool vercel.json > /dev/null 2>&1; then
    echo "  ✅ vercel.json is valid JSON"
else
    echo "  ❌ vercel.json has syntax errors"
    exit 1
fi

# Check if Vercel CLI is available
echo "🚀 Checking Vercel CLI..."
if command -v vercel &> /dev/null; then
    echo "  ✅ Vercel CLI is installed"
    VERCEL_VERSION=$(vercel --version)
    echo "  📦 Version: $VERCEL_VERSION"
else
    echo "  ⚠️  Vercel CLI not found (install with: npm install -g vercel@latest)"
fi

# Test Python client syntax
echo "🐍 Testing Python client..."
if python3 -m py_compile examples/python-client.py; then
    echo "  ✅ Python client syntax is valid"
else
    echo "  ❌ Python client has syntax errors"
    exit 1
fi

# Check environment file templates
echo "🔐 Checking environment templates..."
if grep -q "CLERK_SECRET_KEY" .env.example; then
    echo "  ✅ .env.example contains required variables"
else
    echo "  ❌ .env.example missing required variables"
    exit 1
fi

echo ""
echo "🎉 All checks passed! Your Vercel setup is ready."
echo ""
echo "📋 Next steps:"
echo "1. Set up environment variables: npm run setup:vercel"
echo "2. Deploy to Vercel: npm run deploy:vercel"
echo "3. Configure Clerk webhook URL in dashboard"
echo "4. Test API endpoints"
echo ""
echo "🔗 Useful commands:"
echo "  npm run setup:vercel    # Set up environment variables"
echo "  npm run deploy:vercel   # Deploy to Vercel"
echo "  npm run build:vercel    # Build for Vercel"
echo "  vercel logs            # View deployment logs"
echo ""