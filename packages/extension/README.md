# NACA Mortgage Calculator Extension

Chrome extension for calculating NACA mortgage payments.

## Development

### Prerequisites

- [Bun](https://bun.sh/) runtime

### Setup

```bash
# Install dependencies (from repo root)
bun install

# Or from this directory
cd packages/extension
bun install
```

### Build

```bash
bun run build
```

This outputs a browser-ready extension to `dist/`.

### Load in Chrome

1. Open `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `packages/extension/dist` directory

### Test

```bash
bun test
```

### Package for Distribution

From the repo root:

```bash
./scripts/zip_for_chrome.sh
```

This builds the extension, bumps the version, and creates `naca_extension.zip`.

## Chrome Web Store Submission

The extension can be automatically submitted to the Chrome Web Store via GitHub Actions.

### Workflow Triggers

- **Manual dispatch**: Go to Actions > "Chrome Web Store Submission" > Run workflow
- **Release published**: Automatically triggered when a GitHub release is published

### Required Secrets

Configure these secrets in your GitHub repository settings (Settings > Secrets and variables > Actions):

| Secret | Description |
|--------|-------------|
| `CHROME_EXTENSION_ID` | Your extension's ID from the Chrome Web Store dashboard |
| `CHROME_CLIENT_ID` | OAuth2 client ID from Google Cloud Console |
| `CHROME_CLIENT_SECRET` | OAuth2 client secret from Google Cloud Console |
| `CHROME_REFRESH_TOKEN` | OAuth2 refresh token for Chrome Web Store API |

### Obtaining Chrome Web Store API Credentials

1. **Create a Google Cloud Project**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select an existing one

2. **Enable Chrome Web Store API**
   - Navigate to APIs & Services > Library
   - Search for "Chrome Web Store API" and enable it

3. **Create OAuth2 Credentials**
   - Go to APIs & Services > Credentials
   - Click "Create Credentials" > "OAuth client ID"
   - Select "Desktop app" as application type
   - Download the client ID and secret

4. **Get a Refresh Token**
   - Use the [chrome-webstore-upload](https://github.com/fregante/chrome-webstore-upload) CLI or OAuth playground
   - Authorize with your Google account that owns the extension
   - Save the refresh token

5. **Find Your Extension ID**
   - Go to the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
   - Click on your extension
   - The ID is in the URL or displayed on the dashboard

### Workflow Options

When manually triggering the workflow:

- **publish**: Set to `true` to publish the extension immediately after upload (default: `false`)

For release-triggered runs, the extension is automatically published.
