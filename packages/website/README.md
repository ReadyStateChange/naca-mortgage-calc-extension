# NACA Calculator API + Website Server

Bun server providing mortgage rates, MSA income data, and serving the static website for the NACA Calculator.

## Setup

1. Install Bun: https://bun.sh
2. Install dependencies: `bun install`
3. Copy `.env.example` to `.env` and add your Neon `DATABASE_URL`
4. Run: `bun run dev`

## Environment Template

If the template file is missing, create `railway-api/.env.example` with:

```
# Neon Database Connection
DATABASE_URL=postgresql://user:password@host/dbname?sslmode=require

# Server Configuration
PORT=3000
NODE_ENV=development
```

## Architecture

This server:
- Serves landing page from `railway-api/public/index.html`
- Serves all static website files from the `public/` directory
- Provides REST API endpoints under `/api/*`
- Uses same-origin for website/API (no CORS issues)
- Deploys to Railway with automatic updates

## Endpoints

### API Routes
- `GET /api/rates` - Returns latest NACA mortgage rates
- `POST /api/msa-lookup` - Geocodes address and returns MSA income data

### Static Routes
- `GET /` - Serves index.html (website homepage)
- `GET /<path>` - Serves static files (CSS, JS, images) from `public/`