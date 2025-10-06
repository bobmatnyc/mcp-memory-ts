import { NextRequest, NextResponse } from 'next/server';
import { getUserEmail, getDatabase } from '@/lib/auth';

function getErrorMessage(error: any): string {
  const errorMessage = error.message || 'Unknown error';

  // Check for specific error patterns and return user-friendly messages
  if (errorMessage.includes('credentials not configured')) {
    return 'Database credentials not configured. Please visit Settings to configure your Turso database and OpenAI API credentials.';
  }

  if (errorMessage.includes('UNAUTHORIZED') || errorMessage.includes('401')) {
    return 'Invalid database credentials. Please check your Turso auth token in Settings.';
  }

  if (errorMessage.includes('HTTP status 400') || errorMessage.includes('Bad Request')) {
    return 'Invalid database connection. Please verify your Turso URL and auth token in Settings.';
  }

  if (errorMessage.includes('HTTP status 403') || errorMessage.includes('Forbidden')) {
    return 'Access denied. Your Turso auth token may have expired. Please generate a new token in Settings.';
  }

  if (errorMessage.includes('ECONNREFUSED') || errorMessage.includes('ENOTFOUND')) {
    return 'Cannot connect to database. Please check your internet connection and verify your Turso URL in Settings.';
  }

  if (errorMessage.includes('timeout') || errorMessage.includes('ETIMEDOUT')) {
    return 'Database connection timeout. Please check your internet connection or try again later.';
  }

  if (errorMessage.includes('OpenAI') || errorMessage.includes('API key')) {
    return 'OpenAI API error. Please verify your OpenAI API key in Settings.';
  }

  // Return original message if no pattern matches
  return errorMessage;
}

// POST /api/memories/search - Search memories
export async function POST(request: NextRequest) {
  try {
    const userEmail = await getUserEmail();
    const body = await request.json();

    const { query, limit } = body;

    if (!query) {
      return NextResponse.json({ success: false, error: 'Query is required' }, { status: 400 });
    }

    const database = await getDatabase();
    const memories = await database.getMemories(userEmail, {
      limit: limit || 10,
      query,
    });

    return NextResponse.json({
      success: true,
      data: memories,
    });
  } catch (error: any) {
    console.error('POST /api/memories/search error:', error);
    const userFriendlyMessage = getErrorMessage(error);
    return NextResponse.json({
      success: false,
      error: userFriendlyMessage
    }, { status: 500 });
  }
}
