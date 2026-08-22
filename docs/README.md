# WebPulse AI

## What is this project?

WebPulse AI is a scraper observability and resilience platform built on top of Bright Data Scraper Studio. It monitors data collection pipelines, detects layout-driven extraction failures in real time, and autonomously heals broken CSS selectors without developer intervention.

## Problem

Web scrapers break constantly. A single class rename or DOM restructure can silently corrupt a data pipeline for days before anyone notices. Traditional scraping setups require a developer to manually inspect the page, identify the broken selector, patch the code, and redeploy. This is slow, fragile, and does not scale.

## Solution

WebPulse AI wraps Bright Data Scraper Studio with a validation layer and a local hot-healing engine. When an extraction degrades, the system:

1. Detects the failure via schema confidence scoring.
2. Fetches the raw HTML of the target page.
3. Traverses the DOM to generate CSS selector candidates.
4. Tests and scores each candidate against the expected schema.
5. Writes the best candidate back to the configuration database.
6. Re-runs the collector and confirms recovery.

The same Collector ID continues to work throughout. No code changes, no redeployment.

## Tech Stack

- Next.js 15 (App Router) with TypeScript
- Cheerio for DOM traversal and selector testing
- Bright Data DCA API (trigger + dataset polling)
- OpenRouter for AI-assisted selector suggestion
- JSON file store (db.json) as a zero-dependency local database

## How to Run

```bash
npm install
cp .env.example .env   # fill in BRIGHTDATA_API_KEY and BRIGHTDATA_COLLECTOR_ID
npm run dev
```

Open http://localhost:3000.

## Collector Setup

The Bright Data collector used by this project was created using the Bright Data CLI:

```bash
npx -p @brightdata/cli bdata login
npx -p @brightdata/cli bdata scraper create <URL> "product name, price, rating, availability, discount"
```

The returned Collector ID (format: `c_*`) is stored in `BRIGHTDATA_COLLECTOR_ID` in the `.env` file. WebPulse uses this ID to trigger runs via `POST /dca/trigger` and retrieve results via `GET /dca/dataset`.

## Directory Structure

```
SCRAPERVERSE
├── db.json                 # Local JSON database
├── docs/                   # Project documentation
│   ├── README.md           # This file
│   ├── PLAN.md             # Features, architecture, next tasks
│   ├── DESIGN.md           # Visual identity and component guide
│   ├── API.md              # API endpoints and request/response formats
│   ├── RULES.md            # Coding standards and conventions
│   └── LOG.md              # Decisions, changes, lessons learned
├── scripts/
│   └── test-self-healing.ts
├── src/
│   ├── app/
│   │   ├── api/
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx
│   └── lib/
│       ├── brightdata.ts
│       ├── db.ts
│       ├── extractor.ts
│       ├── validation.ts
│       └── self-healing.ts
```
