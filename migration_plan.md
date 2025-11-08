# Neon + Railway Operations Guide

## 1. Overview
This document replaces the historical Supabase migration plan. It documents how the NACA Mortgage Calculator now runs entirely on **Neon PostgreSQL** + **Railway (Bun)** and how to operate, deploy, and troubleshoot the system.

Key components:
- `railway-api/`: Bun REST API + cron entrypoint
- Neon database (tables `naca_mortgage_rates`, `ffeic_msa_tract_income_2024`)
- Chrome extension (`popup/`)
- Website client (`website/`)
- Shared configuration (`js/api-config.js`)

## 2. Environments

| Environment | Location | Notes |
|-------------|----------|-------|
| Production  | Railway (`https://naca-mortgage-calc-extension-production.up.railway.app`) | Uses Neon production database |
| Local       | `bun run dev` (port 3000) | Requires `.env` with `DATABASE_URL` |

### 2.1 Environment Variables
- `DATABASE_URL`: Neon connection string (`postgresql://user:password@host/db?sslmode=require`)
- `NODE_ENV`: `development` locally, `production` on Railway
- `PORT`: defaults to `3000` (Railway sets `PORT` automatically)

`railway-api/.env.example` contains the template.

## 3. Local Development

```bash
# API
cd railway-api
bun install
cp .env.example .env   # Fill DATABASE_URL (can be Neon read-only branch)
bun run dev            # http://localhost:3000

# Test endpoints
curl http://localhost:3000/
curl http://localhost:3000/api/rates
curl -X POST http://localhost:3000/api/msa-lookup \
  -H "Content-Type: application/json" \
  -d '{"address":"123 Main St, Boston, MA 02101"}'
```

Extension development:
- Load `manifest.json` as an unpacked Chrome extension
- Edit `popup/popup.js`, `popup/popup.html`, `popup/popup.css`

Website development:
- Open `website/index.html` directly or serve via any static server
- JS uses the shared API config (`js/api-config.js`)

## 4. Deployment

### 4.1 Railway API Service
1. Commit + push to `main` (Railway GitHub integration auto-builds) or run `railway up`
2. Ensure build logs succeed (`bun run start`)
3. Health check: `curl https://naca-mortgage-calc-extension-production.up.railway.app/`

### 4.2 Railway Cron Service
- Start command: `bun run src/scripts/runRateUpdate.ts`
- Schedule: `0 6 * * *` (06:00 UTC)
- Logs should show `Cron run started` → `Cron result: { inserted | unchanged | already_saved }` → `Cron run finished`

### 4.3 Chrome Extension Package
```bash
./scripts/zip_for_chrome.sh
```
Produces `naca_extension.zip` for Chrome Web Store uploads.

### 4.4 Website Deployment
- Deploy contents of `website/` to GitHub Pages or preferred host
- Ensure the bundled JS references the production Railway base URL (`js/api-config.js`)

## 5. Database Schema (Neon)

```
CREATE TABLE naca_mortgage_rates (
    id BIGSERIAL PRIMARY KEY,
    thirty_year_rate NUMERIC,
    twenty_year_rate NUMERIC,
    fifteen_year_rate NUMERIC,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
CREATE INDEX idx_rates_created_at ON naca_mortgage_rates(created_at DESC);

CREATE TABLE ffeic_msa_tract_income_2024 (
    msa_code INTEGER,
    state_code INTEGER,
    county_code INTEGER,
    tract_code INTEGER,
    tract_median_income_percentage DOUBLE PRECISION,
    msa_median_income INTEGER,
    estimated_tract_median_income INTEGER
);
CREATE INDEX idx_msa_lookup ON ffeic_msa_tract_income_2024(state_code, county_code, tract_code);
```

## 6. Monitoring & Alerting

| Area | What to watch | Tool |
|------|----------------|------|
| API errors | 4xx/5xx logs, Neon connection errors | Railway dashboard → API service logs |
| Cron runs | Daily success, inserted/unchanged status | Railway dashboard → rate-cron logs |
| Database health | Connection count, storage usage | Neon console |
| Client failures | Fetch errors, CORS issues | Browser console, monitoring service |

Recommended actions:
- Set up log alerts (Railway integrations) for cron failures
- Periodically export Neon data for backups
- Rotate credentials every 90 days

## 7. Troubleshooting

### 7.1 API returns 500
- Check Railway logs for stack trace
- Verify `DATABASE_URL` is valid
- Ensure Neon instance is running and reachable

### 7.2 CORS Errors
- Confirm `corsHeaders` in `railway-api/src/utils/cors.ts` allow required origins
- Make sure extension/website fetches are using HTTPS

### 7.3 Cron did not insert new rates
- Confirm rates on the NACA site actually changed
- Regex in `railway-api/src/services/scraper.ts` may need updates if the site changes markup
- Ensure last insert was more than 24 hours ago (dedupe guard)

### 7.4 MSA lookup failing
- Census geocoder may rate-limit; retry after a short delay
- Ensure parsed `state`, `county`, `tract` are integers before querying Neon

## 8. Release Checklist

- [ ] `bun run dev` works locally with Neon dev branch
- [ ] Unit/manual tests on `/api/rates` and `/api/msa-lookup`
- [ ] Railway deployment successful
- [ ] Cron run invoked manually post-deploy and completed successfully
- [ ] Extension tested in Chrome (unpacked)
- [ ] Website tested (UI + calculations + MSA lookup)
- [ ] New `naca_extension.zip` generated (if extension changes)

## 9. File Map (post-Supabase)

```
naca-app/
├── railway-api/
│   ├── src/
│   │   ├── index.ts
│   │   ├── routes/
│   │   ├── services/
│   │   ├── scripts/
│   │   └── utils/
│   ├── package.json
│   ├── tsconfig.json
│   └── README.md
├── js/
│   └── api-config.js
├── popup/
│   └── popup.js
├── website/
│   └── website.js
├── scripts/
│   └── zip_for_chrome.sh
├── START_HERE.md
├── MIGRATION_STATUS.md
├── migration_plan.md  (this file)
└── neon_schema.sql
```

## 10. Change Log

- 2025-01-XX: Supabase infrastructure removed; Neon + Railway live
- 2025-01-XX: Clients updated to call Railway API
- 2025-01-XX: Docs refreshed (this guide, START_HERE.md, MIGRATION_STATUS.md)

## 11. Contacts & Resources

- Railway docs: https://docs.railway.app
- Neon docs: https://neon.tech/docs
- Bun docs: https://bun.sh/docs
- Production API: https://naca-mortgage-calc-extension-production.up.railway.app
- Issue tracker: GitHub repository issues

Keep this guide updated whenever workflows or infrastructure change. All Supabase instructions have been removed – the stack now relies solely on Neon and Railway.
