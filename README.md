# NACA Mortgage Calculator

Chrome extension and web application that mimics the mortgage calculator available on the [NACA website](https://www.naca.com/mortgage-calculator/). Designed to assist NACA buyers while browsing real estate listing websites like Zillow, Redfin, Homes.com, etc.

## Tech Stack

- **Runtime**: [Bun](https://bun.sh/) - fast JavaScript runtime, bundler, and package manager
- **Language**: TypeScript (API/website), JavaScript (extension popup, shared calculator)
- **Backend Framework**: Bun native server with [Effect](https://effect.website/) for typed error handling
- **Database**: PostgreSQL (Neon) for MSA/FFIEC data
- **Testing**: Vitest (website), Bun test (extension, calculator)
- **Deployment**: Railway (nixpacks)
- **Version Control**: Jujutsu (jj) with Git backend

## Monorepo Structure

This project uses Bun workspaces to manage multiple packages:

```
naca-app/
├── packages/
│   ├── website/              # Bun API server + static website
│   │   ├── src/              # TypeScript server code
│   │   │   ├── routes/       # API route handlers
│   │   │   ├── services/     # Business logic & DB access
│   │   │   ├── schemas/      # Validation schemas
│   │   │   └── index.ts      # Server entry point
│   │   └── public/           # Static website assets (HTML/CSS/JS)
│   │
│   ├── extension/            # Chrome extension
│   │   ├── src/popup/        # TypeScript source
│   │   ├── dist/             # Built extension output
│   │   ├── icons/            # Extension icons
│   │   └── manifest.json     # Chrome extension manifest
│   │
│   └── naca-mortgage-calculator/  # Shared calculator logic
│       └── src/calculator.js      # Core mortgage calculations
│
├── scripts/                  # Build and data import scripts
├── docs/                     # Documentation
├── orchestration/            # Agent orchestration docs
├── railway.toml              # Railway deployment config
├── bunfig.toml               # Bun configuration
└── package.json              # Root workspace config
```

## Features

- Calculate maximum purchase price based on desired monthly payment
- Calculate monthly mortgage payment based on desired purchase price
- Includes calculations for principal, interest, taxes, and insurance (PITI)
- Supports different loan terms and interest rates
- No down payment required with a NACA mortgage
- MSA (Metropolitan Statistical Area) Lookup feature that returns:
  - MSA Median Family Income
  - Tract Median Family Income
  - Tract Percent of MSA
  - Income data year

## Installation

### Chrome Extension

1. Install from [Chrome Web Store](https://chromewebstore.google.com/detail/hbdlcdeikllnheobkpnfhameoclhmjli) (recommended)

Or manually:
1. Clone the repository
2. Run `bun install` at the root
3. Build the extension: `bun run --cwd packages/extension build`
4. Go to `chrome://extensions/`
5. Enable "Developer mode"
6. Click "Load unpacked" and select `packages/extension/dist`

### Website Version

Visit the hosted website at your Railway URL - no installation required!

## Development

### Prerequisites

- [Bun](https://bun.sh/) v1.0+
- PostgreSQL database (for MSA lookup feature)

### Setup

```bash
# Install all workspace dependencies
bun install

# Set up environment variables
cp packages/website/.env.example packages/website/.env
# Edit .env with your DATABASE_URL
```

### Running the Website/API

```bash
# Development mode (with hot reload)
bun run --cwd packages/website dev

# Production mode
bun run --cwd packages/website start

# Visit http://localhost:3000
```

### Building the Extension

```bash
# Build TypeScript and copy assets
bun run --cwd packages/extension build

# Create Chrome Web Store zip
./scripts/zip_for_chrome.sh
```

### Running Tests

```bash
# Run all tests from root
bun test

# Run website tests (Vitest)
bun run --cwd packages/website test

# Run extension tests
bun run --cwd packages/extension test

# Run calculator tests
bun run --cwd packages/naca-mortgage-calculator test
```

### Type Checking

```bash
# Website TypeScript
bun run --cwd packages/website typecheck
```

## API Endpoints

The website package provides these API endpoints:

| Endpoint | Description |
|----------|-------------|
| `GET /api/rates` | Current NACA interest rates |
| `GET /api/msa?lat={lat}&lng={lng}` | MSA lookup by coordinates |

## Deployment

The website is deployed to Railway. See `packages/website/DEPLOYMENT.md` for details.

Key configuration in `railway.toml`:
- Build command: `bun run --cwd packages/website build`
- Start command: `bun run --cwd packages/website start`
- Health check: `/api/rates`

## Package Dependencies

```
@naca-app/website
  └── @naca-app/calculator (workspace dependency)

@naca-app/extension
  └── @naca-app/calculator (workspace dependency)
```

## Contributing

Contributions are welcome! Please fork the repository and submit a pull request for any improvements or bug fixes.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## Contact

For any questions or support, please open an issue on GitHub.
