# AGENTS.md

## Purpose
- Provide build, lint, and test commands for this repo.
- Document code style and engineering conventions for agents.
- Capture any Cursor or Copilot rules that must be followed.

## Repo Layout
- `popup/` contains the Chrome extension UI.
- `js/` contains shared calculator logic and services for the extension.
- `tests/` contains Bun tests for the extension and shared JS.
- `railway-api/` contains the Bun + TypeScript API server.
- `railway-api/public/` hosts the standalone website assets.

## Tooling Summary
- JavaScript in the extension is plain ES modules (no build step).
- The API service uses Bun runtime and TypeScript with strict settings.
- Tests are split across Bun (root) and Vitest (railway-api).
- Version control uses Jujutsu (jj) with a Git backend.
- Use Jujutsu commands to track changes instead of Git.
- No ESLint/Prettier scripts are configured in this repo.

## Root Commands (Extension + Shared JS)
- Install deps: `bun install`
- Run all tests: `bun test`
- Run a single test file: `bun test tests/popup.test.js`
- Run a single test file (another example): `bun test tests/calculator.test.js`
- Debug tests: use `bun test --help` for flags supported by Bun.
- Build/pack extension: `./scripts/zip_for_chrome.sh`
- Local static server (if needed): `npx http-server` or `bunx http-server`.

## Railway API Commands (Bun + TypeScript)
- Install deps: `bun install` (run inside `railway-api/`).
- Dev server: `bun run dev` (watch mode).
- Production server: `bun run start`.
- Build output: `bun run build`.
- Type checks: `bun run typecheck`.
- Run all tests: `bun run test`.
- Run a single test file: `bun run test src/schemas/external/rates.test.ts`.
- Run a single test case: `bun run test -t "name"`.
- Run tests with UI: `bun run test:ui`.
- Run tests with coverage: `bun run test:coverage`.

## Linting and Formatting
- No lint script is configured in `package.json` at the root.
- No lint script is configured in `railway-api/package.json`.
- No formatting tool is configured; keep diffs minimal.
- Maintain the existing formatting style (2-space indents).

## JavaScript Style (Extension + Shared JS)
- Use ES modules and `import`/`export` syntax where applicable.
- Default to `const` and use `let` only when reassignment is needed.
- Prefer function declarations or class methods over inline lambdas.
- Use semicolons and double quotes, matching existing files.
- Use `camelCase` for variables and methods.
- Use `PascalCase` for classes (e.g., `MortgageCalculator`).
- Use `UPPER_SNAKE_CASE` for constants.
- Keep DOM manipulation in `popup/` or `railway-api/public/`.
- Keep core calculation logic in `js/` or the shared calculator files.
- Avoid one-letter variable names unless math contexts demand it.

## TypeScript Style (Railway API)
- Use ES module syntax (`type: module` is set).
- Keep imports grouped by source; external before internal.
- Use named imports consistently (`import { Effect } from "effect"`).
- Maintain strict typing; avoid `any` unless unavoidable.
- Prefer explicit return types for exported functions.
- Use `Record<string, ...>` for string-key maps.
- Use `async/await` instead of `.then()` chaining.
- Use `camelCase` for variables and functions.
- Use `PascalCase` for classes, `Effect` tags, and error types.
- Use `DbError`/`TaggedError` patterns for domain errors.
- Use `const` for arrays/objects and avoid mutation unless needed.

## API Error Handling Patterns
- Return structured `Response` objects with JSON error payloads.
- Use consistent `Content-Type: application/json` for API responses.
- Log errors with `console.error` before returning 500 responses.
- Use `Effect.runPromise(Effect.either(...))` when handling Effects.
- Prefer `Either.isRight`/`Either.isLeft` for control flow.
- Validate required env vars on startup (e.g., `DATABASE_URL`).

## Testing Conventions
- Root tests live under `tests/` and run with Bun.
- API tests live under `railway-api/src/**` and run with Vitest.
- Test file naming uses `.test.js` or `.test.ts`.
- Prefer deterministic tests without network access.
- Reuse existing helpers in `tests/helpers/` when possible.

## Naming and File Organization
- Use `kebab-case` for directories and file names where possible.
- Use `camelCase` file names in `railway-api/src` (existing pattern).
- Keep route handlers under `railway-api/src/routes/`.
- Keep service modules under `railway-api/src/services/`.
- Keep schema definitions under `railway-api/src/schemas/`.
- Keep scripts in `railway-api/src/scripts/`.

## Environment Configuration
- API requires `DATABASE_URL` (Neon PostgreSQL connection).
- `PORT` defaults to 3000 in the API.
- `NODE_ENV` determines dev/production behavior.
- Do not commit `.env` files or credentials.

## Web/Extension Behavior Notes
- Shared calculator logic lives in `js/calculator.js`.
- Website UI logic is in `railway-api/public/website.js`.
- Extension UI logic is in `popup/popup.js`.
- API uses same-origin requests for the website.

## Copilot Instructions (From `.github/copilot-instructions.md`)
- Follow instructions carefully and avoid extra work.
- Ask questions when requirements are unclear.
- Identify constraints and keep work scoped to requests.
- Plan thoughtfully before implementation.
- Maintain code quality, performance, and security.
- Use strict type checking and follow lint rules.
- Report progress and confirm at decision points.
- Do not edit any package management files without consent.
- Validate issues methodically and document solutions.

## Agent Behavior Expectations
- Respect existing architecture and avoid unrelated changes.
- Do not add dependencies or modify package files without approval.
- Keep edits focused and consistent with surrounding code.
- Avoid introducing new tooling unless explicitly requested.
- Prefer minimal diffs and incremental changes.
- If tests are added, keep them alongside existing tests.
- Document any manual steps the user must run.

## Single-Test Examples (Quick Reference)
- Extension single file: `bun test tests/popup.test.js`.
- Extension single file: `bun test tests/inputValidator.test.js`.
- API single file: `bun run test src/schemas/internal/msa.test.ts`.
- API single case: `bun run test -t "returns data"`.

## Notes on Missing Tooling
- No dedicated lint or format commands are present.
- Do not assume Prettier/ESLint configs exist.
- If formatting is needed, match current file style manually.
