import { ExtractedRecord } from './extractor';

export interface ScrapeResult {
  records: ExtractedRecord[];
  collectionId?: string;
  isMock: boolean;
  rawHtml: string;
  status: 'SUCCESS' | 'FAILED';
  error?: string;
  tier?: 'collector' | 'web-unlocker' | 'local';
}

// ─────────────────────────────────────────────────────────────────────────────
// Universal field normalizer
// Maps the 50+ field-name variations that different BrightData collectors,
// Amazon scrapers, and generic e-commerce crawlers return → our schema.
// ─────────────────────────────────────────────────────────────────────────────

const NAME_KEYS = [
  'name', 'title', 'product_name', 'productName', 'product_title', 'productTitle',
  'item_name', 'itemName', 'listing_title', 'listingTitle', 'heading',
  'prodTitle', 'prod_title', 'label', 'brand_name', 'display_name',
];

const PRICE_KEYS = [
  'price', 'selling_price', 'sellingPrice', 'sale_price', 'salePrice',
  'final_price', 'finalPrice', 'current_price', 'currentPrice', 'actual_price',
  'actualPrice', 'offer_price', 'offerPrice', 'discounted_price', 'discountedPrice',
  'price_amount', 'priceAmount', 'buy_price', 'buyPrice', 'listed_price', 'listedPrice',
  'unit_price', 'unitPrice', 'cost', 'amount',
];

const RATING_KEYS = [
  'rating', 'stars', 'star_rating', 'starRating', 'stars_rating', 'starsRating',
  'review_rating', 'reviewRating', 'ratings', 'rating_value', 'ratingValue',
  'average_rating', 'averageRating', 'score', 'review_score', 'reviewScore',
  'product_rating', 'productRating', 'overall_rating', 'overallRating',
];

const AVAILABILITY_KEYS = [
  'availability', 'stock', 'in_stock', 'inStock', 'stock_status', 'stockStatus',
  'available', 'stock_availability', 'stockAvailability', 'inventory_status',
  'inventoryStatus', 'is_available', 'isAvailable', 'is_in_stock', 'isInStock',
  'product_availability', 'productAvailability', 'fulfillment_availability',
];

const DISCOUNT_KEYS = [
  'discount', 'offer', 'savings', 'discount_percentage', 'discountPercentage',
  'discount_amount', 'discountAmount', 'deal', 'badge', 'offer_text', 'offerText',
  'promotion', 'promo', 'save', 'coupon', 'percentage_off', 'percentageOff',
];

function pickFirst(record: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null && record[key] !== '') {
      return record[key];
    }
  }
  return undefined;
}

function toNumber(val: unknown): number | undefined {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    const cleaned = val.replace(/[^\d.]/g, '');
    const n = parseFloat(cleaned);
    return isNaN(n) ? undefined : n;
  }
  return undefined;
}

/**
 * Normalizes a raw BrightData record (with any field names) into our ExtractedRecord schema.
 * Also passes through any extra fields (images, URLs, etc.) via spread.
 */
export function normalizeRecord(raw: Record<string, unknown>): ExtractedRecord {
  const name = pickFirst(raw, NAME_KEYS);
  const priceRaw = pickFirst(raw, PRICE_KEYS);
  const ratingRaw = pickFirst(raw, RATING_KEYS);
  const availability = pickFirst(raw, AVAILABILITY_KEYS);
  const discount = pickFirst(raw, DISCOUNT_KEYS);

  const normalized: ExtractedRecord = { ...raw }; // keep all original fields too

  if (name !== undefined) normalized.name = String(name);
  if (priceRaw !== undefined) {
    const p = toNumber(priceRaw);
    if (p !== undefined) normalized.price = p;
  }
  if (ratingRaw !== undefined) {
    const r = toNumber(ratingRaw);
    if (r !== undefined) normalized.rating = r;
  }
  if (availability !== undefined) normalized.availability = String(availability);
  if (discount !== undefined) normalized.discount = String(discount);

  return normalized;
}

/** Filter + normalize raw Bright Data records — remove empty/invalid rows */
function processRecords(raw: unknown[]): Record<string, unknown>[] {
  return raw
    .filter((r): r is Record<string, unknown> => !!r && typeof r === 'object' && !Array.isArray(r))
    .map(r => normalizeRecord(r))
    .filter(r => !!(r.name || r.price)); // must have at least a name or price to be valid
}

// ─────────────────────────────────────────────────────────────────────────────
// Tier 1 — BrightData Scraper Studio collector
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Trigger a Bright Data Data Collector job and poll until results arrive.
 * NOTE: This works reliably only when the collector is configured with a
 *       dynamic input URL (not a hardcoded one inside Scraper Studio).
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
        console.log('[BrightData] Raw JSON from collector:', JSON.stringify(json).substring(0, 3000));
        const records = processRecords(json);
        console.log(`[BrightData] Done — ${json.length} raw → ${records.length} valid records.`);
        return {
          records: records as ExtractedRecord[],
          collectionId,
          isMock: false,
          rawHtml: '',
          status: records.length > 0 ? 'SUCCESS' : 'FAILED',
          tier: 'collector',
        };
      }
    }

    // ── NDJSON / text response ────────────────────────────────────────────────
    if (
      contentType.includes('text/plain') ||
      contentType.includes('application/x-ndjson') ||
      contentType.includes('text/ndjson') ||
      contentType.includes('application/jsonl')
    ) {
      const text = await dataRes.text();
      const rawRecords = text
        .trim()
        .split('\n')
        .filter(Boolean)
        .map(line => { try { return JSON.parse(line); } catch { return null; } })
        .filter(Boolean);

      console.log('[BrightData] Raw NDJSON from collector:', JSON.stringify(rawRecords).substring(0, 3000));
      const records = processRecords(rawRecords as unknown[]);
      console.log(`[BrightData] Done (NDJSON) — ${rawRecords.length} raw → ${records.length} valid records.`);
      return {
        records: records as ExtractedRecord[],
        collectionId,
        isMock: false,
        rawHtml: '',
        status: records.length > 0 ? 'SUCCESS' : 'FAILED',
        tier: 'collector',
      };
    }

    console.log(`[BrightData] Attempt ${attempt}/${MAX_ATTEMPTS} — no data yet, retrying…`);
  }

  return {
    records: [],
    isMock: false,
    rawHtml: '',
    status: 'FAILED',
    error: 'Timed out waiting for Bright Data results (5 min).',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Tier 2 — BrightData Web Unlocker
// Works for ANY URL — BrightData rotates proxies + handles JS rendering/captchas
// Returns raw HTML that is then parsed locally by our extractData() pipeline.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetches a URL via BrightData Web Unlocker and returns the raw HTML.
 * This bypasses bot detection on Amazon, Flipkart, and any other site.
 *
 * Uses the BrightData Web Unlocker REST API:
 *   POST https://api.brightdata.com/request
 *   body: { zone: 'web_unlocker1', url, format: 'raw', country: 'us' }
 *
 * Falls back to the /dca/html-fetch endpoint for older account types.
 */
export async function fetchWithWebUnlocker(url: string): Promise<{ html: string; error?: string }> {
  const apiKey = process.env.BRIGHTDATA_API_KEY!;

  if (!apiKey) {
    return { html: '', error: 'BRIGHTDATA_API_KEY not set' };
  }

  console.log(`[BrightData] Web Unlocker fetching: ${url}`);

  try {
    // Primary: Web Unlocker REST API (requires Web Unlocker zone enabled in BrightData dashboard)
    const res = await fetch('https://api.brightdata.com/request', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        zone: 'web_unlocker1',
        url,
        format: 'raw',
        country: 'us',
      }),
    });

    if (res.ok) {
      const html = await res.text();
      if (html && html.length > 500) {
        console.log(`[BrightData] Web Unlocker fetched HTML (${html.length} bytes) for ${url}`);
        return { html };
      }
    }

    const errText = res.ok ? 'Empty response' : await res.text();
    console.warn(`[BrightData] Web Unlocker primary endpoint failed (${res.status}): ${errText.substring(0, 300)}`);

    // Fallback: older /dca/html-fetch endpoint some BrightData plans support
    const fallbackRes = await fetch(
      `https://api.brightdata.com/dca/html-fetch?url=${encodeURIComponent(url)}`,
      { headers: { 'Authorization': `Bearer ${apiKey}` } }
    );

    if (fallbackRes.ok) {
      const html = await fallbackRes.text();
      if (html && html.length > 500) {
        console.log(`[BrightData] Web Unlocker (fallback endpoint) fetched HTML (${html.length} bytes) for ${url}`);
        return { html };
      }
    }

    const fallbackErr = await fallbackRes.text().catch(() => 'unknown');
    return {
      html: '',
      error: `Web Unlocker both endpoints failed. Primary: ${res.status}. Fallback: ${fallbackRes.status} — ${fallbackErr.substring(0, 100)}`,
    };
  } catch (e: any) {
    console.error(`[BrightData] Web Unlocker exception:`, e.message);
    return { html: '', error: e.message };
  }
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
