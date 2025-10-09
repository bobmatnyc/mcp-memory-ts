'use client';

import { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';

function maskCredential(value: string | undefined): string {
  if (!value || value.length < 15) return '••••••••';
  return `${value.substring(0, 5)}...${value.substring(value.length - 5)}`;
}

export default function SettingsPage() {
  const { user } = useUser();
  const [tursoUrl, setTursoUrl] = useState('');
  const [tursoToken, setTursoToken] = useState('');
  const [openaiKey, setOpenaiKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [existingCredentials, setExistingCredentials] = useState<{
    tursoUrl?: string;
    hasTursoAuthToken?: boolean;
    hasOpenaiApiKey?: boolean;
  } | null>(null);

  useEffect(() => {
    // Load existing credentials metadata
    const loadCredentials = async () => {
      try {
        const response = await fetch('/api/settings');
        if (response.ok) {
          const result = await response.json();
          if (result.success) {
            setExistingCredentials(result.data);
            setTursoUrl(result.data.tursoUrl || '');
            // Don't load sensitive tokens - user must re-enter them
            setTursoToken('');
            setOpenaiKey('');
          }
        }
      } catch (error) {
        console.error('Failed to load settings:', error);
      } finally {
        setLoading(false);
      }
    };

    loadCredentials();
  }, [user]);

  const handleSave = async () => {
    setMessage(null);
    setTestResult(null);
    setSaving(true);

    try {
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tursoUrl,
          tursoAuthToken: tursoToken,
          openaiApiKey: openaiKey,
        }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setMessage({ type: 'success', text: 'Settings saved successfully!' });
        // Reload credentials to update preview
        const reloadResponse = await fetch('/api/settings');
        if (reloadResponse.ok) {
          const reloadResult = await reloadResponse.json();
          if (reloadResult.success) {
            setExistingCredentials(reloadResult.data);
          }
        }
        // Clear sensitive fields after saving
        setTursoToken('');
        setOpenaiKey('');
      } else {
        setMessage({ type: 'error', text: result.error || 'Failed to save settings' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to save settings. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  const testConnection = async () => {
    setTesting(true);
    setTestResult(null);
    setMessage(null);

    try {
      const response = await fetch('/api/stats');
      if (response.ok) {
        setTestResult({ success: true, message: 'Connection successful! Your credentials are working correctly.' });
      } else {
        const data = await response.json();
        setTestResult({
          success: false,
          message: data.error || 'Connection failed. Please check your credentials.',
        });
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'Network error. Please check your internet connection.',
      });
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-2xl mx-auto">
            <p className="text-center text-muted-foreground">Loading settings...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-muted-foreground mt-2">
            Configure your database and API credentials
          </p>
        </div>

        {existingCredentials && (existingCredentials.hasTursoAuthToken || existingCredentials.hasOpenaiApiKey) && (
          <Card className="border-blue-200 bg-blue-50">
            <CardHeader>
              <CardTitle className="text-blue-900">Current Configuration</CardTitle>
              <CardDescription className="text-blue-700">
                Your existing credentials (masked for security)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-blue-200">
                <div>
                  <div className="text-sm font-medium text-gray-900">Turso Database URL</div>
                  <div className="text-xs text-gray-500 mt-1 font-mono">
                    {existingCredentials.tursoUrl || 'Not configured'}
                  </div>
                </div>
                {existingCredentials.tursoUrl && (
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                )}
              </div>
              <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-blue-200">
                <div>
                  <div className="text-sm font-medium text-gray-900">Turso Auth Token</div>
                  <div className="text-xs text-gray-500 mt-1 font-mono">
                    {existingCredentials.hasTursoAuthToken ? maskCredential(existingCredentials.tursoUrl || '') : 'Not configured'}
                  </div>
                </div>
                {existingCredentials.hasTursoAuthToken && (
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                )}
              </div>
              <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-blue-200">
                <div>
                  <div className="text-sm font-medium text-gray-900">OpenAI API Key</div>
                  <div className="text-xs text-gray-500 mt-1 font-mono">
                    {existingCredentials.hasOpenaiApiKey ? maskCredential('sk-proj-xxxxxxxxxxxxxxx') : 'Not configured'}
                  </div>
                </div>
                {existingCredentials.hasOpenaiApiKey && (
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                )}
              </div>
              {existingCredentials.hasTursoAuthToken && existingCredentials.hasOpenaiApiKey && (
                <Button
                  onClick={testConnection}
                  disabled={testing}
                  variant="outline"
                  className="w-full mt-2 border-blue-300 text-blue-700 hover:bg-blue-100"
                >
                  {testing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Testing Connection...
                    </>
                  ) : (
                    'Test Connection'
                  )}
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {testResult && (
          <Card className={testResult.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                {testResult.success ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
                )}
                <div className="flex-1">
                  <h3 className={`font-medium ${testResult.success ? 'text-green-900' : 'text-red-900'}`}>
                    {testResult.success ? 'Connection Successful' : 'Connection Failed'}
                  </h3>
                  <p className={`text-sm mt-1 ${testResult.success ? 'text-green-700' : 'text-red-700'}`}>
                    {testResult.message}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Database Configuration</CardTitle>
            <CardDescription>
              Configure your Turso database connection. Each user has their own isolated database.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="tursoUrl">Turso Database URL</Label>
              <Input
                id="tursoUrl"
                type="text"
                value={tursoUrl}
                onChange={(e) => setTursoUrl(e.target.value)}
                placeholder="libsql://your-database.turso.io"
              />
              <p className="text-sm text-muted-foreground">
                Find this in your Turso dashboard
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tursoToken">Turso Auth Token</Label>
              <Input
                id="tursoToken"
                type="password"
                value={tursoToken}
                onChange={(e) => setTursoToken(e.target.value)}
                placeholder="eyJhbGci..."
              />
              <p className="text-sm text-muted-foreground">
                Generate a token in your Turso dashboard
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>OpenAI Configuration</CardTitle>
            <CardDescription>
              Configure your OpenAI API key for semantic search and embeddings.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="openaiKey">OpenAI API Key</Label>
              <Input
                id="openaiKey"
                type="password"
                value={openaiKey}
                onChange={(e) => setOpenaiKey(e.target.value)}
                placeholder="sk-..."
              />
              <p className="text-sm text-muted-foreground">
                Get your API key from the OpenAI dashboard
              </p>
            </div>
          </CardContent>
        </Card>

        {message && (
          <div
            className={`p-4 rounded-md ${
              message.type === 'success'
                ? 'bg-green-50 text-green-800 border border-green-200'
                : 'bg-red-50 text-red-800 border border-red-200'
            }`}
          >
            {message.text}
          </div>
        )}

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving || !tursoUrl || !tursoToken || !openaiKey}>
            {saving ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>

        <Card className="border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle className="text-blue-900">Getting Started</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-blue-800">
            <p>
              <strong>1. Create a Turso Database:</strong> Visit{' '}
              <a href="https://turso.tech" target="_blank" rel="noopener noreferrer" className="underline">
                turso.tech
              </a>{' '}
              and create a new database.
            </p>
            <p>
              <strong>2. Get Your OpenAI API Key:</strong> Visit{' '}
              <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="underline">
                platform.openai.com/api-keys
              </a>{' '}
              and create a new API key.
            </p>
            <p>
              <strong>3. Save Your Credentials:</strong> Enter your credentials above and click Save Settings.
            </p>
            <p className="mt-4 pt-4 border-t border-blue-200">
              <strong>Note:</strong> Your credentials are stored securely in Clerk user metadata and are never shared between users. Each user has their own isolated database.
            </p>
          </CardContent>
        </Card>
        </div>
      </div>
    </div>
  );
}
