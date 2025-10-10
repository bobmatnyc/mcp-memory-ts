/**
 * Gmail Connection Test API
 *
 * POST /api/gmail/test - Test Gmail and OpenAI connections
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { GmailClient } from '../../../../../src/integrations/gmail-client.js';
import { GmailExtractor } from '../../../../../src/services/gmail-extractor.js';

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { gmailAccessToken, openaiApiKey } = body;

    const results: any = {
      gmail: { tested: false },
      openai: { tested: false },
    };

    // Test Gmail connection
    if (gmailAccessToken) {
      try {
        const gmailClient = new GmailClient(gmailAccessToken);
        const gmailTest = await gmailClient.testConnection();

        results.gmail = {
          tested: true,
          success: gmailTest.success,
          email: gmailTest.email,
          error: gmailTest.error,
        };
      } catch (error) {
        results.gmail = {
          tested: true,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }

    // Test OpenAI connection
    if (openaiApiKey) {
      try {
        const extractor = new GmailExtractor(openaiApiKey);
        const openaiTest = await extractor.testConnection();

        results.openai = {
          tested: true,
          success: openaiTest.success,
          model: openaiTest.model,
          error: openaiTest.error,
        };
      } catch (error) {
        results.openai = {
          tested: true,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }

    const allSuccess =
      results.gmail.tested && results.gmail.success &&
      results.openai.tested && results.openai.success;

    return NextResponse.json({
      success: allSuccess,
      results,
    });

  } catch (error) {
    console.error('Connection test error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
