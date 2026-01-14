# Style Entries Split Design

## Goal

Split `runtime/scanPlugin/styleEntries.ts` into focused modules while keeping exports and behavior stable.

## Architecture

- Replace `packages/weapp-vite/src/runtime/scanPlugin/styleEntries.ts` with a folder entry and modules.
- Entry: `packages/weapp-vite/src/runtime/scanPlugin/styleEntries/index.ts` keeps `normalizeSubPackageStyleEntries`.
- Modules:
  - `config.ts`: constants and config coercion (`ResolvedStyleConfig`, `coerceScope`, `coerceStyleConfig`, supported extensions).
  - `patterns.ts`: pattern normalization and include/exclude resolution.
  - `resolve.ts`: path resolution helpers and scope inference from filenames.
  - `entries.ts`: entry construction helpers (`addStyleEntry`, `appendDefaultScopedStyleEntries`).

## Data Flow

1. `index.ts` orchestrates normalization and warns on invalid entries.
2. `resolve.ts` resolves absolute paths and infers scope from filenames.
3. `config.ts` normalizes user config into `ResolvedStyleConfig`.
4. `patterns.ts` computes include/exclude patterns with defaults.
5. `entries.ts` builds normalized entries and applies default scoped files.

## Error Handling

- No new error paths; warnings remain unchanged.

## Testing

- No new tests; rely on existing coverage.
