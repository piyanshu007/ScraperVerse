import * as cheerio from 'cheerio';

export async function fetchWithRedirect(url: string, maxRedirects = 3): Promise<Response> {
  let currentUrl = url;
  let response: Response | null = null;

  for (let i = 0; i < maxRedirects; i++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 seconds timeout
    
    try {
      response = await fetch(currentUrl, {
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
        }
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (location) {
        // Handle relative redirects
        if (location.startsWith('/')) {
          const parsed = new URL(currentUrl);
          currentUrl = `${parsed.protocol}//${parsed.host}${location}`;
        } else {
          currentUrl = location;
        }
        continue;
      }
    }
    
    break;
  }

  if (!response) {
    throw new Error('No response received');
  }
  return response;
}

export interface ExtractedRecord {
  name?: string;
  price?: number;
  rating?: number;
  availability?: string;
  discount?: string;
  [key: string]: any;
}

export interface ExtractionConfig {
  containerSelector: string;
  fields: Record<string, string>; // e.g. { price: '.price', name: '.name' }
}

export function extractData(html: string, config: ExtractionConfig): ExtractedRecord[] {
  const $ = cheerio.load(html);
  const records: ExtractedRecord[] = [];

  const containers = $(config.containerSelector);
  containers.each((_, el) => {
    const record: ExtractedRecord = {};
    let hasAnyData = false;

    for (const [fieldName, selector] of Object.entries(config.fields)) {
      if (!selector) continue;
      let element;
      try {
        element = $(el).find(selector);
      } catch (e) {
        // Ignore invalid CSS selector syntax errors
        continue;
      }
      if (element.length === 0) {
        continue;
      }

      hasAnyData = true;
      const textVal = element.text().trim();

      if (fieldName === 'price') {
        // Try reading attribute data-price or price first
        const attrVal = element.attr('data-price') || element.attr('price');
        if (attrVal) {
          const num = parseFloat(attrVal.replace(/[^\d.]/g, ''));
          if (!isNaN(num)) {
            record[fieldName] = num;
            continue;
          }
        }
        // Fallback to text parsing
        const num = parseFloat(textVal.replace(/[^\d.]/g, ''));
        if (!isNaN(num)) {
          record[fieldName] = num;
        }
      } else if (fieldName === 'rating') {
        // Parse rating, e.g. "4.2 Stars" -> 4.2
        const num = parseFloat(textVal.replace(/[^\d.]/g, ''));
        if (!isNaN(num)) {
          record[fieldName] = num;
        }
      } else {
        record[fieldName] = textVal;
      }
    }

    if (hasAnyData) {
      records.push(record);
    }
  });

  return records;
}
