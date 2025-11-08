# Migration Status - Supabase → Neon + Railway

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
- ✅ Removed Supabase authentication headers
- ✅ Updated API endpoints to use Railway URLs
- ✅ Removed `supabaseAnonKey` dependency
- ✅ Added TODO comments for Railway URL updates

### ⚠️ IMPORTANT: URL Placeholders
Both frontend files contain this placeholder:
```javascript
const API_BASE_URL = 'https://your-app.railway.app';
```

**You MUST update this after deploying to Railway!**

---

## 🔜 Next Steps: What YOU Need to Do

### Phase 1: Database Migration (Neon DB)

#### Step 1.1: Create Neon Project
1. Go to https://neon.tech
2. Sign up/login and create a new project
3. Choose a region (US East or West recommended)
4. Copy your connection string (format: `postgresql://user:password@host/dbname?sslmode=require`)
5. Save it as you'll need it for Railway deployment

#### Step 1.2: Export from Supabase (Terminal Commands)
```bash
# Install Supabase CLI (if not already installed)
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project (get project-id from Supabase dashboard)
supabase link --project-ref [your-project-id]

# Export schema
supabase db dump -f supabase_schema.sql

# Export data
supabase db dump --data-only -f supabase_data.sql
```

#### Step 1.3: Create Tables in Neon (Browser - Neon Console)
1. Open Neon Console → SQL Editor
2. Run this SQL:

```sql
-- Table: naca_mortgage_rates
CREATE TABLE naca_mortgage_rates (
    id SERIAL PRIMARY KEY,
    thirty_year_rate DECIMAL(5,3) NOT NULL,
    twenty_year_rate DECIMAL(5,3) NOT NULL,
    fifteen_year_rate DECIMAL(5,3) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_rates_created_at ON naca_mortgage_rates(created_at DESC);

-- Table: ffeic_msa_tract_income_2024
CREATE TABLE ffeic_msa_tract_income_2024 (
    id SERIAL PRIMARY KEY,
    state_code VARCHAR(2) NOT NULL,
    county_code VARCHAR(3) NOT NULL,
    tract_code VARCHAR(6) NOT NULL,
    msa_median_income INTEGER NOT NULL,
    estimated_tract_median_income INTEGER NOT NULL,
    tract_median_income_percentage DECIMAL(5,2) NOT NULL,
    UNIQUE(state_code, county_code, tract_code)
);

CREATE INDEX idx_msa_lookup ON ffeic_msa_tract_income_2024(state_code, county_code, tract_code);
```

#### Step 1.4: Import Data to Neon (Terminal)
```bash
# Option 1: Using psql (recommended)
psql "[your-neon-connection-string]" < supabase_data.sql

# Option 2: Manual CSV import via Neon Console
# Export tables from Supabase as CSV, then use Neon SQL Editor:
# COPY naca_mortgage_rates FROM '/path/to/rates.csv' CSV HEADER;
```

#### Step 1.5: Verify Migration (Neon SQL Editor)
```sql
-- Check row counts
SELECT COUNT(*) FROM naca_mortgage_rates;
SELECT COUNT(*) FROM ffeic_msa_tract_income_2024;

-- Verify latest rate
SELECT * FROM naca_mortgage_rates ORDER BY created_at DESC LIMIT 1;

-- Test MSA lookup
SELECT * FROM ffeic_msa_tract_income_2024 LIMIT 5;
```

---

### Phase 3: Railway Deployment

#### Step 3.1: Install Dependencies (Terminal)
```bash
cd railway-api
bun install  # Make sure Bun is installed first: https://bun.sh
```

#### Step 3.2: Local Testing (Terminal)
```bash
# Create .env file
cp .env.example .env

# Edit .env and add your Neon DATABASE_URL
# DATABASE_URL=postgresql://[user]:[password]@[host]/[dbname]?sslmode=require

# Run dev server
bun run dev

# Test endpoints in another terminal:
curl http://localhost:3000/
curl http://localhost:3000/api/rates
curl -X POST http://localhost:3000/api/msa-lookup \
  -H "Content-Type: application/json" \
  -d '{"address": "123 Main St, Boston, MA 02101"}'
```

#### Step 3.3: Deploy to Railway (Browser)
1. Go to https://railway.app and sign up/login
2. Click "New Project" → "Deploy from GitHub repo"
3. Connect your GitHub account and select this repository
4. Railway will auto-detect Bun and deploy

#### Step 3.4: Configure Environment Variables (Browser - Railway Dashboard)
1. In Railway Dashboard → Your Project → Variables
2. Add:
   ```
   DATABASE_URL=[your-neon-connection-string]
   NODE_ENV=production
   ```

#### Step 3.5: Configure Cron Job (Browser - Railway Dashboard)
1. Click "New Service" → Select same repository
2. Name it `rate-cron`
3. In Variables, add same `DATABASE_URL` and `NODE_ENV`
4. In Settings → Start Command: `bun run src/scripts/runRateUpdate.ts`
5. In Settings → Cron Schedule: `0 6 * * *` (daily at 6 AM UTC)
6. Save and deploy

#### Step 3.6: Get Your Railway URL
1. In Railway Dashboard → Your API service
2. Copy the generated URL (e.g., `https://your-app-abc123.railway.app`)
3. **SAVE THIS URL** - you'll need it for the next step!

---

### Phase 4: Update Frontend URLs

#### Replace Placeholder URLs (This Workspace)
You need to update the Railway URL in 3 files:

1. **popup/popup.js** (lines ~473 and ~505):
```javascript
// Change this:
const API_BASE_URL = 'https://your-app.railway.app';
// To your actual Railway URL:
const API_BASE_URL = 'https://your-app-abc123.railway.app';
```

2. **website/website.js** (lines ~399 and ~437):
```javascript
// Same change as above
const API_BASE_URL = 'https://your-app-abc123.railway.app';
```

3. **js/api-config.js** (line 4):
```javascript
// Same change as above
const API_BASE_URL = 'https://your-app-abc123.railway.app';
```

---

### Phase 5: Testing

#### Step 5.1: Test Railway API (Terminal)
```bash
# Replace YOUR_RAILWAY_URL with actual URL
curl https://YOUR_RAILWAY_URL/api/rates
curl -X POST https://YOUR_RAILWAY_URL/api/msa-lookup \
  -H "Content-Type: application/json" \
  -d '{"address": "123 Main St, Boston, MA 02101"}'
```

#### Step 5.2: Test Extension (Browser)
1. Open Chrome → Extensions → Load unpacked
2. Select your extension directory
3. Click extension icon and test calculator
4. Check browser console for any CORS errors

#### Step 5.3: Test Website (Browser)
1. Open `website/index.html` in browser
2. Test rate display
3. Test MSA lookup
4. Check browser console for errors

#### Step 5.4: Test Cron Job (Browser - Railway Dashboard)
1. In Railway → `rate-cron` service → Logs
2. Click "Run Now" to trigger immediately
3. Verify logs show: "Cron run started" → "Cron result: inserted/unchanged" → "Cron run finished"
4. Check Neon DB for new rate entry

---

## 📋 Checklist

### Phase 1: Database Migration
- [ ] Created Neon project and saved connection string
- [ ] Exported Supabase schema and data
- [ ] Created tables in Neon
- [ ] Imported data to Neon
- [ ] Verified data migration (row counts match)

### Phase 3: Railway Deployment
- [ ] Installed Bun and dependencies locally
- [ ] Tested Railway API locally
- [ ] Deployed API service to Railway
- [ ] Configured environment variables
- [ ] Deployed and configured cron service
- [ ] Saved Railway URL

### Phase 4: Frontend Updates
- [ ] Updated `popup/popup.js` with Railway URL
- [ ] Updated `website/website.js` with Railway URL
- [ ] Updated `js/api-config.js` with Railway URL

### Phase 5: Testing
- [ ] Railway API endpoints work correctly
- [ ] Extension loads and fetches rates
- [ ] Website loads and fetches rates
- [ ] MSA lookup works in both extension and website
- [ ] No CORS errors in console
- [ ] Cron job runs successfully

### Phase 6: Cleanup (After 1+ week of testing)
- [ ] Confirmed Railway stable in production
- [ ] Downloaded final Supabase backup
- [ ] Disabled Supabase Edge Functions
- [ ] Updated documentation
- [ ] Decommissioned Supabase project

---

## 🆘 Troubleshooting

### Database Connection Issues
```bash
# Test Neon connection
psql "[your-neon-connection-string]"

# Check Railway logs
# In Railway Dashboard → Service → Logs
```

### CORS Errors
- Verify Railway API has CORS headers in responses
- Check browser console for specific error messages
- Ensure manifest.json has correct permissions for extension

### Cron Job Not Running
- Check Railway Dashboard → `rate-cron` → Logs
- Verify cron schedule is `0 6 * * *`
- Ensure previous run completed (status: "Completed")
- Use "Run Now" button to test immediately

---

## 📞 Need Help?

Refer to:
- **Railway Docs**: https://docs.railway.app
- **Neon Docs**: https://neon.tech/docs
- **Bun Docs**: https://bun.sh/docs
- **Migration Plan**: See `migration_plan.md` for full details

---

**Current Status**: ✅ Phase 2 Complete, ✅ Phase 4 Code Ready
**Next Action**: Start Phase 1 (Database Migration)

