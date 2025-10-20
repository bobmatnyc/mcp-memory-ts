import { NextRequest, NextResponse } from 'next/server';
import { getUserEmail, getDatabase } from '@/lib/auth';

// GET /api/entities - List entities
export async function GET(request: NextRequest) {
  try {
    const userEmail = await getUserEmail();
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '50');
    const source = searchParams.get('source');
    const week = searchParams.get('week');

    const database = await getDatabase();
    let entities = await database.getEntities(userEmail, { limit });

    // Filter by metadata if parameters provided
    if (source || week) {
      entities = entities.filter((e: any) => {
        if (source && e.metadata?.source !== source) return false;
        if (week && e.metadata?.week_identifier !== week) return false;
        return true;
      });
    }

    return NextResponse.json({
      success: true,
      data: entities,
    });
  } catch (error: any) {
    console.error('GET /api/entities error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST /api/entities - Create entity
export async function POST(request: NextRequest) {
  try {
    const userEmail = await getUserEmail();
    const body = await request.json();

    const { name, entityType, description } = body;

    if (!name || !entityType) {
      return NextResponse.json(
        { success: false, error: 'Name and entityType are required' },
        { status: 400 }
      );
    }

    // For now, just return success - we'll implement entity creation later
    return NextResponse.json(
      {
        success: true,
        message: 'Entity creation not yet implemented in simplified version',
      },
      { status: 501 }
    );
  } catch (error: any) {
    console.error('POST /api/entities error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
