# Quick Guide: Update Railway URLs After Deployment

After you deploy to Railway and get your URL, you need to update 3 files in the parent directory.

## Your Railway URL
After deployment, your Railway URL will look like:
```
https://naca-calculator-api-production.up.railway.app
```
(The exact format varies)

## Files to Update

### 1. popup/popup.js
Find and replace **TWO occurrences**:

**Line ~473** (in `performMsaLookup` function):
```javascript
const API_BASE_URL = 'https://your-app.railway.app';
```

**Line ~505** (in `getLatestMortgageRates` function):
```javascript
const API_BASE_URL = 'https://your-app.railway.app';
```

Change both to your actual Railway URL.

### 2. website/website.js
Find and replace **TWO occurrences**:

**Line ~399** (in `getLatestMortgageRates` function):
```javascript
const API_BASE_URL = 'https://your-app.railway.app';
```

**Line ~437** (in `performMsaLookup` function):
```javascript
const API_BASE_URL = 'https://your-app.railway.app';
```

Change both to your actual Railway URL.

### 3. js/api-config.js
**Line 4**:
```javascript
const API_BASE_URL = 'https://your-app.railway.app';
```

Change to your actual Railway URL.

## Quick Find & Replace

If your Railway URL is `https://naca-calculator-api-production.up.railway.app`, you can use:

```bash
# From the project root directory
grep -r "https://your-app.railway.app" popup/ website/ js/ --include="*.js"
```

This will show you all occurrences that need updating.

## After Updating

1. Test the extension by loading it in Chrome
2. Test the website by opening `website/index.html`
3. Check browser console for any errors
4. Verify rates load correctly
5. Test MSA lookup functionality

## Verification Checklist
- [ ] Updated popup/popup.js (2 places)
- [ ] Updated website/website.js (2 places)
- [ ] Updated js/api-config.js (1 place)
- [ ] Tested extension
- [ ] Tested website
- [ ] No CORS errors
- [ ] Rates display correctly
- [ ] MSA lookup works

