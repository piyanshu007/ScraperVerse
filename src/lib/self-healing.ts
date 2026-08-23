import * as cheerio from 'cheerio';
import { extractData, ExtractionConfig, ExtractedRecord } from './extractor';
import { SchemaConfig, validateDataset } from './validation';
import { readDb, writeDb, logActivity, RepairEvent } from './db';

function extractHtmlSample(records: any[]): string {
  for (const record of records) {
    const html = record['_html'] ?? record['html'] ?? record.data?.['_html'] ?? record.data?.['html'];
    if (typeof html === 'string' && html.trim().length > 100) return html;
  }
  return '';
}

function isValidSemanticValue(fieldName: string, val: string, selector: string): boolean {
  const cleanVal = val.trim().toLowerCase();
  if (cleanVal.length === 0) return false;

  const uiBlacklist = [
    'add to basket', 'add to cart', 'buy now', 'sign in', 'search', 'menu',
    'navigation', 'footer', 'checkout', 'add to wish list', 'view details',
    'details', 'next', 'previous', 'click here',
  ];
  if (uiBlacklist.includes(cleanVal)) return false;

  if (fieldName === 'discount') {
    if (cleanVal.length > 60) return false;
    const discountRegex = /\d+%|%\s*off|%\s*discount|\boff\b|\bsave\b|\bsaving[s]?\b|\bdiscount\b|\bpromo\b|\breduction\b|\bdeal\b|\bcoupon\b|\bextra\b|\bbadge\b|\blimited\b|\bflat\b/i;
    return discountRegex.test(cleanVal);
  }

  if (fieldName === 'availability') {
    if (cleanVal.length > 80) return false;
    const availRegex = /\b(?:in[- ]*stock|out[- ]*of[- ]*stock|available|unavailable|left|delivery|ships|only|hurry|few|limited|sold[- ]*out|pre[- ]*order|backordered|expect|dispatch|arrive)\b/i;
    return availRegex.test(cleanVal);
  }

  if (fieldName === 'rating') {
    if (/^[1-5]$/.test(cleanVal)) {
      const selLower = selector.toLowerCase();
      const ratingKeywords = ['rating', 'star', 'review', 'popover', 'icon', 'acr', 'average'];
      return ratingKeywords.some(kw => selLower.includes(kw));
    }
  }

  return true;
}

interface CandidateScoring {
  selector: string;
  validCount: number;
  score: number;
}

export interface SelfHealingResult {
  monitorId: string;
  repairedConfig: ExtractionConfig;
  success: boolean;
  events: {
    fieldName: string;
    previousSelector: string;
    repairedSelector: string;
    recordsBefore: number;
    recordsAfter: number;
    confidence: number;
    candidatesTested: CandidateScoring[];
  }[];
}

// Platform-specific seed selectors per field — always included in candidate pool
const DISCOUNT_SEED_CANDIDATES = [
  '.savingsPercentage', '.a-badge-text', '#dealprice_savings', '#regularprice_savings .a-color-price',
  '.a-size-large.a-color-price', '.a-color-price', '.reinventPriceSavingsPercentageMargin',
  '._3Ay6Sb', '._2Tpdn3', '._11fVMJ',
  '[class*="discount"]', '[class*="save"]', '[class*="badge"]', '[class*="deal"]',
  '[class*="offer"]', '[class*="promo"]', '[class*="savings"]', '[class*="percent"]',
  '[class*="off"]', '[class*="sale"]', '.badge', '.tag', '.label',
  'del + span', 'del ~ span',
];

const AVAILABILITY_SEED_CANDIDATES = [
  '#availability span', '#availability .a-size-medium', '.a-size-medium.a-color-success',
  '[class*="stock"]', '[class*="availability"]', '[class*="available"]', '[class*="inventory"]',
  '.in-stock', '.out-of-stock', '.product-stock',
];

const PRICE_SEED_CANDIDATES = [
  '.a-price .a-offscreen', '#corePriceDisplay_desktop_feature_div .a-price .a-offscreen',
  '#priceblock_ourprice', '#priceblock_dealprice', '.a-price-whole',
  '._30jeq3', '._16Jk6d', '.s-item__price', '.currency-value',
  '[class*="price"]', '[itemprop="price"]', '[data-price]',
  '.price', '.product-price', '.offer-price', '.selling-price', '.sale-price',
];

const NAME_SEED_CANDIDATES = [
  '#productTitle', '#title span', '.B_NuCI', '.s-item__title',
  'h1', 'h2', 'h3', '.product-title', '.product-name', '.item-title',
  '[itemprop="name"]', '[class*="title"]', '[class*="name"]',
];

const RATING_SEED_CANDIDATES = [
  '#acrPopover .a-icon-alt', '.a-icon-star .a-icon-alt', '#averageCustomerReviews .a-icon-alt',
  '._3LWZlK', '.x-star-rating',
  '[class*="rating"]', '[class*="star"]', '[class*="review"]',
  '[itemprop="ratingValue"]', '.rating', '.stars',
];

function generateFieldCandidates(html: string, containerSelector: string, fieldName: string): string[] {
  const $ = cheerio.load(html);
  const candidatesSet = new Set<string>();

  // Field-specific seeds first
  const seedMap: Record<string, string[]> = {
    discount:     DISCOUNT_SEED_CANDIDATES,
    availability: AVAILABILITY_SEED_CANDIDATES,
    price:        PRICE_SEED_CANDIDATES,
    name:         NAME_SEED_CANDIDATES,
    rating:       RATING_SEED_CANDIDATES,
  };
  for (const seed of (seedMap[fieldName] || [])) {
    candidatesSet.add(seed);
  }

  // Semantic tag fallbacks
  for (const tag of ['span', 'div', 'h1', 'h2', 'h3', 'h4', 'p', 'strong', 'b', 'a', 'del', 's']) {
    candidatesSet.add(tag);
  }

  const container = $(containerSelector).first();
  const scanRoot = container.length > 0 ? container : $('body');

  scanRoot.find('*').each((_, el) => {
    const $el = $(el);
    const tagName = (el as any).tagName?.toLowerCase();
    if (!tagName) return;

    candidatesSet.add(tagName);

    const id = $el.attr('id');
    if (id && id.trim()) {
      candidatesSet.add(`#${id}`);
      candidatesSet.add(`${tagName}#${id}`);
    }

    const classAttr = $el.attr('class');
    if (classAttr) {
      const classes = classAttr.split(/\s+/).filter(c => c.trim().length > 0 && !/[{}[\]():=.,#]/.test(c));
      for (const cls of classes) {
        candidatesSet.add(`.${cls}`);
        candidatesSet.add(`${tagName}.${cls}`);
      }
    }

    const attribs = (el as any).attribs;
    if (attribs) {
      for (const attr of Object.keys(attribs)) {
        if (attr.startsWith('data-')) {
          candidatesSet.add(`[${attr}]`);
          candidatesSet.add(`${tagName}[${attr}]`);
        }
      }
    }
  });

  // Also scan body for discount/offer elements placed outside the container
  if (container.length > 0 && containerSelector !== 'body') {
    $('body').find('[class*="discount"],[class*="save"],[class*="badge"],[class*="deal"],[class*="offer"],[class*="promo"],[class*="percent"]').each((_, el) => {
      const classAttr = $(el).attr('class');
      if (classAttr) {
        classAttr.split(/\s+/).filter(c => c.trim().length > 1).forEach(cls => {
          candidatesSet.add(`.${cls}`);
        });
      }
    });
  }

  return Array.from(candidatesSet).slice(0, 120);
}

function generateContainerCandidates(html: string): string[] {
  const $ = cheerio.load(html);
  const candidatesSet = new Set<string>();

  const singleProductContainers = [
    'div#centerCol', 'div#ppd', 'div#dp-container', 'div#dp',
    '#centerCol', '#ppd', '#dp-container', '#dp',
    '._1AtVbE', '._2kHMtA', '.DOjaWF',
    '.product-detail', '.product-page', '.product-single', '.product-details',
    '.product-container', '.product-info', '.pdp-container', '.product-description',
    '.product-overview', '[itemtype*="Product"]',
    'main', '#main', '#content', '#container', 'body',
  ];
  for (const sel of singleProductContainers) {
    try { if ($(sel).length > 0) candidatesSet.add(sel); } catch {}
  }

  const commonClasses = [
    'product-card', 'product-item', 'product', 'item', 'card',
    's-result-item', 'sg-col-inner', 'a-section', 's-item', 'listing-card',
  ];
  for (const cls of commonClasses) {
    try { if ($(`.${cls}`).length > 0) candidatesSet.add(`.${cls}`); } catch {}
    try { if ($(`div.${cls}`).length > 0) candidatesSet.add(`div.${cls}`); } catch {}
  }

  $('div[class], article[class], li[class], section[class]').each((_, el) => {
    const classAttr = $(el).attr('class') || '';
    for (const cls of classAttr.split(/\s+/)) {
      if (cls.includes('product') || cls.includes('item') || cls.includes('card') || cls.includes('listing')) {
        try { candidatesSet.add(`.${cls}`); } catch {}
      }
    }
  });

  try { if ($('tr').length > 1) candidatesSet.add('tr'); } catch {}
  try { if ($('li').length > 1) candidatesSet.add('li'); } catch {}
  try { if ($('article').length > 0) candidatesSet.add('article'); } catch {}

  return Array.from(candidatesSet).slice(0, 80);
}

function isHealingGoodEnough(records: ExtractedRecord[], schema: SchemaConfig): boolean {
  if (records.length === 0) return false;

  const requiredFields = Object.entries(schema)
    .filter(([, cfg]) => cfg.required)
    .map(([field]) => field);

  for (const field of requiredFields) {
    const filled = records.filter(r => r[field] !== undefined && r[field] !== null && r[field] !== '').length;
    if (filled / records.length < 0.5) return false;
  }

  return true;
}

export async function healScraper(
  monitorId: string,
  html: string,
  currentConfig: ExtractionConfig,
  schema: SchemaConfig,
  scrapedRecords: any[] = []
): Promise<SelfHealingResult> {
  const db = readDb();
  let repairedConfig = { ...currentConfig, fields: { ...currentConfig.fields } };
  const events: SelfHealingResult['events'] = [];
  let overallSuccess = true;

  logActivity(`Self-healing initiated for monitor: ${monitorId}`, 'warning');

  let activeHtml = html;
  if (!activeHtml && scrapedRecords.length > 0) {
    activeHtml = extractHtmlSample(scrapedRecords);
  }

  if (!activeHtml) {
    logActivity(`Self-healing failed: No raw HTML available.`, 'error');
    return { monitorId, repairedConfig, success: false, events: [] };
  }

  const $ = cheerio.load(activeHtml);

  // ── Step 1: Container Healing ───────────────────────────────────────────────
  let initialRecords = extractData($, repairedConfig);
  const containerMatchCount = (() => { try { return $(repairedConfig.containerSelector).length; } catch { return 0; } })();

  if (initialRecords.length === 0 && containerMatchCount === 0) {
    logActivity(`Container "${repairedConfig.containerSelector}" matched 0 elements. Healing container...`, 'info');
    const containerCandidates = generateContainerCandidates(activeHtml);

    let bestContainer = repairedConfig.containerSelector;
    let bestScore = 0;

    for (const candidate of containerCandidates) {
      try {
        const testConfig: ExtractionConfig = { containerSelector: candidate, fields: repairedConfig.fields };
        const testRecords = extractData($, testConfig);
        const filledRecords = testRecords.filter(r =>
          (r.name && String(r.name).trim()) || (r.price !== undefined && r.price !== null)
        ).length;
        const matchCount = $(candidate).length;
        const score = filledRecords > 0 ? filledRecords * 10 + matchCount : matchCount * 0.1;
        if (score > bestScore) { bestScore = score; bestContainer = candidate; }
      } catch { continue; }
    }

    if (bestContainer !== repairedConfig.containerSelector) {
      logActivity(`Repaired container: "${repairedConfig.containerSelector}" → "${bestContainer}" (score: ${bestScore})`, 'success');
      repairedConfig.containerSelector = bestContainer;
      initialRecords = extractData($, repairedConfig);
    } else {
      logActivity(`Could not find a better container. Keeping "${repairedConfig.containerSelector}"`, 'warning');
    }
  }

  // ── Step 2: Identify broken fields ─────────────────────────────────────────
  const validationReport = validateDataset(initialRecords, schema);
  const brokenFields = validationReport.failedFields.filter(field => {
    const cfg = schema[field];
    if (!cfg) return false;
    if (cfg.required) return true;
    const status = validationReport.fieldStatus[field];
    if (!status) return false;
    return (status.missingCount === validationReport.totalRecords && validationReport.totalRecords > 0);
  });

  if (brokenFields.length === 0 && initialRecords.length > 0) {
    logActivity(`No broken fields detected. Active selectors are working.`, 'success');
    return { monitorId, repairedConfig, success: true, events: [] };
  }

  if (initialRecords.length === 0 && brokenFields.length === 0) {
    logActivity(`Self-healing: container returned 0 records and no fields to repair.`, 'error');
    return { monitorId, repairedConfig, success: false, events: [] };
  }

  logActivity(`Healing broken fields: ${brokenFields.join(', ')}`, 'warning');

  // ── Step 3: Heal each broken field ─────────────────────────────────────────
  for (const fieldName of brokenFields) {
    const previousSelector = currentConfig.fields[fieldName] || '';
    logActivity(`Generating candidates for field "${fieldName}"...`, 'info');

    const candidates = generateFieldCandidates(activeHtml, repairedConfig.containerSelector, fieldName);
    const candidateScoring: CandidateScoring[] = [];

    const totalContainers = (() => {
      try { return Math.max($(repairedConfig.containerSelector).length, 1); } catch { return 1; }
    })();

    for (const candidate of candidates) {
      if (fieldName !== 'price' && candidate === repairedConfig.fields.price) continue;

      let testRecords: ExtractedRecord[] = [];
      try {
        const testConfig: ExtractionConfig = {
          containerSelector: repairedConfig.containerSelector,
          fields: { ...repairedConfig.fields, [fieldName]: candidate },
        };
        testRecords = extractData($, testConfig);
      } catch { continue; }

      let validCount = 0;
      const fieldConfig = schema[fieldName];

      for (const rec of testRecords) {
        const val = rec[fieldName];
        if (val === undefined || val === null || val === '') continue;
        if (!isValidSemanticValue(fieldName, String(val), candidate)) continue;

        if (fieldConfig.type === 'number') {
          let num = Number(val);
          if (isNaN(num) && typeof val === 'string') {
            const match = val.replace(/,/g, '').match(/[\d.]+/);
            if (match) num = parseFloat(match[0]);
          }
          if (!isNaN(num)) {
            if ((fieldConfig.min === undefined || num >= fieldConfig.min) &&
                (fieldConfig.max === undefined || num <= fieldConfig.max)) {
              validCount++;
            }
          }
        } else {
          if (typeof val === 'string') validCount++;
        }
      }

      let score = (validCount / totalContainers) * 100;

      const lowerSelector = candidate.toLowerCase();
      const synonyms: Record<string, string[]> = {
        name:         ['name', 'title', 'heading', 'brand', 'product'],
        price:        ['price', 'value', 'amount', 'cost', 'offscreen', 'jeq'],
        rating:       ['rating', 'stars', 'score', 'badge', 'acr', 'popover'],
        availability: ['availability', 'stock', 'status', 'inventory'],
        discount:     ['discount', 'promo', 'save', 'off', 'savings', 'badge', 'deal', 'coupon', 'percent', 'sale'],
      };
      const terms = synonyms[fieldName] || [fieldName];
      if (terms.some(t => lowerSelector.includes(t))) score += 20;

      // Extra bonus for known-good discount seed candidates
      if (fieldName === 'discount' && DISCOUNT_SEED_CANDIDATES.includes(candidate)) score += 15;

      if (!candidate.includes('.') && !candidate.includes('#') && !candidate.includes('[')) score -= 5;

      candidateScoring.push({ selector: candidate, validCount, score: Math.round(score * 10) / 10 });
    }

    candidateScoring.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const aGeneric = !a.selector.includes('.') && !a.selector.includes('#');
      const bGeneric = !b.selector.includes('.') && !b.selector.includes('#');
      if (aGeneric !== bGeneric) return aGeneric ? 1 : -1;
      return a.selector.length - b.selector.length;
    });

    const bestCandidate = candidateScoring[0];
    if (bestCandidate && bestCandidate.score > 0) {
      repairedConfig.fields[fieldName] = bestCandidate.selector;
      const healedRecords = extractData($, repairedConfig);
      const postValidation = validateDataset(healedRecords, schema);

      logActivity(
        `Field "${fieldName}" repaired: "${previousSelector}" → "${bestCandidate.selector}" (score: ${bestCandidate.score}%)`,
        'success'
      );

      events.push({
        fieldName,
        previousSelector,
        repairedSelector: bestCandidate.selector,
        recordsBefore: validationReport.validRecordsCount,
        recordsAfter: healedRecords.filter(r => r[fieldName] !== undefined && r[fieldName] !== null).length,
        confidence: postValidation.confidence,
        candidatesTested: candidateScoring.slice(0, 10),
      });
    } else {
      if (schema[fieldName]?.required) overallSuccess = false;
      logActivity(`No valid repair found for field "${fieldName}" (required: ${schema[fieldName]?.required})`, 'warning');
    }
  }

  // ── Step 4: Decide whether to save ─────────────────────────────────────────
  if (events.length > 0) {
    const finalRecords = extractData($, repairedConfig);
    const finalValidation = validateDataset(finalRecords, schema);
    const healingGood = isHealingGoodEnough(finalRecords, schema);

    if (!healingGood) {
      overallSuccess = false;
      logActivity(`Self-healing repair didn't satisfy required fields — discarding changes.`, 'warning');
    } else {
      overallSuccess = true;

      const monitorIdx = db.monitors.findIndex(m => m.id === monitorId);
      if (monitorIdx !== -1) {
        db.monitors[monitorIdx].selectors = {
          container: repairedConfig.containerSelector,
          ...repairedConfig.fields,
        };
        const scraperIdx = db.scrapers.findIndex(s => s.monitorId === monitorId);
        if (scraperIdx !== -1) db.scrapers[scraperIdx].status = 'HEALTHY';
      }

      for (const ev of events) {
        const repairEvent: RepairEvent = {
          id: `rep_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
          monitorId,
          timestamp: new Date().toISOString(),
          fieldName: ev.fieldName,
          previousSelector: ev.previousSelector,
          repairedSelector: ev.repairedSelector,
          recordsBefore: ev.recordsBefore,
          recordsAfter: ev.recordsAfter,
          confidence: ev.confidence,
          status: 'SUCCESS',
          candidatesTested: ev.candidatesTested,
        };
        db.repairEvents.unshift(repairEvent);
      }

      writeDb(db);
      logActivity(`Self-healing saved. Final confidence: ${finalValidation.confidence}%.`, 'success');
    }
  }

  return { monitorId, repairedConfig, success: overallSuccess, events };
}
