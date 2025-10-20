import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@libsql/client';

/**
 * GET /api/health
 * Main health check endpoint - checks database connectivity
 */
export async function GET(request: NextRequest) {
  try {
    // Get database credentials from environment
    const tursoUrl = process.env.TURSO_URL;
    const tursoAuthToken = process.env.TURSO_AUTH_TOKEN;

    if (!tursoUrl || !tursoAuthToken) {
      return NextResponse.json(
        {
          status: 'error',
          message: 'Database configuration missing',
          timestamp: new Date().toISOString(),
        },
        { status: 503 }
      );
    }

    // Create database client
    const client = createClient({
      url: tursoUrl,
      authToken: tursoAuthToken,
    });

    // Test database connectivity with a simple query
    const result = await client.execute('SELECT 1 as test');

    // Check if query returned expected result
    if (result.rows.length > 0) {
      return NextResponse.json({
        status: 'ok',
        message: 'Database connection successful',
        timestamp: new Date().toISOString(),
      });
    } else {
      return NextResponse.json(
        {
          status: 'error',
          message: 'Database query returned unexpected result',
          timestamp: new Date().toISOString(),
        },
        { status: 503 }
      );
    }
  } catch (error) {
    console.error('Health check failed:', error);
    return NextResponse.json(
      {
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
