import { NextRequest, NextResponse } from 'next/server';
import { readDb, writeDb, logActivity, Monitor, Scraper } from '@/lib/db';

export async function GET() {
  const db = readDb();
  return NextResponse.json(db);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, url, fields, schema, collectorId } = body;

    if (!name || !url || !fields || !schema) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    const db = readDb();
    const monitorId = `mon_${Date.now()}`;

    const newMonitor: Monitor = {
      id: monitorId,
      name,
      url,
      selectors: fields, // e.g. { container: '.product-card', name: '.name', price: '.price', ... }
      schema,
      collectorId: collectorId || undefined,
      createdAt: new Date().toISOString(),
    };

    const newScraper: Scraper = {
      id: `scr_${Date.now()}`,
      monitorId,
      status: 'HEALTHY',
      successRate: 100,
      totalRecordsCollected: 0,
    };

    db.monitors.push(newMonitor);
    db.scrapers.push(newScraper);
    writeDb(db);

    logActivity(`Created monitor: "${name}" for URL: ${url}`, 'success');

    return NextResponse.json({ monitor: newMonitor, scraper: newScraper });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Server error' },
      { status: 500 }
    );
  }
}
