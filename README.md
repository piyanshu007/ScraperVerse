# WebPulse AI 

> **“The internet changes. Your data shouldn’t.”**

WebPulse AI is a **self-healing web intelligence platform** powered by Bright Data. Built for the **“Into the Scrape-Verse”** hackathon by WeMakeDevs / Bright Data, it addresses the fragility of traditional web scrapers when target website layouts shift. 

---

## 🌟 Key Features

1. **SaaS Dashboard**: Monitor scraper success rates, record collection metrics, and self-healing telemetry.
2. **True Self-Healing**: Automatically detects missing fields, generates candidate selector variations, tests them against raw HTML, scores them using schema constraints and semantic heuristics, and updates selectors.
3. **Controlled Demo Target**: Integrates a layout version toggle (V1 vs. V2 Layout) to test the scraper degradation and self-healing loops on demand.
4. **Bright Data Scraper Studio Integration**: Implements a clean adapter allowing seamless switching between real Scraper Studio trigger APIs and a local simulation fallback.
5. **Insights Engine**: Turn collected records into price intelligence and out-of-stock metrics.
6. **Activity Timeline**: Full system history logging.

---

## 🏗️ Tech Stack

- **Framework**: Next.js 15 (React, App Router, TypeScript, API Routes)
- **CSS**: Premium Vanilla CSS (custom space-dark theme, glassmorphism)
- **DOM / Parser**: Cheerio (for selector candidate generation and local validation)
- **Database**: Local JSON-file database (`db.json`) for instant portability and setup

---

## 🚀 Quick Start

### 1. Clone & Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env` (optional, falls back to simulation mode if keys are omitted):
```bash
cp .env.example .env
```

### 3. Run the App
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🧪 Running Automated Tests

Run the E2E self-healing test suite using the following command:
```bash
npx tsx scripts/test-self-healing.ts
```
This tests:
- Healthy extraction on V1 layout.
- Failure detection when switched to V2 layout.
- Self-healing container and fields recovery.
- Verification of recovered data.

---

## 📂 Project Structure

- `src/app/` - Next.js React frontend pages & API routes.
- `src/lib/` - Logic helpers (database, Cheerio extractor, validation, self-healing, Bright Data adapter).
- `scripts/` - Autonomous test suite.
- `docs/` - Technical detail documentation.
