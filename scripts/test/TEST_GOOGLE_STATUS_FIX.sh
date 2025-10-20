#!/bin/bash

# Test Google OAuth Status Fix
# This script helps verify the fix is working correctly

echo "================================================"
echo "Google OAuth Status Fix - Verification Test"
echo "================================================"
echo ""

# Check if the fix is present in the code
echo "1. Checking if fix is applied..."
if grep -q "const { currentUser } = await import('@clerk/nextjs/server');" web/app/api/google/status/route.ts; then
    echo "✅ Fix applied: currentUser() pattern detected"
else
    echo "❌ Fix NOT applied: currentUser() pattern missing"
    exit 1
fi

# Check for old broken pattern
if grep -q "sessionClaims?.email" web/app/api/google/status/route.ts; then
    echo "❌ Warning: Old broken pattern still present (sessionClaims?.email)"
    exit 1
else
    echo "✅ Old broken pattern removed"
fi

# Check for logging
if grep -q "\[GoogleStatus\]" web/app/api/google/status/route.ts; then
    echo "✅ Defensive logging added"
else
    echo "⚠️  Warning: Logging may be missing"
fi

echo ""
echo "2. Code verification complete!"
echo ""
echo "================================================"
echo "Manual Testing Steps"
echo "================================================"
echo ""
echo "To fully verify the fix:"
echo ""
echo "1. Start the web server:"
echo "   cd web && npm run dev -- -p 3002"
echo ""
echo "2. Login to the application:"
echo "   Open http://localhost:3002"
echo ""
echo "3. Navigate to Settings page:"
echo "   Click 'Settings' in the navigation"
echo ""
echo "4. Check the logs for:"
echo "   [GoogleStatus] Checking connection status for user: { userId: 'user_xxx', email: 'user@example.com' }"
echo ""
echo "5. Verify the response:"
echo "   - If you have OAuth configured: Should show 'Connected' with email"
echo "   - If no OAuth: Should show 'Not Connected'"
echo ""
echo "6. Check for errors:"
echo "   - No TypeError in logs"
echo "   - No 'undefined' in database queries"
echo ""
echo "================================================"
echo "Expected Successful Logs"
echo "================================================"
echo ""
echo "[GoogleStatus] Checking connection status for user: { userId: 'user_xxx', email: 'user@example.com' }"
echo "[GoogleStatus] Connection check result: { userEmail: 'user@example.com', isConnected: true/false }"
echo ""
echo "If connected:"
echo "[GoogleStatus] User found, retrieving sync statistics"
echo "[GoogleStatus] Found X Google contacts"
echo "[GoogleStatus] Found Y calendar events"
echo "[GoogleStatus] Returning connection status: { connected: true, ... }"
echo ""
echo "================================================"
echo "Verification Complete"
echo "================================================"
