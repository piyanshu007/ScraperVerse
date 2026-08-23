import { NextRequest, NextResponse } from 'next/server';
import { readDb, writeDb, logActivity, ExtractionRun, ExtractionRecord } from '@/lib/db';
import { scrapeWithBrightData, fetchWithWebUnlocker } from '@/lib/brightdata';
import { validateDataset } from '@/lib/validation';
import { healScraper } from '@/lib/self-healing';
import { extractData, fetchWithRedirect } from '@/lib/extractor';

// Allow up to 300 seconds — covers BrightData collector poll (90s) + Web Unlocker + self-healing
export const maxDuration = 300;


export async function POST(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const params = await props.params;
    const { id: monitorId } = params;
    const body = await request.json().catch(() => ({}));
    const useRealBrightData = body.useRealBrightData || false;

    const db = readDb();
    let monitor = db.monitors.find(m => m.id === monitorId) || body.monitor;
    let scraper = db.scrapers.find(s => s.monitorId === monitorId) || body.scraper;

    if (!monitor) {
      return NextResponse.json({ error: 'Monitor not found' }, { status: 404 });
    }

    if (!scraper) {
      scraper = {
        id: `scr_${Date.now()}`,
        monitorId,
        status: 'HEALTHY',
        successRate: 100,
        totalRecordsCollected: 0,
      };
    }

    // Extract current configuration
    const containerSelector = monitor.selectors.container || '.product-card';
    const fields = { ...monitor.selectors };
    delete fields.container; // Separate fields from the container

    const config = { containerSelector, fields };

    logActivity(`Starting extraction run for monitor: "${monitor.name}"`, 'info');

    // Perform primary extraction
    const scrapeResult = await scrapeWithBrightData(monitor.url, config, useRealBrightData, monitor.collectorId);

    const runId = `run_${Date.now()}`;
    const timestamp = new Date().toISOString();

    // ── 3-TIER FALLBACK STRATEGY ──────────────────────────────────────────────
    // Tier 1: BrightData Scraper Studio collector (already ran above)
    // Tier 2: BrightData Web Unlocker — works for ANY URL, bypasses bot detection
    // Tier 3: Plain local fetch — last resort, may be blocked by major sites
    let rawHtml = scrapeResult.rawHtml;
    
    const collectorFailed =
      scrapeResult.status === 'FAILED' ||
      !scrapeResult.records ||
      scrapeResult.records.length === 0;

    if (collectorFailed && !rawHtml) {
      // ── Tier 2: BrightData Web Unlocker ──────────────────────────────────
      let absoluteUrl = monitor.url;
      if (monitor.url.startsWith('/')) {
        const origin = request.nextUrl.origin || 'http://localhost:3000';
        absoluteUrl = `${origin}${monitor.url}`;
      }

      logActivity(`Collector returned 0 records — trying BrightData Web Unlocker for ${absoluteUrl}`, 'info');
      console.log(`[Tier2] Web Unlocker attempting: ${absoluteUrl}`);

      const unlockerResult = await fetchWithWebUnlocker(absoluteUrl);

      if (unlockerResult.html && unlockerResult.html.length > 500) {
        rawHtml = unlockerResult.html;
        console.log(`[Tier2] Web Unlocker succeeded — HTML length: ${rawHtml.length}`);
        logActivity(`BrightData Web Unlocker fetched HTML (${rawHtml.length} bytes).`, 'info');
      } else {
        // ── Tier 3: Plain local fetch ─────────────────────────────────────
        console.warn(`[Tier2] Web Unlocker failed (${unlockerResult.error}) — falling back to plain fetch (Tier 3)`);
        logActivity(`Web Unlocker failed: ${unlockerResult.error || 'no HTML'}. Trying local fetch (may be blocked).`, 'warning');
        try {
          const htmlRes = await fetchWithRedirect(absoluteUrl);
          if (htmlRes.ok) {
            rawHtml = await htmlRes.text();
            console.log(`[Tier3] Plain fetch succeeded — HTML length: ${rawHtml.length}`);
          } else {
            console.warn(`[Tier3] Plain fetch returned HTTP ${htmlRes.status}`);
          }
        } catch (e: any) {
          console.error('[Tier3] Plain fetch failed:', e.message);
        }
      }

      // Parse the fetched HTML with our selector-based extractor
      if (rawHtml) {
        const fallbackRecords = extractData(rawHtml, config);
        if (fallbackRecords.length > 0) {
          logActivity(`HTML parsed successfully — ${fallbackRecords.length} records extracted.`, 'info');
          scrapeResult.records = fallbackRecords;
          scrapeResult.status = 'SUCCESS';
          scrapeResult.rawHtml = rawHtml;
        } else {
          // HTML fetched but our selectors found nothing — set rawHtml so self-healing can run
          console.log('[Fallback] HTML fetched but 0 records matched. Self-healing will attempt to find selectors.');
          scrapeResult.rawHtml = rawHtml;
        }
      }
    }
    // ─────────────────────────────────────────────────────────────────────────

    // If Bright Data failed and Fallback ALSO failed (e.g. timeout on bad URL), return FAILED
    if (scrapeResult.status === 'FAILED') {
      const failedRun: ExtractionRun = {
        id: runId,
        monitorId,
        timestamp,
        status: 'FAILED',
        recordsCount: 0,
        collectionId: scrapeResult.collectionId,
      };

      db.runs.unshift(failedRun);
      scraper.lastRun = timestamp;
      scraper.status = 'FAILED';
      
      const runs = db.runs.filter(r => r.monitorId === monitorId);
      const successRuns = runs.filter(r => r.status !== 'FAILED');
      scraper.successRate = Math.round((successRuns.length / runs.length) * 100);
      
      writeDb(db);
      logActivity(`Extraction run failed: ${scrapeResult.error || 'Unknown error'}`, 'error');

      return NextResponse.json({
        run: failedRun,
        scraper,
        records: [],
        selfHealingAttempted: false,
        error: scrapeResult.error,
      });
    }

    // Validate the scraped data (if Bright Data succeeded but maybe needs healing)
    const validationReport = validateDataset(scrapeResult.records, monitor.schema);

    // Scenario A: Extraction is healthy and contains records
    if (validationReport.isValid && scrapeResult.records.length > 0) {
      const successRun: ExtractionRun = {
        id: runId,
        monitorId,
        timestamp,
        status: 'SUCCESS',
        recordsCount: scrapeResult.records.length,
        collectionId: scrapeResult.collectionId,
      };

      db.runs.unshift(successRun);
      scraper.lastRun = timestamp;
      scraper.lastSuccessfulRun = timestamp;
      scraper.status = 'HEALTHY';
      scraper.totalRecordsCollected += scrapeResult.records.length;

      // Add records
      for (const recData of scrapeResult.records) {
        const newRecord: ExtractionRecord = {
          id: `rec_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
          runId,
          monitorId,
          data: recData,
          timestamp,
        };
        db.records.unshift(newRecord);
      }

      const runs = db.runs.filter(r => r.monitorId === monitorId);
      const successRuns = runs.filter(r => r.status !== 'FAILED');
      scraper.successRate = Math.round((successRuns.length / runs.length) * 100);

      writeDb(db);
      logActivity(`Extraction successful for "${monitor.name}". Collected ${scrapeResult.records.length} records.`, 'success');

      return NextResponse.json({
        run: successRun,
        scraper,
        records: scrapeResult.records,
        validation: validationReport,
        selfHealingAttempted: false,
      });
    }

    // Scenario B: Extraction degraded or failed validation, trigger Self-Healing
    logActivity(`Extraction validation failed for "${monitor.name}". Initiating self-healing...`, 'warning');

    if (!rawHtml) {
      try {
        let absoluteUrl = monitor.url;
        if (monitor.url.startsWith('/')) {
          const origin = request.nextUrl.origin || 'http://localhost:3000';
          absoluteUrl = `${origin}${monitor.url}`;
        }
        const htmlRes = await fetchWithRedirect(absoluteUrl);
        if (htmlRes.ok) {
          rawHtml = await htmlRes.text();
        }
      } catch (e: any) {
        console.error("Failed to fetch raw HTML for self-healing:", e);
      }
    }

    const healingResult = await healScraper(monitorId, rawHtml, config, monitor.schema, scrapeResult.records);

    if (healingResult.success) {
      if (healingResult.events.length > 0) {
        // Re-run extraction locally on the saved HTML using the repaired configuration
        // If rawHtml is empty, extract from the HTML records if available
        let testHtml = rawHtml;
        if (!testHtml && scrapeResult.records.length > 0) {
          for (const rec of scrapeResult.records) {
            const h = rec['_html'] ?? rec['html'] ?? rec.data?.['_html'] ?? rec.data?.['html'];
            if (typeof h === 'string' && h.trim().length > 100) {
              testHtml = h;
              break;
            }
          }
        }

        const recoveredRecords = testHtml ? extractData(testHtml, healingResult.repairedConfig) : [];
        const recoveryValidation = validateDataset(recoveredRecords, monitor.schema);

        // If the healed extraction yields 0 records, it's not a successful recovery!
        if (recoveredRecords.length === 0) {
          const failedHealingRun: ExtractionRun = {
            id: runId,
            monitorId,
            timestamp,
            status: 'FAILED',
            recordsCount: 0,
            collectionId: scrapeResult.collectionId,
          };

          const freshDb = readDb();
          freshDb.runs.unshift(failedHealingRun);
          
          const freshScraper = freshDb.scrapers.find(s => s.monitorId === monitorId);
          if (freshScraper) {
            freshScraper.lastRun = timestamp;
            freshScraper.status = 'FAILED';
            
            const runs = freshDb.runs.filter(r => r.monitorId === monitorId);
            const successRuns = runs.filter(r => r.status !== 'FAILED');
            freshScraper.successRate = Math.round((successRuns.length / runs.length) * 100);
          }

          writeDb(freshDb);
          logActivity(`Self-healing completed but recovered 0 records for "${monitor.name}". Run marked as FAILED.`, 'error');

          return NextResponse.json({
            run: failedHealingRun,
            scraper: freshScraper || scraper,
            records: [],
            validation: recoveryValidation,
            selfHealingAttempted: true,
            selfHealingLog: healingResult,
          });
        }

        const recoveredRun: ExtractionRun = {
          id: runId,
          monitorId,
          timestamp,
          status: 'RECOVERED',
          recordsCount: recoveredRecords.length,
          collectionId: scrapeResult.collectionId,
        };

        // Reload database because healScraper modifies selectors and scrapers in DB
        const freshDb = readDb();
        freshDb.runs.unshift(recoveredRun);
        
        const freshScraper = freshDb.scrapers.find(s => s.monitorId === monitorId);
        if (freshScraper) {
          freshScraper.lastRun = timestamp;
          freshScraper.lastSuccessfulRun = timestamp;
          freshScraper.status = 'HEALTHY';
          freshScraper.totalRecordsCollected += recoveredRecords.length;
          
          const runs = freshDb.runs.filter(r => r.monitorId === monitorId);
          const successRuns = runs.filter(r => r.status !== 'FAILED');
          freshScraper.successRate = Math.round((successRuns.length / runs.length) * 100);
        }

        // Add recovered records
        for (const recData of recoveredRecords) {
          const newRecord: ExtractionRecord = {
            id: `rec_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            runId,
            monitorId,
            data: recData,
            timestamp,
          };
          freshDb.records.unshift(newRecord);
        }

        writeDb(freshDb);
        logActivity(`Self-healing succeeded. Extraction recovered for "${monitor.name}".`, 'success');

        return NextResponse.json({
          run: recoveredRun,
          scraper: freshScraper || scraper,
          records: recoveredRecords,
          validation: recoveryValidation,
          selfHealingAttempted: true,
          selfHealingLog: healingResult,
        });
      } else {
        // success is true, but no selectors changed. Means either everything was already valid
        // or optional fields couldn't be resolved (which is fine). Save original records.
        // BUT if original records count is 0, this is a failure!
        if (scrapeResult.records.length === 0) {
          const failedHealingRun: ExtractionRun = {
            id: runId,
            monitorId,
            timestamp,
            status: 'FAILED',
            recordsCount: 0,
            collectionId: scrapeResult.collectionId,
          };

          const freshDb = readDb();
          freshDb.runs.unshift(failedHealingRun);
          
          const freshScraper = freshDb.scrapers.find(s => s.monitorId === monitorId);
          if (freshScraper) {
            freshScraper.lastRun = timestamp;
            freshScraper.status = 'FAILED';
            
            const runs = freshDb.runs.filter(r => r.monitorId === monitorId);
            const successRuns = runs.filter(r => r.status !== 'FAILED');
            freshScraper.successRate = Math.round((successRuns.length / runs.length) * 100);
          }

          writeDb(freshDb);
          logActivity(`Self-healing aborted: no fields to repair and original dataset is empty. Run marked as FAILED.`, 'error');

          return NextResponse.json({
            run: failedHealingRun,
            scraper: freshScraper || scraper,
            records: [],
            validation: validationReport,
            selfHealingAttempted: true,
            selfHealingLog: healingResult,
          });
        }

        const successRun: ExtractionRun = {
          id: runId,
          monitorId,
          timestamp,
          status: 'SUCCESS',
          recordsCount: scrapeResult.records.length,
          collectionId: scrapeResult.collectionId,
        };

        const freshDb = readDb();
        freshDb.runs.unshift(successRun);
        
        const freshScraper = freshDb.scrapers.find(s => s.monitorId === monitorId);
        if (freshScraper) {
          freshScraper.lastRun = timestamp;
          freshScraper.lastSuccessfulRun = timestamp;
          freshScraper.status = 'HEALTHY';
          freshScraper.totalRecordsCollected += scrapeResult.records.length;
          
          const runs = freshDb.runs.filter(r => r.monitorId === monitorId);
          const successRuns = runs.filter(r => r.status !== 'FAILED');
          freshScraper.successRate = Math.round((successRuns.length / runs.length) * 100);
        }

        // Add records
        for (const recData of scrapeResult.records) {
          const newRecord: ExtractionRecord = {
            id: `rec_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            runId,
            monitorId,
            data: recData,
            timestamp,
          };
          freshDb.records.unshift(newRecord);
        }

        writeDb(freshDb);
        logActivity(`Extraction validated successfully (unresolved optional fields ignored).`, 'success');

        return NextResponse.json({
          run: successRun,
          scraper: freshScraper || scraper,
          records: scrapeResult.records,
          validation: validationReport,
          selfHealingAttempted: true,
          selfHealingLog: healingResult,
        });
      }
    }

    // Scenario C: Self-healing failed to find a valid repair
    const failedHealingRun: ExtractionRun = {
      id: runId,
      monitorId,
      timestamp,
      status: 'FAILED',
      recordsCount: 0,
      collectionId: scrapeResult.collectionId,
    };

    // Reload database
    const freshDb = readDb();
    freshDb.runs.unshift(failedHealingRun);
    
    const freshScraper = freshDb.scrapers.find(s => s.monitorId === monitorId);
    if (freshScraper) {
      freshScraper.lastRun = timestamp;
      freshScraper.status = 'FAILED';
      
      const runs = freshDb.runs.filter(r => r.monitorId === monitorId);
      const successRuns = freshDb.runs.filter(r => r.status !== 'FAILED');
      freshScraper.successRate = Math.round((successRuns.length / freshDb.runs.length) * 100);
    }

    writeDb(freshDb);
    logActivity(`Self-healing failed to recover extraction for "${monitor.name}".`, 'error');

    return NextResponse.json({
      run: failedHealingRun,
      scraper: freshScraper || scraper,
      records: [],
      validation: validationReport,
      selfHealingAttempted: true,
      selfHealingLog: healingResult,
    });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}
