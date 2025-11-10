# Migration Status - Neon + Railway

## ✅ Completed: Phase 2 - Bun Server Development

I've created the complete Railway API server in the `railway-api/` directory with:

### Created Files:
```
railway-api/
├── src/
│   ├── index.ts              # Main Bun server (health check + routes)
│   ├── routes/
│   │   ├── rates.ts          # GET /api/rates endpoint
│   │   └── msaLookup.ts      # POST /api/msa-lookup endpoint
│   ├── services/
│   │   ├── db.ts             # Neon PostgreSQL connection pool
│   │   ├── scraper.ts        # NACA website rate scraper
│   │   └── rateUpdater.ts    # Deduped rate persistence logic
│   ├── scripts/
│   │   └── runRateUpdate.ts  # Railway Cron job entry point
│   └── utils/
│       └── cors.ts           # CORS configuration
├── package.json
├── tsconfig.json
├── .env.example
├── .gitignore
└── README.md
```

### API Endpoints:
- `GET /api/rates` - Returns latest mortgage rates from Neon DB
- `POST /api/msa-lookup` - Geocodes address and returns MSA income data
- `GET /` - Health check endpoint

### Key Features:
- ✅ CORS configured for browser extension + website access
- ✅ Deduplicated rate updates (max 1 snapshot per 24 hours)
- ✅ Cron script that exits cleanly for Railway scheduling
- ✅ Error handling with proper HTTP status codes
- ✅ Connection pooling for Neon DB

## ✅ Completed: Phase 4 - Frontend Updates

I've updated both frontend files to use the Railway API:

### Modified Files:
- `popup/popup.js` - Extension popup
- `website/website.js` - Website frontend
- `js/api-config.js` - (NEW) Centralized API configuration

### Changes Made:
- ✅ Removed legacy authentication headers
- ✅ Updated API endpoints to use Railway URLs
- ✅ Centralized configuration via `js/api-config.js`
- ✅ Added TODO comments for Railway URL updates

### ⚠️ IMPORTANT: URL Placeholders
Both frontend files contain this placeholder:
```javascript
const API_BASE_URL = 'https://naca-mortgage-calc-extension-production.up.railway.app';
```

**Make sure this matches your deployed Railway service.**

---

## ✅ Migration Summary

- Data migrated from Supabase to Neon (tables `naca_mortgage_rates`, `ffeic_msa_tract_income_2024`)
- Railway API deployed at `https://naca-mortgage-calc-extension-production.up.railway.app`
- Cron service (`rate-cron`) scheduled daily 06:00 UTC and writes only when rates change
- Chrome extension & website consume the Railway API (no Supabase dependencies remain)

---

## 🔍 Verification Checklist

### Neon database
- `SELECT COUNT(*) FROM naca_mortgage_rates;` → matches historical count
- `SELECT * FROM naca_mortgage_rates ORDER BY created_at DESC LIMIT 1;` → latest rates confirm daily job
- `SELECT * FROM ffeic_msa_tract_income_2024 LIMIT 5;` → baseline MSA data present

### Railway services
- API service: `bun run start` (port 3000) publishes `/`, `/api/rates`, `/api/msa-lookup`
- Cron service: `bun run src/scripts/runRateUpdate.ts` (logs “Cron run started/finished”)
- Environment variables: `DATABASE_URL`, `NODE_ENV=production`
- Health check: `curl https://naca-mortgage-calc-extension-production.up.railway.app/`

### Clients
- Extension (Popup) uses `API_ENDPOINTS` from `js/api-config.js`
- Website `website/website.js` fetches from the same Railway base URL
- Both clients handle error conditions with JSON error responses (404/500)

---

## 🔄 Release Playbook

1. **Local sanity check**
   ```bash
   cd railway-api
   bun install
   cp .env.example .env   # add Neon DATABASE_URL
   bun run dev
   ```
   - `curl http://localhost:3000/api/rates`
   - `curl -X POST http://localhost:3000/api/msa-lookup -d '{"address":"123 Main St, Boston, MA"}'`

2. **Deploy to Railway**
   - Push to main (GitHub integration auto-builds) or use `railway up`
   - Confirm new release in Railway dashboard → Deployments

3. **Package extension**
   ```bash
   ./scripts/zip_for_chrome.sh
   ```
   - Upload `naca_extension.zip` to Chrome Web Store if publishing

4. **Smoke test production**
   ```bash
   curl https://naca-mortgage-calc-extension-production.up.railway.app/api/rates
   curl -X POST https://naca-mortgage-calc-extension-production.up.railway.app/api/msa-lookup \
     -H "Content-Type: application/json" \
     -d '{"address":"123 Main St, Boston, MA 02101"}'
   ```
   - Load extension (unpacked) and verify UI
   - Trigger Railway cron “Run Now” and confirm log output

---

## 🧹 Follow-up Items

- [ ] Monitor cron runs for a few days (expect “inserted” on first run, “unchanged” otherwise)
- [ ] Remove any remaining Supabase credentials from shared vaults/secrets
- [ ] Archive old Supabase backups in cold storage (if needed)
- [ ] Update organization runbooks to reference Neon/Railway only

---

## 📚 References

- Railway Dashboard: https://railway.app/project (API + rate-cron services)
- Neon Console: https://console.neon.tech (manage database + auth tokens)
- Bun Docs: https://bun.sh/docs
- Railway API README: `railway-api/README.md`
- Extension packaging script: `scripts/zip_for_chrome.sh`

---

**Current Status**: ✅ Migration complete – Supabase fully decommissioned
**Next Action**: Ongoing monitoring & extension releases as needed

