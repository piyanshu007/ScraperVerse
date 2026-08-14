# WebPulse AI — Observability & Resilience for Scraper Studio

> **"The internet changes. Your data shouldn’t."**

WebPulse AI is a **scraper observability and resilience platform** built around **Bright Data Scraper Studio**. In web scraping, target website structures change frequently, causing data feeds to break. WebPulse AI monitors collection integrity, validates dataset schemas, visualizes degradation, and deploys a **local hot-healing engine** to generate and validate selector repairs before re-running the collector.

---

## 🏆 Hackathon Submission Overview

### 1. Potential Impact
*   **The Problem**: Web scrapers break constantly due to minor HTML structural changes, leading to broken data pipelines and hours of manual debugging.
*   **The Solution**: WebPulse AI automates scraper health monitoring and selector healing. It immediately flags structural anomalies, scores data confidence, and repairs broken selectors dynamically in real-time, restoring pipeline health without developer intervention.

### 2. Creativity
*   **Observe & Heal Loop**: Combines strict schema validation rules with local DOM parsing, candidate scoring, and optional LLM auto-suggestions.
*   **Developer-First UX**: Features a comic brutalist, Spider-Verse themed console dashboard displaying live selector mappings, validation matrices, and historical healing logs.

### 3. Technical Excellence
*   **Next.js & TypeScript**: Clean, modular API routes and React dashboard.
*   **Fast DOM Traversal**: Lightweight and fast Cheerio element parsing.
*   **OpenRouter Integration**: Fully hardened LLM parser with substring bracket-extraction that remains completely immune to raw text or markdown fence wrapper bugs.
*   **Lightweight Telemetry DB**: Zero-dependency JSON storage engine tracking monitors, runs, records, and repairs.

### 4. Use of Scraper Studio
*   **Central Infrastructure**: Bright Data Scraper Studio serves as the primary remote collection engine.
*   **Execution**: WebPulse triggers the Scraper Studio collector via the DCA API, streams and parses the NDJSON dataset, scores fields, and monitors execution telemetry.

### 5. Reliability & Self-Healing
*   **Local Hot-Healing**: When a required schema field degrades, WebPulse isolates the element, extracts the DOM, scores alternative candidate paths, writes the corrected selector to the configuration database, and re-runs the collection pipeline automatically.

### 6. 30-Second Demo Flow
1.  **Healthy Baseline**: Select the **V1 Layout** and click **Run Scraper** (Status: `● HEALTHY` / Confidence: `100%`).
2.  **Layout Shift**: Select the **V2 Layout** and click **Run Scraper**. Watch the validator detect missing fields and trigger self-healing (Status: `🕷 HEALING`).
3.  **Automated Recovery**: Watch the terminal console analyze the DOM, score candidates, apply the best selector patch, and recover data (Status: `✓ RECOVERED` / Confidence: `100%`).

---

## 🎨 Visual Identity (Spider-Verse Theme)
WebPulse AI sports a premium, high-contrast **Spider-Verse** aesthetic:
*   **Palette**: Cinematic deep purples, neon cyan accents, Gwen-magenta borders, and amber-gold indicator highlights.
*   **Typography**: Bangers comic font for headers and metrics.
*   **Graphic Touches**: Diagonal comic print textures, mathematical SVG cobweb ornaments, and horizontal glitch text-shadow animations.

---

## 🏗️ Architecture & Flow

```text
               PUBLIC WEBSITE
                      │
                      ▼
          ┌───────────────────────┐
          │  BRIGHT DATA          │
          │  SCRAPER STUDIO       │
          │                       │
          │  Primary Collector    │
          └───────────┬───────────┘
                      │
                Structured Data
                      │
                      ▼
          ┌───────────────────────┐
          │      WEBPULSE AI      │
          │                       │
          │  Schema Validation    │
          │  Confidence Scoring   │
          │  Health Monitoring    │
          │  Change Detection     │
          └───────────┬───────────┘
                      │
               Extraction fails
                      │
                      ▼
          ┌───────────────────────┐
          │  HOT-HEALING ENGINE   │
          │                       │
          │  DOM Analysis         │
          │  Candidate Generation │
          │  AI Assistance        │
          │  Candidate Testing    │
          │  Schema Validation    │
          └───────────┬───────────┘
                      │
                New selectors
                      │
                      ▼
          ┌───────────────────────┐
          │    RE-RUN COLLECTOR   │
          └───────────┬───────────┘
                      │
                      ▼
               100% CONFIDENCE
                      │
                      ▼
                🟢 RECOVERED
```

*   **Primary Collector**: Runs as a Scraper Studio DCA collector in the cloud (`brightdata.ts`).
*   **Observability Hub**: WebPulse monitors runs, parses NDJSON streams, and alerts developers to extraction quality drops.
*   **Self-Healing Engine**: A local hot-healing loop (`self-healing.ts`) that runs heuristic DOM analysis, tests generated selectors against target schemas, and updates the selectors locally, preventing slow and expensive cloud refactoring loops.
*   **AI selector suggest**: Uses OpenRouter (Llama-3.1-Nemotron or active free models) to suggest initial CSS selectors directly from the UI.
*   **Fail-Safe Native Fallback**: Implements a native Cheerio scraper fallback to keep data flowing during API downtime.

---

## 📂 Project Structure

```text
SCRAPERVERSE
├── db.json                # Lightweight JSON Database (Monitors, Scrapers, Runs, Records, Repairs)
├── README.md              # Project documentation
├── scripts/
│   └── test-self-healing.ts # E2E local self-healing simulation suite
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── status/        # Live API status checks
│   │   │   ├── suggest-selectors/ # OpenRouter AI selector generator
│   │   │   └── monitors/      
│   │   │       ├── route.ts   # CRUD Operations (GET monitors list, POST create monitor)
│   │   │       └── [id]/      
│   │   │           ├── route.ts # DELETE Monitor operations
│   │   │           └── run/     
│   │   │               └── route.ts # Extraction & Fallback Route
│   │   ├── globals.css        # Spider-Verse Theme Visual Tokens
│   │   ├── layout.tsx         # Root app layout
│   │   └── page.tsx           # Interactive Comic-Brutalist Dashboard
│   └── lib/
│       ├── brightdata.ts      # Live DCA API Poll Adapter (NDJSON support)
│       ├── db.ts              # Driver for db.json
│       ├── extractor.ts       # Cheerio-based element selector parser
│       ├── validation.ts      # Schema validator & dataset confidence scorer
│       └── self-healing.ts    # Selector candidate generator, tester & database repair driver
```

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env` and fill in your Bright Data credentials and OpenRouter key:
```env
BRIGHTDATA_API_KEY=your_bright_data_api_key
BRIGHTDATA_COLLECTOR_ID=your_scraper_studio_collector_id
OPENROUTER_API_KEY=your_openrouter_api_key
```

### 3. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to view the dashboard.

---

## 🧪 E2E Verification Tests

To verify the selector repair flow locally without hitting API limits, run the automated E2E test script:
```bash
npx tsx scripts/test-self-healing.ts
```
The test asserts:
1.  **Healthy Extraction (V1 layout)** yields 100% confidence.
2.  **Degraded Extraction (V2 layout using V1 selectors)** drops integrity to 0%.
3.  **Self-Healing Repair** scans DOM, generates candidates, scores validity, and writes corrected selectors.
4.  **Verifies Recovery** re-running extraction and validating 100% schema compliance.

---

## 🛡️ Data & Public Compliance Policy
WebPulse only accesses and processes publicly available web data. It is explicitly designed not to target:
*   Private user information.
*   Login-protected or credential-walled pages.
*   Paywalled or pay-protected domains.
*   Robots.txt restricted sources.
