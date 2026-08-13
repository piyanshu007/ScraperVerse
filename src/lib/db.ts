import fs from 'fs';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'db.json');

export interface Monitor {
  id: string;
  name: string;
  url: string;
  selectors: Record<string, string>;
  schema: Record<string, { type: 'string' | 'number'; required: boolean; min?: number; max?: number }>;
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

export function readDb(): DatabaseState {
  try {
    if (!fs.existsSync(DB_PATH)) {
      fs.writeFileSync(DB_PATH, JSON.stringify(DEFAULT_STATE, null, 2), 'utf-8');
      return DEFAULT_STATE;
    }
    const content = fs.readFileSync(DB_PATH, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error('Error reading DB:', error);
    return DEFAULT_STATE;
  }
}

export function writeDb(state: DatabaseState): void {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(state, null, 2), 'utf-8');
  } catch (error) {
    console.error('Error writing DB:', error);
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
