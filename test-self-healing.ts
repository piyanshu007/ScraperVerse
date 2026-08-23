import assert from 'assert';
import { getDemoTargetHtml } from './src/lib/brightdata';
import { extractData } from './src/lib/extractor';
import { validateDataset } from './src/lib/validation';
import { healScraper } from './src/lib/self-healing';

// Mock DB-like environment locally for the test
import fs from 'fs';
import path from 'path';

const dbPath = path.join(process.cwd(), 'db.json');

// Ensure db.json exists with default data before starting tests
function initMockDb() {
  const initialDb = {
    monitors: [
      {
        id: 'mon_test_123',
        name: 'Test Monitor',
        url: '/api/demo-target',
        selectors: {
          container: '.product-card',
          name: '.name',
          price: '.price',
          rating: '.rating',
          availability: '.availability',
          discount: '.discount',
        },
        schema: {
          name: { type: 'string', required: true },
          price: { type: 'number', required: true, min: 0 },
          rating: { type: 'number', required: false, min: 0, max: 5 },
          availability: { type: 'string', required: false },
          discount: { type: 'string', required: false },
        },
        createdAt: new Date().toISOString(),
      }
    ],
    scrapers: [
      {
        id: 'scr_test_123',
        monitorId: 'mon_test_123',
        status: 'HEALTHY',
        successRate: 100,
        totalRecordsCollected: 0,
      }
    ],
    runs: [],
    records: [],
    repairEvents: [],
    activityEvents: [],
    activeDemoVersion: 1,
  };
  fs.writeFileSync(dbPath, JSON.stringify(initialDb, null, 2), 'utf-8');
}

async function runTests() {
  console.log('🧪 Starting WebPulse AI Self-Healing E2E Test Suite...\n');
  
  initMockDb();

  // Test Case 1: Healthy Extraction (Version 1 target page)
  console.log('--- Test Case 1: Extracting Version 1 (Healthy Scraper) ---');
  const v1Html = getDemoTargetHtml(1);
  const v1Config = {
    containerSelector: '.product-card',
    fields: {
      name: '.name',
      price: '.price',
      rating: '.rating',
      availability: '.availability',
      discount: '.discount',
    }
  };
  const v1Schema = {
    name: { type: 'string' as const, required: true },
    price: { type: 'number' as const, required: true, min: 0 },
    rating: { type: 'number' as const, required: false, min: 0, max: 5 },
    availability: { type: 'string' as const, required: false },
    discount: { type: 'string' as const, required: false },
  };

  const v1Records = extractData(v1Html, v1Config);
  console.log(`✅ Extracted ${v1Records.length} records.`);
  assert.strictEqual(v1Records.length, 3, 'Should extract exactly 3 records');
  
  const v1Report = validateDataset(v1Records, v1Schema);
  console.log(`✅ Schema validation status: ${v1Report.isValid ? 'VALID' : 'INVALID'}`);
  console.log(`✅ Confidence score: ${v1Report.confidence}%`);
  assert.strictEqual(v1Report.isValid, true, 'V1 dataset should be valid');
  assert.strictEqual(v1Report.confidence, 100, 'V1 confidence should be 100%');
  
  console.log('Test Case 1 Passed! ✨\n');

  // Test Case 2: Degraded Extraction (Version 2 target page using Version 1 selectors)
  console.log('--- Test Case 2: Extracting Version 2 using V1 Selectors (Broken Scraper) ---');
  const v2Html = getDemoTargetHtml(2);
  const v2RecordsBroken = extractData(v2Html, v1Config);
  console.log(`ℹ️ Extracted ${v2RecordsBroken.length} records.`);
  
  const v2ReportBroken = validateDataset(v2RecordsBroken, v1Schema);
  console.log(`❌ Schema validation status: ${v2ReportBroken.isValid ? 'VALID' : 'INVALID'}`);
  console.log(`❌ Failed fields detected: ${v2ReportBroken.failedFields.join(', ')}`);
  console.log(`❌ Confidence score dropped to: ${v2ReportBroken.confidence}%`);
  assert.strictEqual(v2ReportBroken.isValid, false, 'V2 should fail validation using V1 selectors');
  assert.ok(v2ReportBroken.failedFields.includes('price'), 'Price field should be detected as failed');
  
  console.log('Test Case 2 Passed! ✨\n');

  // Test Case 3: Self-Healing Recovery Loop
  console.log('--- Test Case 3: Triggering Self-Healing Loop ---');
  const healingResult = await healScraper('mon_test_123', v2Html, v1Config, v1Schema);
  
  console.log(`✅ Self-Healing success: ${healingResult.success ? 'TRUE' : 'FALSE'}`);
  assert.strictEqual(healingResult.success, true, 'Self-healing should succeed');
  
  console.log('✅ Repaired Config Selectors:');
  console.log(`  └─ Container: "${healingResult.repairedConfig.containerSelector}"`);
  for (const [f, sel] of Object.entries(healingResult.repairedConfig.fields)) {
    console.log(`  └─ ${f}: "${sel}"`);
  }
  
  assert.strictEqual(healingResult.repairedConfig.containerSelector, '.product-item', 'Container selector should heal to .product-item');
  assert.ok(
    healingResult.repairedConfig.fields.price === '[data-price]' || 
    healingResult.repairedConfig.fields.price === '.price-value' ||
    healingResult.repairedConfig.fields.price === 'span[data-price]',
    'Price selector should heal to target attribute or class'
  );

  console.log('Test Case 3 Passed! ✨\n');

  // Test Case 4: Verify recovered extraction
  console.log('--- Test Case 4: Verifying Recovered Data ---');
  const recoveredRecords = extractData(v2Html, healingResult.repairedConfig);
  const recoveryReport = validateDataset(recoveredRecords, v1Schema);
  
  console.log(`✅ Recovered records: ${recoveredRecords.length}`);
  console.log(`✅ Recovery Schema validation status: ${recoveryReport.isValid ? 'VALID' : 'INVALID'}`);
  console.log(`✅ Recovery Confidence score: ${recoveryReport.confidence}%`);
  
  assert.strictEqual(recoveredRecords.length, 3, 'Recovered count should be 3');
  assert.strictEqual(recoveryReport.isValid, true, 'Recovered dataset should validate successfully');
  assert.strictEqual(recoveryReport.confidence, 100, 'Recovered confidence should return to 100%');

  console.log('Test Case 4 Passed! ✨\n');

  console.log('🎉 All WebPulse AI E2E Self-Healing Tests Completed Successfully!');
}

runTests().catch(err => {
  console.error('❌ Test execution failed with error:', err);
  process.exit(1);
});
