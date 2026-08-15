import fs from 'fs';
import path from 'path';

// ─── Paths ────────────────────────────────────────────────────────────────────
// On Vercel the project root is read-only. We write to /tmp instead so the
// same warm serverless instance stays consistent across requests.
const IS_VERCEL  = !!process.env.VERCEL;
const LOCAL_PATH = path.join(process.cwd(), 'db.json');
const TMP_PATH   = '/tmp/db.json';

export interface Monitor {
  id: string;
  name: string;
  url: string;
  selectors: Record<string, string>;
  schema: Record<string, { type: 'string' | 'number'; required: boolean; min?: number; max?: number }>;
  collectorId?: string;
  createdAt: string;
}

export interface Scraper {
  id: string;
  monitorId: string;
  status: 'HEALTHY' | 'DEGRADED' | 'FAILED';
  lastRun?: string;
  lastSuccessfulRun?: string;
  successRate: number; // percentage
  totalRecordsCollected: number;
}

export interface ExtractionRun {
  id: string;
  monitorId: string;
  timestamp: string;
  status: 'SUCCESS' | 'FAILED' | 'RECOVERED';
  recordsCount: number;
  collectionId?: string;
}

export interface ExtractionRecord {
  id: string;
  runId: string;
  monitorId: string;
  data: Record<string, any>;
  timestamp: string;
}

export interface RepairEvent {
  id: string;
  monitorId: string;
  timestamp: string;
  fieldName: string;
  previousSelector: string;
  repairedSelector: string;
  recordsBefore: number;
  recordsAfter: number;
  confidence: number;
  status: 'SUCCESS' | 'FAILED';
  candidatesTested: { selector: string; validCount: number; score: number }[];
}

export interface ActivityEvent {
  id: string;
  timestamp: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
}

export interface DatabaseState {
  monitors: Monitor[];
  scrapers: Scraper[];
  runs: ExtractionRun[];
  records: ExtractionRecord[];
  repairEvents: RepairEvent[];
  activityEvents: ActivityEvent[];
  activeDemoVersion: 1 | 2;
}

const DEFAULT_STATE: DatabaseState = {
  monitors: [],
  scrapers: [],
  runs: [],
  records: [],
  repairEvents: [],
  activityEvents: [],
  activeDemoVersion: 1,
};

// ─── In-Memory Singleton ──────────────────────────────────────────────────────
// On Vercel, each warm function instance shares this module-level variable
// across all requests handled by that instance (15–30 min window).
// This gives full read/write consistency within a demo session.
let memDb: DatabaseState | null = null;

function loadInitial(): DatabaseState {
  // 1. Try /tmp first (previous writes in this warm instance)
  if (IS_VERCEL) {
    try {
      if (fs.existsSync(TMP_PATH)) {
        return JSON.parse(fs.readFileSync(TMP_PATH, 'utf-8'));
      }
    } catch { /* ignore */ }
  }

  // 2. Fall back to the committed db.json (always readable, even on Vercel)
  try {
    if (fs.existsSync(LOCAL_PATH)) {
      return JSON.parse(fs.readFileSync(LOCAL_PATH, 'utf-8'));
    }
  } catch { /* ignore */ }

  return DEFAULT_STATE;
}

export function readDb(): DatabaseState {
  if (!memDb) memDb = loadInitial();
  return memDb;
}

export function writeDb(state: DatabaseState): void {
  // Always update the in-memory singleton first (instant, always works)
  memDb = state;

  // Then try to persist to disk (works locally; works in /tmp on Vercel)
  const writePath = IS_VERCEL ? TMP_PATH : LOCAL_PATH;
  try {
    fs.writeFileSync(writePath, JSON.stringify(state, null, 2), 'utf-8');
  } catch (error) {
    // On Vercel the project root is read-only — in-memory is our fallback
    console.warn('[db] writeFileSync failed (expected on read-only FS):', (error as Error).message);
  }
}

export function logActivity(message: string, type: ActivityEvent['type'] = 'info') {
  const db = readDb();
  const newEvent: ActivityEvent = {
    id: `act_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    timestamp: new Date().toISOString(),
    message,
    type,
  };
  db.activityEvents.unshift(newEvent);
  if (db.activityEvents.length > 100) {
    db.activityEvents = db.activityEvents.slice(0, 100);
  }
  writeDb(db);
}
