# Migration Plan: Supabase → Neon DB + Railway (Bun Server)

## Overview
Migrating the NACA Mortgage Calculator from Supabase (database + Edge Functions) to Neon DB (PostgreSQL) + Railway (Bun server) with a daily cron job for rate updates.

## User Requirements Confirmed
- ✅ Access to export Supabase schema and data
- ✅ Railway Cron job scheduled for 6 AM UTC daily
- ✅ API accessible from browser extension and frontend website
- ✅ Start with Neon DB setup first

---

## Phase 1: Database Migration (Neon DB) 🗄️

### 1.1 Set up Neon Project
**Steps:**
1. Go to [neon.tech](https://neon.tech) and create new project
2. Choose region (recommend US East or West based on your users)
3. Note your connection string format:
   ```
   postgresql://[user]:[password]@[host]/[dbname]?sslmode=require
   ```
4. Save this as `DATABASE_URL` for later use

### 1.2 Export Schema from Supabase
**Using Supabase Dashboard:**
```bash
# Install Supabase CLI if not already installed
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project (get project-id from dashboard)
supabase link --project-ref [your-project-id]

# Generate migration file with current schema
supabase db dump -f schema.sql

# Export data
supabase db dump --data-only -f data.sql
```

**Alternative - Manual Export:**
- Go to Supabase Dashboard → Database → Schema
- Copy table definitions manually
- Use Table Editor → Export as CSV for data

### 1.3 Create Tables in Neon

**Option A - Using Neon SQL Editor (Dashboard):**
1. Open Neon Console → SQL Editor
2. Run the following SQL:

```sql
-- Table: naca_mortgage_rates
-- Stores current mortgage rates scraped from NACA website
CREATE TABLE naca_mortgage_rates (
    id SERIAL PRIMARY KEY,
    thirty_year_rate DECIMAL(5,3) NOT NULL,
    twenty_year_rate DECIMAL(5,3) NOT NULL,
    fifteen_year_rate DECIMAL(5,3) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for efficient latest-rate queries
CREATE INDEX idx_rates_created_at ON naca_mortgage_rates(created_at DESC);

-- Table: ffeic_msa_tract_income_2024
-- Stores MSA (Metropolitan Statistical Area) income data from FFEIC
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

-- Composite index for MSA lookups (common query pattern)
CREATE INDEX idx_msa_lookup ON ffeic_msa_tract_income_2024(state_code, county_code, tract_code);
```

**Option B - Using psql CLI:**
```bash
# Connect to Neon
psql "postgresql://[user]:[password]@[host]/[dbname]?sslmode=require"

# Paste the SQL above or run from file
\i neon_schema.sql
```

### 1.4 Migrate Existing Data

**Using pg_dump/pg_restore:**
```bash
# Export from Supabase
pg_dump [supabase-connection-string] \
  --data-only \
  --table=naca_mortgage_rates \
  --table=ffeic_msa_tract_income_2024 \
  > supabase_data.sql

# Import to Neon
psql [neon-connection-string] < supabase_data.sql
```

**Using CSV Export/Import:**
```bash
# 1. Export from Supabase Table Editor as CSV
# 2. Import to Neon using SQL Editor:

COPY naca_mortgage_rates(thirty_year_rate, twenty_year_rate, fifteen_year_rate, created_at)
FROM '/path/to/rates.csv'
DELIMITER ','
CSV HEADER;

COPY ffeic_msa_tract_income_2024(state_code, county_code, tract_code, msa_median_income, estimated_tract_median_income, tract_median_income_percentage)
FROM '/path/to/msa_data.csv'
DELIMITER ','
CSV HEADER;
```

### 1.5 Verify Data Migration
```sql
-- Check row counts match
SELECT COUNT(*) FROM naca_mortgage_rates;
SELECT COUNT(*) FROM ffeic_msa_tract_income_2024;

-- Verify latest rate
SELECT * FROM naca_mortgage_rates ORDER BY created_at DESC LIMIT 1;

-- Confirm at most one snapshot per day
SELECT created_at::date AS recorded_on,
       COUNT(*) AS rate_snapshots
FROM naca_mortgage_rates
GROUP BY created_at::date
HAVING COUNT(*) > 1;

-- Test MSA lookup
SELECT * FROM ffeic_msa_tract_income_2024
WHERE state_code = '25' AND county_code = '025' AND tract_code = '010200';
```

---

## Phase 2: Bun Server Development 🚀

### 2.1 Project Structure
```
railway-api/
├── src/
│   ├── index.ts              # Main Bun server entry point
│   ├── routes/
│   │   ├── rates.ts              # GET /api/rates endpoint
│   │   └── msaLookup.ts          # POST /api/msa-lookup endpoint
│   ├── services/
│   │   ├── db.ts                 # Neon PostgreSQL connection pool
│   │   ├── scraper.ts            # NACA website scraper
│   │   └── rateUpdater.ts        # Deduped rate persistence helpers
│   ├── scripts/
│   │   └── runRateUpdate.ts      # Cron entry point (exits after job completes)
│   ├── utils/
│   │   └── cors.ts               # CORS configuration
│   └── types/
│       └── index.ts              # TypeScript interfaces
├── package.json
├── tsconfig.json
├── .env.example
├── .gitignore
└── README.md
```

### 2.2 Initialize Project
```bash
mkdir railway-api
cd railway-api
bun init -y

# Install dependencies
bun add pg
bun add -d @types/pg @types/node
```

### 2.3 Configuration Files

**package.json:**
```json
{
  "name": "naca-calculator-api",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "bun run --watch src/index.ts",
    "start": "bun run src/index.ts",
    "build": "bun build src/index.ts --outdir ./dist --target bun"
  },
  "dependencies": {
    "pg": "^8.11.3"
  },
  "devDependencies": {
    "@types/pg": "^8.10.9",
    "@types/node": "^20.10.0"
  }
}
```

**tsconfig.json:**
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "lib": ["ES2022"],
    "moduleResolution": "bundler",
    "types": ["bun-types"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules"]
}
```

**.env.example:**
```bash
# Neon Database Connection
DATABASE_URL=postgresql://user:password@host/dbname?sslmode=require

# Server Configuration
PORT=3000
NODE_ENV=development

# (Cron service reuses DATABASE_URL/NODE_ENV)
```

**.gitignore:**
```
node_modules/
dist/
.env
.DS_Store
*.log
```

### 2.4 Core Implementation Files

**src/services/db.ts** - Database connection:
```typescript
import { Pool } from 'pg';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required');
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // Neon requires SSL
  max: 20, // Maximum pool size
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Test connection on startup
pool.on('error', (err) => {
  console.error('Unexpected database error', err);
  process.exit(-1);
});

export async function testConnection() {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    console.log('✅ Database connected successfully:', result.rows[0]);
    client.release();
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    throw error;
  }
}
```

**src/utils/cors.ts** - CORS headers:
```typescript
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // Allows browser extension + website
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400', // 24 hours
};

export function handleCORS(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }
  return null;
}
```

**src/services/scraper.ts** - NACA rate scraper:
```typescript
// Regex from original Supabase function (supabase/functions/get-naca-rates/index.ts:7)
const rateRegex = /function\s+fillRate\s*\(\)\s*\{\s*var\s+thirtyYearRate\s*=\s*"([^"]+)";\s*var\s+twentyYearRate\s*=\s*"([^"]+)";\s*var\s+fifteenYearRate\s*=\s*"([^"]+)";/;

const NACA_CALCULATOR_URL = 'https://www.naca.com/mortgage-calculator/';

export interface RateData {
  thirty_year_rate: number;
  twenty_year_rate: number;
  fifteen_year_rate: number;
}

export async function scrapeNacaRates(): Promise<RateData> {
  console.log('🔍 Fetching rates from NACA website...');

  const response = await fetch(NACA_CALCULATOR_URL);

  if (!response.ok) {
    throw new Error(`Failed to fetch NACA page: ${response.statusText}`);
  }

  const html = await response.text();
  const match = html.match(rateRegex);

  if (!match || match.length < 4) {
    throw new Error('Could not parse rates from NACA page');
  }

  const rates = {
    thirty_year_rate: parseFloat(match[1].replace('%', '')),
    twenty_year_rate: parseFloat(match[2].replace('%', '')),
    fifteen_year_rate: parseFloat(match[3].replace('%', '')),
  };

  console.log('✅ Scraped rates:', rates);
  return rates;
}
```

**src/routes/rates.ts** - GET /api/rates endpoint:
```typescript
import { pool } from '../services/db';
import { corsHeaders } from '../utils/cors';

export async function getRates(): Promise<Response> {
  try {
    const result = await pool.query(
      'SELECT * FROM naca_mortgage_rates ORDER BY created_at DESC LIMIT 1'
    );

    if (result.rows.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No rates available' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(
      JSON.stringify(result.rows[0]),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error fetching rates:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
}
```

**src/routes/msaLookup.ts** - POST /api/msa-lookup endpoint:
```typescript
import { pool } from '../services/db';
import { corsHeaders } from '../utils/cors';

interface AddressRequest {
  address: string;
}

interface LocationData {
  state: string;
  county: string;
  tract: string;
  block: string;
  geoid: string;
}

async function geocodeAddress(address: string) {
  const encodedAddress = encodeURIComponent(address);
  const apiUrl = `https://geocoding.geo.census.gov/geocoder/geographies/onelineaddress?address=${encodedAddress}&benchmark=4&vintage=4&format=json`;

  const response = await fetch(apiUrl);
  const data = await response.json();

  if (data.result?.addressMatches?.length > 0) {
    const match = data.result.addressMatches[0];
    return {
      matched: true,
      matchedAddress: match.matchedAddress,
      coordinates: match.coordinates,
      geographies: match.geographies,
    };
  }

  return { matched: false };
}

function extractLocationData(geocodeResult: any): LocationData {
  const censusBlocks = geocodeResult.geographies['2020 Census Blocks'][0];
  const censusTract = geocodeResult.geographies['Census Tracts'][0];

  return {
    state: censusTract.STATE,
    county: censusTract.COUNTY,
    tract: censusTract.TRACT,
    block: censusBlocks.BLOCK,
    geoid: censusTract.GEOID,
  };
}

export async function msaLookup(req: Request): Promise<Response> {
  try {
    const body = await req.json() as AddressRequest;
    const { address } = body;

    if (!address) {
      return new Response(
        JSON.stringify({ error: 'Address is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Geocode address
    const geocodeResult = await geocodeAddress(address);
    if (!geocodeResult.matched) {
      return new Response(
        JSON.stringify({ error: 'Address could not be geocoded' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Extract location data
    const locationData = extractLocationData(geocodeResult);

    // Query income data from Neon
    const result = await pool.query(
      `SELECT
        msa_median_income,
        estimated_tract_median_income,
        tract_median_income_percentage
      FROM ffeic_msa_tract_income_2024
      WHERE state_code = $1 AND county_code = $2 AND tract_code = $3`,
      [locationData.state, locationData.county, locationData.tract]
    );

    if (result.rows.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No income data found for this location' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const incomeData = result.rows[0];

    const response = {
      address: geocodeResult.matchedAddress || address,
      state: locationData.state,
      county: locationData.county,
      tract: locationData.tract,
      msaMedianFamilyIncome: incomeData.msa_median_income,
      tractMedianFamilyIncome: incomeData.estimated_tract_median_income,
      tractPercentOfMsa: incomeData.tract_median_income_percentage,
      year: 2024,
    };

    return new Response(
      JSON.stringify(response),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in MSA lookup:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
}
```

The rate updater helper keeps the existing schema intact while preventing duplicate rows. It compares the latest stored snapshot with the freshly scraped values and enforces a 24-hour cool-down before another insert.

**src/services/rateUpdater.ts** - Deduplicated rate persistence logic:
```typescript
import { pool } from './db';

type RateSnapshot = {
  thirty_year_rate: number;
  twenty_year_rate: number;
  fifteen_year_rate: number;
};

const ONE_DAY_IN_MS = 24 * 60 * 60 * 1000;

function ratesMatch(
  latest: RateSnapshot | undefined,
  incoming: RateSnapshot
) {
  if (!latest) return false;
  return (
    latest.thirty_year_rate === incoming.thirty_year_rate &&
    latest.twenty_year_rate === incoming.twenty_year_rate &&
    latest.fifteen_year_rate === incoming.fifteen_year_rate
  );
}

export async function saveRatesIfNeeded(rates: RateSnapshot) {
  const latestResult = await pool.query(
    'SELECT * FROM naca_mortgage_rates ORDER BY created_at DESC LIMIT 1'
  );

  const latest = latestResult.rows[0] as (RateSnapshot & { created_at: string }) | undefined;

  if (ratesMatch(latest, rates)) {
    console.log('ℹ️ Rates unchanged, skipping insert');
    return { status: 'unchanged' as const };
  }

  if (latest) {
    const lastCreatedAt = new Date(latest.created_at);
    const now = new Date();

    if (now.getTime() - lastCreatedAt.getTime() < ONE_DAY_IN_MS) {
      console.log('ℹ️ Rates already captured in the last 24 hours, skipping insert');
      return { status: 'already_saved' as const, lastCreatedAt };
    }
  }

  const insertResult = await pool.query(
    `INSERT INTO naca_mortgage_rates
      (thirty_year_rate, twenty_year_rate, fifteen_year_rate)
    VALUES ($1, $2, $3)
    RETURNING *`,
    [rates.thirty_year_rate, rates.twenty_year_rate, rates.fifteen_year_rate]
  );

  const saved = insertResult.rows[0];
  console.log('✅ New rates saved:', saved);
  return { status: 'inserted' as const, record: saved };
}
```

**src/scripts/runRateUpdate.ts** - Railway Cron entry point:
```typescript
import { pool } from '../services/db';
import { scrapeNacaRates } from '../services/scraper';
import { saveRatesIfNeeded } from '../services/rateUpdater';

async function run() {
  console.log('⏰ Cron run started');

  try {
    const rates = await scrapeNacaRates();
    const result = await saveRatesIfNeeded(rates);
    console.log('ℹ️ Cron result:', result);
  } catch (error) {
    console.error('❌ Rate cron failed:', error);
    process.exitCode = 1;
  } finally {
    await pool.end(); // Required so the process exits cleanly on Railway Cron
    console.log('👋 Cron run finished');
  }
}

run();
```

This script mirrors Railway's cron guidance: execute the job, close open resources, and exit immediately so the platform can schedule the next run.

**src/index.ts** - Main server:
```typescript
import { testConnection } from './services/db';
import { getRates } from './routes/rates';
import { msaLookup } from './routes/msaLookup';
import { handleCORS } from './utils/cors';

const PORT = process.env.PORT || 3000;

// Initialize database connection
await testConnection();

// Main Bun server
const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    // Handle CORS preflight
    const corsResponse = handleCORS(req);
    if (corsResponse) return corsResponse;

    const url = new URL(req.url);
    const path = url.pathname;

    // Route: GET /api/rates
    if (path === '/api/rates' && req.method === 'GET') {
      return getRates();
    }

    // Route: POST /api/msa-lookup
    if (path === '/api/msa-lookup' && req.method === 'POST') {
      return msaLookup(req);
    }

    // Route: GET / (health check)
    if (path === '/' && req.method === 'GET') {
      return new Response(
        JSON.stringify({
          status: 'ok',
          service: 'NACA Calculator API',
          version: '1.0.0'
        }),
        {
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // 404 for unknown routes
    return new Response('Not Found', { status: 404 });
  },
});

console.log(`🚀 Server running on http://localhost:${PORT}`);
```

### 2.5 Error Handling & Observability
- Keep try/catch blocks around every external call (`scrapeNacaRates`, Census geocoder) and return JSON with clear `error` messages plus appropriate HTTP status codes (400/404/500).
- Log structured errors (`console.error`) so Railway log drains can parse context; avoid logging sensitive request payloads.
- Surface cron outcomes via response payloads (`inserted`, `already_saved`, `unchanged`) to simplify monitoring and alerting rules.
- Consider wrapping `pool.query` calls in helper utilities that attach query metadata on errors for faster debugging.
- Hook Railway log drain or third-party monitoring (e.g., Logtail, Better Stack) to capture `Rate cron failed` events automatically.

### 2.6 Local Testing
```bash
# Create .env file
cp .env.example .env
# Add your Neon DATABASE_URL

# Install dependencies
bun install

# Run dev server
bun run dev

# Test endpoints
curl http://localhost:3000/api/rates
curl -X POST http://localhost:3000/api/msa-lookup \
  -H "Content-Type: application/json" \
  -d '{"address": "123 Main St, Boston, MA 02101"}'
```

---

## Phase 3: Railway Deployment 🚂

### 3.1 Prepare for Deployment
```bash
# Create railway-api/README.md
echo "# NACA Calculator API" > README.md

# Ensure .gitignore is correct
cat > .gitignore << EOF
node_modules/
dist/
.env
.DS_Store
*.log
EOF

# Commit code
git add railway-api/
git commit -m "Add Railway API server with Bun"
```

### 3.2 Deploy to Railway

**Option A - GitHub Integration (Recommended):**
1. Push code to GitHub
2. Go to [railway.app](https://railway.app)
3. Click "New Project" → "Deploy from GitHub repo"
4. Select your repository
5. Railway auto-detects Bun and deploys

**Option B - Railway CLI:**
```bash
# Install Railway CLI
npm i -g @railway/cli

# Login
railway login

# Initialize project
cd railway-api
railway init

# Deploy
railway up
```

### 3.3 Configure Railway Environment

**In Railway Dashboard → Variables:**
```bash
DATABASE_URL=<your-neon-connection-string>
NODE_ENV=production
```

### 3.4 Provision Cron Service

1. Add a second Railway service from the same repository (e.g., name it `rate-cron`).
2. In `rate-cron` → **Variables**, add the same `DATABASE_URL` and `NODE_ENV`.
3. Set **Start Command** to `bun run src/scripts/runRateUpdate.ts`.
4. In `rate-cron` → **Cron Schedule**, set `0 6 * * *` so Railway launches the service daily at 6 AM UTC. The process must exit once complete; ensure no handles remain open (Railway skips runs if a prior one is still active).

### 3.5 Configure Domain (Optional)
- Railway auto-generates a domain: `your-app.railway.app`
- Or add custom domain in Railway dashboard

### 3.6 Monitor Deployment
```bash
# View logs
railway logs

# Check API service logs for request handling
# For cron runs, open the rate-cron service logs (should show "Cron run started" / "Cron run finished")
```

---

## Phase 4: Frontend Updates 🎨

### 4.1 Update Extension (popup.js)

**Find current Supabase URL references:**
```bash
cd /Users/emmanuelgenard/Workspace/naca-app
grep -r "supabase" popup/
grep -r "functions/v1" popup/
```

**Replace with Railway URLs:**
```javascript
// OLD (Supabase):
const RATES_URL = 'https://[project].supabase.co/functions/v1/get-naca-rates';
const MSA_URL = 'https://[project].supabase.co/functions/v1/msaLookup';

// NEW (Railway):
const RATES_URL = 'https://your-app.railway.app/api/rates';
const MSA_URL = 'https://your-app.railway.app/api/msa-lookup';
```

### 4.2 Update Website (website/website.js)

Same URL updates as extension.

### 4.3 Create Config File (Optional)

**js/config.js:**
```javascript
// API Configuration
export const API_BASE_URL = process.env.API_BASE_URL || 'https://your-app.railway.app';

export const API_ENDPOINTS = {
  rates: `${API_BASE_URL}/api/rates`,
  msaLookup: `${API_BASE_URL}/api/msa-lookup`,
};
```

Then import in popup.js and website.js:
```javascript
import { API_ENDPOINTS } from '../js/config.js';

const response = await fetch(API_ENDPOINTS.rates);
```

---

## Phase 5: Testing & Validation ✅

### 5.1 Local Testing Checklist
```bash
cd railway-api
bun run dev
```

- [ ] Server starts without errors
- [ ] Database connection successful
- [ ] GET `/api/rates` returns latest rates
- [ ] POST `/api/msa-lookup` with valid address returns income data
- [ ] POST `/api/msa-lookup` with invalid address returns 404
- [ ] CORS headers present in all responses
- [ ] `bun run src/scripts/runRateUpdate.ts` succeeds once (status `inserted`)
- [ ] Second `bun run src/scripts/runRateUpdate.ts` immediately logs `already_saved` or `unchanged` and exits

### 5.2 Railway Testing Checklist
After deploying to Railway:

- [ ] Railway deployment successful (check dashboard)
- [ ] Health check endpoint works: `https://your-app.railway.app/`
- [ ] GET rates endpoint works
- [ ] POST MSA lookup endpoint works
- [ ] `rate-cron` service shows a completed run with exit code 0
- [ ] Cron logs confirm `status: inserted | unchanged | already_saved`
- [ ] Verify Neon DB contains at most one rate snapshot per calendar day

### 5.3 Extension Testing Checklist
```bash
cd /Users/emmanuelgenard/Workspace/naca-app
./scripts/zip_for_chrome.sh
```

- [ ] Load extension in Chrome
- [ ] Extension fetches rates from Railway API
- [ ] Payment-to-price calculation works
- [ ] Price-to-payment calculation works
- [ ] MSA lookup works (if used in extension)
- [ ] No CORS errors in console

### 5.4 Website Testing Checklist
- [ ] Website loads successfully
- [ ] Rates display correctly
- [ ] MSA lookup functionality works
- [ ] All calculations accurate
- [ ] No console errors

### 5.5 End-to-End Integration Test

**Test Scenario:**
1. In Railway, open `rate-cron` service and click **Run Now** (or wait for 6:05 AM UTC)
2. Verify new rate inserted in Neon (only if first run that day):
   ```sql
   SELECT * FROM naca_mortgage_rates ORDER BY created_at DESC LIMIT 5;
   ```
3. Trigger `rate-cron` **Run Now** again; logs should report `already_saved` or `unchanged`
4. Call Railway API to get rates
5. Verify extension displays latest rates
6. Verify website displays latest rates
7. Test MSA lookup with known address
8. Verify income data matches expected values

---

## Phase 6: Documentation & Cleanup 📚

### 6.1 Update CLAUDE.md
```markdown
## Backend Services

### Railway API (Bun Server)
- **URL**: https://your-app.railway.app
- **Endpoints**:
  - GET /api/rates - Returns latest mortgage rates
  - POST /api/msa-lookup - Geocodes address and returns MSA income data
- **Cron Jobs**: Separate `rate-cron` service (start command `bun run src/scripts/runRateUpdate.ts`, schedule `0 6 * * *`)

### Database (Neon PostgreSQL)
- **Tables**:
  - naca_mortgage_rates: Current mortgage rates (updated daily)
  - ffeic_msa_tract_income_2024: MSA income data from FFEIC

## Development Commands

### Railway API
```bash
cd railway-api
bun install
bun run dev  # Local development
```

### Deploy to Railway
```bash
cd railway-api
railway up  # Or push to GitHub (auto-deploys)
```
```

### 6.2 Create Railway API README
```bash
cd railway-api
cat > README.md << 'EOF'
# NACA Calculator API

Bun server providing mortgage rates and MSA income data for the NACA Calculator extension and website.

## Setup

1. Install Bun: https://bun.sh
2. Install dependencies: `bun install`
3. Copy `.env.example` to `.env` and add your Neon `DATABASE_URL`
4. Run: `bun run dev`

## Endpoints

- `GET /api/rates` - Latest mortgage rates
- `POST /api/msa-lookup` - MSA income data lookup

## Deployment

Deployed to Railway. Push to GitHub main branch for auto-deploy.

## Environment Variables

- `DATABASE_URL` - Neon PostgreSQL connection string
- `PORT` - Server port (default: 3000)
EOF
```

### 6.3 Update Main README
Update project root README with new architecture diagram and Railway deployment info.

### 6.4 Export Final Supabase Backup
```bash
# Full backup before decommissioning
supabase db dump --data-only > final_backup_$(date +%Y%m%d).sql

# Store safely (e.g., AWS S3, GitHub private repo, etc.)
```

### 6.5 Decommission Supabase

**Gradual Shutdown:**
1. Week 1: Monitor Railway in production alongside Supabase
2. Week 2: If no issues, disable Supabase Edge Functions
3. Week 3: Download final backups
4. Week 4: Pause/delete Supabase project

**Checklist:**
- [ ] Verify all data migrated successfully
- [ ] Confirm Railway API stable for 1+ week
- [ ] Update all API keys/secrets
- [ ] Remove Supabase environment variables from extension/website
- [ ] Archive Supabase project (don't delete immediately)
- [ ] Document migration date in CLAUDE.md

---

## Architecture Comparison

| Component        | Supabase (Old)        | Neon + Railway (New)                     |
| ---------------- | --------------------- | ---------------------------------------- |
| **Database**     | Supabase PostgreSQL   | Neon PostgreSQL                          |
| **Functions**    | Deno Edge Functions   | Bun HTTP Server                          |
| **Client**       | @supabase/supabase-js | pg (node-postgres)                       |
| **Cron Jobs**    | External triggers     | Railway Cron webhook (managed)           |
| **Rate Caching** | Function checks DB    | Cron endpoint saves once daily (deduped) |
| **Auth**         | Supabase Auth         | N/A (not needed)                         |
| **CORS**         | Function headers      | Server middleware                        |
| **Deployment**   | Supabase CLI          | Railway (Git push)                       |
| **Cost**         | Supabase free tier    | Neon free tier + Railway ($5/mo)         |

---

## Troubleshooting

### Database Connection Issues
```bash
# Test Neon connection
psql "postgresql://[user]:[password]@[host]/[dbname]?sslmode=require"

# Check Railway logs
railway logs
```

### CORS Errors
- Verify `Access-Control-Allow-Origin: *` in response headers
- Check browser console for specific CORS error messages
- For extensions, ensure manifest.json has correct permissions

### Cron Job Not Running
- In the `rate-cron` service, ensure the Cron schedule `0 6 * * *` is enabled and the last execution finished (status `Completed`)
- If the previous execution still shows `Active`, Railway skips the next run—double-check the script closes database connections and exits
- Review service logs for `Rate cron failed` messages and rerun locally (`bun run src/scripts/runRateUpdate.ts`) to reproduce
- Use **Run Now** in the Railway dashboard to test immediately after applying fixes

### Rate Scraping Fails
- Check Railway logs for `Rate cron failed` errors (ensure scraper is reachable)
- Inspect cron response body for error message (should include JSON `{ error: ... }`)
- NACA website may have changed HTML structure
- Update regex in `src/services/scraper.ts:4`
- Test regex: https://regex101.com

---

## Rollback Plan

If critical issues arise:

1. **Immediate**: Revert frontend to use old Supabase URLs
2. **Database**: Restore Supabase from backup
3. **Functions**: Re-enable Supabase Edge Functions
4. **Investigation**: Debug Railway/Neon issues offline
5. **Retry**: Fix issues and redeploy to Railway

---

## Success Criteria

- ✅ All data migrated to Neon without loss
- ✅ Railway API responds to all endpoints correctly
- ✅ Railway Cron runs daily (0 6 * * *) without creating duplicate rate snapshots
- ✅ Extension and website work with new API
- ✅ No CORS errors
- ✅ Response times < 500ms (similar to Supabase)
- ✅ Zero downtime during migration
- ✅ Cost savings vs Supabase (if applicable)

## Post-Migration Quality Assurance

### Automated Test Coverage
- Add unit tests for `saveRatesIfNeeded` to assert `inserted`, `already_saved`, and `unchanged` branches
- Add integration test that runs the cron script twice with mocked scraper output to verify deduping
- Record contract tests for `/api/rates` and `/api/msa-lookup` using mocked Neon responses to cover error paths
- Capture regression tests for geocoding failures (missing address, unknown tract) and ensure 4xx responses persist

### Monitoring & Alerting
- Enable Railway Cron failure notifications (email/Slack) for non-200 responses
- Configure log-based alert for `Rate cron failed` occurrences (Railway Log Drains or external service)
- Schedule daily Neon query (e.g., using Railway Metrics or external monitor) to assert only one snapshot per date
- Add uptime monitor for `/api/rates` and `/api/msa-lookup` (e.g., UptimeRobot/Pingdom) with alert thresholds

---

## Timeline

| Phase       | Tasks                                          | Estimated Time  |
| ----------- | ---------------------------------------------- | --------------- |
| **Phase 1** | Neon DB setup, schema creation, data migration | 2-3 hours       |
| **Phase 2** | Bun server development                         | 3-4 hours       |
| **Phase 3** | Railway deployment                             | 1 hour          |
| **Phase 4** | Frontend updates                               | 1 hour          |
| **Phase 5** | Testing & validation                           | 2 hours         |
| **Phase 6** | Documentation & cleanup                        | 1 hour          |
| **Total**   |                                                | **10-13 hours** |

---

## Next Steps

1. **Start with Phase 1**: Create Neon project and export Supabase schema
2. **Ask for help** if you encounter any issues
3. **Test thoroughly** at each phase before proceeding
4. **Document** any deviations from this plan

---

## Contact & Support

- **Railway Docs**: https://docs.railway.app
- **Neon Docs**: https://neon.tech/docs
- **Bun Docs**: https://bun.sh/docs

Good luck with the migration! 🚀