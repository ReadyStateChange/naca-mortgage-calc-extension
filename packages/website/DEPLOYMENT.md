# Deployment Guide

## Railway Deployment (API + Website)

The Railway server serves both the REST API and the static website from a single origin.

### Architecture

```
Railway Server (Bun)
├── API Routes (/api/*)
│   ├── GET /api/rates
│   └── POST /api/msa-lookup
└── Static Files (/) - served from railway-api/public/
    ├── index.html (landing page)
    ├── styles.css
    ├── calculator.js
    ├── website.js
    └── assets (icons, images)
```

### Deployment Process

1. **Update Website Files** (if website changed)
   - Edit files directly in `railway-api/public/` directory
   - Legacy `website/` directory will be removed

2. **Commit and Push**
   ```bash
   git add .
   git commit -m "Update website and API"
   git push origin main
   ```

3. **Railway Auto-Deploy**
   - Railway detects push to main branch
   - Builds and deploys automatically
   - Website accessible at: `https://<app>.up.railway.app/`
   - API accessible at: `https://<app>.up.railway.app/api/*`

### Local Testing

```bash
cd railway-api
bun run dev
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

**Important**: Landing page served from `railway-api/public/index.html`

When updating website:
1. Edit files directly in `railway-api/public/` directory
2. Commit and push to deploy (Railway serves from `public/` directory)
3. Ensure API URLs use relative paths (already configured)

_Note: Legacy `website/` directory will be removed._

### Environment Variables (Railway Dashboard)

Required:
- `DATABASE_URL` - Neon PostgreSQL connection string
- `PORT` - Auto-set by Railway (usually 3000)
- `NODE_ENV` - Set to `production`

### Monitoring

- Check Railway logs for errors
- Test both website and API endpoints after deployment
- Verify rate updates (cron runs daily at 6 AM UTC)

