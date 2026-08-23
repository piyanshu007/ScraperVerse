import { NextRequest, NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import { fetchWithRedirect } from '@/lib/extractor';
import { fetchWithWebUnlocker } from '@/lib/brightdata';


// ─────────────────────────────────────────────────────────────────────────────
// Offline preset selectors for common platforms
// Used when OpenRouter is unavailable or returns an error
// ─────────────────────────────────────────────────────────────────────────────
function getPresetSelectors(url: string): Record<string, string> | null {
  try {
    const hostname = new URL(url).hostname.toLowerCase();

    if (hostname.includes('amazon')) {
      return {
        container: '#centerCol',
        name: '#productTitle',
        price: '#corePriceDisplay_desktop_feature_div .a-price .a-offscreen',
        rating: '#acrPopover .a-icon-alt',
        availability: '#availability span',
        discount: '#regularprice_savings .a-color-price',
        _note: 'AI unavailable — using Amazon preset selectors. Run the monitor to auto-heal if needed.',
      };
    }

    if (hostname.includes('flipkart')) {
      return {
        container: '._1AtVbE',
        name: '.B_NuCI',
        price: '._30jeq3',
        rating: '._3LWZlK',
        availability: '._16FRp0',
        discount: '._3Ay6Sb',
        _note: 'AI unavailable — using Flipkart preset selectors.',
      };
    }

    if (hostname.includes('books.toscrape')) {
      return {
        container: 'article.product_pod',
        name: 'h3 a',
        price: '.price_color',
        rating: '.star-rating',
        availability: '.availability',
        discount: '',
        _note: 'AI unavailable — using Books to Scrape preset selectors.',
      };
    }

    if (hostname.includes('ebay')) {
      return {
        container: '.s-item',
        name: '.s-item__title',
        price: '.s-item__price',
        rating: '.x-star-rating',
        availability: '',
        discount: '',
        _note: 'AI unavailable — using eBay preset selectors.',
      };
    }

    if (hostname.includes('etsy')) {
      return {
        container: '.listing-card',
        name: '.wt-text-caption',
        price: '.currency-value',
        rating: '.wt-nudge-xs',
        availability: '',
        discount: '',
        _note: 'AI unavailable — using Etsy preset selectors.',
      };
    }

    // Generic Shopify / WooCommerce / standard product page
    return {
      container: '.product, .product-item, article, .item, .card',
      name: 'h1, h2, .product-title, .product-name, .title',
      price: '.price, .product-price, [class*="price"]',
      rating: '.rating, .stars, [class*="rating"], [class*="star"]',
      availability: '.availability, .stock, [class*="stock"]',
      discount: '.discount, .badge, [class*="discount"], [class*="save"]',
      _note: 'AI unavailable — using generic preset selectors. Run the monitor to trigger self-healing for this specific site.',
    };
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();
    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    // 1. Resolve relative URLs
    let absoluteUrl = url;
    if (url.startsWith('/')) {
      const origin = request.nextUrl.origin || 'http://localhost:3000';
      absoluteUrl = `${origin}${url}`;
    }

    const openRouterApiKey = process.env.OPENROUTER_API_KEY;

    // 2. Attempt to fetch HTML — gracefully handle bot-block or network errors
    let cleanHtml = '';
    let fetchError = '';
    try {
      const res = await fetchWithRedirect(absoluteUrl);
      if (res.ok) {
        const html = await res.text();
        const $ = cheerio.load(html);
        // Strip noise so we stay within LLM token limits
        $('script, style, svg, path, img, iframe, link, meta, noscript, header, footer, nav').remove();
        cleanHtml = ($('body').html() || $.html()).substring(0, 14000);
      } else {
        fetchError = `HTTP ${res.status} ${res.statusText}`;
      }
    } catch (e: any) {
      fetchError = e.message || 'Network error';
    }

    // 2b. If plain fetch failed (bot-blocked, etc.), try BrightData Web Unlocker to get real HTML
    if (!cleanHtml && process.env.BRIGHTDATA_API_KEY) {
      try {
        console.log(`[SuggestSelectors] Plain fetch failed (${fetchError}) — trying Web Unlocker for HTML…`);
        const unlockerResult = await fetchWithWebUnlocker(absoluteUrl);
        if (unlockerResult.html && unlockerResult.html.length > 500) {
          const $ = cheerio.load(unlockerResult.html);
          $('script, style, svg, path, img, iframe, link, meta, noscript, header, footer, nav').remove();
          cleanHtml = ($('body').html() || $.html()).substring(0, 14000);
          fetchError = ''; // cleared — we now have real HTML
          console.log(`[SuggestSelectors] Web Unlocker provided ${cleanHtml.length} bytes of HTML for AI analysis`);
        } else {
          console.warn(`[SuggestSelectors] Web Unlocker also failed: ${unlockerResult.error}`);
        }
      } catch (e: any) {
        console.warn(`[SuggestSelectors] Web Unlocker exception: ${e.message}`);
      }
    }

    // 3. If OpenRouter key is missing or invalid, return presets immediately
    if (!openRouterApiKey) {
      const presets = getPresetSelectors(absoluteUrl);
      if (presets) return NextResponse.json(presets);
      return NextResponse.json({ error: 'OPENROUTER_API_KEY is not configured and no preset found for this URL.' }, { status: 500 });
    }

    // 4. Build prompt for OpenRouter
    const systemPrompt = `You are a CSS selector expert specialized in e-commerce web scraping for ANY website (Amazon, Flipkart, eBay, Etsy, Shopify stores, WooCommerce sites, books.toscrape.com, or any other online store).

Return a valid JSON object with these keys:
{
  "container": "CSS selector for the wrapping element of each product item (for listing pages use the repeating card selector; for single product detail pages use the main product section e.g. div#centerCol, .product-detail, .product-container)",
  "name": "CSS selector for the product title/name (relative to container)",
  "price": "CSS selector for the price element (relative to container)",
  "rating": "CSS selector for rating/stars (relative to container, empty string if not present)",
  "availability": "CSS selector for stock status (relative to container, empty string if not present)",
  "discount": "CSS selector for discount/offer text (relative to container, empty string if not present)"
}

Rules:
- Return ONLY raw JSON. No markdown, no code fences, no extra text.
- Selectors must be relative to the container (not document-level) except for single-product pages.
- For single product pages: container should isolate the main product info block.
- For listing pages: container should match each individual product card.
- Use stable selectors (IDs, semantic class names) over fragile positional ones.
- If unsure, provide a sensible generic fallback like .product, article, or .item.`;

    let userContent: string;
    if (cleanHtml) {
      userContent = `Analyze this HTML from: ${absoluteUrl}\n\nHTML:\n${cleanHtml}`;
    } else {
      userContent = `I could not fetch the page HTML for: ${absoluteUrl} (reason: ${fetchError}).
Based on the URL and your knowledge of common e-commerce platforms and site structures, suggest the most likely CSS selectors for this type of page.
If the domain is unknown, suggest generic selectors that work for most Shopify/WooCommerce/standard product pages.`;
    }

    // 5. Call OpenRouter
    let openRouterFailed = false;
    let openRouterError = '';
    try {
      const openRouterRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openRouterApiKey}`,
          'HTTP-Referer': 'https://scraperverse.vercel.app',
          'X-Title': 'ScraperVerse AI Selector Suggestion',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash:free',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userContent },
          ],
          temperature: 0.1,
          response_format: { type: 'json_object' },
        }),
      });

      if (!openRouterRes.ok) {
        const errText = await openRouterRes.text();
        openRouterFailed = true;
        openRouterError = `OpenRouter ${openRouterRes.status}: ${errText.substring(0, 200)}`;
        console.warn('[SuggestSelectors] OpenRouter failed:', openRouterError);
      } else {
        const openRouterData = await openRouterRes.json();
        const content = openRouterData.choices?.[0]?.message?.content;

        if (content) {
          // 6. Parse JSON from LLM response (handle markdown fences gracefully)
          let jsonText = content.trim();
          const startIdx = jsonText.indexOf('{');
          const endIdx = jsonText.lastIndexOf('}');
          if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
            jsonText = jsonText.substring(startIdx, endIdx + 1);
          } else if (jsonText.startsWith('```')) {
            jsonText = jsonText.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '');
          }

          const selectors = JSON.parse(jsonText.trim());
          if (!cleanHtml) {
            selectors._note = `Page HTML could not be fetched (${fetchError}). Selectors are AI-inferred from the URL — verify them manually or run the monitor to trigger self-healing.`;
          }
          return NextResponse.json(selectors);
        } else {
          openRouterFailed = true;
          openRouterError = 'Empty response from AI';
        }
      }
    } catch (e: any) {
      openRouterFailed = true;
      openRouterError = e.message || 'OpenRouter network error';
      console.warn('[SuggestSelectors] OpenRouter exception:', openRouterError);
    }

    // 7. Fallback to presets if OpenRouter failed
    if (openRouterFailed) {
      const presets = getPresetSelectors(absoluteUrl);
      if (presets) {
        presets._note = `AI suggestion failed (${openRouterError}). Using built-in preset selectors for this platform. Run the monitor to trigger self-healing for fine-tuning.`;
        return NextResponse.json(presets);
      }
      return NextResponse.json({ error: `AI failed: ${openRouterError}` }, { status: 500 });
    }

    return NextResponse.json({ error: 'Unknown error in suggest-selectors' }, { status: 500 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}
