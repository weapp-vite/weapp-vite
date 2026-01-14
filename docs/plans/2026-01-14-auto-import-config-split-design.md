# Auto Import Config Split Design

## Goal

Split `runtime/autoImport/config.ts` into focused modules while keeping exports and behavior stable.

## Architecture

- Replace `packages/weapp-vite/src/runtime/autoImport/config.ts` with a folder entry and modules.
- Entry: `packages/weapp-vite/src/runtime/autoImport/config/index.ts` keeps current exports.
- Modules:
  - `base.ts`: base directory and default output path helpers.
  - `merge.ts`: cloning and merge helpers for auto import configs.
  - `defaults.ts`: default auto import config and `getAutoImportConfig`.
  - `settings.ts`: typed/html/vue settings getters and interfaces.

## Data Flow

1. `index.ts` re-exports all public APIs and constants.
2. `merge.ts` normalizes user config inputs and merges overrides.
3. `defaults.ts` computes the default config and applies subpackage overrides.
4. `settings.ts` resolves output paths for typed/html/vue definitions.

## Error Handling

- No new error paths; existing behavior remains unchanged.

## Testing

- No new tests; rely on existing coverage.
