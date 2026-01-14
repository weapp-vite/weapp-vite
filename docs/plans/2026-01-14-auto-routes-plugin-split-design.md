# Auto Routes Plugin Split Design

## Context

`packages/weapp-vite/src/runtime/autoRoutesPlugin.ts` mixes file crawling, route parsing, typed definition generation, and service state management in a single module. This makes maintenance harder and increases the cost of changes. We want to split the module into focused files while preserving the current public API and behavior.

## Goals

- Split auto routes logic into small, responsibility-focused files.
- Keep the existing import path working via a folder entry (`autoRoutesPlugin`).
- Preserve all runtime behavior, logs, and ordering rules.

## Non-goals

- No functional changes to route detection or output.
- No changes to JSON parsing behavior or error handling.
- No new tests or snapshot updates.

## Proposed Structure

Create a new folder `packages/weapp-vite/src/runtime/autoRoutes/`:

- `index.ts`: public entry; exports `createAutoRoutesService`, `createAutoRoutesServicePlugin`, and `_collectAutoRouteCandidates`.
- `candidates.ts`: candidate scanning and file-type helpers (`collectCandidates`, `ensureCandidate`, `cloneCandidate`, `areSetsEqual`, file extension checks).
- `routes.ts`: route resolution and serialization (`resolveRoute`, `resolvePagesDirectory`, `createTypedRouterDefinition`, `scanRoutes`, `updateRoutesReference`, `cloneRoutes`).
- `watch.ts`: file change matching and candidate updates (`matchesRouteFile`, `updateCandidateFromFile`, `rebuildCandidateForBase`).
- `service.ts`: `createAutoRoutesService` state machine and public API.

The original `autoRoutesPlugin.ts` will be replaced by `autoRoutes/index.ts` to keep the public entry path stable.

## Data Flow

`service.ts` owns the runtime state and coordinates scans. On initialization or full rescan, it calls `candidates.ts:collectCandidates`. On file changes, it uses `watch.ts:updateCandidateFromFile` to update candidate entries incrementally. It then calls `routes.ts:scanRoutes` to build the latest snapshot, and `routes.ts:updateRoutesReference` to update the in-place routes reference without breaking consumers. Module code and typed definitions are produced by `routes.ts` and written by `service.ts`, preserving existing file output logic.

## Error Handling

Keep behavior unchanged: scanning requires initialized config/json services; crawler errors are swallowed; typed router writes/removals are guarded with logging and do not break the main flow.

## Testing

No new tests. Existing tests should remain green, including any tests that use `_collectAutoRouteCandidates`.
