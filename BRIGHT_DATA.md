# Bright Data Scraper Studio & Resilience Integration

WebPulse AI is designed around **Bright Data Scraper Studio (DCA)** as its primary collection layer, supplemented by a local validation, fallback, and hot-healing resilience pipeline.

---

## ☁️ Primary Cloud Collection: Bright Data Scraper Studio

Bright Data Scraper Studio serves as the primary cloud collection infrastructure, utilizing Bright Data's unblocking, proxy, and browser environments.

### 1. Trigger API Endpoint
To initiate a scraping job, WebPulse sends an authenticated request to Bright Data's Data Collector API:
*   **Method**: `POST`
*   **URL**: `https://api.brightdata.com/dca/trigger?collector=<COLLECTOR_ID>&queue_next=1`
*   **Headers**:
    *   `Authorization: Bearer <API_KEY>`
    *   `Content-Type: application/json`
*   **Payload**:
    ```json
    [
      {
        "url": "https://example.com/products"
      }
    ]
    ```

### 2. Polling and Results Retrieval
The trigger request returns a unique transaction identifier (`collection_id`). WebPulse polls the Bright Data dataset endpoint:
*   **Method**: `GET`
*   **URL**: `https://api.brightdata.com/dca/dataset?id=<COLLECTION_ID>&format=json`
*   **Headers**:
    *   `Authorization: Bearer <API_KEY>`

While the cloud scraper gathers data, the API responds with a building status (`{"status": "building"}` or `{"status": "pending"}`). Once processing completes, it returns the final array of structured JSON records, which WebPulse consumes.

---

## 🛡️ WebPulse Local Resilience Layer

To guarantee high availability and protect against API timeouts, network errors, or rate limits, WebPulse executes a local fallback and hot-healing pipeline:

```text
               Bright Data Trigger Run
                          │
               ┌──────────┴──────────┐
               ▼                     ▼
          [ SUCCESS ]            [ FAILED ] (Timeout, Rate-limit, Network Error)
               │                     │
               │                     ▼
               │          ┌──────────────────────┐
               │          │ WebPulse Fallback    │
               │          │                      │
               │          │ - Fetch raw HTML     │
               │          │ - Cheerio Parser     │
               │          │ - Local Selectors    │
               │          └──────────┬───────────┘
               │                     │
               ▼                     ▼
        ┌──────────────────────────────┐
        │     WebPulse Validation      │
        │                              │
        │ - Check fields vs Schema     │
        │ - Calculate Confidence %     │
        └──────────────┬───────────────┘
                       │
             ┌─────────┴─────────┐
             ▼                   ▼
        [ HEALTHY ]         [ DEGRADED ]
             │                   │
             ▼                   ▼
         Save Data      ┌──────────────────────┐
                        │ WebPulse Hot-Heal    │
                        │                      │
                        │ - DOM Analysis       │
                        │ - Candidate Scoring  │
                        │ - Repair config      │
                        │ - Re-run extraction  │
                        └──────────────────────┘
```

### 1. WebPulse Local Fallback
If the Bright Data API call fails or times out, WebPulse initiates a local fallback:
1.  **HTML Retrieval**: Performs a direct HTTP fetch on the target URL (utilizing custom user-agents and handling HTTP redirects).
2.  **Cheerio Extraction**: Feeds the raw HTML to Cheerio and applies the locally configured CSS selectors to extract dataset records.

### 2. WebPulse Validation
Validation rules verify the extracted dataset (from either Bright Data or the local fallback) against the target schema:
*   Assures required fields (e.g. `name`, `price`) are present.
*   Enforces type parameters (e.g. asserts `price` resolves to a numeric value).
*   Calculates a quantitative **Confidence Score** based on the record pass rate.
*   If data violates schema validation, the system flags the extraction as degraded.

### 3. WebPulse Local Hot-Healing
If the schema validation fails, WebPulse triggers its **local hot-healing engine** to restore the feed:
1.  **DOM Analysis & Candidate Generation**: Traverses the DOM tree to extract target elements, tags, and class attributes.
2.  **Telemetry & Scoring**: Tests candidate selectors on the page and ranks them using a dynamic validity score and a semantic synonym match bonus.
3.  **Local Database Repair**: Writes the highest-scoring selectors back to the local database configuration (`db.json`) for subsequent extraction runs, bypassing manual selector refactoring loops.

---

## 🤖 Auxiliary AI Selector Suggestion (OpenRouter)

To assist developers during monitor setup, WebPulse includes an **AI Selector Suggestion** feature powered by OpenRouter:
*   Fetches the target page HTML and strips heavy elements (style, script, svg) to fit context windows.
*   Queries OpenRouter (e.g., Llama-3.1-Nemotron-70B-Instruct) to analyze structural elements.
*   Populates the initial scraper configuration form inputs on the UI, which the developer inspects and saves.
