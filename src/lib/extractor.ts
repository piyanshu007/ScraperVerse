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

  let containers = $(config.containerSelector);

  // ── Single-page fallback ─────────────────────────────────────────────────
  // If the container selector finds 0 elements (common for single-product
  // PDP pages where the configured selector is overly specific), fall back to
  // treating the entire document body as ONE container.  This ensures we
  // always attempt field extraction rather than silently returning 0 records.
  const usingDocumentFallback = containers.length === 0;
  if (usingDocumentFallback) {
    containers = $('body') as unknown as ReturnType<typeof $>;
  }

  containers.each((_, el) => {
    const record: ExtractedRecord = {};
    let hasAnyData = false;

    for (const [fieldName, selector] of Object.entries(config.fields)) {
      if (!selector) continue;
      let element;
      try {
        element = $(el).find(selector);
        // Fallback: If container-relative search returns nothing, but it is an ID selector, try document-level
        if ((!element || element.length === 0) && selector.includes('#')) {
          element = $(selector);
        }
      } catch (e) {
        // Ignore invalid CSS selector syntax errors
        continue;
      }
      if (!element || element.length === 0) {
        continue;
      }

      hasAnyData = true;
      
      // Clone element and strip script/style tags to avoid extracting inline script JSON data (like Amazon availability)
      const cleanElement = element.clone();
      cleanElement.find('script, style').remove();
      const textVal = cleanElement.text().trim();

      if (fieldName === 'price') {
        let foundPrice = false;
        
        // Loop through all matched elements to bypass unit prices or strike-through list prices
        for (let i = 0; i < element.length; i++) {
          const elSingle = $(element[i]);
          const textValSingle = elSingle.text().trim();
          
          // Get surrounding text of parent/grandparent container to look for /count or /per
          const parentText = elSingle.parent().text().trim() + ' ' + (elSingle.parent().parent().text().trim());
          
          if (/\bper\b|\/|m\.r\.p|mrp/i.test(parentText) || elSingle.closest('.a-text-price').length > 0 || textValSingle.includes('%')) {
            continue;
          }
          
          // Try reading attribute data-price or price first
          const attrVal = elSingle.attr('data-price') || elSingle.attr('price');
          if (attrVal) {
            const matches = attrVal.match(/[\d,]+(?:\.\d+)?/);
            if (matches) {
              const num = parseFloat(matches[0].replace(/,/g, ''));
              if (!isNaN(num)) {
                record[fieldName] = num;
                foundPrice = true;
                break;
              }
            }
          }
          
          // Fallback to text parsing of first match
          const matches = textValSingle.match(/[\d,]+(?:\.\d+)?/);
          if (matches) {
            const num = parseFloat(matches[0].replace(/,/g, ''));
            if (!isNaN(num)) {
              record[fieldName] = num;
              foundPrice = true;
              break;
            }
          }
        }
        
        if (foundPrice) {
          continue;
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

        // ── Variation swatch parsing ─────────────────────────────────────────
        // Always scan for colour/size swatches — show per-variant stock status
        // regardless of whether the main text is generic or specific.
        // Selectors cover Amazon, common Shopify/WooCommerce variation widgets.
        const swatchSelectors = [
          // Amazon
          '#variation_color_name li',
          '#variation_size_name li',
          '#variation_style_name li',
          '.inline-twister-row-content li',
          '.inline-twister-swatch',
          // Generic e-commerce colour/size swatches
          '.swatch-element',
          '.color-swatch',
          '.size-swatch',
          '.swatches li',
          '.swatches .swatch',
          '.variants li',
          '.product-variants li',
          '[data-variant-id]',
          // WooCommerce
          '.variable-item',
          '.woocommerce-variation-add-to-cart .variations tr',
        ];

        const variations: { name: string; inStock: boolean }[] = [];
        const seenNames = new Set<string>();

        try {
          $(el).find(swatchSelectors.join(', ')).each((_, swatch) => {
            if (variations.length >= 50) return; // cap at 50 to prevent OOM
            const $sw = $(swatch);

            // Skip nested swatches (already counted via parent)
            if ($sw.parents(swatchSelectors.join(', ')).length > 0) return;

            // Resolve display name: image alt > title attr > data attributes > text
            let name = (
              $sw.find('img').first().attr('alt') ||
              $sw.attr('title') ||
              $sw.attr('data-value') ||
              $sw.attr('aria-label') ||
              $sw.text()
            )?.trim() || '';

            // Strip common boilerplate phrases
            name = name
              .replace(/click to select/gi, '')
              .replace(/select/gi, '')
              .replace(/click to/gi, '')
              .replace(/\s+/g, ' ')
              .trim();

            if (!name || seenNames.has(name.toLowerCase())) return;
            seenNames.add(name.toLowerCase());

            // Determine stock status from class names and aria attributes
            const cls = ($sw.attr('class') || '').toLowerCase();
            const ariaDisabled = $sw.attr('aria-disabled');
            const ariaLabel = ($sw.attr('aria-label') || '').toLowerCase();

            const isOutOfStock =
              cls.includes('outofstock') ||
              cls.includes('out-of-stock') ||
              cls.includes('unavailable') ||
              cls.includes('inactive') ||
              cls.includes('disabled') ||
              cls.includes('soldout') ||
              cls.includes('sold-out') ||
              ariaDisabled === 'true' ||
              ariaLabel.includes('out of stock') ||
              ariaLabel.includes('unavailable') ||
              ariaLabel.includes('sold out');

            variations.push({ name, inStock: !isOutOfStock });
          });
        } catch {
          // Swallowed — swatch scan is best-effort and must not crash extraction
        }

        if (variations.length > 0) {
          const inStockVars = variations.filter(v => v.inStock).map(v => v.name);
          const outOfStockVars = variations.filter(v => !v.inStock).map(v => v.name);

          let variationStatus = '';
          if (inStockVars.length > 0) variationStatus += `In Stock: ${inStockVars.join(', ')}`;
          if (outOfStockVars.length > 0) {
            if (variationStatus) variationStatus += ' | ';
            variationStatus += `Out of Stock: ${outOfStockVars.join(', ')}`;
          }

          // Replace generic/empty availability text with the detailed variation status
          const isGeneric = !cleanVal ||
            /see all|options|buying options|sellers|available from|check options/i.test(cleanVal);

          if (isGeneric) {
            cleanVal = variationStatus || cleanVal;
          } else {
            // Existing text is meaningful (e.g. "In Stock") — append variation detail
            cleanVal = `${cleanVal} (${variationStatus})`;
          }
        }

        // Cap final string to avoid extremely long cells in the data table
        if (cleanVal.length > 200) {
          cleanVal = cleanVal.substring(0, 200).trim() + '...';
        }
        record[fieldName] = cleanVal;
      } else if (fieldName === 'discount') {
        // Try data-discount or data-savings attribute first (structured data)
        const attrDiscount = element.attr('data-discount') || element.attr('data-savings') || element.attr('data-percent-off');
        if (attrDiscount && attrDiscount.trim()) {
          record[fieldName] = attrDiscount.trim().substring(0, 80);
        } else {
          let cleanVal = textVal.split('\n').map(s => s.trim()).filter(Boolean)[0] || '';

          // If selector returned empty text, try looking for adjacent struck-through price (del/s)
          // and compute implied discount from it and the current price
          if (!cleanVal && record['price'] !== undefined) {
            const parent = element.parent();
            const struckPrice = parent.find('del, s, .a-text-price, [class*="original"], [class*="list-price"]').first().text().trim();
            if (struckPrice) {
              const origMatch = struckPrice.match(/[\d,]+(?:\.\d+)?/);
              if (origMatch) {
                const orig = parseFloat(origMatch[0].replace(/,/g, ''));
                const current = Number(record['price']);
                if (!isNaN(orig) && !isNaN(current) && orig > current) {
                  const pct = Math.round(((orig - current) / orig) * 100);
                  cleanVal = `${pct}% off`;
                }
              }
            }
          }

          if (cleanVal.length > 80) {
            cleanVal = cleanVal.substring(0, 80).trim() + '...';
          }
          record[fieldName] = cleanVal;
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
