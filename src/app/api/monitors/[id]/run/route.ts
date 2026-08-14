import { NextRequest, NextResponse } from 'next/server';
import { readDb, writeDb, logActivity, ExtractionRun, ExtractionRecord } from '@/lib/db';
import { scrapeWithBrightData } from '@/lib/brightdata';
import { validateDataset } from '@/lib/validation';
import { healScraper } from '@/lib/self-healing';
import { extractData, fetchWithRedirect } from '@/lib/extractor';

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
    const monitor = db.monitors.find(m => m.id === monitorId);
    const scraper = db.scrapers.find(s => s.monitorId === monitorId);

    if (!monitor || !scraper) {
      return NextResponse.json({ error: 'Monitor or Scraper not found' }, { status: 404 });
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

    // ── NATIVE FALLBACK FOR BRIGHT DATA FAILURES / TIMEOUTS ──
    let rawHtml = scrapeResult.rawHtml;
    
    // If Bright Data timed out (FAILED) or returned 0 records, try Native Fallback immediately
    if (scrapeResult.status === 'FAILED' || (scrapeResult.records && scrapeResult.records.length === 0)) {
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
          console.error("Failed to fetch raw HTML for fallback:", e);
        }
      }

      if (rawHtml) {
        const fallbackRecords = extractData(rawHtml, config);
        // If native fallback succeeds, merge it into scrapeResult to undergo validation and healing!
        if (fallbackRecords.length > 0) {
          logActivity(`Bright Data failed, but WebPulse Native Fallback successfully retrieved page HTML and parsed elements.`, 'info');
          scrapeResult.records = fallbackRecords;
          scrapeResult.status = 'SUCCESS';
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

    // Scenario A: Extraction is healthy
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

    const healingResult = await healScraper(monitorId, rawHtml, config, monitor.schema);

    if (healingResult.success) {
      if (healingResult.events.length > 0) {
        // Re-run extraction locally on the saved HTML using the repaired configuration
        const recoveredRecords = extractData(rawHtml, healingResult.repairedConfig);
        const recoveryValidation = validateDataset(recoveredRecords, monitor.schema);

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
      const successRuns = runs.filter(r => r.status !== 'FAILED');
      freshScraper.successRate = Math.round((successRuns.length / runs.length) * 100);
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
