import { NextRequest, NextResponse } from 'next/server';
import { readDb, writeDb } from '@/lib/db';

export async function DELETE(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const params = await props.params;
    const { id } = params;
    const db = readDb();
    
    db.monitors = db.monitors.filter(m => m.id !== id);
    db.scrapers = db.scrapers.filter(s => s.monitorId !== id);
    db.runs = db.runs.filter(r => r.monitorId !== id);
    db.records = db.records.filter(r => r.monitorId !== id);
    db.repairEvents = db.repairEvents.filter(r => r.monitorId !== id);
    
    writeDb(db);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}
