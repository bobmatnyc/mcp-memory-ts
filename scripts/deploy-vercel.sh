#!/bin/bash

# Vercel Deployment Script for MCP Memory Service
# This script handles secure deployment with environment variable management

set -e

echo "🚀 Starting Vercel deployment for MCP Memory Service..."

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Run this script from the project root."
    exit 1
fi

# Check if vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo "📦 Installing Vercel CLI..."
    npm install -g vercel@latest
fi

# Set deployment environment
DEPLOYMENT_ENV=${1:-production}
echo "🎯 Deploying to: $DEPLOYMENT_ENV"

# Pre-deployment checks
echo "🔍 Running pre-deployment checks..."
npm run type-check
npm run lint
npm run build:vercel

# Environment variable setup
echo "🔧 Setting up environment variables..."

# Required environment variables
REQUIRED_VARS=(
    "TURSO_URL"
    "TURSO_AUTH_TOKEN"
    "OPENAI_API_KEY"
    "CLERK_SECRET_KEY"
    "CLERK_WEBHOOK_SECRET"
)

# Check if all required environment variables are set
for var in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!var}" ]; then
        echo "⚠️  Warning: $var is not set in environment"
        echo "   Make sure to set it in Vercel dashboard after deployment"
    fi
done

# Set Clerk publishable key (safe to commit)
vercel env add NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY "pk_test_touching-gar-14.clerk.accounts.dev" production --force || true

# Set other environment variables from current environment (if available)
if [ -n "$TURSO_URL" ]; then
    echo "$TURSO_URL" | vercel env add TURSO_URL production --force || true
fi

if [ -n "$TURSO_AUTH_TOKEN" ]; then
    echo "$TURSO_AUTH_TOKEN" | vercel env add TURSO_AUTH_TOKEN production --force || true
fi

if [ -n "$OPENAI_API_KEY" ]; then
    echo "$OPENAI_API_KEY" | vercel env add OPENAI_API_KEY production --force || true
fi

if [ -n "$CLERK_SECRET_KEY" ]; then
    echo "$CLERK_SECRET_KEY" | vercel env add CLERK_SECRET_KEY production --force || true
fi

if [ -n "$CLERK_WEBHOOK_SECRET" ]; then
    echo "$CLERK_WEBHOOK_SECRET" | vercel env add CLERK_WEBHOOK_SECRET production --force || true
fi

# Set application configuration
vercel env add NODE_ENV "production" production --force || true
vercel env add LOG_LEVEL "warn" production --force || true
vercel env add MCP_DEBUG "0" production --force || true

echo "🌐 Environment variables configured"

# Deploy to Vercel
if [ "$DEPLOYMENT_ENV" = "production" ]; then
    echo "🚀 Deploying to production..."
    vercel --prod
else
    echo "🧪 Deploying to preview..."
    vercel
fi

echo "✅ Deployment completed!"
echo ""
echo "📋 Next steps:"
echo "1. Verify environment variables in Vercel dashboard"
echo "2. Test the API endpoints"
echo "3. Configure Clerk webhook URL in Clerk dashboard"
echo "4. Set up monitoring and alerts"
echo ""
echo "🔗 Useful links:"
echo "   Dashboard: https://vercel.com/dashboard"
echo "   Clerk: https://dashboard.clerk.com"
echo "   API Documentation: /api"
echo ""