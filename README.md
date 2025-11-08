# NACA Mortgage Calculator

Chrome extension and web application that mimics the mortgage calculator available on the [NACA website](https://www.naca.com/mortgage-calculator/). Designed to assist NACA buyers while browsing real estate listing websites like Zillow, Redfin, Homes.com, etc.

## Project Structure

- **Chrome Extension** (`popup/`, `js/`) - Browser extension with popup interface
- **Website** (`railway-api/public/`) - Standalone web calculator served via Railway
- **API Server** (`railway-api/`) - Bun server providing rates, MSA lookup, and static file serving

_Note: Legacy `website/` directory will be removed. Edit files directly in `railway-api/public/`._

## Features

- Calculate maximum purchase price based on desired monthly payment.
- Calculate monthly mortgage payment based on desired purchase price.
- Includes calculations for principal, interest, taxes, and insurance (PITI).
- Supports different loan terms and interest rates.
- No down payment required with a NACA mortgage.
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
2. Go to `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked" and select the repository folder

### Website Version

Visit the hosted website at your Railway URL (landing page served from `railway-api/public/index.html`) - no installation required!

## Usage

1. Open the extension popup by clicking on the extension icon in your browser toolbar.

2. Choose your calculation method:
   - **Enter your desired monthly payment (PITI)**: Calculate the maximum purchase price.
   - **Enter Desired Purchase Price**: Calculate the monthly mortgage payment.

3. Fill in the required fields:
   - Purchase Price / Payment
   - Loan Term
   - Interest Rate
   - Property Tax
   - Insurance
   - Down Payment (optional)

4. Click "Calculate" to view the results.

## Development

### Extension
```bash
# Build extension zip
./scripts/zip_for_chrome.sh
```

### Website
```bash
# Edit files directly in railway-api/public/
# (website/ directory is deprecated and will be removed)

# Test locally
cd railway-api
bun run dev
# Visit http://localhost:3000 - landing page served from public/index.html
```

### API Server
See `railway-api/README.md` and `railway-api/DEPLOYMENT.md` for details.

## Contributing

Contributions are welcome! Please fork the repository and submit a pull request for any improvements or bug fixes.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## Contact

For any questions or support, please contact [your email] or open an issue on GitHub.