import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
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

// GET /api/stats - Get statistics for dashboard
export async function GET(request: NextRequest) {
  try {
    // Check if user is authenticated
    const { userId } = await auth();

    // Require authentication unconditionally
    if (!userId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Authentication required'
        },
        { status: 401 }
      );
    }

    // Fetch actual stats for authenticated user
    const userEmail = await getUserEmail();
    const database = await getDatabase();

    const stats = await database.getStatistics(userEmail);

    return NextResponse.json({
      success: true,
      data: stats,
    });
  } catch (error: any) {
    console.error('GET /api/stats error:', error);
    const userFriendlyMessage = getErrorMessage(error);
    return NextResponse.json({
      success: false,
      error: userFriendlyMessage
    }, { status: 500 });
  }
}
