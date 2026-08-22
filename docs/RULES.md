# Rules

Coding standards, naming conventions, and things to avoid for this project.

---

## Language and Framework

- TypeScript strict mode is enforced. Run `npx tsc --noEmit` before committing.
- Next.js App Router only. Do not mix Pages Router patterns.
- No `any` types unless absolutely required. Add a comment explaining why.

## File Structure

- Library modules go in `src/lib/`. Each file has a single responsibility.
- API handlers go in `src/app/api/`. One folder per resource.
- Keep `page.tsx` as the only client component. All data logic stays in API routes.

## Naming

- Files: `kebab-case.ts`
- Functions: `camelCase`
- Interfaces and types: `PascalCase`
- Database IDs use the format `mon_`, `scr_`, `run_`, `rec_`, `rep_` followed by a timestamp and random suffix.

## Database

- Always read the full db with `readDb()` and write back with `writeDb(db)` in a single call.
- Never mutate the database object across async boundaries without re-reading.
- The database file (`db.json`) is the single source of truth. Do not cache it in memory between requests.

## API Responses

- All API routes return JSON.
- On error, return `{ "error": "message" }` with the appropriate HTTP status code.
- On success, return `{ "key": data }` with HTTP 200.

## Bright Data Integration

- API keys are loaded only from `process.env`. Never hardcode or log them.
- The Collector ID in logs must be masked to `c_xxxxxxxx••••` format.
- Polling timeout is 60 attempts x 5 seconds = 5 minutes maximum.
- Always handle both `application/json` and NDJSON (`text/plain`, `application/x-ndjson`) response types.

## Self-Healing Engine

- Never hardcode selector fallbacks. All candidates must be generated dynamically from the live DOM.
- Optional fields that fail to heal must not mark the entire run as FAILED.
- Log every step of the healing process to the activity log via `logActivity()`.

## CSS and Styling

- All styling uses the CSS custom properties defined in `globals.css`.
- No inline styles for colors or fonts that are not already in the design token set.
- No TailwindCSS. Vanilla CSS only.
- Responsive breakpoints: 1100px for grid-4, 768px for all grids.

## Things to Avoid

- Do not expose `.env` files or API keys in any commit, log, or demo.
- Do not scrape login-walled, paywalled, or robots.txt-restricted pages.
- Do not use `console.log` for production logging. Use `logActivity()` for user-visible events.
- Do not add new dependencies without checking if a native or already-installed solution exists.
