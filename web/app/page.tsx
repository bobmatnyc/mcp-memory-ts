import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { SignInButton } from '@clerk/nextjs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Brain, Database, Search, Users, Lock, Zap } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default function HomePage() {
  const { userId } = auth();

  // Redirect authenticated users to dashboard
  if (userId) {
    redirect('/dashboard');
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto text-center mb-16">
          <h1 className="text-5xl font-bold text-gray-900 mb-6">
            MCP Memory TypeScript
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            Cloud-based vector memory service for AI assistants via Model Context Protocol
          </p>
          <SignInButton mode="modal">
            <Button size="lg" className="text-lg px-8 py-6">
              Get Started
            </Button>
          </SignInButton>
        </div>

        {/* About Section */}
        <div className="max-w-5xl mx-auto mb-16">
          <Card className="border-2">
            <CardHeader className="text-center">
              <CardTitle className="text-3xl mb-2">About the Project</CardTitle>
              <CardDescription className="text-base">
                A production-ready MCP server providing persistent, searchable memory for AI assistants
              </CardDescription>
            </CardHeader>
            <CardContent className="text-gray-700 space-y-4">
              <p>
                MCP Memory TypeScript is a sophisticated memory management system designed specifically for AI assistants like Claude.
                It provides persistent storage with advanced semantic search capabilities, enabling AI assistants to remember
                conversations, learn patterns, and build relationships over time.
              </p>
              <p>
                Built on the Model Context Protocol (MCP), this service integrates seamlessly with Claude Desktop and other
                MCP-compatible clients, offering a comprehensive solution for AI memory management with multi-tenant support,
                vector embeddings, and intelligent search.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Features Grid */}
        <div className="max-w-6xl mx-auto mb-16">
          <h2 className="text-3xl font-bold text-center mb-10 text-gray-900">Key Features</h2>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="mb-2">
                  <Brain className="h-10 w-10 text-blue-600" />
                </div>
                <CardTitle>Vector Search</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  Semantic similarity search using OpenAI embeddings with intelligent ranking and relevance scoring.
                </p>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="mb-2">
                  <Database className="h-10 w-10 text-green-600" />
                </div>
                <CardTitle>Turso Database</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  Cloud-based LibSQL database with optimized schema for fast queries and reliable data persistence.
                </p>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="mb-2">
                  <Users className="h-10 w-10 text-purple-600" />
                </div>
                <CardTitle>Multi-Tenant</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  Secure user isolation with Clerk authentication, ensuring your memories stay private and protected.
                </p>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="mb-2">
                  <Search className="h-10 w-10 text-orange-600" />
                </div>
                <CardTitle>Smart Memory</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  3-tier memory system (SYSTEM, LEARNED, MEMORY) for organizing knowledge and conversation context.
                </p>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="mb-2">
                  <Lock className="h-10 w-10 text-red-600" />
                </div>
                <CardTitle>Claude Integration</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  Native integration with Claude Desktop via MCP, enabling seamless AI memory capabilities.
                </p>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="mb-2">
                  <Zap className="h-10 w-10 text-yellow-600" />
                </div>
                <CardTitle>Real-time Sync</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  Automatic embedding generation and monitoring for up-to-date semantic search capabilities.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* CTA Section */}
        <div className="max-w-3xl mx-auto text-center">
          <Card className="bg-gradient-to-r from-blue-600 to-indigo-600 border-0 text-white">
            <CardHeader>
              <CardTitle className="text-3xl mb-2 text-white">Ready to Get Started?</CardTitle>
              <CardDescription className="text-blue-100 text-base">
                Sign in to access your AI memory dashboard and start managing your memories
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SignInButton mode="modal">
                <Button size="lg" variant="secondary" className="text-lg px-8 py-6">
                  Sign In Now
                </Button>
              </SignInButton>
              <p className="mt-4 text-sm text-blue-100">
                By signing in, you agree to our Terms of Service and Privacy Policy
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
