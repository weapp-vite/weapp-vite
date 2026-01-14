# Wevu Reachability Split Design

## Goal

Split `plugins/wevu/pageFeatures/reachability.ts` into focused modules while keeping exports and behavior stable.

## Architecture

- Replace `packages/weapp-vite/src/plugins/wevu/pageFeatures/reachability.ts` with a folder entry and modules.
- Entry: `packages/weapp-vite/src/plugins/wevu/pageFeatures/reachability/index.ts` keeps `collectWevuFeaturesFromSetupReachableImports`.
- Modules:
  - `calls.ts`: callee name resolution and call collection helpers.
  - `hooks.ts`: wevu hook detection in function bodies.
  - `resolve.ts`: exported function resolution across modules.
  - `walk.ts`: queue-driven reachability traversal.

## Data Flow

1. `index.ts` wires helpers to collect reachable wevu features.
2. `calls.ts` inspects call expressions and tracks called bindings.
3. `hooks.ts` maps hook calls to feature flags.
4. `resolve.ts` follows exported functions across modules.
5. `walk.ts` performs BFS traversal with depth limits and seed handling.

## Error Handling

- No new error paths; existing guards and depth caps remain unchanged.

## Testing

- No new tests; rely on existing coverage.
