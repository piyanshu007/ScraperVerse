# Self-Healing Mechanism

WebPulse AI does not use hardcoded selector fallbacks. Instead, it implements a dynamic, scoring-based recovery cycle.

## How it works

### 1. Failure Detection
When an extraction run completes, the validation engine checks if:
- Required fields are missing.
- Values violate schemas (e.g., non-numeric price).
- A whole field is missing across all records.
- If failures are detected, a self-healing event triggers.

### 2. Container Selection Repair
If 0 records are scraped, the engine determines if the container selector itself is broken. It generates potential wrapper tag names or classes (e.g. `.product-item`, `.card`) and selects the candidate that matches the highest number of child elements in the new DOM.

### 3. Field Candidate Generation
Once the container is corrected, the engine targets each broken field. It scans the descendants of the first container element and extracts selector candidates:
- Raw tags (`span`, `div`, `h3`)
- Class names (`.price-value`, `.product-title`)
- Data attributes (`[data-price]`)
- Compound selectors (`span[data-price]`)

### 4. Testing & Scoring
Each candidate selector is evaluated against all matching containers on the page. The candidate is scored based on:
1. **Validation Rate**: The percentage of elements yielding values that pass the field's schema constraints (e.g. positive numbers).
2. **Semantic Matching**: A +15% score bonus is granted if the selector string contains the field name or its synonyms (e.g., selector `.price-value` contains "price", matching field "price").
3. **Selector Simplicity**: Tie-breakers prefer shorter, cleaner selectors over long complex ones.

### 5. Application and Recovery
The candidate with the highest overall score is written to the database. The extraction job re-executes immediately using the repaired selectors, restoring the data feed.
