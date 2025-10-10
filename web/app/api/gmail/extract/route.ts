/**
 * Gmail Extraction API Routes
 *
 * POST /api/gmail/extract - Extract memories from Gmail for a specific week
 * GET /api/gmail/extract - Get extraction logs
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { DatabaseConnection } from '../../../../../src/database/connection.js';
import { MemoryCore } from '../../../../../src/core/memory-core.js';
import { GmailExtractionService } from '../../../../../src/services/gmail-extraction-service.js';
import { getCurrentWeekIdentifier } from '../../../../../src/integrations/gmail-client.js';

/**
 * POST /api/gmail/extract
 * Extract memories and entities from Gmail
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const {
      weekIdentifier,
      gmailAccessToken,
      openaiApiKey,
    } = body;

    if (!gmailAccessToken) {
      return NextResponse.json(
        { error: 'Gmail access token is required' },
        { status: 400 }
      );
    }

    // Use current week if not specified
    const targetWeek = weekIdentifier || getCurrentWeekIdentifier();

    // Initialize services
    const db = new DatabaseConnection({
      url: process.env.TURSO_URL!,
      authToken: process.env.TURSO_AUTH_TOKEN!,
    });
    await db.connect();
    const memoryCore = new MemoryCore(db);
    const extractionService = new GmailExtractionService(db, memoryCore);

    // Run extraction
    console.log(`Starting extraction for user ${userId}, week ${targetWeek}`);
    const result = await extractionService.extractWeek(
      userId,
      targetWeek,
      gmailAccessToken,
      openaiApiKey
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Extraction failed' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      skipped: result.skipped,
      reason: result.reason,
      week_identifier: targetWeek,
      emails_processed: result.emails_processed,
      memories_created: result.memories_created,
      entities_created: result.entities_created,
      summary: result.summary,
    });

  } catch (error) {
    console.error('Gmail extraction error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/gmail/extract
 * Get extraction logs for current user
 */
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const weekIdentifier = searchParams.get('week');

    // Initialize services
    const db = new DatabaseConnection({
      url: process.env.TURSO_URL!,
      authToken: process.env.TURSO_AUTH_TOKEN!,
    });
    await db.connect();
    const memoryCore = new MemoryCore(db);
    const extractionService = new GmailExtractionService(db, memoryCore);

    // Get specific week or all logs
    if (weekIdentifier) {
      const log = await extractionService.getExtractionLog(userId, weekIdentifier);
      return NextResponse.json({ log });
    } else {
      const logs = await extractionService.getExtractionLogs(userId, limit);
      return NextResponse.json({ logs });
    }

  } catch (error) {
    console.error('Get extraction logs error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/gmail/extract
 * Delete extraction log for a specific week
 */
export async function DELETE(req: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const weekIdentifier = searchParams.get('week');

    if (!weekIdentifier) {
      return NextResponse.json(
        { error: 'Week identifier is required' },
        { status: 400 }
      );
    }

    // Initialize services
    const db = new DatabaseConnection({
      url: process.env.TURSO_URL!,
      authToken: process.env.TURSO_AUTH_TOKEN!,
    });
    await db.connect();
    const memoryCore = new MemoryCore(db);
    const extractionService = new GmailExtractionService(db, memoryCore);

    const deleted = await extractionService.deleteExtractionLog(userId, weekIdentifier);

    return NextResponse.json({
      success: deleted,
      message: deleted ? 'Extraction log deleted' : 'Log not found',
    });

  } catch (error) {
    console.error('Delete extraction log error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
