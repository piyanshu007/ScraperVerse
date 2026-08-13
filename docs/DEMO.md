# Controlled Demo Environment Walkthrough

To ensure judges can reliably test the self-healing pipeline, WebPulse AI includes a **Controlled Demo Switcher** directly in the user interface.

## Step-by-Step Demo Script

### 1. Healthy Baseline (Version 1 Layout)
- In the top header bar, select **V1 Layout** from the Demo Switcher.
- Navigate to the **Monitors** tab and click **Run Scraper** on the "Competitor Electronics Monitor".
- **Result**: The extraction completes successfully. The dashboard shows status `HEALTHY` and success rate `100%`.
- Click the **Scraped Data** tab to view the clean product list.

### 2. Layout Shift (Switch to Version 2)
- In the top header bar, click **V2 Layout**.
- **Result**: The mock target website switches to a completely different CSS template (classes, attributes, and tags change).
- Return to the **Overview** or **Healing** tab and click **Run Scraper** again.

### 3. Self-Healing Execution (Observe terminal logs)
- Navigate to the **Self-Healing Console** tab.
- **Result**:
  - The scraper attempts to extract data using V1 selectors, failing validation.
  - The WebPulse Self-Healing engine detects the failure.
  - The system analyzes the DOM and tests candidate selectors for container, name, price, rating, availability, and discount.
  - Candidates are scored (displaying validation rates).
  - Selectors are updated dynamically (e.g. price heals from `.price` to `.price-value`).
  - Extraction re-runs and recovers the data.

### 4. Recovery Verification
- Check the **Scraped Data** tab to verify that the table has been fully populated with Version 2 product data.
- Check the **Insights** tab to see updated pricing stats.
- Check the **Historical Self-Healing Log Events** table to inspect candidates and validation scores.
