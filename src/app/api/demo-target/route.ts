import { NextRequest, NextResponse } from 'next/server';
import { getDemoTargetHtml } from '@/lib/brightdata';

declare global {
  // eslint-disable-next-line no-var
  var _demoVersion: 1 | 2;
}

/**
 * GET /api/demo-target
 * Serves the simulated product listing HTML (V1 or V2 layout).
 * This is the default scrape target used by the self-healing demo.
 * The AI Suggest feature fetches this URL to analyse the DOM structure.
 */
export async function GET(_req: NextRequest) {
  const version: 1 | 2 = global._demoVersion ?? 1;
  const html = getDemoTargetHtml(version);
  return new NextResponse(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
