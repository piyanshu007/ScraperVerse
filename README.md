# WebPulse AI — Observability & Resilience for Scraper Studio

> **"The internet changes. Your data shouldn’t."**

WebPulse AI is a **scraper observability and resilience platform** built around **Bright Data Scraper Studio**. In web scraping, target website structures change frequently, causing data feeds to break. WebPulse AI monitors collection integrity, validates dataset schemas, visualizes degradation, and deploys a **local hot-healing engine** to generate and validate selector repairs before re-running the collector.

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
