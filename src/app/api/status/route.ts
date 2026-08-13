import { NextResponse } from 'next/server';
import { hasBrightDataCredentials } from '@/lib/brightdata';

export async function GET() {
  const live = hasBrightDataCredentials();
  return NextResponse.json({
    brightData: {
      configured: live,
      collectorId: live ? process.env.BRIGHTDATA_COLLECTOR_ID : null,
      mode: live ? 'live' : 'demo',
    },
  });
}
