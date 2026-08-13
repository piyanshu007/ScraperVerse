# Bright Data Scraper Studio Integration

WebPulse AI integrates directly with **Bright Data Scraper Studio (DCA)**. 

## Integration Approach

Instead of creating simple scrapers with static selectors, WebPulse configurations are passed dynamically in the trigger request body.

### 1. Trigger API Endpoint
To execute a scrape job, WebPulse sends an authenticated HTTP request:
- **Method**: `POST`
- **URL**: `https://api.brightdata.com/dca/trigger?collector=<COLLECTOR_ID>&queue_next=1`
- **Headers**:
  - `Authorization: Bearer <API_KEY>`
  - `Content-Type: application/json`
- **Payload**:
  ```json
  [
    {
      "url": "https://example.com/products",
      "selectors": {
        "name": ".product-title",
        "price": ".price-value",
        "rating": ".rating-badge",
        "availability": ".stock-status",
        "discount": ".promo-text"
      }
    }
  ]
  ```

### 2. Scraper Studio Code Design
The custom Javascript code saved inside the Scraper Studio IDE reads these selectors from the trigger payload dynamically:

```javascript
async function scrape(input) {
  // Input payload parsed by Bright Data
  const url = input.url;
  const selectors = input.selectors || {};
  
  // Set fallbacks if selectors aren't passed
  const nameSelector = selectors.name || '.name';
  const priceSelector = selectors.price || '.price';

  // Navigate and extract using cheerio/puppeteer
  navigate(url);
  const products = [];
  
  $('.product-card, .product-item').each((i, el) => {
    products.push({
      name: $(el).find(nameSelector).text().trim(),
      price: $(el).find(priceSelector).text().trim()
    });
  });

  return products;
}
```

### 3. Polling and Results Retrieval
The trigger endpoint returns a `collection_id`. WebPulse polls:
- **Method**: `GET`
- **URL**: `https://api.brightdata.com/dca/dataset?id=<COLLECTION_ID>`
- **Headers**:
  - `Authorization: Bearer <API_KEY>`

While the job runs, the endpoint responds with `{"status": "building"}`. Once complete, it returns the final array of extracted JSON objects.
If credentials are not configured, WebPulse falls back to the `BrightDataAdapter` simulation mode.
