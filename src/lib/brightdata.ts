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
 * Normalize a raw Bright Data record to our standard field names.
 * Bright Data returns fields like `title`, `selling_price`, `stars`, etc.
 * We map these to: name, price, rating, availability, discount.
 */
function normalizeRecord(raw: Record<string, unknown>): Record<string, unknown> {
  const r: Record<string, unknown> = {};

  // Name / title
  r.name = raw.name ?? raw.title ?? raw.product_name ?? raw.product_title ?? raw.item_name ?? '';

  // Price — try numeric fields first, then string fields
  const priceRaw =
    raw.price ?? raw.selling_price ?? raw.final_price ?? raw.current_price ??
    raw.discounted_price ?? raw.sale_price ?? raw.offer_price ?? raw.mrp ?? '';
  if (typeof priceRaw === 'number') {
    r.price = priceRaw;
  } else if (typeof priceRaw === 'string') {
    const cleaned = priceRaw.replace(/[^\d.]/g, '');
    r.price = cleaned ? parseFloat(cleaned) : '';
  } else {
    r.price = '';
  }

  // Rating
  const ratingRaw = raw.rating ?? raw.stars ?? raw.star_rating ?? raw.review_stars ?? raw.avg_rating ?? '';
  if (typeof ratingRaw === 'number') {
    r.rating = ratingRaw;
  } else if (typeof ratingRaw === 'string') {
    const m = String(ratingRaw).match(/[\d.]+/);
    r.rating = m ? parseFloat(m[0]) : '';
  } else {
    r.rating = '';
  }

  // Availability
  const availRaw = raw.availability ?? raw.stock ?? raw.in_stock ?? raw.stock_status ?? raw.availability_status ?? '';
  if (typeof availRaw === 'boolean') {
    r.availability = availRaw ? 'In Stock' : 'Out of Stock';
  } else {
    const lower = String(availRaw).toLowerCase();
    if (lower.includes('out') || lower.includes('unavailable') || lower.includes('sold out')) {
      r.availability = 'Out of Stock';
    } else if (availRaw) {
      r.availability = 'In Stock';
    } else {
      r.availability = '';
    }
  }

  // Discount
  r.discount = raw.discount ?? raw.discount_percentage ?? raw.savings ?? raw.you_save ?? raw.badge ?? '';
  if (r.discount && typeof r.discount === 'string' && !String(r.discount).includes('%')) {
    r.discount = String(r.discount).trim() || '';
  }

  // Pass through any extra fields (url, image, etc.)
  for (const [k, v] of Object.entries(raw)) {
    if (!(k in r)) r[k] = v;
  }

  return r;
}

/** Filter + normalize raw Bright Data records — remove empty/invalid rows */
function processRecords(raw: unknown[]): Record<string, unknown>[] {
  return raw
    .filter((r): r is Record<string, unknown> => !!r && typeof r === 'object' && !Array.isArray(r))
    .map(r => normalizeRecord(r))
    .filter(r => !!(r.name || r.price)); // must have at least a name or price to be valid
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

  console.log(`[BrightData] Triggering collector ${collectorId} for ${url}`);

  // ── Step 1: Trigger ────────────────────────────────────────────────────────
  const triggerRes = await fetch(
    `https://api.brightdata.com/dca/trigger?collector=${collectorId}&queue_next=1`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([{ url }]),
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
        console.log('[BrightData] Raw JSON from collector:', JSON.stringify(json));
        const records = processRecords(json);
        console.log(`[BrightData] Done — ${json.length} raw → ${records.length} valid records.`);
        return {
          records: records as ExtractedRecord[],
          collectionId,
          isMock: false,
          rawHtml: '',
          status: records.length > 0 ? 'SUCCESS' : 'FAILED',
        };
      }
    }

    // ── NDJSON / text response ────────────────────────────────────────────────
    if (contentType.includes('text/plain') || contentType.includes('application/x-ndjson') || contentType.includes('text/ndjson') || contentType.includes('application/jsonl')) {
      const text = await dataRes.text();
      const rawRecords = text
        .trim()
        .split('\n')
        .filter(Boolean)
        .map(line => { try { return JSON.parse(line); } catch { return null; } })
        .filter(Boolean);

      console.log('[BrightData] Raw NDJSON from collector:', JSON.stringify(rawRecords));
      const records = processRecords(rawRecords);
      console.log(`[BrightData] Done (NDJSON) — ${rawRecords.length} raw → ${records.length} valid records.`);
      return {
        records: records as ExtractedRecord[],
        collectionId,
        isMock: false,
        rawHtml: '',
        status: records.length > 0 ? 'SUCCESS' : 'FAILED',
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
