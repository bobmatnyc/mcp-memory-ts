import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getUserCredentials } from '@/lib/user-metadata';

export async function GET() {
  try {
    const { userId } = auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const metadata = await getUserCredentials(userId);

    if (!metadata?.openaiApiKey) {
      return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 400 });
    }

    // Simple check - try to validate the API key format
    // We don't actually make an API call to avoid unnecessary costs
    const isValidFormat = metadata.openaiApiKey.startsWith('sk-');

    if (!isValidFormat) {
      return NextResponse.json({ error: 'Invalid OpenAI API key format' }, { status: 400 });
    }

    return NextResponse.json({
      status: 'ok',
      message: 'OpenAI API key is configured'
    });
  } catch (error: any) {
    console.error('OpenAI health check error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to check OpenAI connection' },
      { status: 500 }
    );
  }
}
