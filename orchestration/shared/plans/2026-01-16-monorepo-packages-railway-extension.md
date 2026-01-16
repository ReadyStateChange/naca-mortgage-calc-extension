# Monorepo Packages (Extension + Website) Implementation Plan

## Overview

Convert the repo into a Bun workspace monorepo with explicit packages for the extension, website/API, and shared calculator logic. Add a build pipeline for the extension (TypeScript-ready), update the packaging zip script to build before zipping, keep Railway deployments working via a root Railway config, and add a GitHub Actions workflow for Chrome Web Store submission.

## Current State Analysis

- Extension assets live at repo root and are packaged by `scripts/zip_for_chrome.sh`, which bumps `manifest.json` in place and zips `icons/`, `js/`, and `popup/` (`scripts/zip_for_chrome.sh:13`).
- Website/API is a Bun service in `railway-api/` that serves static assets from `railway-api/public` and defines start/build scripts in `railway-api/package.json` (`railway-api/src/index.ts:7`, `railway-api/package.json:6`).
- Calculator logic is duplicated between `js/calculator.js` and `railway-api/public/calculator.js` (`railway-api/public/calculator.js:1`).
- No Railway config file exists to declare a service root outside `railway-api` (`railway-api/DEPLOYMENT.md:35`).
- No CI workflows exist yet (`.github` only contains instructions and PR template).

## Desired End State

- Repo is a Bun workspace with `packages/extension`, `packages/website`, and `packages/naca-mortgage-calculator`.
- Extension is built via a TypeScript-enabled pipeline that emits a Chrome-loadable layout, and packaging zips the build output after a build step.
- Website/API is moved under `packages/website` with Railway configuration pointing to that package, keeping deployment stable.
- Shared calculator code lives in `packages/naca-mortgage-calculator` and is consumed by both extension and website builds.
- A GitHub Actions workflow builds and uploads the Chrome extension zip using Chrome Web Store API credentials stored as secrets.

### Key Discoveries
- Extension packaging currently assumes root-level paths for `icons/`, `js/`, `popup/`, and `manifest.json` (`scripts/zip_for_chrome.sh:13-16`).
- The Bun server serves static assets from a directory relative to `railway-api/src/index.ts` (`railway-api/src/index.ts:8`).
- The website uses a separate calculator implementation at `railway-api/public/calculator.js` (`railway-api/public/calculator.js:1`).

## What We’re NOT Doing

- Redesigning extension UI/UX or changing business logic outputs.
- Migrating API server code to a different runtime.
- Publishing the extension or Railway deployment as part of this plan.
- Implementing a new calculator UI on the website beyond swapping in shared logic.

## Implementation Approach

Adopt a phased migration: introduce the monorepo structure first, then split out shared calculator logic, then add the extension build system and update packaging, and finally wire up Railway and CI. Each phase produces a runnable system before moving on.

## Plan Approval + Jujutsu Tracking

- After this plan is approved, run `jj commit -m "Document monorepo research and implementation plan."` with only the plan file changed.
- Create a new `jj bookmark` for the implementation workstream before Phase 1 (e.g., `jj bookmark create monorepo-packages-railway-extension`).
- After completing each phase (at minimum after Phase 1), create a `jj commit` with a single-sentence description of what was done in that commit.

## Phase 1: Monorepo Structure + Workspaces

### Overview
Create the `packages/` structure and configure Bun workspaces, while keeping the repo runnable.

### Changes Required

#### 1. Workspace root configuration
**File**: `package.json`
**Changes**: Add Bun workspaces and ensure root scripts can delegate to package scripts.

```json
{
  "name": "naca-app",
  "workspaces": ["packages/*"],
  "scripts": {
    "test": "bun test"
  }
}
```

#### 2. Move extension into `packages/extension`
**File**: `packages/extension/*`
**Changes**: Move `manifest.json`, `popup/`, `js/`, `icons/`, and extension tests to the package.

#### 3. Move website/API into `packages/website`
**File**: `packages/website/*`
**Changes**: Move `railway-api/` contents into `packages/website` and update any path references in docs.

### Success Criteria

#### Automated Verification
- [x] Workspace install succeeds: `bun install`

#### Manual Verification
- [x] Extension assets load from `packages/extension` in Chrome.
- [x] Website still runs locally via `cd packages/website && bun run dev`.

**Implementation Note**: After Phase 1 completes and automated verification passes, confirm the extension can still be loaded as unpacked using the new path before moving on.

---

## Phase 2: Shared Calculator Package

### Overview
Extract calculator logic into `packages/naca-mortgage-calculator` and make both extension and website consume it.

### Changes Required

#### 1. Create shared calculator package
**File**: `packages/naca-mortgage-calculator/src/*`
**Changes**: Move `js/calculator.js` (and any related logic) into a shared package with an explicit entry point.

#### 2. Extension consumption
**File**: `packages/extension/js/*`
**Changes**: Update extension imports to consume from the shared package (via build output or local alias).

#### 3. Website consumption
**File**: `packages/website/public/calculator.js`
**Changes**: Replace duplicated calculator script with build output from shared package.

### Success Criteria

#### Automated Verification
- [ ] Extension tests continue to run: `bun test` (from repo root)

#### Manual Verification
- [ ] Extension calculations match previous outputs.
- [ ] Website calculator still works with shared logic.

**Implementation Note**: Pause after manual validation before adding TypeScript/build steps.

---

## Phase 3: Extension TypeScript Build Pipeline

### Overview
Introduce a TypeScript-based build for the extension that outputs a browser-ready structure.

### Changes Required

#### 1. TypeScript configuration for extension
**File**: `packages/extension/tsconfig.json`
**Changes**: Add TS config targeting browser ESM, with output to `packages/extension/dist`.

#### 2. Update extension source layout
**File**: `packages/extension/src/*`
**Changes**: Move `popup/` and `js/` source into `src/` with `.ts`/`.tsx` extensions.

#### 3. Build script
**File**: `packages/extension/package.json`
**Changes**: Add `build` script to compile to `dist` and preserve structure (`popup/`, `js/`, `icons/`, `manifest.json`).

### Success Criteria

#### Automated Verification
- [ ] Build succeeds: `bun run build` (in `packages/extension`)

#### Manual Verification
- [ ] Unpacked extension loads from `packages/extension/dist`.

---

## Phase 4: Update Extension Zip Packaging Script

### Overview
Modify `scripts/zip_for_chrome.sh` to run the extension build command and zip the build output.

### Changes Required

#### 1. Build + package flow
**File**: `scripts/zip_for_chrome.sh`
**Changes**: Call extension build command (e.g., `bun run build` in `packages/extension`) before zipping `packages/extension/dist` output.

#### 2. Manifest version bump location
**File**: `packages/extension/dist/manifest.json`
**Changes**: Ensure version bump is applied to the built manifest, not the source manifest.

### Success Criteria

#### Automated Verification
- [ ] Zip script succeeds: `./scripts/zip_for_chrome.sh`

#### Manual Verification
- [ ] `naca_extension.zip` installs and runs in Chrome.

---

## Phase 5: Railway Deployment Continuity

### Overview
Ensure Railway continues to deploy the website/API from the new package path.

### Changes Required

#### 1. Railway config
**File**: `railway.toml`
**Changes**: Configure Railway to use `packages/website` as the service root and run the existing `start`/`build` scripts.

#### 2. Update deployment docs
**File**: `packages/website/DEPLOYMENT.md`
**Changes**: Update paths and commands for the new structure.

### Success Criteria

#### Automated Verification
- [ ] Website still runs locally: `cd packages/website && bun run dev`

#### Manual Verification
- [ ] Railway deploy works with `packages/website` (confirm via dashboard or logs).

---

## Phase 6: GitHub Actions for Chrome Web Store Submission

### Overview
Create a GitHub Actions workflow that builds, zips, and uploads the extension using the Chrome Web Store API.

### Changes Required

#### 1. Workflow definition
**File**: `.github/workflows/chrome-webstore.yml`
**Changes**: Build the extension, run zip script, and upload using Chrome Web Store API credentials.

#### 2. Secrets + documentation
**File**: `README.md` or `packages/extension/README.md`
**Changes**: Document required secrets (`CHROME_CLIENT_ID`, `CHROME_CLIENT_SECRET`, `CHROME_REFRESH_TOKEN`, `CHROME_EXTENSION_ID`) and how to trigger the workflow.

### Success Criteria

#### Automated Verification
- [ ] Workflow builds and produces `naca_extension.zip` on CI.

#### Manual Verification
- [ ] Chrome Web Store submission succeeds using stored secrets.

---

## Testing Strategy

### Unit Tests
- Move calculator tests to `packages/naca-mortgage-calculator/tests` and update imports to the package entry point.
- Move extension tests to `packages/extension/tests` and update helper paths to the new package layout.
- Add `tsconfig.json` per package to ensure Bun can run TypeScript tests in each package.
- Ensure tests run via workspace scripts (root `bun test` plus package-level `bun test`).

### Integration Tests
- Website calculator flow after shared package integration.

### Manual Testing Steps
1. Load extension from `packages/extension/dist` and confirm popup works.
2. Verify calculation outputs match previous version for known inputs.
3. Load website at `http://localhost:3000/` and run calculator flow.
4. Run `./scripts/zip_for_chrome.sh` and confirm the zip installs.

### Automated Verification
- Run `bun test` at the workspace root after test migration to verify all TypeScript tests pass.
- Run `bun test` inside `packages/naca-mortgage-calculator` and `packages/extension` to confirm package-local test execution.

## Performance Considerations

- Avoid bundlers that inline the entire calculator into multiple outputs; keep one shared module build artifact and reuse it.
- Ensure extension build output remains lightweight (no large dependency trees).

## Migration Notes

- Keep old extension version intact until new build output is validated in Chrome.
- Run Railway deploy from a staging branch before switching production.

## References

- Research doc: `orchestration/shared/research/2026-01-16-monorepo-packages-plan.md`
- Extension packaging: `scripts/zip_for_chrome.sh:13`
- Railway server: `railway-api/src/index.ts:7`
- Railway deployment guide: `railway-api/DEPLOYMENT.md:35`
