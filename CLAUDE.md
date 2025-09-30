# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a NACA (Neighborhood Assistance Corporation of America) Mortgage Calculator browser extension that replicates functionality from the official NACA website. The project includes both a Chrome extension and a standalone website version.

### Core Architecture

- **Browser Extension**: Chrome Manifest V3 extension with popup interface
- **Website Version**: Standalone web application deployable to GitHub Pages
- **Backend Services**: Supabase Edge Functions for data fetching and API integration
- **Data Storage**: Supabase database for mortgage rates and MSA income data

### Key Components

1. **MortgageCalculator Class** (`js/calculator.js`, `website/calculator.js`) - Core calculation engine supporting:
   - Payment-to-price and price-to-payment calculations
   - Interest rate buydown calculations (1.5% max buydown)
   - Principal buydown calculations
   - PITI (Principal, Interest, Taxes, Insurance) breakdowns

2. **Extension Popup** (`popup/`) - Browser extension interface with dual calculation modes

3. **Website Interface** (`website/`) - Standalone web version with MSA lookup functionality

4. **Supabase Functions** (`supabase/functions/`):
   - `get-naca-rates`: Scrapes and caches NACA mortgage rates (24-hour cache)
   - `msaLookup`: Geocodes addresses and retrieves MSA income data

## Development Commands

### Build Extension
```bash
./scripts/zip_for_chrome.sh
```
Creates `naca_extension.zip` ready for Chrome Web Store upload.

### Deploy Website
The website auto-deploys to GitHub Pages from the `website/` directory.

### Supabase Functions
```bash
# Serve locally
supabase functions serve get-naca-rates --env-file ./supabase/.env --no-verify-jwt
supabase functions serve msaLookup --env-file ./supabase/.env --no-verify-jwt

# Deploy
supabase functions deploy get-naca-rates --no-verify-jwt
supabase functions deploy msaLookup --no-verify-jwt
```

## Code Structure

### Calculator Logic Flow
- Two calculation modes: `payment` (desired payment → max price) and `price` (purchase price → monthly payment)
- Binary search algorithm for payment-to-price calculations
- Interest rate buydown: 1 point = 1/6% reduction (20/30 year), 1/4% reduction (15 year)
- All calculations account for principal buydowns and include PITI components

### Data Integration
- Live mortgage rates scraped from NACA website with 24-hour caching
- MSA income data from FFEIC database stored in Supabase
- Census geocoding API for address-to-tract resolution

### Shared Code Pattern
Both extension and website versions share the same `MortgageCalculator` class but have separate DOM manipulation code (`popup/popup.js` vs `website/website.js`).

## Environment Variables
Required for Supabase functions:
- `NACA_APP_SUPABASE_URL`
- `NACA_APP_SUPABASE_ROLE_KEY` (for rate updates)
- `NACA_APP_SUPABASE_ANON_KEY` (for MSA lookups)

## Testing
No automated tests currently implemented. Manual testing required for both extension and website versions.

## Key Implementation Notes
- Interest rate buydown calculations include 1.5% maximum reduction cap
- Rate caching prevents excessive API calls to NACA website
- MSA lookup requires valid US addresses for Census API geocoding
- Extension manifest uses minimal permissions (no host permissions required)