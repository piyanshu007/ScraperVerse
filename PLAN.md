# Plan

## What We Are Building

WebPulse AI is a self-healing scraper observability platform. The core loop is: trigger a Bright Data Scraper Studio collector, validate the output against a schema, and if the output degrades, automatically repair the selector configuration and re-run.

## Features

### Implemented

- Bright Data DCA API integration (trigger + polling + NDJSON parsing)
- Schema-based confidence scoring per field and per run
- Local hot-healing engine with DOM candidate generation and semantic scoring
- Multi-monitor support with per-monitor Collector ID override
- OpenRouter AI selector suggestion during monitor setup
- Fallback Cheerio extraction when Bright Data API is unavailable
- Full CRUD for monitors (create, list, delete)
- JSON file database (monitors, scrapers, runs, records, repair events, activity log)
- Spider-Verse themed dashboard with status badges and live terminal

### Demo Infrastructure

- Simulated V1 and V2 HTML layouts embedded in brightdata.ts for offline demo
- Version switcher in the dashboard to trigger a layout shift
- E2E test script (scripts/test-self-healing.ts) that validates the full healing cycle

## Architecture

```
Browser -> Next.js API Routes -> Bright Data DCA API
                              -> Cheerio Fallback
                              -> Validation Engine
                              -> Self-Healing Engine -> db.json
```

## Progress

- [x] Core API integration with Bright Data Scraper Studio
- [x] Validation and confidence scoring
- [x] Self-healing DOM traversal and candidate ranking
- [x] Dashboard UI with Spider-Verse theme
- [x] E2E test suite
- [x] Docs folder structure

## Next Tasks

- Add GitHub Actions cron to run the scraper nightly and log results
- Record and embed a demo video in the root README
- Add response time tracking per extraction run
