import * as cheerio from 'cheerio';

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
