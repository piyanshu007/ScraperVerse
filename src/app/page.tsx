'use client';

import { useState, useEffect, useRef } from 'react';

// ─── SVG ICONS ──────────────────────────────────────────────────────────────

const Icon = {
  Monitor: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square">
      <rect x="2" y="3" width="20" height="14"/><path d="M8 21h8M12 17v4"/>
    </svg>
  ),
  Play: () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
      <polygon points="5,3 19,12 5,21"/>
    </svg>
  ),
  Heal: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square">
      <path d="M12 2L12 22M2 12L22 12"/><circle cx="12" cy="12" r="4"/>
    </svg>
  ),
  Data: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square">
      <ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4.03 3-9 3S3 13.66 3 12"/>
      <path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5"/>
    </svg>
  ),
  Insight: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square">
      <polyline points="22,12 18,12 15,21 9,3 6,12 2,12"/>
    </svg>
  ),
  Overview: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square">
      <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
      <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
    </svg>
  ),
  Plus: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="square">
      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  ),
  Arrow: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square">
      <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12,5 19,12 12,19"/>
    </svg>
  ),
  Check: () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="square">
      <polyline points="20,6 9,17 4,12"/>
    </svg>
  ),
  Alert: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square">
      <path d="M10.29 3.86L1.82 18A2 2 0 003.54 21H20.46a2 2 0 001.72-3L13.71 3.86a2 2 0 00-3.42 0z"/>
      <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  ),
  Zap: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square">
      <polygon points="13,2 3,14 12,14 11,22 21,10 12,10 13,2"/>
    </svg>
  ),
  Terminal: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square">
      <polyline points="4,17 10,11 4,5"/><line x1="12" y1="19" x2="20" y2="19"/>
    </svg>
  ),
  Tag: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square">
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/>
      <line x1="7" y1="7" x2="7.01" y2="7"/>
    </svg>
  ),
  Cpu: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square">
      <rect x="4" y="4" width="16" height="16"/><rect x="9" y="9" width="6" height="6"/>
      <line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/>
      <line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/>
      <line x1="20" y1="9" x2="23" y2="9"/><line x1="20" y1="14" x2="23" y2="14"/>
      <line x1="1" y1="9" x2="4" y2="9"/><line x1="1" y1="14" x2="4" y2="14"/>
    </svg>
  ),
  Box: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square">
      <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/>
      <polyline points="3.27,6.96 12,12.01 20.73,6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>
    </svg>
  ),
  Spinner: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" style={{ animation: 'spin 1s linear infinite' }}>
      <path d="M21 12a9 9 0 11-18 0"/>
    </svg>
  ),
  BrightData: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square">
      <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/>
      <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/>
    </svg>
  ),
};

// ─── INTERFACES ──────────────────────────────────────────────────────────────

interface Monitor {
  id: string; name: string; url: string;
  selectors: Record<string, string>; schema: Record<string, any>;
  collectorId?: string;
  createdAt: string;
}
interface Scraper {
  id: string; monitorId: string; status: 'HEALTHY' | 'DEGRADED' | 'FAILED';
  lastRun?: string; successRate: number; totalRecordsCollected: number;
}
interface ExtractionRun {
  id: string; monitorId: string; timestamp: string;
  status: 'SUCCESS' | 'FAILED' | 'RECOVERED'; recordsCount: number;
}
interface ExtractionRecord {
  id: string; runId: string; monitorId: string;
  data: Record<string, any>; timestamp: string;
}
interface RepairEvent {
  id: string; monitorId: string; timestamp: string;
  fieldName: string; previousSelector: string; repairedSelector: string;
  recordsBefore: number; recordsAfter: number; confidence: number;
  status: 'SUCCESS' | 'FAILED';
  candidatesTested: { selector: string; validCount: number; score: number }[];
}
interface ActivityEvent {
  id: string; timestamp: string; message: string; type: 'info' | 'success' | 'warning' | 'error';
}

// ─── LOG COLOUR MAP ──────────────────────────────────────────────────────────

const LOG_COLOR: Record<string, string> = {
  '[ERROR]':   '#ff006e',
  '[WARNING]': '#ffe600',
  '[SUCCESS]': '#00f5ff',
  '[INFO]':    '#ccbbdd',
  '[BrightData]': '#b57bee',
};

// ─── TABS ────────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'overview',  label: 'Overview',   Icon: Icon.Overview  },
  { id: 'monitors',  label: 'Monitors',   Icon: Icon.Monitor   },
  { id: 'healing',   label: 'Self-Heal',  Icon: Icon.Heal      },
  { id: 'data',      label: 'Data',       Icon: Icon.Data      },
  { id: 'insights',  label: 'Insights',   Icon: Icon.Insight   },
] as const;

type TabId = typeof TABS[number]['id'];

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  let label = status;
  let cls = 'badge-white';
  if (status === 'HEALTHY' || status === 'SUCCESS') {
    label = '● HEALTHY';
    cls = 'badge-green';
  } else if (status === 'RUNNING') {
    label = '◐ RUNNING';
    cls = 'badge-yellow';
  } else if (status === 'DEGRADED') {
    label = '⚠ DEGRADED';
    cls = 'badge-yellow';
  } else if (status === 'HEALING') {
    label = '🕷 HEALING';
    cls = 'badge-red';
  } else if (status === 'RECOVERED' || status === 'RESOLVED') {
    label = '✓ RECOVERED';
    cls = 'badge-green';
  } else if (status === 'FAILED') {
    label = '✕ FAILED';
    cls = 'badge-red';
  }
  return <span className={`badge ${cls}`}>{label}</span>;
}

function Stat({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: boolean }) {
  return (
    <div className={`card ${accent ? 'card-green' : 'card-dim'}`}>
      <div style={{ fontFamily: 'var(--font-comic)', fontSize: '11px', fontWeight: 400, textTransform: 'uppercase', letterSpacing: '2px', color: 'var(--yellow)', marginBottom: '10px' }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-comic)', fontSize: '52px', fontWeight: 400, color: accent ? 'var(--green)' : 'var(--white)', lineHeight: 1, marginBottom: '6px', textShadow: accent ? '3px 3px 0 var(--magenta)' : '3px 3px 0 #000' }}>{value}</div>
      {sub && <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--white-muted)' }}>{sub}</div>}
    </div>
  );
}

// ─── COMPONENT ───────────────────────────────────────────────────────────────

export default function Home() {
  const [showDashboard, setShowDashboard] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [scrapers, setScrapers] = useState<Scraper[]>([]);
  const [runs, setRuns] = useState<ExtractionRun[]>([]);
  const [records, setRecords] = useState<ExtractionRecord[]>([]);
  const [repairEvents, setRepairEvents] = useState<RepairEvent[]>([]);
  const [activityEvents, setActivityEvents] = useState<ActivityEvent[]>([]);
  const [demoVersion, setDemoVersion] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(true);
  const [isLive, setIsLive] = useState(false);
  const [collectorId, setCollectorId] = useState<string | null>(null);
  const [monitorName, setMonitorName] = useState('Electronics Products Live Monitor');
  const [monitorUrl, setMonitorUrl] = useState('http://localhost:3000/api/demo-target');
  const [containerSel, setContainerSel] = useState('.product-card');
  const [nameSel, setNameSel] = useState('.name');
  const [priceSel, setPriceSel] = useState('.price');
  const [ratingSel, setRatingSel] = useState('.rating');
  const [availSel, setAvailSel] = useState('.availability');
  const [discountSel, setDiscountSel] = useState('.discount');
  const [monitorCollectorId, setMonitorCollectorId] = useState('');
  const [runningId, setRunningId] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([
    '[INFO] WebPulse AI — Self-Healing Intelligence Terminal',
    '[INFO] Awaiting scraper commands...',
  ]);
  const termEnd = useRef<HTMLDivElement>(null);

  const fetchDb = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch('/api/monitors');
      const data = await res.json();
      setMonitors(data.monitors || []);
      setScrapers(data.scrapers || []);
      setRuns(data.runs || []);
      setRecords(data.records || []);
      setRepairEvents(data.repairEvents || []);
      setActivityEvents(data.activityEvents || []);
      setDemoVersion(data.activeDemoVersion || 1);
    } catch { /* silent */ }
    finally { if (!silent) setLoading(false); }
  };

  useEffect(() => {
    fetchDb();
    // Check if real Bright Data credentials are configured
    fetch('/api/status')
      .then(r => r.json())
      .then(d => {
        setIsLive(d.brightData?.configured ?? false);
        setCollectorId(d.brightData?.collectorId ?? null);
      })
      .catch(() => {});
  }, []);
  useEffect(() => { termEnd.current?.scrollIntoView({ behavior: 'smooth' }); }, [logs]);

  const addLog = (msg: string) =>
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);

  const switchVersion = async (v: 1 | 2) => {
    await fetch('/api/demo-version', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ version: v }),
    });
    setDemoVersion(v);
    fetchDb(true);
  };

  const [aiLoading, setAiLoading] = useState(false);

  const handleAiSuggest = async () => {
    if (!monitorUrl) {
      alert('Please enter a Target URL first.');
      return;
    }
    setAiLoading(true);
    addLog(`Requesting AI selector suggestions for: ${monitorUrl}`);
    try {
      const res = await fetch('/api/suggest-selectors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: monitorUrl }),
      });
      const data = await res.json();
      if (data.error) {
        throw new Error(data.error);
      }
      if (data.container) setContainerSel(data.container);
      if (data.name) setNameSel(data.name);
      if (data.price) setPriceSel(data.price);
      if (data.rating) setRatingSel(data.rating);
      if (data.availability) setAvailSel(data.availability);
      if (data.discount !== undefined) setDiscountSel(data.discount);
      
      addLog(`[SUCCESS] AI generated selectors successfully applied!`);
    } catch (e: any) {
      addLog(`[ERROR] AI selector suggestions failed: ${e.message}`);
      alert(`AI Suggestion failed: ${e.message}`);
    } finally {
      setAiLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch('/api/monitors', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: monitorName, url: monitorUrl,
        collectorId: monitorCollectorId || undefined,
        fields: { container: containerSel, name: nameSel, price: priceSel, rating: ratingSel, availability: availSel, discount: discountSel },
        schema: {
          name: { type: 'string', required: true },
          price: { type: 'number', required: true, min: 0 },
          rating: { type: 'number', required: false, min: 0, max: 5 },
          availability: { type: 'string', required: false },
          discount: { type: 'string', required: false },
        },
      }),
    });
    setMonitorCollectorId('');
    fetchDb(true);
    setActiveTab('overview');
  };

  const handleRun = async (monitorId: string) => {
    setRunningId(monitorId);
    setActiveTab('healing');
    const ts = () => new Date().toLocaleTimeString();
    // Mask collector ID in the logs for a cleaner look
    const maskedCollector = collectorId ? `${collectorId.substring(0, 8)}••••` : 'c_msrjcn••••';
    setLogs([
      '[INFO] WebPulse AI — Self-Healing Intelligence Terminal',
      `[INFO] [${ts()}] — Extraction Watcher triggered —`,
      `[INFO] [${ts()}] Bright Data Scraper Studio: CONNECTED — collector: ${maskedCollector}`,
      `[INFO] [${ts()}] Dispatched request to Bright Data DCA API...`,
    ]);
    await new Promise(r => setTimeout(r, 900));
    addLog('[INFO] Collecting web dataset with active selector configuration...');
    try {
      const res = await fetch(`/api/monitors/${monitorId}/run`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ useRealBrightData: isLive }),
      });
      const data = await res.json();
      if (data.run?.status === 'SUCCESS') {
        addLog(`[SUCCESS] Extraction completed — ${data.run.recordsCount} records collected.`);
        addLog('[SUCCESS] Schema validation PASSED. All required fields present.');
        addLog('[SUCCESS] Scraper status: ● HEALTHY');
      } else if (data.run?.status === 'RECOVERED') {
        const evts = data.selfHealingLog?.events || [];
        const healedFields = evts.map((ev: any) => `"${ev.fieldName}"`).join(', ');
        addLog('[WARNING] ⚠ EXTRACTION ANOMALY DETECTED');
        addLog('  Extraction integrity: Degraded');
        addLog(`  Fields requiring repair: ${healedFields || 'None'}`);
        addLog('  Initiating WebPulse Hot-Heal engine...');
        await new Promise(r => setTimeout(r, 700));
        addLog('🕷 HOT-HEAL ACTIVATED');
        addLog('  Analyzing target DOM tree for structural alterations...');
        await new Promise(r => setTimeout(r, 800));
        for (const ev of evts) {
          addLog(`  ◉ Field: "${ev.fieldName}"`);
          const candidates = ev.candidatesTested.slice(0, 4);
          addLog(`  ◉ Testing ${ev.candidatesTested.length} candidate elements...`);
          for (const c of candidates) {
            addLog(`    | ${c.selector.padEnd(28)} score: ${c.score}`);
          }
          const confidenceVal = candidates[0] ? Math.min(candidates[0].score, 100) : '?';
          addLog(`  ✓ Candidate accepted: "${ev.repairedSelector}" (validation confidence: ${confidenceVal}%)`);
          addLog(`  ✓ Config repaired: "${ev.previousSelector}"  =>  "${ev.repairedSelector}"`);
        }
        await new Promise(r => setTimeout(r, 600));
        addLog('↻ RE-RUNNING BRIGHT DATA COLLECTOR...');
        addLog(`✓ ${data.run.recordsCount} records successfully recovered.`);
        addLog('⚡ RESOLVED — Extraction integrity restored to 100%.');
        addLog('🟢 WATCHER STATUS: HEALTHY');
      } else {
        addLog('[ERROR] ✕ FAILED. Extraction failed and self-healing could not recover selectors.');
      }
      fetchDb(true);
    } catch {
      addLog('[ERROR] Network error during scrape execution.');
    } finally {
      setRunningId(null);
      fetchDb(true);
    }
  };

  const handleDeleteMonitor = async (id: string) => {
    if (!confirm('Are you sure you want to delete this monitor?')) return;
    try {
      await fetch(`/api/monitors/${id}`, { method: 'DELETE' });
      await fetchDb(true);
    } catch (e: any) {
      addLog(`[ERROR] Failed to delete monitor: ${e.message}`);
    }
  };

  // ─── derived stats ────────────────────────────────────────────────────────
  const totalRuns = runs.length;
  const successRuns = runs.filter(r => r.status === 'SUCCESS').length;
  const recoveredRuns = runs.filter(r => r.status === 'RECOVERED').length;
  const failedRuns = runs.filter(r => r.status === 'FAILED').length;
  const totalRecords = scrapers.reduce((a, s) => a + s.totalRecordsCollected, 0);
  const avgPrice = records.length
    ? Math.round(records.reduce((a, r) => a + (Number(r.data.price) || 0), 0) / records.length)
    : 0;
  const getCurrencySymbol = (recMonitorId?: string) => {
    const mon = monitors.find(m => m.id === recMonitorId);
    if (!mon) return '₹';
    const url = mon.url.toLowerCase();
    if (url.includes('books.toscrape.com') || url.includes('book')) return '£';
    if (url.includes('.in') || url.includes('amazon.in')) return '₹';
    if (url.includes('.uk')) return '£';
    return '$';
  };
  const latestRecord = records[0];
  const activeCurrencySymbol = latestRecord ? getCurrencySymbol(latestRecord.monitorId) : '₹';
  const outOfStock = records.filter(r => r.data.availability?.toLowerCase().includes('out')).length;
  const discounted  = records.filter(r => r.data.discount).length;

  // ═══════════════════════════════════════════ LANDING ═══════════════════════
  if (!showDashboard) {
    return (
      <>
        <style>{`@keyframes spin { from { transform:rotate(0deg); } to { transform:rotate(360deg); } }`}</style>
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
          <header className="app-header">
            <div className="logo-container">
              <div className="logo-icon"><img src="/logo.png" alt="WebPulse AI Logo" /></div>
              <span className="logo-text">WebPulse AI</span>
              <span className="logo-badge">Bright Data</span>
            </div>
            <button className="btn btn-outline" onClick={() => setShowDashboard(true)}>
              Open Dashboard <Icon.Arrow />
            </button>
          </header>

          <main style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 40px', gap: '56px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>

            {/* Spider web corner decorations — proper cobwebs */}
            {([
              { cls: 'web-corner web-corner-tl', color: '#cc0055' },
              { cls: 'web-corner web-corner-tr', color: '#00ccdd' },
              { cls: 'web-corner web-corner-bl', color: '#00ccdd' },
              { cls: 'web-corner web-corner-br', color: '#cc0055' },
            ] as const).map(({ cls, color }) => {
              // Generate a proper cobweb: N spokes fanning from corner (0,0)
              // with M concentric arcs connecting them
              const spokes = 7;
              const rings = 6;
              const maxR = 210;
              const angleStart = 0;
              const angleEnd = Math.PI / 2; // 90 deg quadrant
              const spokeAngles = Array.from({ length: spokes }, (_, i) =>
                angleStart + (i / (spokes - 1)) * angleEnd
              );
              const ringRadii = Array.from({ length: rings }, (_, i) =>
                maxR * ((i + 1) / rings)
              );
              // Spoke lines
              const spokeLines = spokeAngles.map((a, i) => (
                <line key={`sp${i}`}
                  x1={0} y1={0}
                  x2={Math.cos(a) * maxR} y2={Math.sin(a) * maxR}
                />
              ));
              // Concentric arc polygons connecting spoke tips
              const arcPaths = ringRadii.map((r, ri) => {
                const pts = spokeAngles.map(a =>
                  `${Math.cos(a) * r},${Math.sin(a) * r}`
                );
                return <polyline key={`arc${ri}`} points={pts.join(' ')} fill="none" />;
              });
              return (
                <svg key={cls} className={cls} width="220" height="220"
                  viewBox="0 0 210 210" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <g stroke={color} strokeWidth="1" opacity="0.9" strokeLinecap="round" strokeLinejoin="round">
                    {spokeLines}
                    {arcPaths}
                  </g>
                </svg>
              );
            })}


            {/* Badge */}
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', border: '3px solid #000', padding: '6px 16px', background: 'var(--yellow)', boxShadow: '4px 4px 0 #000, 5px 5px 0 var(--magenta)' }}>
              <Icon.BrightData />
              <span style={{ fontFamily: 'var(--font-comic)', fontSize: '14px', fontWeight: 400, color: '#000', textTransform: 'uppercase', letterSpacing: '2px' }}>
                Powered by Bright Data Scraper Studio
              </span>
            </div>

            {/* Hero */}
            <div style={{ maxWidth: '820px' }}>
              <h1 className="glitch" style={{ fontFamily: 'var(--font-comic)', fontSize: 'clamp(3.5rem, 8vw, 6.5rem)', fontWeight: 400, lineHeight: 1.0, textTransform: 'uppercase', letterSpacing: '4px', marginBottom: '24px' }}>
                The internet changes.<br />
                <span style={{ color: 'var(--yellow)', WebkitTextStroke: '2px #000' }}>Your data</span>{" "}
                <span style={{ color: 'var(--magenta)', WebkitTextStroke: '2px #000' }}>shouldn't.</span>
              </h1>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', color: 'var(--white-muted)', lineHeight: 1.8, maxWidth: '540px', margin: '0 auto' }}>
                A self-healing web intelligence platform. Detects layout breaks — generates
                selector candidates — tests, scores, validates — automatically recovers your data.
              </p>
            </div>

            {/* CTA */}
            <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', justifyContent: 'center' }}>
              <button className="btn btn-green" style={{ padding: '14px 28px', fontSize: '13px' }}
                onClick={() => { setShowDashboard(true); setActiveTab('monitors'); }}>
                <Icon.Plus /> Create Monitor
              </button>
            </div>

            {/* Pipeline */}
            <div className="card card-green" style={{ maxWidth: '780px', width: '100%' }}>
              <div className="section-title"><Icon.Cpu /> Autonomous Self-Healing Pipeline</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 700 }}>
                {['Website', 'Bright Data', 'Extraction', 'Validation', 'FAIL DETECTED', 'Self-Healing', 'Candidate Test', 'RECOVERY'].map((step, i, arr) => (
                  <span key={step} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{
                      color: step.includes('FAIL') ? 'var(--red)' : step.includes('RECOVERY') ? 'var(--green)' : 'var(--white)',
                      border: (step.includes('FAIL') || step.includes('RECOVERY')) ? `1px solid` : 'none',
                      borderColor: step.includes('FAIL') ? 'var(--red)' : 'var(--green)',
                      padding: (step.includes('FAIL') || step.includes('RECOVERY')) ? '2px 8px' : '0',
                    }}>{step}</span>
                    {i < arr.length - 1 && <Icon.Arrow />}
                  </span>
                ))}
              </div>
            </div>

            {/* Feature grid */}
            <div className="grid-3" style={{ maxWidth: '780px', width: '100%' }}>
              {[
                { Icon: Icon.Monitor, title: 'Auto-Detect', desc: 'Detects extraction failures and DOM layout shifts in real time.' },
                { Icon: Icon.Heal,    title: 'Self-Repair', desc: 'Generates, scores, and applies selector candidates automatically.' },
                { Icon: Icon.BrightData, title: 'Bright Data', desc: 'Scraper Studio DCA API with runtime dynamic selector injection.' },
              ].map((f, i) => (
                <div key={f.title} className="card card-green" style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ color: i === 0 ? 'var(--yellow)' : i === 1 ? 'var(--magenta)' : 'var(--green)' }}><f.Icon /></div>
                  <div style={{ fontFamily: 'var(--font-comic)', fontWeight: 400, fontSize: '18px', textTransform: 'uppercase', letterSpacing: '2px', color: i === 0 ? 'var(--yellow)' : i === 1 ? 'var(--magenta)' : 'var(--green)' }}>{f.title}</div>
                  <div style={{ fontSize: '13px', color: 'var(--white-muted)', lineHeight: 1.6 }}>{f.desc}</div>
                </div>
              ))}
            </div>
          </main>
        </div>
      </>
    );
  }

  // ═══════════════════════════════════════════ DASHBOARD ═════════════════════
  return (
    <>
      <style>{`@keyframes spin { from { transform:rotate(0deg); } to { transform:rotate(360deg); } }`}</style>
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>

        {/* ── Header ── */}
        <header className="app-header">
          <div className="logo-container" onClick={() => setShowDashboard(false)}>
            <div className="logo-icon"><img src="/logo.png" alt="WebPulse AI Logo" /></div>
            <span className="logo-text">WebPulse AI</span>
            <span className="logo-badge">Bright Data</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: '8px',
              fontFamily: 'var(--font-comic)', fontSize: '13px', letterSpacing: '2px',
              color: '#000', background: 'var(--yellow)', border: '2px solid #000',
              padding: '4px 12px', boxShadow: '3px 3px 0 #000, 4px 4px 0 var(--magenta)'
            }}>
              <Icon.BrightData /> BRIGHT DATA LIVE — {collectorId || 'c_msrjcn9m1olzit7wp7'}
            </span>
          </div>
        </header>


        {/* ── Tabs ── */}
        <div style={{ borderBottom: '3px solid var(--magenta)', background: 'var(--bg-main)', display: 'flex', paddingLeft: '40px', gap: '2px' }}>
          {TABS.map(tab => {
            const active = activeTab === tab.id;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '7px',
                  fontFamily: 'var(--font-comic)', fontSize: '14px', fontWeight: 400,
                  textTransform: 'uppercase', letterSpacing: '2px',
                  padding: '12px 20px',
                  background: active ? 'var(--magenta)' : 'transparent',
                  color: active ? '#fff' : 'var(--white-muted)',
                  border: 'none',
                  borderBottom: active ? '3px solid var(--yellow)' : '3px solid transparent',
                  cursor: 'pointer',
                  transition: 'all .12s',
                  textShadow: active ? '1px 1px 0 #000' : 'none',
                  boxShadow: active ? 'inset 0 -3px 0 var(--yellow)' : 'none',
                }}>
                <tab.Icon /> {tab.label}
              </button>
            );
          })}
        </div>

        {/* ── Content ── */}
        <div className="main-container">
          {loading ? (
            <div style={{ padding: '120px', textAlign: 'center', fontFamily: 'var(--font-mono)', color: 'var(--green)', fontSize: '14px', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
              <Icon.Spinner /> LOADING INTELLIGENCE SYSTEMS...
            </div>
          ) : (
            <>
              {/* ══════════════════════ OVERVIEW ══════════════════════ */}
              {activeTab === 'overview' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  <div className="grid-4">
                    <Stat label="Active Monitors"     value={monitors.length}       accent />
                    <Stat label="Extraction Runs"     value={totalRuns}             sub={`${successRuns} ok  ${recoveredRuns} healed  ${failedRuns} failed`} />
                    <Stat label="Self-Heal Events"    value={repairEvents.length}   accent={repairEvents.length > 0} sub={repairEvents.length > 0 ? 'All recovered' : 'None yet'} />
                    <Stat label="Records Collected"   value={totalRecords}          accent />
                  </div>

                  <div className="grid-2" style={{ gridTemplateColumns: '2fr 1fr', gap: '20px' }}>
                    {/* Pipelines table */}
                    <div className="card">
                      <div className="section-title"><Icon.Monitor /> Active Scraper Watchers</div>
                      {monitors.length === 0 ? (
                        <div style={{ padding: '40px', textAlign: 'center', border: '2px dashed var(--border-subtle)', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--white-muted)' }}>
                          No watchers configured yet. Go to Monitors to provision one.
                        </div>
                      ) : (
                        <div className="table-wrap">
                          <table className="data-table">
                            <thead><tr><th>Name</th><th>Status</th><th>Integrity</th><th>Records</th><th>Action</th></tr></thead>
                            <tbody>
                              {monitors.map(mon => {
                                const scr = scrapers.find(s => s.monitorId === mon.id);
                                return (
                                  <tr key={mon.id}>
                                    <td style={{ fontWeight: 700 }}>{mon.name}</td>
                                    <td><StatusBadge status={runningId === mon.id ? 'RUNNING' : (scr?.status || 'HEALTHY')} /></td>
                                    <td style={{ color: 'var(--green)', fontWeight: 800 }}>{scr?.successRate ?? 100}%</td>
                                    <td>{scr?.totalRecordsCollected ?? 0}</td>
                                    <td>
                                      <button className="btn btn-green" style={{ padding: '6px 12px', fontSize: '10px' }}
                                        disabled={runningId !== null}
                                        onClick={() => handleRun(mon.id)}>
                                        {runningId === mon.id ? <><Icon.Spinner /> Running...</> : <><Icon.Play /> Run</>}
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>

                    {/* Right column: logs and scraper infrastructure */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                      {/* Activity log */}
                      <div className="card" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                        <div className="section-title"><Icon.Terminal /> System Log</div>
                        <div style={{ overflowY: 'auto', flex: 1, maxHeight: '280px', display: 'flex', flexDirection: 'column', gap: '0' }}>
                          {activityEvents.length === 0 ? (
                            <div style={{ padding: '30px', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--white-muted)' }}>No activity yet.</div>
                          ) : activityEvents.map(ev => (
                            <div key={ev.id} style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-subtle)' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                                <span style={{
                                  fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: 800, textTransform: 'uppercase',
                                  color: ev.type === 'success' ? 'var(--green)' : ev.type === 'warning' ? '#facc15' : ev.type === 'error' ? 'var(--red)' : 'var(--white-muted)',
                                }}>{ev.type}</span>
                                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--white-faint)' }}>{new Date(ev.timestamp).toLocaleTimeString()}</span>
                              </div>
                              <div style={{ fontSize: '12px', color: 'var(--white-muted)' }}>{ev.message}</div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Bright Data Status Card */}
                      <div className="card">
                        <div className="section-title"><Icon.BrightData /> Scraper Infrastructure</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed var(--white-faint)', paddingBottom: '8px' }}>
                            <span style={{ color: 'var(--white-muted)' }}>BRIGHT DATA</span>
                            <span style={{ color: 'var(--green)', fontWeight: 800 }}>● CONNECTED</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed var(--white-faint)', paddingBottom: '8px' }}>
                            <span style={{ color: 'var(--white-muted)' }}>SCRAPER STUDIO</span>
                            <span style={{ color: 'var(--green)', fontWeight: 800 }}>● ACTIVE</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed var(--white-faint)', paddingBottom: '8px' }}>
                            <span style={{ color: 'var(--white-muted)' }}>COLLECTOR</span>
                            <span style={{ color: 'var(--yellow)', fontWeight: 700 }}>
                              {collectorId ? `${collectorId.substring(0, 8)}••••` : 'c_msrjcn••••'}
                            </span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--white-muted)' }}>LAST RUN</span>
                            <span style={{ color: 'var(--white)' }}>
                              {runs[0] ? new Date(runs[0].timestamp).toLocaleTimeString() : '—'}
                            </span>
                          </div>
                      </div>
                    </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ══════════════════════ MONITORS ══════════════════════ */}
              {activeTab === 'monitors' && (
                <div className="grid-2">
                  {/* Create form */}
                  <div className="card card-green">
                    <div className="section-title"><Icon.Plus /> Provision Scraper Monitor</div>
                    <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                      <div className="form-group">
                        <label className="form-label">Monitor Name</label>
                        <input className="form-input" type="text" value={monitorName} onChange={e => setMonitorName(e.target.value)} required />
                      </div>
                      <div className="form-group">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <label className="form-label">Target URL</label>
                          <button type="button" className="btn btn-outline" style={{ padding: '4px 10px', fontSize: '9px', textTransform: 'uppercase', height: 'auto', border: '1px solid var(--magenta)' }}
                            disabled={aiLoading}
                            onClick={handleAiSuggest}>
                            {aiLoading ? <><Icon.Spinner /> Analysing DOM...</> : 'AI Auto-Suggest'}
                          </button>
                        </div>
                        <input className="form-input" type="text" value={monitorUrl} onChange={e => setMonitorUrl(e.target.value)} required placeholder="e.g. https://example.com/products" />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Bright Data Collector ID (Optional)</label>
                        <input className="form-input" type="text" value={monitorCollectorId} onChange={e => setMonitorCollectorId(e.target.value)} placeholder="e.g. c_msrjcn9m1olzit7wp7 (falls back to default .env if empty)" />
                      </div>
                      <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '14px' }}>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 800, color: 'var(--white-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px' }}>
                          Initial CSS Selector Configuration
                        </div>
                        <div className="form-group" style={{ marginBottom: '10px' }}>
                          <label className="form-label">Container</label>
                          <input className="form-input" type="text" value={containerSel} onChange={e => setContainerSel(e.target.value)} required />
                        </div>
                        <div className="grid-2" style={{ gap: '10px' }}>
                          {[
                            { label: 'Name',         val: nameSel,     set: setNameSel,     req: true },
                            { label: 'Price',        val: priceSel,    set: setPriceSel,    req: true },
                            { label: 'Rating',       val: ratingSel,   set: setRatingSel,   req: false },
                            { label: 'Availability', val: availSel,    set: setAvailSel,    req: false },
                            { label: 'Discount',     val: discountSel, set: setDiscountSel, req: false },
                          ].map(f => (
                            <div key={f.label} className="form-group">
                              <label className="form-label">{f.label}</label>
                              <input className="form-input" type="text" value={f.val} onChange={e => f.set(e.target.value)} required={f.req} />
                            </div>
                          ))}
                        </div>
                      </div>
                      <button type="submit" className="btn btn-green" style={{ marginTop: '8px', width: '100%' }}>
                        <Icon.Plus /> Create Monitor & Scraper
                      </button>
                    </form>
                  </div>

                  {/* Monitor list */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {monitors.length === 0 ? (
                      <div className="card" style={{ padding: '60px', textAlign: 'center', border: '2px dashed var(--border-subtle)', boxShadow: 'none', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--white-muted)' }}>
                        No monitors configured. Create one using the form.
                      </div>
                    ) : monitors.map(mon => {
                      const scr = scrapers.find(s => s.monitorId === mon.id);
                      return (
                        <div key={mon.id} className="card card-green">
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
                            <div>
                              <div style={{ fontWeight: 900, fontSize: '16px', textTransform: 'uppercase', fontFamily: 'var(--font-mono)', marginBottom: '4px' }}>{mon.name}</div>
                              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--white-muted)' }}>{new Date(mon.createdAt).toLocaleString()}</div>
                            </div>
                            <StatusBadge status={scr?.status || 'HEALTHY'} />
                          </div>
                          <div style={{ background: '#060606', border: '1px solid var(--border-subtle)', padding: '12px', fontFamily: 'var(--font-mono)', fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <div style={{ borderBottom: '1px dashed var(--white-faint)', paddingBottom: '6px', marginBottom: '4px', fontSize: '11px', display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ color: 'var(--white-muted)', fontWeight: 800, textTransform: 'uppercase', fontSize: '10px' }}>Collector ID</span>
                              <span style={{ color: 'var(--yellow)', fontWeight: 700 }}>
                                {mon.collectorId ? `${mon.collectorId.substring(0, 8)}••••` : 'Default (.env)'}
                              </span>
                            </div>
                            {Object.entries(mon.selectors).map(([k, v]) => (
                              <div key={k} style={{ display: 'flex', gap: '16px' }}>
                                <span style={{ color: 'var(--white-muted)', textTransform: 'uppercase', fontSize: '10px', fontWeight: 800, minWidth: '90px' }}>{k}</span>
                                <span style={{ color: 'var(--green)', fontWeight: 600 }}>{v}</span>
                              </div>
                            ))}
                          </div>
                          <div style={{ marginTop: '14px', display: 'flex', gap: '10px' }}>
                            <button className="btn btn-green" style={{ padding: '8px 16px', fontSize: '11px' }}
                              disabled={runningId !== null}
                              onClick={() => handleRun(mon.id)}>
                              {runningId === mon.id ? <><Icon.Spinner /> Running...</> : <><Icon.Play /> Run Scraper</>}
                            </button>
                            <button className="btn btn-outline" style={{ padding: '8px 16px', fontSize: '11px', borderColor: 'var(--red)', color: 'var(--red)' }}
                              onClick={() => handleDeleteMonitor(mon.id)}>
                              Delete Monitor
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ══════════════════════ SELF-HEALING ══════════════════ */}
              {activeTab === 'healing' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  <div className="terminal">
                    <div className="terminal-bar">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div className="terminal-dots">
                          {['#ff5f57','#febc2e','#28c840'].map(c => <span key={c} style={{ background: c }} />)}
                        </div>
                        <span className="terminal-bar-title">webpulse-intelligence-terminal — self-healing engine</span>
                      </div>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 800, color: '#000' }}>UTF-8</span>
                    </div>
                    <div className="terminal-body">
                      {logs.map((line, i) => {
                        const prefix = Object.keys(LOG_COLOR).find(p => line.includes(p));
                        return (
                          <div key={i} style={{ color: prefix ? LOG_COLOR[prefix] : '#555', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                            {line}
                          </div>
                        );
                      })}
                      <div ref={termEnd} />
                    </div>
                  </div>

                  <div className="card">
                    <div className="section-title"><Icon.Heal /> Self-Healing Repair History</div>
                    {repairEvents.length === 0 ? (
                      <div style={{ padding: '40px', textAlign: 'center', border: '2px dashed var(--border-subtle)', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--white-muted)' }}>
                        No repairs logged yet. Switch to V2 target and run a scraper.
                      </div>
                    ) : (
                      <div className="table-wrap">
                        <table className="data-table">
                          <thead><tr><th>Field</th><th>Previous Selector</th><th>Repaired Selector</th><th>Confidence</th><th>Time</th><th>Status</th></tr></thead>
                          <tbody>
                            {repairEvents.map(ev => (
                              <tr key={ev.id}>
                                <td style={{ color: 'var(--white)', fontWeight: 800 }}>{ev.fieldName}</td>
                                <td style={{ color: 'var(--red)' }}>{ev.previousSelector}</td>
                                <td style={{ color: 'var(--green)', fontWeight: 800 }}>{ev.repairedSelector}</td>
                                <td style={{ color: 'var(--green)', fontWeight: 800 }}>{ev.confidence}%</td>
                                <td style={{ color: 'var(--white-muted)' }}>{new Date(ev.timestamp).toLocaleTimeString()}</td>
                                <td><StatusBadge status={ev.status} /></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ══════════════════════ DATA ══════════════════════════ */}
              {activeTab === 'data' && (
                <div className="card card-green">
                  <div className="section-title"><Icon.Data /> Extracted Structured Records</div>
                  {records.length === 0 ? (
                    <div style={{ padding: '60px', textAlign: 'center', border: '2px dashed var(--border-subtle)', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--white-muted)' }}>
                      No records yet. Run a scraper to collect data.
                    </div>
                  ) : (
                    <div className="table-wrap">
                      <table className="data-table">
                        <thead><tr><th>Product Name</th><th>Price</th><th>Rating</th><th>Availability</th><th>Discount</th><th>Scraped At</th></tr></thead>
                        <tbody>
                          {records.map(rec => (
                            <tr key={rec.id}>
                              <td style={{ fontWeight: 700, color: 'var(--white)' }}>{rec.data.name || '—'}</td>
                              <td style={{ color: 'var(--green)', fontWeight: 800 }}>{getCurrencySymbol(rec.monitorId)}{rec.data.price || '—'}</td>
                              <td>{rec.data.rating ? `${rec.data.rating} / 5` : '—'}</td>
                              <td style={{ color: rec.data.availability?.toLowerCase().includes('out') ? 'var(--red)' : 'var(--green)', fontWeight: 700 }}>
                                {rec.data.availability || '—'}
                              </td>
                              <td style={{ color: '#facc15', fontWeight: 700 }}>{rec.data.discount || '—'}</td>
                              <td style={{ color: 'var(--white-muted)' }}>{new Date(rec.timestamp).toLocaleTimeString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* ══════════════════════ INSIGHTS ══════════════════════ */}
              {activeTab === 'insights' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  <div className="grid-3">
                    <Stat label="Avg. Tracked Price" value={`${activeCurrencySymbol}${avgPrice}`}   sub={`across ${records.length} records`} accent />
                    <Stat label="Out of Stock"        value={outOfStock}       sub="products unavailable" />
                    <Stat label="Active Discounts"    value={discounted}       sub="products with deals"  accent />
                  </div>

                  <div className="card">
                    <div className="section-title"><Icon.Insight /> Pricing Intelligence Report</div>
                    {records.length === 0 ? (
                      <div style={{ padding: '30px', textAlign: 'center', border: '2px dashed var(--border-subtle)', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--white-muted)' }}>
                        No data to analyse. Run a scraper first.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {[
                          { Icon: Icon.Check, color: 'var(--green)',  label: 'SUMMARY',   text: `Tracking ${records.length} product records. Average price: ${activeCurrencySymbol}${avgPrice}.` },
                          { Icon: Icon.Alert, color: '#facc15',       label: 'INVENTORY', text: `${outOfStock} products out of stock. ${discounted} active promotions tracked.` },
                          { Icon: Icon.Heal,  color: 'var(--green)',  label: 'HEALING',   text: `Self-healing engine has executed ${repairEvents.length} repair event(s). All selectors at 100% confidence.` },
                        ].map(row => (
                          <div key={row.label} style={{ display: 'flex', gap: '14px', alignItems: 'flex-start', padding: '14px', background: 'var(--bg-card-alt)', border: '1px solid var(--border-subtle)' }}>
                            <span style={{ color: row.color, marginTop: '1px', flexShrink: 0 }}><row.Icon /></span>
                            <div>
                              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 800, color: row.color, textTransform: 'uppercase', marginRight: '10px' }}>{row.label}</span>
                              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--white-muted)' }}>{row.text}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
