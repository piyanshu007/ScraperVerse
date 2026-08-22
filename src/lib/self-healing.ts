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

  // Blacklist common UI buttons and action labels
  const uiBlacklist = [
    'add to basket', 'add to cart', 'buy now', 'sign in', 'search', 'menu', 
    'navigation', 'footer', 'checkout', 'add to wish list', 'view details', 
    'details', 'next', 'previous', 'click here'
  ];
  if (uiBlacklist.includes(cleanVal)) {
    return false;
  }

  if (fieldName === 'discount') {
    if (cleanVal.length > 40) return false;
    // Discount strings should represent savings/reductions with explicit word boundaries or percent symbols (removing standalone dash)
    const discountRegex = /%|\boff\b|\bsave\b|\bdiscount\b|\bpromo\b|\breduction\b/i;
    return discountRegex.test(cleanVal);
  }

  if (fieldName === 'availability') {
    if (cleanVal.length > 60) return false;
    // Availability should match precise stock status or delivery keywords using word boundaries
    const availRegex = /^(?!.*(?:location|address|pincode|postal|enter|select|seller|enhancement|choose|chosen|list|cardName|image|emi|option|pay|free|checkout|from)).*\b(?:in[- ]*stock|out[- ]*of[- ]*stock|available|unavailable|left|ships|only|delivery)\b/i;
    return availRegex.test(cleanVal);
  }

  if (fieldName === 'rating') {
    // Reject ambiguous single digit numbers (like quantity dropdown '1') unless selector is explicitly rating-related
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

/**
 * Generates potential CSS selectors for elements inside a container.
 */
function generateFieldCandidates(html: string, containerSelector: string, fieldName: string): string[] {
  const $ = cheerio.load(html);
  const container = $(containerSelector).first();
  if (container.length === 0) return [];

  const candidatesSet = new Set<string>();

  // Add fallback selectors based on field type
  if (fieldName === 'name') {
    candidatesSet.add('h1');
    candidatesSet.add('h2');
    candidatesSet.add('h3');
  } else if (fieldName === 'price') {
    candidatesSet.add('span');
    candidatesSet.add('div');
  }

  // Define semantic validation filters for each field type
  const isMatchForField = (text: string): boolean => {
    const clean = text.trim().toLowerCase();
    if (clean.length === 0) return false;
    
    if (fieldName === 'price') {
      return /[0-9]/.test(clean) && clean.length <= 30;
    }
    if (fieldName === 'rating') {
      return (/[0-9]/.test(clean) || clean.includes('star') || clean.includes('review') || clean.includes('rating')) && clean.length <= 40;
    }
    if (fieldName === 'discount') {
      return (clean.includes('%') || /\boff\b|\bsave\b|\bdiscount\b/i.test(clean)) && clean.length <= 50;
    }
    if (fieldName === 'availability') {
      return /^(?!.*(?:location|address|pincode|postal|enter|select|seller|enhancement|choose|chosen|list|cardName|image|emi|option|pay|free|checkout|from)).*\b(?:in[- ]*stock|out[- ]*of[- ]*stock|available|unavailable|left|ships|only|delivery)\b/i.test(clean) && clean.length <= 60;
    }
    if (fieldName === 'name') {
      const uiBlacklist = ['add to cart', 'buy now', 'sign in', 'search', 'menu', 'navigation', 'footer', 'checkout', 'my account'];
      return clean.length > 5 && clean.length <= 150 && !uiBlacklist.includes(clean);
    }
    return true;
  };

  // Traverse all descendants of the first container element
  container.find('*').each((_, el) => {
    const $el = $(el);
    const textVal = $el.text().trim();
    
    if (!isMatchForField(textVal)) {
      return;
    }

    const tagName = el.tagName.toLowerCase();
    candidatesSet.add(tagName);

    const classAttr = $el.attr('class');
    if (classAttr) {
      const classes = classAttr
        .split(/\s+/)
        .filter(c => c.trim().length > 0 && !/[{}[\]():=.,#]/.test(c));
      for (const cls of classes) {
        candidatesSet.add(`.${cls}`);
        candidatesSet.add(`${tagName}.${cls}`);
      }
    }
    
    const attribs = el.attribs;
    if (attribs) {
      for (const attr of Object.keys(attribs)) {
        if (attr.startsWith('data-')) {
          candidatesSet.add(`[${attr}]`);
          candidatesSet.add(`${tagName}[${attr}]`);
        }
      }
    }
  });

  return Array.from(candidatesSet).slice(0, 250);
}

/**
 * Generates potential container selectors if the current one extracts 0 records.
 */
function generateContainerCandidates(html: string): string[] {
  const $ = cheerio.load(html);
  const candidatesSet = new Set<string>();

  // Add common single-product wrappers and page roots as containers for detail pages
  const singleProductContainers = [
    'body', 'main', '#container', '#main', '#content', 
    'div#container', 'div#centerCol', 'div#ppd', 
    '.product-detail', '.product-page', '.product-single', '.product-details'
  ];
  for (const sel of singleProductContainers) {
    if ($(sel).length > 0) candidatesSet.add(sel);
  }

  // Look for common wrapper classes/elements
  const commonClasses = ['product-card', 'product-item', 'product', 'item', 'card', 'post', 'row'];
  for (const cls of commonClasses) {
    if ($(`.${cls}`).length > 0) candidatesSet.add(`.${cls}`);
    if ($(`div.${cls}`).length > 0) candidatesSet.add(`div.${cls}`);
  }

  // Scan all divs with classes containing 'product' or 'item'
  $('div[class]').each((_, el) => {
    const classAttr = $(el).attr('class') || '';
    const classes = classAttr.split(/\s+/);
    for (const cls of classes) {
      if (cls.includes('product') || cls.includes('item') || cls.includes('card')) {
        candidatesSet.add(`.${cls}`);
      }
    }
  });

  // Basic selectors
  if ($('tr').length > 1) candidatesSet.add('tr');
  if ($('li').length > 1) candidatesSet.add('li');

  // Hard cap: prevent OOM/timeout crash with large DOM trees (many colour/size variants)
  return Array.from(candidatesSet).slice(0, 250);
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

  // Extract raw HTML from scraped records if the main parameter is empty
  let activeHtml = html;
  if (!activeHtml && scrapedRecords.length > 0) {
    activeHtml = extractHtmlSample(scrapedRecords);
  }

  if (!activeHtml) {
    logActivity(`Self-healing failed: No raw HTML available.`, 'error');
    return {
      monitorId,
      repairedConfig,
      success: false,
      events: [],
    };
  }

  // Step 1: Check if container selector works. If not, heal the container first.
  const $ = cheerio.load(activeHtml);
  let initialRecords = extractData($, repairedConfig);
  const initialValidation = validateDataset(initialRecords, schema);
  const initialHasRequiredFailures = initialValidation.failedFields.some(field => schema[field].required);

  if (initialHasRequiredFailures || initialRecords.length === 0) {
    logActivity(`Container selector "${repairedConfig.containerSelector}" returned 0 records. Healing container...`, 'info');
    const containerCandidates = generateContainerCandidates(activeHtml);
    let bestContainer = repairedConfig.containerSelector;
    let maxCount = 0;

    const originalContainerCount = $(currentConfig.containerSelector).length;
    let bestScore = -9999;
    
    const getFieldCoverageCount = (containerSel: string): number => {
      const el = $(containerSel).first();
      if (el.length === 0) return 0;
      
      let coverage = 0;
      for (const [field, config] of Object.entries(schema)) {
        let found = false;
        el.find('*').each((_, desc) => {
          const txt = $(desc).text().trim();
          const clean = txt.toLowerCase();
          
          if (field === 'price') {
            if (/[0-9]/.test(clean) && clean.length <= 30) {
              found = true;
              return false;
            }
          } else if (field === 'name') {
            const uiBlacklist = ['add to cart', 'buy now', 'sign in', 'search', 'menu', 'navigation', 'footer', 'checkout', 'my account'];
            if (clean.length > 5 && clean.length <= 150 && !uiBlacklist.includes(clean)) {
              found = true;
              return false;
            }
          } else if (field === 'rating') {
            const num = parseFloat(clean);
            const isNumRating = !isNaN(num) && num >= 1 && num <= 5;
            if (isNumRating || clean.includes('star') || clean.includes('rating') || clean.includes('review')) {
              found = true;
              return false;
            }
          } else if (field === 'availability') {
            const availRegex = /^(?!.*(?:location|address|pincode|postal|enter|select|seller|enhancement|choose|chosen|list|cardName|image|emi|option|pay|free|checkout|from)).*\b(?:in[- ]*stock|out[- ]*of[- ]*stock|available|unavailable|left|ships|only|delivery)\b/i;
            if (availRegex.test(clean)) {
              found = true;
              return false;
            }
          } else if (field === 'discount') {
            if ((clean.includes('%') || clean.includes('off') || clean.includes('save') || clean.includes('discount')) && clean.length <= 50) {
              found = true;
              return false;
            }
          } else {
            if (clean.length > 0) {
              found = true;
              return false;
            }
          }
        });
        
        if (found) coverage++;
      }
      return coverage;
    };

    const hasRequiredFieldsHeuristics = (containerSel: string): boolean => {
      const el = $(containerSel).first();
      if (el.length === 0) return false;
      
      const requiredFields = Object.keys(schema).filter(f => schema[f].required);
      
      for (const field of requiredFields) {
        let found = false;
        el.find('*').each((_, desc) => {
          const txt = $(desc).text().trim();
          const clean = txt.toLowerCase();
          
          if (field === 'price') {
            if (/[0-9]/.test(clean) && clean.length <= 30) {
              found = true;
              return false;
            }
          } else if (field === 'name') {
            const uiBlacklist = ['add to cart', 'buy now', 'sign in', 'search', 'menu', 'navigation', 'footer', 'checkout', 'my account'];
            if (clean.length > 5 && clean.length <= 150 && !uiBlacklist.includes(clean)) {
              found = true;
              return false;
            }
          } else {
            if (clean.length > 0) {
              found = true;
              return false;
            }
          }
        });
        
        if (!found) return false;
      }
      return true;
    };

    for (const candidate of containerCandidates) {
      if (!hasRequiredFieldsHeuristics(candidate)) {
        continue;
      }
      let count = 0;
      try {
        count = $(candidate).length;
      } catch {
        continue;
      }
      
      let score = 0;
      if (originalContainerCount <= 1) {
        if (count === 1) {
          score = 100;
          // Prefer ID selectors, then class selectors, then tags
          if (candidate.includes('#')) score += 10;
          else if (candidate.includes('.')) score += 5;
        } else {
          score = 10 - count;
        }
      } else {
        if (count > 1) {
          score = count;
          if (candidate.includes('.')) score += 5;
        } else {
          score = 0;
        }
      }
      
      score += getFieldCoverageCount(candidate) * 20;
      console.log(`  Container candidate: "${candidate}" | Count: ${count} | Score: ${score}`);
      if (score > bestScore) {
        bestScore = score;
        bestContainer = candidate;
      }
    }

    if (bestContainer !== repairedConfig.containerSelector) {
      logActivity(`Repaired container selector: "${repairedConfig.containerSelector}" -> "${bestContainer}" (${maxCount} containers found)`, 'success');
      repairedConfig.containerSelector = bestContainer;
      // Re-extract (might still be empty if all fields are broken, but the container is now correct!)
      initialRecords = extractData($, repairedConfig);
    } else {
      logActivity(`Could not find a better container selector. Sticking with "${repairedConfig.containerSelector}"`, 'error');
    }
  }

  // Step 2: Validate the current extraction to see which fields are broken
  const validationReport = validateDataset(initialRecords, schema);
  const brokenFields = validationReport.failedFields;

  if (brokenFields.length === 0 && initialRecords.length > 0) {
    logActivity(`No schema validation failures detected. Active selectors are valid.`, 'success');
    return {
      monitorId,
      repairedConfig,
      success: true,
      events: [],
    };
  }

  logActivity(`Detected broken fields: ${brokenFields.join(', ')}`, 'warning');

  // Step 3: Heal each broken field
  for (const fieldName of brokenFields) {
    const previousSelector = currentConfig.fields[fieldName] || '';
    logActivity(`Generating candidate selectors for field "${fieldName}"...`, 'info');
    
    // Generate candidates
    const candidates = generateFieldCandidates(activeHtml, repairedConfig.containerSelector, fieldName);
    const candidateScoring: CandidateScoring[] = [];

    // Test and score each candidate — wrapped in try/catch so one bad selector never crashes the loop
    for (const candidate of candidates) {
      if (fieldName !== 'price' && candidate === repairedConfig.fields.price) {
        continue;
      }

      let testRecords: ExtractedRecord[] = [];
      try {
        // Test configuration where ONLY this field is changed to the candidate selector
        const testFields = { ...repairedConfig.fields, [fieldName]: candidate };
        const testConfig: ExtractionConfig = {
          containerSelector: repairedConfig.containerSelector,
          fields: testFields,
        };
        testRecords = extractData($, testConfig);
      } catch {
        // Skip selectors that cheerio cannot parse (e.g. invalid generated from huge swatch lists)
        continue;
      }

      // Calculate how many times this field is valid according to schema rules
      let validCount = 0;
      const fieldConfig = schema[fieldName];

      for (const rec of testRecords) {
        const val = rec[fieldName];
        if (val === undefined || val === null || val === '') continue;

        // Perform semantic value checking first
        if (!isValidSemanticValue(fieldName, String(val), candidate)) {
          continue;
        }

        if (fieldConfig.type === 'number') {
          let num = Number(val);
          if (isNaN(num) && typeof val === 'string') {
            const cleaned = val.replace(/,/g, '');
            const match = cleaned.match(/[\d.]+/);
            if (match) {
              num = parseFloat(match[0]);
            }
          }
          if (!isNaN(num)) {
            if ((fieldConfig.min === undefined || num >= fieldConfig.min) && 
                (fieldConfig.max === undefined || num <= fieldConfig.max)) {
              validCount++;
            }
          }
        } else {
          if (typeof val === 'string' && isValidSemanticValue(fieldName, val, candidate)) {
            validCount++;
          }
        }
      }

      // Score is percentage of matching containers where valid data is extracted
      let totalContainers = 0;
      try {
        totalContainers = $(repairedConfig.containerSelector).length;
      } catch {}
      let score = totalContainers > 0 ? (validCount / totalContainers) * 100 : 0;

      // Semantic matching bonus: reward selectors containing field name or synonyms
      const lowerSelector = candidate.toLowerCase();
      const lowerFieldName = fieldName.toLowerCase();
      const synonyms: Record<string, string[]> = {
        name: ['name', 'title', 'heading', 'brand', 'h1', 'h2'],
        price: ['price', 'value', 'amount', 'cost'],
        rating: ['rating', 'stars', 'score', 'badge'],
        availability: ['availability', 'stock', 'status'],
        discount: ['discount', 'promo', 'save', 'off'],
      };

      const terms = synonyms[lowerFieldName] || [lowerFieldName];
      if (terms.some(term => lowerSelector.includes(term))) {
        score += 15; // 15% semantic bonus
      }
      
      candidateScoring.push({
        selector: candidate,
        validCount,
        score: Math.round(score * 10) / 10,
      });
    }

    // Sort candidates: highest score first, then prioritize class/attribute selectors over tags, then shorter length
    candidateScoring.sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      
      const aIsTag = !a.selector.includes('.') && !a.selector.includes('[');
      const bIsTag = !b.selector.includes('.') && !b.selector.includes('[');
      if (aIsTag !== bIsTag) {
        return aIsTag ? 1 : -1; // Keep non-tag first
      }
      
      return a.selector.length - b.selector.length;
    });

    const bestCandidate = candidateScoring[0];
    if (bestCandidate && bestCandidate.score > 0) {
      repairedConfig.fields[fieldName] = bestCandidate.selector;
      
      // Test run with the repaired config
      const healedRecords = extractData($, repairedConfig);
      const postValidation = validateDataset(healedRecords, schema);

      logActivity(
        `Field "${fieldName}" successfully repaired: "${previousSelector}" -> "${bestCandidate.selector}" (Score: ${bestCandidate.score}%)`,
        'success'
      );

      events.push({
        fieldName,
        previousSelector,
        repairedSelector: bestCandidate.selector,
        recordsBefore: validationReport.validRecordsCount,
        recordsAfter: healedRecords.filter(r => r[fieldName] !== undefined && r[fieldName] !== null).length,
        confidence: postValidation.confidence,
        candidatesTested: candidateScoring.slice(0, 10), // Limit history to top 10
      });
    } else {
      if (schema[fieldName].required) {
        overallSuccess = false;
      }
      logActivity(`Could not find a valid repair candidate for optional or required field "${fieldName}" (Required: ${schema[fieldName].required})`, 'warning');
    }
  }

  // Update DB configs and log event history if repairs were attempted and healing overall succeeded
  if (events.length > 0) {
    const finalRecords = extractData($, repairedConfig);
    const finalValidation = validateDataset(finalRecords, schema);

    // If healed dataset is still invalid or empty, healing is considered failed!
    const hasRequiredFailures = finalValidation.failedFields.some(field => schema[field].required);
    if (hasRequiredFailures || finalRecords.length === 0) {
      overallSuccess = false;
    }

    if (overallSuccess) {
      // Save repaired configuration to monitor in DB
      const monitorIdx = db.monitors.findIndex(m => m.id === monitorId);
      if (monitorIdx !== -1) {
        db.monitors[monitorIdx].selectors = {
          container: repairedConfig.containerSelector,
          ...repairedConfig.fields,
        };
        
        // Update scraper status to HEALTHY
        const scraperIdx = db.scrapers.findIndex(s => s.monitorId === monitorId);
        if (scraperIdx !== -1) {
          db.scrapers[scraperIdx].status = 'HEALTHY';
        }
      }

      // Record the repair event
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
    } else {
      logActivity(`Self-healing completed but did not result in a valid extraction schema. Changes discarded.`, 'warning');
    }
  }

  return {
    monitorId,
    repairedConfig,
    success: overallSuccess,
    events,
  };
}
