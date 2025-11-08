# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a NACA (Neighborhood Assistance Corporation of America) Mortgage Calculator browser extension that replicates functionality from the official NACA website. The project includes both a Chrome extension and a standalone website version.

### Core Architecture

- **Browser Extension**: Chrome Manifest V3 extension with popup interface
- **Website Version**: Standalone web application served from Railway (same-origin with API)
- **Backend Services**: Railway-hosted Bun server with REST API + static file serving
- **Data Storage**: Neon PostgreSQL database for mortgage rates and MSA income data
- **Cron Jobs**: Railway Cron service for daily rate updates (6 AM UTC)

### Key Components

1. **MortgageCalculator Class** (`js/calculator.js`, `website/calculator.js`) - Core calculation engine supporting:
   - Payment-to-price and price-to-payment calculations
   - Interest rate buydown calculations (1.5% max buydown)
   - Principal buydown calculations
   - PITI (Principal, Interest, Taxes, Insurance) breakdowns

2. **Extension Popup** (`popup/`) - Browser extension interface with dual calculation modes

3. **Website Interface** (`railway-api/public/`) - Standalone web version with MSA lookup functionality

4. **Railway API + Static Server** (`railway-api/`):
   - `GET /api/rates`: Returns latest mortgage rates from Neon DB
   - `POST /api/msa-lookup`: Geocodes addresses and retrieves MSA income data
   - `GET /`: Serves static website (index.html and assets from `public/`)
   - Static assets: All files in `railway-api/public/` served with proper MIME types
   - Daily cron job scrapes NACA rates (max 1 snapshot per 24 hours)

## Development Commands

### Build Extension
```bash
./scripts/zip_for_chrome.sh
```
Creates `naca_extension.zip` ready for Chrome Web Store upload.

### Deploy Website
Landing page served from `railway-api/public/index.html`:
- Edit files directly in `railway-api/public/` directory
- Auto-deploys with Railway API when pushing to main branch
- Uses relative API URLs (same-origin, no CORS needed)
- All static assets served from `railway-api/public/` directory

_Note: Legacy `website/` directory will be removed._

### Railway API
```bash
# Navigate to API directory
cd railway-api

# Install dependencies
bun install

# Run locally (dev mode with watch)
bun run dev

# Run locally (production mode)
bun run start

# Test cron job locally
bun run src/scripts/runRateUpdate.ts

# Deploy to Railway
# Push to GitHub main branch (auto-deploys)
# Or use Railway CLI: railway up
```

## Code Structure

### Calculator Logic Flow
- Two calculation modes: `payment` (desired payment → max price) and `price` (purchase price → monthly payment)
- Binary search algorithm for payment-to-price calculations
- Interest rate buydown: 1 point = 1/6% reduction (20/30 year), 1/4% reduction (15 year)
- All calculations account for principal buydowns and include PITI components

### Data Integration
- Live mortgage rates scraped from NACA website daily (Railway cron at 6 AM UTC)
- Deduplicated rate storage (max 1 snapshot per 24 hours) in Neon PostgreSQL
- MSA income data from FFEIC database stored in Neon PostgreSQL
- Census geocoding API for address-to-tract resolution
- CORS-enabled REST API accessible from browser extension and website

### Shared Code Pattern
Both extension and website versions share the same `MortgageCalculator` class but have separate DOM manipulation code (`popup/popup.js` vs `website/website.js`).

### Static File Serving
Railway server serves static files from `railway-api/public/`:
- All non-API routes check for matching static files
- MIME types automatically set (.html, .css, .js, .png, .svg, etc.)
- Fallback to index.html for client-side routing
- API routes (`/api/*`) take precedence over static files
- Security: Directory traversal prevention built-in

## Environment Variables
Required for Railway API (set in Railway Dashboard):
- `DATABASE_URL` - Neon PostgreSQL connection string
- `PORT` - Server port (default: 3000, auto-set by Railway)
- `NODE_ENV` - Environment (development/production)

Local development (`.env` file in `railway-api/`):
```
DATABASE_URL=postgresql://user:password@host/dbname?sslmode=require
PORT=3000
NODE_ENV=development
```

## Testing
No automated tests currently implemented. Manual testing required for both extension and website versions.

## Key Implementation Notes
- Interest rate buydown calculations include 1.5% maximum reduction cap
- Rate deduplication prevents duplicate snapshots (max 1 per 24 hours)
- MSA lookup requires valid US addresses for Census API geocoding
- Extension manifest uses minimal permissions (no host permissions required)
- CORS configured for cross-origin requests from extension and website
- Railway cron job exits cleanly after each run for proper scheduling

## Migration Status
**Migrated from Supabase → Neon + Railway** (January 2025)
- Old: Supabase (PostgreSQL + Edge Functions)
- New: Neon PostgreSQL + Railway (Bun server + Cron)

See `MIGRATION_STATUS.md` for details and `migration_plan.md` for full migration guide.

### API Endpoints
- `GET /api/rates` - Returns latest mortgage rates
- `POST /api/msa-lookup` - Geocodes address and returns MSA income data
- `GET /` - Serves website (index.html)
- `GET /<path>` - Serves static files from `public/` directory

### Database Tables (Neon)
- `naca_mortgage_rates` - Current mortgage rates (updated daily via cron)
- `ffeic_msa_tract_income_2024` - MSA income data from FFEIC