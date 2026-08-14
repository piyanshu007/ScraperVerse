import { NextRequest, NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import { fetchWithRedirect } from '@/lib/extractor';

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();
    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    // 1. Fetch HTML from target URL
    let absoluteUrl = url;
    if (url.startsWith('/')) {
      const origin = request.nextUrl.origin || 'http://localhost:3000';
      absoluteUrl = `${origin}${url}`;
    }

    const res = await fetchWithRedirect(absoluteUrl);

    if (!res.ok) {
      return NextResponse.json({ error: `Failed to fetch target URL: ${res.statusText}` }, { status: 500 });
    }

    const html = await res.text();

    // 2. Clean HTML to fit LLM context limits
    const $ = cheerio.load(html);
    $('script').remove();
    $('style').remove();
    $('svg').remove();
    $('path').remove();
    $('img').remove();
    $('iframe').remove();
    $('link').remove();
    $('meta').remove();
    $('noscript').remove();

    // Get cleaned body or html snippet
    const cleanHtml = ($('body').html() || $.html()).substring(0, 12000);

    // 3. Query OpenRouter with Llama-3.1-Nemotron-70B-Instruct
    const openRouterApiKey = process.env.OPENROUTER_API_KEY;
    if (!openRouterApiKey) {
      return NextResponse.json({ error: 'OPENROUTER_API_KEY is not configured in .env' }, { status: 500 });
    }
    const openRouterModel = 'openrouter/auto';

    const systemPrompt = `You are a CSS selector assistant. Analyze the given HTML structure and identify the correct CSS selectors for capturing product/item data.

*IMPORTANT*: If the HTML represents a single product detail page (rather than a search result listing page), you MUST return a container selector that isolates the main product details block (such as 'div#centerCol', 'div#ppd', or '.product-detail') to scrape exactly one product record instead of matching generic layout elements or footer links.

Return a valid JSON object matching this schema:
{
  "container": "string (CSS selector for the wrapping card of each product, e.g. '.product-card', 'article.product_pod', or 'div#centerCol' / 'div#ppd' for a single product page)",
  "name": "string (CSS selector for the product name relative to the container, e.g. 'h3 a', 'span#productTitle', or '.title')",
  "price": "string (CSS selector for the price, e.g. '.price_color' or 'span.price')",
  "rating": "string (CSS selector for rating, e.g. '.star-rating' or '.rating')",
  "availability": "string (CSS selector for stock/availability, e.g. '.instock' or '.stock')",
  "discount": "string (CSS selector for discounts or write empty string '' if not found)"
}

Do NOT wrap the JSON in markdown code blocks. Return ONLY the raw JSON string. Ensure the selectors are robust and relative to the container element.`;

    const openRouterRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openRouterApiKey}`,
        'HTTP-Referer': 'https://scraperverse.hackathon', // Required by OpenRouter
        'X-Title': 'ScraperVerse Self-Healing Scraper'
      },
      body: JSON.stringify({
        model: openRouterModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Here is the HTML snippet:\n\n${cleanHtml}` }
        ],
        temperature: 0.1,
        response_format: { type: 'json_object' }
      })
    });

    if (!openRouterRes.ok) {
      const errorText = await openRouterRes.text();
      return NextResponse.json({ error: `OpenRouter error: ${errorText}` }, { status: 500 });
    }

    const openRouterData = await openRouterRes.json();
    const content = openRouterData.choices?.[0]?.message?.content;
    if (!content) {
      return NextResponse.json({ error: 'Empty response from selector generator AI' }, { status: 500 });
    }

    let jsonText = content.trim();
    const startIdx = jsonText.indexOf('{');
    const endIdx = jsonText.lastIndexOf('}');
    if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
      jsonText = jsonText.substring(startIdx, endIdx + 1);
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '');
    }
    const selectors = JSON.parse(jsonText.trim());
    return NextResponse.json(selectors);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}
