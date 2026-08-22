import fs from 'fs';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'db.json');

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

let memoryCache: DatabaseState | null = (global as any).__dbCache || null;

export function readDb(): DatabaseState {
  if (memoryCache) {
    return memoryCache;
  }
  try {
    if (!fs.existsSync(DB_PATH)) {
      try {
        fs.writeFileSync(DB_PATH, JSON.stringify(DEFAULT_STATE, null, 2), 'utf-8');
      } catch (writeError) {
        console.warn('Filesystem read-only, initializing in memory:', writeError);
      }
      memoryCache = JSON.parse(JSON.stringify(DEFAULT_STATE));
      (global as any).__dbCache = memoryCache;
      return memoryCache!;
    }
    const content = fs.readFileSync(DB_PATH, 'utf-8');
    memoryCache = JSON.parse(content);
    (global as any).__dbCache = memoryCache;
    return memoryCache!;
  } catch (error) {
    console.error('Error reading DB:', error);
    memoryCache = JSON.parse(JSON.stringify(DEFAULT_STATE));
    (global as any).__dbCache = memoryCache;
    return memoryCache!;
  }
}

export function writeDb(state: DatabaseState): void {
  memoryCache = state;
  (global as any).__dbCache = memoryCache;
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(state, null, 2), 'utf-8');
  } catch (error) {
    console.warn('Filesystem read-only, saved state in memory:', error);
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
  // Cap activity events at 100
  if (db.activityEvents.length > 100) {
    db.activityEvents = db.activityEvents.slice(0, 100);
  }
  writeDb(db);
}
