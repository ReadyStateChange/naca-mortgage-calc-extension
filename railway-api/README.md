# NACA Calculator API

Bun server providing mortgage rates and MSA income data for the NACA Calculator extension and website.

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

## Endpoints

- `GET /api/rates`