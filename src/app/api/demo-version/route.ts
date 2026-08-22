import { NextRequest, NextResponse } from 'next/server';

declare global {
  // eslint-disable-next-line no-var
  var _demoVersion: 1 | 2;
}
global._demoVersion = global._demoVersion ?? 1;

/**
 * POST /api/demo-version
 * Sets the active demo layout version (1 = original selectors, 2 = broken/renamed selectors).
 * Used by the dashboard version switcher to simulate a website layout change.
 */
export async function POST(request: NextRequest) {
  try {
    const { version } = await request.json();
    if (version !== 1 && version !== 2) {
      return NextResponse.json({ error: 'version must be 1 or 2' }, { status: 400 });
    }
    global._demoVersion = version as 1 | 2;
    return NextResponse.json({ activeDemoVersion: global._demoVersion });
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
}

export async function GET() {
  return NextResponse.json({ activeDemoVersion: global._demoVersion ?? 1 });
}
