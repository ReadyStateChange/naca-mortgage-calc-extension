# Future Plans

## Objectives
- Deliver a local-first property tracking experience that works offline for NACA members during their housing search.
- Add optional sync across devices while staying within existing zero-cost infrastructure commitments.
- Evaluate PGlite versus TanStack DB for the primary client-side store to keep the stack local-first without incurring new platform costs.
- Keep the experience member-centric but members may selectively share read-only views with their real estate agent.

## Mobile Sharing Strategy
- Prioritize the standalone web app as the sharing surface; ensure layouts remain fully responsive so agents consuming links on phones have a clean experience ([moldstud.com](https://moldstud.com/articles/p-cloud-storage-for-real-estate-agents-storing-property-info?utm_source=openai)).
- Generate optional share links scoped to an agent role with read-only RBAC to prevent counselor-level data leakage and guard sensitive member details ([moldstud.com](https://moldstud.com/articles/p-cloud-storage-for-real-estate-agents-storing-property-info?utm_source=openai)).
- Offer secure link management (passwords/expiry) and encourage members to apply device security best practices when collaborating with agents on mobile ([blinq.me](https://blinq.me/blog/file-sharing-for-realtors?utm_source=openai); [nar.realtor](https://www.nar.realtor/data-privacy-security?utm_source=openai)).
- Avoid mobile workflows that depend on the Chrome extension, since the extension is desktop-only; default to sharing via the responsive web app or exported summaries.

## Roadmap · Bun API + Neon Sync
### Scope
- Extend the current Bun Railway API with `/api/properties` CRUD endpoints that read/write `properties` table rows keyed by authenticated user IDs.
- Keep the local IndexedDB/extension storage as the source of truth during offline use; reconcile changes when connectivity returns.
- Leverage existing Neon Postgres instance for persistence; add minimal auth tables (`users`, `sessions`) and use email-based passwordless login (magic link or OTP).

### Phased Delivery
1. **Schema & Storage Foundations**
   - Add `users`, `properties`, and `property_events` tables (latter for audit trail/conflict resolution).
2. **API + Auth Layer**
   - Implement Bun routes for auth (register, login, refresh) and property CRUD with per-user row-level security.
   - Integrate JWT/session tokens in the extension + web app; cache user identity locally.
3. **Client Sync Engine**
   - Build a small sync worker that batches local mutations, ships them to the API, and merges server updates via timestamps.
   - Add optimistic UI updates and conflict prompts (e.g., counselor overrides vs member edits).

### Cost & Operations
- Railway Starter credit ($5/mo) continues to cover Bun service runtime; monitor cumulative hours to avoid spillover.
- Neon free tier (1 compute, 1 GB storage) keeps database at $0 while property data stays lightweight (<<1 GB).
- Add Observability via existing logging; defer heavy analytics until usage justifies spend.
- Establish usage alerts so growth that risks paid tiers triggers review before costs incur.

## Experimental Track · PGlite + ElectricSQL vs [TanStack DB](https://frontendatscale.com/blog/tanstack-db/) + ElectricSQL
### Motivation
- Compare two ElectricSQL-backed local-first stacks: (a) PGlite as an embedded Postgres paired with Electric sync, and (b) TanStack DB as the client store with Electric providing synchronization.

### Discovery Tasks
1. **Prototype Workspace**
   - Spin up a standalone sandbox that mounts PGlite in the extension/web build and seeds mortgage calculator fixtures.
   - Validate CRUD performance, bundle size impact (<3 MB gzip per PGlite spec) and persistence durability across sessions ([pglite.dev](https://pglite.dev/)).
2. **ElectricSQL Sync Trial**
   - Deploy Electric sync service against the existing Neon database; subscribe to a limited `properties` shape for a test user cohort ([electric-sql.com](https://electric-sql.com)).
   - Measure latency and conflict resolution behavior for both storage options to surface differences in developer experience and data modeling.
3. **Integration Spike**
   - Replace the hand-rolled sync worker with Electric client bindings in a feature branch; implement parallel PGlite and TanStack DB variants.
   - Document required auth hooks, optimistic update flows, and any bundle-size or offline durability differences between the two approaches.

### Evaluation Criteria
- **Cost**: Confirm Electric Cloud, PGlite, and TanStack DB usage can remain within free/community tiers during experimentation.
- **Complexity**: Compare maintenance overhead, typing ergonomics, and integration friction between embedded Postgres and TanStack DB.
- **Resilience**: Benchmark offline editing, reconnect merges, and counselor/member concurrent edits across both stacks.

### Exit Options
- Choose the Electric stack (PGlite or TanStack DB) that best balances offline fidelity, sync robustness, and maintenance.
- Defer adoption if bundle size, auth integration, or hosting overhead outweigh benefits.
- Track Electric’s GA roadmap and revisit after Bun sync stabilizes.


