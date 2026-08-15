import { ExtractedRecord } from './extractor';

export interface ScrapeResult {
  records: ExtractedRecord[];
  collectionId?: string;
  isMock: boolean;
  rawHtml: string;
  status: 'SUCCESS' | 'FAILED';
  error?: string;
}

/**
 * Trigger a Bright Data Data Collector job and poll until results arrive.
 * Always uses real Bright Data — no local fallback.
 */
export async function scrapeWithBrightData(
  url: string,
  _config: unknown,        // kept for API compatibility — selectors live in the collector
  _useRealBrightData = true,
  customCollectorId?: string
): Promise<ScrapeResult> {
  const apiKey      = process.env.BRIGHTDATA_API_KEY!;
  const collectorId = customCollectorId || process.env.BRIGHTDATA_COLLECTOR_ID!;

  if (!apiKey || !collectorId) {
    return {
      records: [],
      isMock: false,
      rawHtml: '',
      status: 'FAILED',
      error: 'BRIGHTDATA_API_KEY or BRIGHTDATA_COLLECTOR_ID is not set in .env',
    };
  }

/** Resolve short/redirect URLs (amzn.in, amzn.to, bit.ly, etc.) to their final destination */
async function resolveUrl(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; WebPulseBot/1.0)' },
      signal: AbortSignal.timeout(8000),
    });
    const resolved = res.url;
    if (resolved && resolved !== url) {
      console.log(`[BrightData] Resolved short URL: ${url} → ${resolved}`);
      return resolved;
    }
  } catch {
    // If HEAD fails, try GET (some servers don't support HEAD)
    try {
      const res = await fetch(url, {
        method: 'GET',
        redirect: 'follow',
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; WebPulseBot/1.0)' },
        signal: AbortSignal.timeout(8000),
      });
      if (res.url && res.url !== url) {
        console.log(`[BrightData] Resolved short URL via GET: ${url} → ${res.url}`);
        return res.url;
      }
    } catch { /* ignore, use original URL */ }
  }
  return url;
}

  // Resolve any short/redirect URLs (amzn.in, amzn.to, etc.) to their full URL
  const resolvedUrl = await resolveUrl(url);
  console.log(`[BrightData] Triggering collector ${collectorId} for ${resolvedUrl}`);

  // ── Step 1: Trigger ────────────────────────────────────────────────────────
  const triggerRes = await fetch(
    `https://api.brightdata.com/dca/trigger?collector=${collectorId}&queue_next=1`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([{ url: resolvedUrl }]),
    }
  );

  if (!triggerRes.ok) {
    const body = await triggerRes.text();
    return {
      records: [],
      isMock: false,
      rawHtml: '',
      status: 'FAILED',
      error: `Trigger failed (${triggerRes.status}): ${body}`,
    };
  }

  const triggerData = await triggerRes.json();
  console.log('[BrightData] Trigger response:', JSON.stringify(triggerData));

  const collectionId: string =
    triggerData.collection_id ??
    triggerData.id ??
    triggerData.response_id ??
    null;

  if (!collectionId) {
    return {
      records: [],
      isMock: false,
      rawHtml: '',
      status: 'FAILED',
      error: `No collection_id in trigger response: ${JSON.stringify(triggerData)}`,
    };
  }

  console.log(`[BrightData] Collection ID: ${collectionId} — polling…`);

  // ── Step 2: Poll ───────────────────────────────────────────────────────────
  const MAX_ATTEMPTS = 60;
  const POLL_INTERVAL_MS = 5000;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));

    const dataRes = await fetch(
      `https://api.brightdata.com/dca/dataset?id=${collectionId}&format=json`,
      { headers: { 'Authorization': `Bearer ${apiKey}` } }
    );

    if (!dataRes.ok) {
      const body = await dataRes.text();
      console.warn(`[BrightData] Poll attempt ${attempt} failed (${dataRes.status}): ${body}`);
      continue;
    }

    const contentType = dataRes.headers.get('content-type') ?? '';

    // ── JSON response ────────────────────────────────────────────────────────
    if (contentType.includes('application/json')) {
      const json = await dataRes.json();

      if (json?.status === 'building' || json?.status === 'pending') {
        console.log(`[BrightData] Attempt ${attempt}/${MAX_ATTEMPTS} — still building…`);
        continue;
      }

      if (Array.isArray(json)) {
        console.log(`[BrightData] Done — ${json.length} records.`);
        return {
          records: json as ExtractedRecord[],
          collectionId,
          isMock: false,
          rawHtml: '',
          status: 'SUCCESS',
        };
      }
    }

    // ── NDJSON / text response ────────────────────────────────────────────────
    if (contentType.includes('text/plain') || contentType.includes('application/x-ndjson') || contentType.includes('text/ndjson') || contentType.includes('application/jsonl')) {
      const text = await dataRes.text();
      const records = text
        .trim()
        .split('\n')
        .filter(Boolean)
        .map(line => { try { return JSON.parse(line); } catch { return null; } })
        .filter(Boolean) as ExtractedRecord[];

      console.log(`[BrightData] Done (NDJSON) — ${records.length} records.`);
      return {
        records,
        collectionId,
        isMock: false,
        rawHtml: '',
        status: 'SUCCESS',
      };
    }

    console.log(`[BrightData] Attempt ${attempt}/${MAX_ATTEMPTS} — no data yet, retrying…`);
  }

  return {
    records: [],
    isMock: false,
    rawHtml: '',
    status: 'FAILED',
    error: 'Timed out waiting for Bright Data results (90 s).',
  };
}

/** Returns true if real Bright Data credentials are configured */
export function hasBrightDataCredentials(): boolean {
  return !!(process.env.BRIGHTDATA_API_KEY && process.env.BRIGHTDATA_COLLECTOR_ID);
}

export function getDemoTargetHtml(version: 1 | 2): string {
  if (version === 1) {
    return `<!DOCTYPE html>
<html>
<head><title>Gadget Shop - Version 1</title></head>
<body>
  <h1>Trending Electronic Products (v1)</h1>
  <div class="product-grid">
    <div class="product-card">
      <h3 class="name">AcousticPro Wireless Headphones</h3>
      <span class="price">₹1999</span>
      <span class="rating">4.2</span>
      <span class="availability">In Stock</span>
      <span class="discount">10% OFF</span>
    </div>
    <div class="product-card">
      <h3 class="name">SmartBand Health Tracker</h3>
      <span class="price">₹3499</span>
      <span class="rating">4.5</span>
      <span class="availability">In Stock</span>
      <span class="discount">15% OFF</span>
    </div>
    <div class="product-card">
      <h3 class="name">UltraHD Action Camera 4K</h3>
      <span class="price">₹7999</span>
      <span class="rating">3.9</span>
      <span class="availability">Out of Stock</span>
      <span class="discount">5% OFF</span>
    </div>
  </div>
</body>
</html>`;
  } else {
    return `<!DOCTYPE html>
<html>
<head><title>Gadget Shop - Version 2</title></head>
<body>
  <h1>Trending Electronic Products (v2)</h1>
  <div class="product-list">
    <div class="product-item">
      <h3 class="product-title">AcousticPro Wireless Headphones</h3>
      <span class="price-value" data-price="1999">₹1,999</span>
      <span class="rating-badge">4.2 Stars</span>
      <span class="stock-status">Available</span>
      <span class="promo-text">Save 10%</span>
    </div>
    <div class="product-item">
      <h3 class="product-title">SmartBand Health Tracker</h3>
      <span class="price-value" data-price="3499">₹3,499</span>
      <span class="rating-badge">4.5 Stars</span>
      <span class="stock-status">Available</span>
      <span class="promo-text">Save 15%</span>
    </div>
    <div class="product-item">
      <h3 class="product-title">UltraHD Action Camera 4K</h3>
      <span class="price-value" data-price="7999">₹7,999</span>
      <span class="rating-badge">3.9 Stars</span>
      <span class="stock-status">Out of Stock</span>
      <span class="promo-text">Save 5%</span>
    </div>
  </div>
</body>
</html>`;
  }
}
