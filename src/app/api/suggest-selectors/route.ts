import { NextRequest, NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import { fetchWithRedirect } from '@/lib/extractor';

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

    // 3. Build prompt — if we have HTML, include it; otherwise ask AI for generic heuristics based on the URL
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
      // Fallback: ask AI to infer selectors from the URL alone using domain knowledge
      userContent = `I could not fetch the page HTML for: ${absoluteUrl} (reason: ${fetchError}).
Based on the URL and your knowledge of common e-commerce platforms and site structures, suggest the most likely CSS selectors for this type of page.
If the domain is unknown, suggest generic selectors that work for most Shopify/WooCommerce/standard product pages.`;
    }

    // 4. Call OpenRouter with absolute fallback safety
    let selectors;
    try {
      if (!openRouterApiKey) {
        throw new Error('OPENROUTER_API_KEY is not configured');
      }

      const openRouterRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openRouterApiKey}`,
          'HTTP-Referer': 'https://scraperverse.hackathon',
          'X-Title': 'ScraperVerse AI Selector Suggestion',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          max_tokens: 250,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userContent },
          ],
          temperature: 0.1,
          response_format: { type: 'json_object' },
        }),
      });

      if (!openRouterRes.ok) {
        throw new Error(`OpenRouter HTTP ${openRouterRes.status}`);
      }

      const openRouterData = await openRouterRes.json();
      const content = openRouterData.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error('Empty response from AI');
      }

      let jsonText = content.trim();
      const startIdx = jsonText.indexOf('{');
      const endIdx = jsonText.lastIndexOf('}');
      if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
        jsonText = jsonText.substring(startIdx, endIdx + 1);
      }
      selectors = JSON.parse(jsonText.trim());
    } catch (llmError: any) {
      console.warn('AI Suggestion failed, falling back to smart local selectors:', llmError);
      
      const lowerUrl = absoluteUrl.toLowerCase();
      if (lowerUrl.includes('amazon')) {
        selectors = {
          container: '#centerCol',
          name: '#productTitle',
          price: '.a-price-whole',
          rating: '.mvt-cm-cr-review-stars-mini',
          availability: '#availability span.a-color-success',
          discount: '.a-color-price'
        };
      } else if (lowerUrl.includes('flipkart')) {
        selectors = {
          container: 'body',
          name: 'h1.v1zwn26',
          price: '.v1zwn20',
          rating: 'a._1psv1zek9',
          availability: '._1psv1zeel',
          discount: '.v1zwn2a'
        };
      } else if (lowerUrl.includes('books.toscrape')) {
        selectors = {
          container: 'article.product_pod',
          name: 'h3 > a',
          price: 'p.price_color',
          rating: 'p.star-rating',
          availability: 'p.instock.availability',
          discount: ''
        };
      } else {
        // Smart generic fallback for any online store / WooCommerce / Shopify
        selectors = {
          container: '.product-container, .product-item, .product, .item',
          name: 'h1, .product-title, .title, .name',
          price: '.price, .price-value, .amount, span.price',
          rating: '.rating, .stars, .star-rating',
          availability: '.stock, .availability, .in-stock',
          discount: '.discount, .offer, .sale'
        } as Record<string, string>;
      }
      (selectors as Record<string, string>)._note = `AI Suggestion fell back to smart presets. (${llmError.message})`;
    }

    // 6. Attach a note if HTML was unavailable so the UI can inform the user
    if (!cleanHtml) {
      (selectors as Record<string, string>)._note = `Page HTML could not be fetched (${fetchError}). Selectors are AI-inferred from the URL — verify them manually or run the monitor to trigger self-healing.`;
    }

    return NextResponse.json(selectors);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}
