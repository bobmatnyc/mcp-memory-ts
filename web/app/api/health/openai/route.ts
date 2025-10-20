import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getUserCredentials } from '@/lib/user-metadata';

export async function GET() {
  try {
    const { userId } = await auth();

    // If user is authenticated, check their personal API key
    if (userId) {
      const metadata = await getUserCredentials(userId);

      if (!metadata?.openaiApiKey) {
        return NextResponse.json({ error: 'OpenAI API key not configured for user' }, { status: 400 });
      }

      // Simple check - try to validate the API key format
      const isValidFormat = metadata.openaiApiKey.startsWith('sk-');

      if (!isValidFormat) {
        return NextResponse.json({ error: 'Invalid OpenAI API key format' }, { status: 400 });
      }

      return NextResponse.json({
        status: 'ok',
        message: 'OpenAI API key is configured for user'
      });
    }

    // If not authenticated, check environment variable (for public health status)
    const envApiKey = process.env.OPENAI_API_KEY;

    if (!envApiKey) {
      return NextResponse.json({ error: 'OpenAI API key not configured in environment' }, { status: 400 });
    }

    const isValidFormat = envApiKey.startsWith('sk-');

    if (!isValidFormat) {
      return NextResponse.json({ error: 'Invalid OpenAI API key format in environment' }, { status: 400 });
    }

    return NextResponse.json({
      status: 'ok',
      message: 'OpenAI API key is configured in environment'
    });
  } catch (error: any) {
    console.error('OpenAI health check error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to check OpenAI connection' },
      { status: 500 }
    );
  }
}
