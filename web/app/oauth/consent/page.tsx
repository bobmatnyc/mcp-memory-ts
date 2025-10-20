/**
 * OAuth 2.0 Consent Screen
 * User authorization interface for OAuth clients
 */

'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth, useUser } from '@clerk/nextjs';

interface ScopeInfo {
  scope: string;
  description: string;
  icon: string;
}

const SCOPE_DESCRIPTIONS: Record<string, ScopeInfo> = {
  'memories:read': {
    scope: 'memories:read',
    description: 'Read your memories and related data',
    icon: '📖',
  },
  'memories:write': {
    scope: 'memories:write',
    description: 'Create, update, and delete your memories',
    icon: '✏️',
  },
  'entities:read': {
    scope: 'entities:read',
    description: 'Read your entities (people, organizations, projects)',
    icon: '👥',
  },
  'entities:write': {
    scope: 'entities:write',
    description: 'Create, update, and delete your entities',
    icon: '👤',
  },
};

export default function OAuthConsentPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { isLoaded, userId } = useAuth();
  const { user } = useUser();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clientId = searchParams.get('client_id');
  const clientName = searchParams.get('client_name');
  const redirectUri = searchParams.get('redirect_uri');
  const scope = searchParams.get('scope');
  const state = searchParams.get('state');

  const scopes = scope?.split(' ') || [];
  const scopeInfos = scopes
    .map(s => SCOPE_DESCRIPTIONS[s])
    .filter(Boolean);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (isLoaded && !userId) {
      const loginUrl = `/sign-in?redirect_url=${encodeURIComponent(window.location.href)}`;
      router.push(loginUrl);
    }
  }, [isLoaded, userId, router]);

  const handleApprove = async () => {
    if (!clientId || !redirectUri || !state || !userId) {
      setError('Missing required parameters');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Generate authorization code
      const response = await fetch('/api/oauth/consent/approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: clientId,
          redirect_uri: redirectUri,
          scope: scope || 'memories:read memories:write',
          state,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error_description || 'Failed to approve authorization');
      }

      const data = await response.json();

      // Redirect back to client with authorization code
      const redirectUrl = new URL(redirectUri);
      redirectUrl.searchParams.set('code', data.code);
      redirectUrl.searchParams.set('state', state);

      window.location.href = redirectUrl.toString();
    } catch (err) {
      console.error('Approval error:', err);
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
      setLoading(false);
    }
  };

  const handleDeny = () => {
    if (!redirectUri || !state) {
      router.push('/dashboard');
      return;
    }

    // Redirect back to client with error
    const redirectUrl = new URL(redirectUri);
    redirectUrl.searchParams.set('error', 'access_denied');
    redirectUrl.searchParams.set('error_description', 'User denied authorization');
    redirectUrl.searchParams.set('state', state);

    window.location.href = redirectUrl.toString();
  };

  if (!isLoaded || !userId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!clientId || !redirectUri || !state) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
          <div className="text-center">
            <div className="text-red-500 text-5xl mb-4">⚠️</div>
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Invalid Request</h1>
            <p className="text-gray-600 mb-6">
              Required OAuth parameters are missing. Please try again or contact support.
            </p>
            <button
              onClick={() => router.push('/dashboard')}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Return to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="text-5xl mb-4">🔐</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Authorization Request</h1>
          <p className="text-gray-600">
            <strong className="text-blue-600">{clientName || clientId}</strong> is requesting access
            to your MCP Memory account
          </p>
        </div>

        {/* User Info */}
        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <p className="text-sm text-gray-600 mb-1">Authorizing as:</p>
          <p className="font-medium text-gray-900">
            {user?.primaryEmailAddress?.emailAddress || 'Unknown user'}
          </p>
        </div>

        {/* Permissions */}
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">This will allow the app to:</h2>
          <ul className="space-y-2">
            {scopeInfos.map(info => (
              <li key={info.scope} className="flex items-start">
                <span className="text-2xl mr-3">{info.icon}</span>
                <span className="text-gray-700 pt-1">{info.description}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex space-x-4">
          <button
            onClick={handleDeny}
            disabled={loading}
            className="flex-1 px-6 py-3 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Deny
          </button>
          <button
            onClick={handleApprove}
            disabled={loading}
            className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                Authorizing...
              </>
            ) : (
              'Authorize'
            )}
          </button>
        </div>

        {/* Trust Note */}
        <div className="mt-6 pt-6 border-t border-gray-200">
          <p className="text-xs text-gray-500 text-center">
            Only authorize applications you trust. You can revoke access at any time from your account
            settings.
          </p>
        </div>
      </div>
    </div>
  );
}
