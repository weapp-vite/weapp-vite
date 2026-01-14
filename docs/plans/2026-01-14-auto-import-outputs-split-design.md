# Auto Import Outputs Split Design

## Goal

Split `runtime/autoImport/service/outputs.ts` into focused modules while keeping exports and behavior stable.

## Architecture

- Replace `packages/weapp-vite/src/runtime/autoImport/service/outputs.ts` with a folder entry and modules.
- Entry: `packages/weapp-vite/src/runtime/autoImport/service/outputs/index.ts` keeps `createOutputsHelpers`.
- Modules:
  - `state.ts`: output state and helper types.
  - `manifest.ts`: manifest collection and write logic.
  - `sync.ts`: typed/vue/html custom data sync writers.
  - `schedule.ts`: schedule helpers for each output target.

## Data Flow

1. `index.ts` wires state, manifest collection, sync, and scheduling into the helpers API.
2. `manifest.ts` gathers components from registry/resolvers and writes the JSON manifest.
3. `sync.ts` builds and writes typed/components/html custom data definitions with caching.
4. `schedule.ts` orchestrates pending write queues and config-change detection.

## Error Handling

- No new error paths; existing logging remains unchanged.

## Testing

- No new tests; rely on existing coverage.
