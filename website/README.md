# NACA Calculator Website

This directory contains the website files that are automatically deployed to GitHub Pages.

## Deployment

The website is automatically deployed via GitHub Actions when changes are pushed to the main branch.

### Files Deployed

- `index.html` - Main website page
- `styles.css` - Website styles
- `website.js` - Website functionality
- `CNAME` - Custom domain configuration
- `.nojekyll` - Prevents Jekyll processing
- Icon files for the website

### GitHub Actions Workflow

The `.github/workflows/deploy-website.yml` file handles:
1. Building the website (if needed)
2. Uploading the `website/` directory as a Pages artifact
3. Deploying to GitHub Pages

### Custom Domain

The website is configured to use: `naca-helper.readystatechange.com`

## Local Development

To test the website locally:
1. Navigate to this directory
2. Open `index.html` in a web browser
3. Or use a local server: `python -m http.server 8000`
