#!/bin/bash

# Vercel Environment Variables Setup Script
# Securely configure all required environment variables for production deployment

set -e

echo "🔧 Setting up Vercel environment variables..."

# Function to safely add environment variable
add_env_var() {
    local key=$1
    local value=$2
    local env=${3:-production}
    local type=${4:-encrypted}

    if [ -n "$value" ]; then
        if [ "$type" = "plain" ]; then
            vercel env add "$key" "$value" "$env" --force
        else
            echo "$value" | vercel env add "$key" "$env" --sensitive --force
        fi
        echo "✅ Set $key for $env environment"
    else
        echo "⚠️  Skipping $key (not provided)"
    fi
}

# Check if vercel CLI is installed and logged in
if ! command -v vercel &> /dev/null; then
    echo "❌ Vercel CLI not found. Please install it first:"
    echo "   npm install -g vercel@latest"
    exit 1
fi

# Check if logged in
if ! vercel whoami &> /dev/null; then
    echo "🔑 Please log in to Vercel first:"
    echo "   vercel login"
    exit 1
fi

# Link project if not already linked
if [ ! -f ".vercel/project.json" ]; then
    echo "🔗 Linking Vercel project..."
    vercel link
fi

echo "📝 Please provide the following environment variables:"
echo "   (Press Enter to skip if not available)"
echo ""

# Database Configuration
read -p "TURSO_URL: " TURSO_URL
read -p "TURSO_AUTH_TOKEN: " TURSO_AUTH_TOKEN

# OpenAI Configuration
read -p "OPENAI_API_KEY: " OPENAI_API_KEY

# Clerk Configuration (using provided values as defaults)
read -p "CLERK_SECRET_KEY [sk_test_zRXJyKhoYuXlNaqiiqjiSDDCyt7jhLFmBEmp2npfYc]: " CLERK_SECRET_KEY
CLERK_SECRET_KEY=${CLERK_SECRET_KEY:-sk_test_zRXJyKhoYuXlNaqiiqjiSDDCyt7jhLFmBEmp2npfYc}

read -p "CLERK_WEBHOOK_SECRET: " CLERK_WEBHOOK_SECRET

echo ""
echo "🚀 Setting up environment variables..."

# Set all environments (development, preview, production)
for env in development preview production; do
    echo "📦 Configuring $env environment..."

    # Database
    add_env_var "TURSO_URL" "$TURSO_URL" "$env"
    add_env_var "TURSO_AUTH_TOKEN" "$TURSO_AUTH_TOKEN" "$env"

    # OpenAI
    add_env_var "OPENAI_API_KEY" "$OPENAI_API_KEY" "$env"

    # Clerk (public key is safe to be plain text)
    add_env_var "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY" "pk_test_touching-gar-14.clerk.accounts.dev" "$env" "plain"
    add_env_var "CLERK_SECRET_KEY" "$CLERK_SECRET_KEY" "$env"
    add_env_var "CLERK_WEBHOOK_SECRET" "$CLERK_WEBHOOK_SECRET" "$env"

    # Application configuration
    if [ "$env" = "production" ]; then
        add_env_var "NODE_ENV" "production" "$env" "plain"
        add_env_var "LOG_LEVEL" "warn" "$env" "plain"
    else
        add_env_var "NODE_ENV" "development" "$env" "plain"
        add_env_var "LOG_LEVEL" "info" "$env" "plain"
    fi

    add_env_var "MCP_DEBUG" "0" "$env" "plain"

    echo "✅ $env environment configured"
    echo ""
done

echo "🎉 Environment setup complete!"
echo ""
echo "📋 Summary of configured variables:"
vercel env ls
echo ""
echo "🔗 Next steps:"
echo "1. Deploy with: npm run deploy:vercel"
echo "2. Configure Clerk webhook URL in Clerk dashboard:"
echo "   https://your-deployment.vercel.app/api/auth/webhook"
echo "3. Test API endpoints"
echo ""