# Core Plugin Split Design

## Context

`packages/weapp-vite/src/plugins/core.ts` has grown large and mixes plugin factories, lifecycle logic, require analysis, and helper utilities in a single module. This makes navigation and ownership harder as related helpers are far apart. We want to split the module into focused files while keeping the public import path and behavior unchanged.

## Goals

- Split `core.ts` into smaller files organized by responsibility.
- Keep the public API and import path stable (`packages/weapp-vite/src/plugins/core`).
- Avoid any behavior changes in the build, watch, and HMR flows.

## Non-goals

- No functional changes to plugin logic.
- No renaming of exported symbols or altering log messages.
- No new tests or coverage changes.

## Proposed Structure

Create a new folder `packages/weapp-vite/src/plugins/core/` and move the logic into:

- `index.ts`: public entry; exports `weappVite` and `__removeImplicitPagePreloadsForTest`; wires plugin list.
- `wxss.ts`: `createWxssResolverPlugin`.
- `lifecycle.ts`: `createCoreLifecyclePlugin` and lifecycle-specific helpers related to build/start/watch/render/generate.
- `requireAnalysis.ts`: `createRequireAnalysisPlugin`.
- `helpers.ts`: shared utilities used across lifecycle and require analysis (byte formatting, module graph refresh, shared chunk importers, implicit preload removal).

The old `core.ts` will be replaced by `core/index.ts` so existing imports continue to resolve via the folder entry.

## Data Flow

`weappVite` initializes state and returns three plugins. Lifecycle paths remain identical: `wxss` runs at `pre`, core lifecycle runs at `pre`, and require analysis runs at `post`. Helper functions are imported locally and remain pure utilities without new dependencies. State is still owned by `weappVite` and passed to factory functions.

## Error Handling

No changes. Existing `try/catch` and logging behavior remains as-is.

## Testing

No new tests. Existing tests should continue to pass, especially `packages/weapp-vite/src/plugins/core.test.ts` (if present). Run the same unit tests used for prior refactors to confirm no behavior drift.
