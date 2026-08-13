# Security Guidelines

WebPulse AI enforces strict security practices for managing scraping operations and credentials.

## Secrets Management
- **No Hardcoded Keys**: API credentials for Bright Data are never committed or hardcoded in frontend source files.
- **Environment Variables**: Access keys are loaded strictly server-side using secure Node.js environment variables:
  - `BRIGHTDATA_API_KEY`
  - `BRIGHTDATA_COLLECTOR_ID`
- **Example Template**: An `.env.example` file is included to document necessary keys without exposing them.

## Scraping Restrictions & Best Practices
- **Public Data Only**: The application is configured to parse public endpoints. It does not handle authentication, sessions, or cookie tracking for target pages.
- **No Paywalls or Login Protection**: WebPulse should not be used to scrape paywalled, age-restricted, or password-protected content.
- **Robot Compliance**: When querying real sites via Bright Data, respect rate limits, utilize proxy rotation, and conform to target site guidelines.
