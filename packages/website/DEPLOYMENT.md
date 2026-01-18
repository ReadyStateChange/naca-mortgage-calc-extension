# Deployment Guide

## Railway Deployment (API + Website)

The Railway server serves both the REST API and the static website from a single origin.

### Architecture

```
Railway Server (Bun)
├── API Routes (/api/*)
│   ├── GET /api/rates
│   └── POST /api/msa-lookup
└── Static Files (/) - served from packages/website/public/
    ├── index.html (landing page)
    ├── styles.css
    ├── calculator.js
    ├── website.js
    └── assets (icons, images)
```

### Monorepo Structure

This project uses a Bun workspace monorepo. The website/API lives at `packages/website/`.

```
naca-app/
├── package.json              # Workspace root
├── packages/
│   ├── extension/            # Chrome extension
│   ├── naca-mortgage-calculator/  # Shared calculator logic
│   └── website/              # API + Website (this package)
│       ├── railway.toml      # Railway config-as-code
│       ├── package.json
│       ├── src/              # API source code
│       └── public/           # Static website assets
```

### Railway Configuration

Railway is configured via `railway.toml` in this package directory:

```toml
[build]
builder = "nixpacks"
buildCommand = "bun run build"

[deploy]
startCommand = "bun run start"
healthcheckPath = "/api/rates"
healthcheckTimeout = 120
restartPolicyType = "ON_FAILURE"
```

**Important**: In the Railway dashboard, set the **Root Directory** to `packages/website` so Railway uses this package as the service root.

### Deployment Process

1. **Update Website Files** (if website changed)
   - Edit files directly in `packages/website/public/` directory

2. **Commit and Push**
   ```bash
   jj commit -m "Update website and API"
   jj git push
   ```

3. **Railway Auto-Deploy**
   - Railway detects push to main branch
   - Builds and deploys automatically from `packages/website/`
   - Website accessible at: `https://<app>.up.railway.app/`
   - API accessible at: `https://<app>.up.railway.app/api/*`

### Local Testing

From the repository root:
```bash
cd packages/website
bun run dev
```

Or using workspace commands from root:
```bash
bun run --cwd packages/website dev
```

Then visit:
- Website: http://localhost:3000/
- API: http://localhost:3000/api/rates

### Key Points

- **Same Origin**: Website and API on same domain (no CORS issues)
- **API Priority**: API routes (`/api/*`) checked before static files
- **Fallback**: Unknown routes serve `index.html` for client-side routing
- **Security**: Directory traversal prevention built-in
- **MIME Types**: Automatically set for .html, .css, .js, .png, .svg, etc.

### File Management

**Important**: Landing page served from `packages/website/public/index.html`

When updating website:
1. Edit files directly in `packages/website/public/` directory
2. Commit and push to deploy (Railway serves from `public/` directory)
3. Ensure API URLs use relative paths (already configured)

### Environment Variables (Railway Dashboard)

Required:
- `DATABASE_URL` - Neon PostgreSQL connection string
- `PORT` - Auto-set by Railway (usually 3000)
- `NODE_ENV` - Set to `production`

### Monitoring

- Check Railway logs for errors
- Test both website and API endpoints after deployment
- Verify rate updates (cron runs daily at 6 AM UTC)
