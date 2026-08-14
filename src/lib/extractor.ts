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

export function extractData(
  htmlOrCheerio: string | cheerio.CheerioAPI,
  config: ExtractionConfig
): ExtractedRecord[] {
  const $ = typeof htmlOrCheerio === 'string' ? cheerio.load(htmlOrCheerio) : htmlOrCheerio;
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
      
      // Clone element and strip script/style tags to avoid extracting inline script JSON data (like Amazon availability)
      const cleanElement = element.clone();
      cleanElement.find('script, style').remove();
      const textVal = cleanElement.text().trim();

      if (fieldName === 'price') {
        // Reject unit prices containing slashes or "per" (e.g. ₹8.54/count)
        if (/\bper\b|\//i.test(textVal)) {
          continue;
        }
        // Try reading attribute data-price or price first
        const attrVal = element.attr('data-price') || element.attr('price');
        if (attrVal) {
          const matches = attrVal.match(/[\d,]+(?:\.\d+)?/);
          if (matches) {
            const num = parseFloat(matches[0].replace(/,/g, ''));
            if (!isNaN(num)) {
              record[fieldName] = num;
              continue;
            }
          }
        }
        // Fallback to text parsing of first match
        const matches = textVal.match(/[\d,]+(?:\.\d+)?/);
        if (matches) {
          const num = parseFloat(matches[0].replace(/,/g, ''));
          if (!isNaN(num)) {
            record[fieldName] = num;
          }
        }
      } else if (fieldName === 'rating') {
        // Star ratings can be stored as words in classes (e.g. books.toscrape.com "<p class='star-rating Three'>")
        const classVal = element.attr('class') || '';
        const textAndClass = `${textVal} ${classVal}`.toLowerCase();
        
        const wordMap: Record<string, number> = {
          one: 1, two: 2, three: 3, four: 4, five: 5,
          single: 1, double: 2, triple: 3
        };
        
        let parsedRating: number | null = null;
        for (const [word, val] of Object.entries(wordMap)) {
          const regex = new RegExp(`\\b${word}\\b`, 'i');
          if (regex.test(textAndClass)) {
            parsedRating = val;
            break;
          }
        }
        
        if (parsedRating === null) {
          const matches = textVal.match(/[\d,]+(?:\.\d+)?/);
          if (matches) {
            const num = parseFloat(matches[0].replace(/,/g, ''));
            if (!isNaN(num)) {
              parsedRating = num;
            }
          }
        }
        
        if (parsedRating !== null) {
          record[fieldName] = parsedRating;
        }
      } else if (fieldName === 'availability') {
        let cleanVal = textVal.split('\n').map(s => s.trim()).filter(Boolean)[0] || '';
        if (cleanVal.length > 80) {
          cleanVal = cleanVal.substring(0, 80).trim() + '...';
        }
        record[fieldName] = cleanVal;
      } else if (fieldName === 'discount') {
        let cleanVal = textVal.split('\n').map(s => s.trim()).filter(Boolean)[0] || '';
        if (cleanVal.length > 50) {
          cleanVal = cleanVal.substring(0, 50).trim() + '...';
        }
        record[fieldName] = cleanVal;
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
