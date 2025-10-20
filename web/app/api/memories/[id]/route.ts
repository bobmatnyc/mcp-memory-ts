import { NextRequest, NextResponse } from 'next/server';
import { getUserEmail, getDatabase } from '@/lib/auth';

// GET /api/memories/:id - Get memory by ID
export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const userEmail = await getUserEmail();
    const database = await getDatabase();
    const params = await props.params;

    const memory = await database.getMemory(userEmail, params.id);

    if (memory) {
      return NextResponse.json({
        success: true,
        data: memory,
      });
    } else {
      return NextResponse.json(
        { success: false, error: 'Memory not found' },
        { status: 404 }
      );
    }
  } catch (error: any) {
    console.error('GET /api/memories/:id error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// PUT /api/memories/:id - Update memory
export async function PUT(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const userEmail = await getUserEmail();
    const body = await request.json();
    const params = await props.params;

    const database = await getDatabase();
    await database.updateMemory(userEmail, params.id, body);

    return NextResponse.json({
      success: true,
      message: 'Memory updated successfully',
    });
  } catch (error: any) {
    console.error('PUT /api/memories/:id error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// DELETE /api/memories/:id - Delete memory
export async function DELETE(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const userEmail = await getUserEmail();
    const database = await getDatabase();
    const params = await props.params;

    await database.deleteMemory(userEmail, params.id);

    return NextResponse.json({
      success: true,
      message: 'Memory deleted successfully',
    });
  } catch (error: any) {
    console.error('DELETE /api/memories/:id error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
