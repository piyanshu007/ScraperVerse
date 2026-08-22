# Log

Important decisions, changes, and lessons learned during development.

---

## 2026-08-21 — Docs folder added

Added structured documentation folder with README, PLAN, DESIGN, API, RULES, and LOG files following the hackathon project structure guide.

---

## 2026-08-21 — Mobile responsiveness fixed

The dashboard was zooming out on iOS and Android because:
- The viewport meta tag was missing `initial-scale=1` enforcement.
- Tab navigation had fixed padding that overflowed on small screens.
- Several inline padding values did not scale below 768px.

Fixed by:
- Adding explicit `width=device-width, initial-scale=1` viewport meta.
- Making the tab bar horizontally scrollable on mobile.
- Adding a dedicated mobile breakpoint in globals.css for the header and main container.
- Reducing card padding on small screens.

---

## 2026-08-20 — Bright Data CLI context added to README

Judges evaluating against the bdata CLI workflow needed to see how the collector was originally provisioned. Added a Collector Setup section to the root README documenting the `bdata scraper create` step and how the Collector ID maps to the environment variable.

---

## 2026-08-20 — Polling timeout loop fixed

When Bright Data returned 0 records (e.g., scraping an Amazon URL with Books.toScrape code), the polling loop was checking `json.length > 0` before exiting. This caused a 5-minute hang before triggering the fallback.

Fix: Changed the exit condition in `brightdata.ts` to exit as soon as an array is returned regardless of length, immediately triggering the native fallback.

---

## 2026-08-20 — Optional field healing fixed

Optional fields with 0% presence (e.g., discount field on pages with no active promotions) were causing `overallSuccess = false`, crashing the entire run even when required fields (name, price) were successfully parsed.

Fix: Modified `self-healing.ts` to only set `overallSuccess = false` when a required field fails to heal. Optional fields log a warning but do not affect the run status.

---

## 2026-08-19 — Self-healing engine architecture decision

Considered using a pure LLM to generate repaired selectors (fully AI-driven healing). Decided against it as the primary mechanism because:
- LLM calls add latency and cost per healing event.
- DOM traversal is deterministic and can be audited.
- Semantic scoring with synonym bonuses achieved the same recall in testing.

LLM assistance (OpenRouter) is retained as an optional suggestion tool during initial monitor setup, not during automated healing.

---

## 2026-08-19 — Scraper Studio as primary layer decision

Decided to use Bright Data DCA API directly rather than the bdata CLI at runtime because:
- The CLI is a developer tool, not suitable for programmatic server-side triggering.
- The DCA REST API (`/dca/trigger`, `/dca/dataset`) provides the same functionality with full control over polling and error handling.
- The bdata CLI was used during development to create and configure the collector (see docs/README.md for the exact commands).
