# SWC Scope Plugin Split Design

## Context

`packages/weapp-vite/src/runtime/swcScopePlugin.ts` currently bundles type definitions, scope manager, pattern helpers, SWC visitor logic, analysis entry points, and export wiring. The file is long and hard to navigate when iterating on the scope analysis logic.

## Goals

- Split SWC scope analysis into focused modules.
- Keep the public entry path stable via a folder `index.ts`.
- Preserve current behavior and exports.

## Non-goals

- No behavioral changes to scope resolution or analysis.
- No algorithmic refactors or new features.
- No new tests.

## Proposed Structure

Create a new folder `packages/weapp-vite/src/runtime/swcScopePlugin/`:

- `index.ts`: public exports and re-exports (`analyzeScope`, `resolveBinding`, `ScopeManager`, types, and SWC exports).
- `types.ts`: `BindingKind`, `ScopeType`, `BindingInfo`, `ScopeAnalysisResult`.
- `scopeManager.ts`: `ScopeManager` and internal scope state types.
- `collector.ts`: `ScopeCollector` plus pattern extraction helpers used by the visitor.
- `analyze.ts`: `analyzeScope` and `resolveBinding`.

The original `swcScopePlugin.ts` will be replaced by `swcScopePlugin/index.ts` to keep imports stable.

## Data Flow

`collector.ts` builds on `scopeManager.ts` and `types.ts` to gather bindings and references during traversal. `analyze.ts` parses code with SWC, runs the collector on the program, and returns a `ScopeAnalysisResult`. `index.ts` re-exports the public API.

## Error Handling

Unchanged. Parsing and traversal behavior remain as-is.

## Testing

No new tests. Existing tests should continue to pass.
