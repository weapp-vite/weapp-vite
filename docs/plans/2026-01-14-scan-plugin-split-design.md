# Scan Plugin Split Design

## Context

`packages/weapp-vite/src/runtime/scanPlugin.ts` combines subpackage entry resolution, shared style entry normalization, scan service state management, and the Vite plugin entry in a single file. The dense mix of responsibilities makes it harder to navigate and maintain.

## Goals

- Split scan plugin logic into focused modules.
- Keep the public entry path stable via a folder `index.ts`.
- Preserve runtime behavior, caching semantics, and error handling.

## Non-goals

- No behavior changes to app/subpackage scanning.
- No changes to file system access patterns or logging.
- No new tests.

## Proposed Structure

Create a new folder `packages/weapp-vite/src/runtime/scanPlugin/`:

- `index.ts`: public entry for `createScanServicePlugin` and `ScanService`.
- `service.ts`: scan service implementation (`createScanService`) and related helpers for app/subpackage loading.
- `styleEntries.ts`: shared style entry normalization, scope inference, and default style discovery.
- `subpackages.ts`: subpackage entry resolution helpers.

The original `scanPlugin.ts` will be replaced by `scanPlugin/index.ts` to keep imports stable.

## Data Flow

`service.ts` owns the runtime scan state and uses `subpackages.ts` to collect subpackage entries and `styleEntries.ts` to normalize style configuration. The Vite plugin wrapper lives in `index.ts` and delegates to the scan service.

## Error Handling

Unchanged. Existing warnings and thrown errors remain intact, only relocated to the appropriate modules.

## Testing

No new tests. Existing tests should continue to pass.
