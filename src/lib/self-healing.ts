import * as cheerio from 'cheerio';
import { extractData, ExtractionConfig } from './extractor';
import { SchemaConfig, validateDataset } from './validation';
import { readDb, writeDb, logActivity, RepairEvent } from './db';

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
function generateFieldCandidates(html: string, containerSelector: string): string[] {
  const $ = cheerio.load(html);
  const container = $(containerSelector).first();
  if (container.length === 0) return [];

  const candidatesSet = new Set<string>();

  // Add some fallback selectors
  candidatesSet.add('span');
  candidatesSet.add('div');
  candidatesSet.add('h3');

  // Traverse all descendants of the first container element
  container.find('*').each((_, el) => {
    const $el = $(el);
    const tagName = el.tagName.toLowerCase();

    // 1. Tag name
    candidatesSet.add(tagName);

    // 2. Class names
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

    // 3. Data attributes
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

  return Array.from(candidatesSet);
}

/**
 * Generates potential container selectors if the current one extracts 0 records.
 */
function generateContainerCandidates(html: string): string[] {
  const $ = cheerio.load(html);
  const candidatesSet = new Set<string>();

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

  return Array.from(candidatesSet);
}

export async function healScraper(
  monitorId: string,
  html: string,
  currentConfig: ExtractionConfig,
  schema: SchemaConfig
): Promise<SelfHealingResult> {
  const db = readDb();
  let repairedConfig = { ...currentConfig, fields: { ...currentConfig.fields } };
  const events: SelfHealingResult['events'] = [];
  let overallSuccess = true;

  logActivity(`Self-healing initiated for monitor: ${monitorId}`, 'warning');

  // Step 1: Check if container selector works. If not, heal the container first.
  const $ = cheerio.load(html);
  let initialRecords = extractData($, repairedConfig);
  if (initialRecords.length === 0 && $(repairedConfig.containerSelector).length === 0) {
    logActivity(`Container selector "${repairedConfig.containerSelector}" returned 0 records. Healing container...`, 'info');
    const containerCandidates = generateContainerCandidates(html);
    let bestContainer = repairedConfig.containerSelector;
    let maxCount = 0;

    for (const candidate of containerCandidates) {
      let count = 0;
      try {
        count = $(candidate).length;
      } catch {
        continue;
      }
      if (count > maxCount) {
        maxCount = count;
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
    const candidates = generateFieldCandidates(html, repairedConfig.containerSelector);
    const candidateScoring: CandidateScoring[] = [];

    // Test and score each candidate
    for (const candidate of candidates) {
      // Test configuration where ONLY this field is changed to the candidate selector
      const testFields = { ...repairedConfig.fields, [fieldName]: candidate };
      const testConfig: ExtractionConfig = {
        containerSelector: repairedConfig.containerSelector,
        fields: testFields,
      };

      const testRecords = extractData($, testConfig);
      
      // Calculate how many times this field is valid according to schema rules
      let validCount = 0;
      const fieldConfig = schema[fieldName];

      for (const rec of testRecords) {
        const val = rec[fieldName];
        if (val === undefined || val === null || val === '') continue;

        if (fieldConfig.type === 'number') {
          const num = Number(val);
          if (!isNaN(num)) {
            if ((fieldConfig.min === undefined || num >= fieldConfig.min) && 
                (fieldConfig.max === undefined || num <= fieldConfig.max)) {
              validCount++;
            }
          }
        } else {
          if (typeof val === 'string') {
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
        name: ['name', 'title', 'heading', 'brand'],
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

  // Update DB configs and log event history if repairs were attempted
  if (events.length > 0) {
    const finalRecords = extractData($, repairedConfig);
    const finalValidation = validateDataset(finalRecords, schema);

    // Save repaired configuration to monitor in DB
    const monitorIdx = db.monitors.findIndex(m => m.id === monitorId);
    if (monitorIdx !== -1) {
      db.monitors[monitorIdx].selectors = {
        container: repairedConfig.containerSelector,
        ...repairedConfig.fields,
      };
      
      // Update scraper status to HEALTHY or DEGRADED
      const scraperIdx = db.scrapers.findIndex(s => s.monitorId === monitorId);
      if (scraperIdx !== -1) {
        db.scrapers[scraperIdx].status = overallSuccess ? 'HEALTHY' : 'DEGRADED';
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
        status: overallSuccess ? 'SUCCESS' : 'FAILED',
        candidatesTested: ev.candidatesTested,
      };
      db.repairEvents.unshift(repairEvent);
    }

    writeDb(db);
  }

  return {
    monitorId,
    repairedConfig,
    success: overallSuccess,
    events,
  };
}
