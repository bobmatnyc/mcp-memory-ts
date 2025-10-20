import { auth } from '@clerk/nextjs/server';
import { updateUserCredentials, getUserCredentials } from '@/lib/user-metadata';
import { NextResponse } from 'next/server';

// GET /api/settings - Get user credentials (excluding sensitive values)
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const credentials = await getUserCredentials(userId);

    // Return metadata about what's configured, but not the actual sensitive values
    return NextResponse.json({
      success: true,
      data: {
        hasTursoUrl: !!credentials?.tursoUrl,
        hasTursoAuthToken: !!credentials?.tursoAuthToken,
        hasOpenaiApiKey: !!credentials?.openaiApiKey,
        tursoUrl: credentials?.tursoUrl || '', // Return URL as it's not as sensitive
      },
    });
  } catch (error: any) {
    console.error('GET /api/settings error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST /api/settings - Update user credentials
export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { tursoUrl, tursoAuthToken, openaiApiKey } = body;

    // Validate required fields
    if (!tursoUrl || !tursoAuthToken || !openaiApiKey) {
      return NextResponse.json(
        {
          success: false,
          error: 'All fields are required: tursoUrl, tursoAuthToken, openaiApiKey'
        },
        { status: 400 }
      );
    }

    // Basic validation for Turso URL format
    if (!tursoUrl.startsWith('libsql://') && !tursoUrl.startsWith('http://') && !tursoUrl.startsWith('https://')) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid Turso URL format. Must start with libsql://, http://, or https://'
        },
        { status: 400 }
      );
    }

    // Basic validation for OpenAI API key format
    if (!openaiApiKey.startsWith('sk-')) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid OpenAI API key format. Must start with sk-'
        },
        { status: 400 }
      );
    }

    // Update user credentials in Clerk metadata
    await updateUserCredentials(userId, {
      tursoUrl,
      tursoAuthToken,
      openaiApiKey,
    });

    return NextResponse.json({
      success: true,
      message: 'Settings saved successfully'
    });
  } catch (error: any) {
    console.error('POST /api/settings error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
