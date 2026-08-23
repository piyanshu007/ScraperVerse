# API

All routes are Next.js App Router API handlers under `src/app/api/`.

---

## GET /api/monitors

Returns the full database snapshot.

**Response**
```json
{
  "monitors": [...],
  "scrapers": [...],
  "runs": [...],
  "records": [...],
  "repairEvents": [...],
  "activityEvents": [...],
  "activeDemoVersion": 1
}
```

---

## POST /api/monitors

Creates a new monitor and its associated scraper entry.

**Request Body**
```json
{
  "name": "My Monitor",
  "url": "https://example.com/products",
  "collectorId": "c_optional_override",
  "fields": {
    "container": ".product-card",
    "name": ".name",
    "price": ".price",
    "rating": ".rating",
    "availability": ".availability",
    "discount": ".discount"
  },
  "schema": {
    "name":         { "type": "string",  "required": true },
    "price":        { "type": "number",  "required": true, "min": 0 },
    "rating":       { "type": "number",  "required": false, "min": 0, "max": 5 },
    "availability": { "type": "string",  "required": false },
    "discount":     { "type": "string",  "required": false }
  }
}
```

**Response**
```json
{ "monitor": { ... }, "scraper": { ... } }
```

---

## DELETE /api/monitors/[id]

Deletes a monitor and all associated scrapers, runs, records, and repair events from the database.

**Response**
```json
{ "success": true }
```

---

## POST /api/monitors/[id]/run

Triggers an extraction run for the monitor. Calls Bright Data DCA API if credentials are configured, otherwise uses local simulated HTML.

**Request Body**
```json
{ "useRealBrightData": true }
```

**Response**
```json
{
  "run": {
    "id": "run_...",
    "monitorId": "...",
    "status": "SUCCESS | RECOVERED | FAILED",
    "recordsCount": 3,
    "timestamp": "2026-08-21T00:00:00.000Z"
  },
  "selfHealingLog": {
    "success": true,
    "events": [
      {
        "fieldName": "name",
        "previousSelector": ".name",
        "repairedSelector": ".product-title",
        "recordsBefore": 0,
        "recordsAfter": 3,
        "confidence": 100,
        "candidatesTested": [
          { "selector": ".product-title", "validCount": 3, "score": 115 }
        ]
      }
    ]
  }
}
```

---

## GET /api/status

Returns API credential configuration status.

**Response**
```json
{
  "brightData": {
    "configured": true,
    "collectorId": "c_msrjcn****"
  },
  "openRouter": {
    "configured": true
  }
}
```

---

## POST /api/suggest-selectors

Fetches the target URL HTML and queries OpenRouter to suggest CSS selectors.

**Request Body**
```json
{ "url": "https://example.com/products" }
```

**Response**
```json
{
  "container": ".product-card",
  "name": ".product-title",
  "price": ".price",
  "rating": ".rating",
  "availability": ".stock",
  "discount": ".discount"
}
```

---

## Bright Data DCA Endpoints (External)

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `https://api.brightdata.com/dca/trigger?collector=<ID>&queue_next=1` | Trigger a scraping job |
| GET | `https://api.brightdata.com/dca/dataset?id=<COLLECTION_ID>&format=json` | Poll for results |
