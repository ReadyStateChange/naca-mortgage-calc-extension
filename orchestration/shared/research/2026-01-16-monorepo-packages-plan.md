---
date: 2026-01-16T11:29:41-05:00
researcher: AI Agent
git_commit: 6ea78a5126e375af43ac7eb8cf114b5c4b4048b4
branch: HEAD (detached)
repository: naca-app
topic: "Plan for monorepo packages (extension + website)"
tags: [research, codebase, monorepo, bun-workspaces, extension, website, railway]
status: complete
last_updated: 2026-01-16
last_updated_by: AI Agent
---

# Research: Plan for monorepo packages (extension + website)

**Date**: 2026-01-16T11:29:41-05:00
**Researcher**: AI Agent
**Git Commit**: 6ea78a5126e375af43ac7eb8cf114b5c4b4048b4
**Branch**: HEAD (detached)
**Repository**: naca-app

## Research Question

Come up with a plan that creates packages and turns this project into a monorepo with multiple packages. The calculator is shared. There should be an extension package and a website (currently `railway-api`) package. The plan needs to include what changes need to happen so that deployments to Railway are not broken. Also include what it would take to convert the extension to TypeScript and what would have to change in the zip script so it can still be updated to the Chrome Web Store, plus what it would take to add a GitHub Action (or similar) to submit the extension when pushed.

## Summary

The repo currently has a root extension project (manifest + `popup/`, `js/`, `icons/`) and a separate Bun API/website in `railway-api/`. The Railway API serves static assets out of `railway-api/public` and handles `/api/*` routes. The extension is packaged by `scripts/zip_for_chrome.sh`, which zips `icons/`, `js/`, `popup/`, and `manifest.json` from the repo root. A monorepo plan should preserve these relationships: keep the calculator module shared, move the website/API into `packages/website`, and adjust Railway deploy configuration to run from that package path. Any TypeScript migration for the extension would require converting `popup/` and `js/` to `.ts`/`.tsx`, adding a build step that outputs the current file layout for `manifest.json`, and updating the zip script to package the build output instead of raw source. A CI-based Chrome Web Store submission would require a build + zip step and Chrome Web Store API credentials stored as GitHub secrets.

## Detailed Findings

### Current Package Layout and Scripts
- Root package manifest exists at `package.json` with `bun test` only (`package.json:1-18`).
- Railway API has its own `package.json` scripts for Bun (`railway-api/package.json:1-26`).
- The extension is packaged by `scripts/zip_for_chrome.sh`, which zips root-level `icons/`, `js/`, `popup/`, and `manifest.json` (`scripts/zip_for_chrome.sh:8-41`).
- Shared calculator logic lives at `js/calculator.js` and is imported by extension UI code (`popup/popup.js:1-6`, `js/mortgageService.js:8-31`).

### Extension Structure (Current)
- Manifest: `manifest.json` points the popup to `popup/popup.html` and references `icons/` (`manifest.json:1-14`).
- Popup entry: `popup/popup.html` loads `popup.js` as a module (`popup/popup.html:277`).
- Shared logic: `js/` modules (`js/calculator.js`, `js/mortgageService.js`, `js/inputValidator.js`).
- API config is hardcoded to Railway production URL in `js/api-config.js` (`js/api-config.js:4-9`).
- `popup/popup.js` directly fetches Railway API URLs hardcoded to production (two places) (`popup/popup.js:552-606`).

### Website + API (Railway)
- Bun server entry point is `railway-api/src/index.ts`, serving static files from `railway-api/public` and `/api/*` routes (`railway-api/src/index.ts:7-80`).
- Deployment docs state Railway auto-deploys on push and serves static site from `railway-api/public` (`railway-api/DEPLOYMENT.md:14-67`).
- No `railway.toml`, Dockerfile, or Procfile are present (search results; no files found).
- Website uses relative `/api/*` paths for fetching rates/lookup (`railway-api/public/website.js:397-457`).
- Website calculator script is embedded separately from extension, with a duplicate `MortgageCalculator` in `railway-api/public/calculator.js` (`railway-api/public/calculator.js:1-250`).

### Orchestration Context (Historical)
- The project has multiple plans/research around popup modularization and ES module migration; extension is expected to remain a no-build zip-based extension (`orchestration/shared/plans/2025-12-25-popup-calculator-refactoring.md:13-14`).
- UI/business logic separation plan documents current ES module setup and shared JS modules (`orchestration/shared/plans/2025-12-31-ui-business-logic-separation.md:9-31`).

## Plan: Monorepo with Bun Workspaces

### 1) Workspace structure (top-level)
- Create `packages/` folder with packages: `packages/extension`, `packages/website`.
- Move current root extension assets into `packages/extension`:
  - `manifest.json`, `popup/`, `js/`, `icons/`, and extension tests `tests/` (or a dedicated `packages/extension/tests`).
  - Keep `scripts/zip_for_chrome.sh` either at root or move into `packages/extension/scripts/` and update paths.
- Move `railway-api/` into `packages/website`:
  - `packages/website/src`, `packages/website/public`, `packages/website/package.json`, etc.
- Add a shared package for calculator logic if desired (e.g., `packages/shared`), with the current `js/` modules moved into that package and referenced by both extension and website.
  - Shared calculator currently lives in `js/calculator.js` and `js/mortgageService.js` (`js/calculator.js:1-250`, `js/mortgageService.js:1-75`).

### 2) Root workspace configuration (Bun workspaces)
- Update root `package.json` to define Bun workspaces with `packages/*`.
- Keep root scripts for running tests across packages if needed (e.g., `bun test` in extension package + `bun run test` in website package).
- Preserve current dependency boundaries:
  - Extension currently uses only browser assets and Bun test dependencies.
  - Website uses Bun + TypeScript dependencies (`railway-api/package.json:5-25`).

### 3) Extension package configuration
- Create `packages/extension/package.json` based on current root package, adjusting `main` to `popup/popup.js` and keeping `bun test`.
- Ensure `manifest.json` still references `popup/popup.html` relative to the extension package root.
- Update `scripts/zip_for_chrome.sh` to point to the new extension package root:
  - Either run zip from `packages/extension` or adjust INCLUDE paths (currently relative to repo root) (`scripts/zip_for_chrome.sh:13-18`).
- If the shared calculator is moved to a shared package, update imports:
  - `popup/popup.js` and `js/mortgageService.js` would import from the shared package path or a local copy.

### 4) Website package configuration
- Move `railway-api` to `packages/website` and update internal references:
  - `PUBLIC_DIR` in `src/index.ts` uses `../public` relative to `src`, so it stays valid after the move (`railway-api/src/index.ts:7-80`).
  - Update any documentation path references in `packages/website/DEPLOYMENT.md` and `packages/website/README.md`.
- Keep `packages/website/package.json` scripts intact for `bun run dev`, `bun run start`, etc.

### 5) Railway deployment continuity
- Railway currently expects to run from the `railway-api` directory; there is no `railway.toml` or Dockerfile.
- Introduce a `railway.toml` at repo root (per your request) that points Railway to `packages/website` as the service root.
- Preserve environment requirements:
  - `DATABASE_URL`, `PORT`, `NODE_ENV` still required (`railway-api/DEPLOYMENT.md:71-77`, `railway-api/src/index.ts:7-11`).
- Ensure any Railway build/start commands run inside `packages/website`:
  - `start`: `bun run src/index.ts` (existing script).
  - `build`: `bun build src/index.ts --outdir ./dist --target bun` (existing script).

### 6) Shared calculator between extension + website
- Website currently has a separate `public/calculator.js` (duplicated class) and the extension uses `js/calculator.js`.
- If sharing the calculator module, decide whether:
  - Website continues using a browser bundle (build step needed), or
  - Shared calculator stays in a plain JS module copied into `public/` for website consumption.
- The plan should include how shared code is distributed to both:
  - Option A (no build): keep a shared source under `packages/shared` and copy into `packages/website/public` during release.
  - Option B (build step): TypeScript/ESM build that outputs browser-ready files for both extension and website.

## TypeScript Migration Plan for Extension (Scope)

### Current state
- Extension files are plain ES modules, loaded directly by Chrome (`manifest.json:1-14`, `popup/popup.html:277`).
- No build system is in place; the zip script packages raw source files (`scripts/zip_for_chrome.sh:13-40`).

### Required changes for TypeScript
- Add a build step (likely `tsc` or a bundler) to transpile TypeScript to browser-ready JavaScript.
- Convert files:
  - `popup/popup.js` → `popup/popup.ts`
  - `js/*.js` → `src/*.ts` (or similar)
  - Adjust imports to compiled output paths.
- Update `manifest.json` to point to compiled JS files if output is in `dist/` (depending on build output).
- Ensure the build output directory mirrors the expected layout: `popup/`, `js/`, `icons/`, `manifest.json`.
- Adjust extension tests if they rely on source paths (e.g., Bun tests referencing `js/calculator.js`).

### Local testing after TypeScript conversion
- Run the extension build to produce the browser-ready output directory (e.g., `packages/extension/dist`).
- Load the unpacked extension from the build output directory (not source) in `chrome://extensions/`.
- Verify the popup renders and the calculator flow still works (rate fetch + MSA lookup).

### Zip script changes for TypeScript
- Update `scripts/zip_for_chrome.sh` to zip the build output directory instead of raw `popup/` + `js/`.
- The script currently bumps `manifest.json` version in place; with a build step, decide whether to bump in source or in output copy (`scripts/zip_for_chrome.sh:20-29`).
- Ensure `manifest.json` in the output folder is the one whose version is incremented and packaged.

## CI/GitHub Action for Chrome Web Store Submission (Scope)

### Inputs/Assets
- The zip output `naca_extension.zip` is produced by `scripts/zip_for_chrome.sh` (`scripts/zip_for_chrome.sh:8-44`).
- Chrome Web Store publish requires:
  - Extension zip
  - Extension ID and OAuth credentials for Chrome Web Store API
  - Possibly `client_id`, `client_secret`, `refresh_token` stored as GitHub secrets

### Workflow Steps (conceptual)
- Build the extension (if TypeScript/build introduced).
- Run zip script (adjusted for monorepo path).
- Use a GitHub Action (or similar CI) to upload the zip to the Chrome Web Store API.
- The action would need permissions and secrets configured in GitHub repository settings.

## Code References
- `manifest.json:1-14` - Extension manifest and popup entry
- `popup/popup.html:277` - Module script loading
- `popup/popup.js:1-6` - Extension imports shared mortgage service
- `scripts/zip_for_chrome.sh:13-40` - Current packaging script and zip include paths
- `js/calculator.js:1-250` - Shared calculator logic
- `railway-api/src/index.ts:7-80` - Bun server static file root and API routes
- `railway-api/DEPLOYMENT.md:14-77` - Railway deployment details and required env vars
- `railway-api/public/website.js:397-457` - Website API fetches using relative paths
- `railway-api/public/calculator.js:1-250` - Website calculator duplication

## Architecture Documentation

- The extension is currently a standalone package at repo root with a zip-based deployment flow (`manifest.json`, `popup/`, `js/`, `icons/`, `scripts/zip_for_chrome.sh`).
- The website/API is a Bun service that serves static files from `railway-api/public` and handles API routes in `railway-api/src/index.ts`.
- Both the extension and website maintain their own calculator logic (shared in extension `js/`, duplicated in website `public/calculator.js`).

## Historical Context (from orchestration/)
- `orchestration/shared/plans/2025-12-25-popup-calculator-refactoring.md` - Extension should remain a no-build zip-based extension (`orchestration/shared/plans/2025-12-25-popup-calculator-refactoring.md:13-14`).
- `orchestration/shared/plans/2025-12-31-ui-business-logic-separation.md` - Extension uses ES modules and shared `js/` services for calculations (`orchestration/shared/plans/2025-12-31-ui-business-logic-separation.md:9-31`).

## Related Research
- `orchestration/shared/research/2025-12-25-popup-calculator-refactoring.md`
- `orchestration/shared/research/2025-12-29-mortgage-service-extension-integration-and-dom-testing.md`

## Open Questions
- None (plan assembled based on current repo structure and your answers).
