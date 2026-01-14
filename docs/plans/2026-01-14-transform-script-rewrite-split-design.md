# Transform Script Rewrite Split Design

## Goal

Split `transformScript/rewrite.ts` into scenario-focused modules without changing behavior or public APIs.

## Architecture

- Replace `packages/weapp-vite/src/plugins/vue/transform/transformScript/rewrite.ts` with a folder entry and modules.
- Entry: `packages/weapp-vite/src/plugins/vue/transform/transformScript/rewrite/index.ts` keeps `rewriteDefaultExport` export/signature.
- Modules:
  - `defaults.ts`: wevu defaults merge/serialization/injection helpers (`serializeWevuDefaults`, `applyWevuDefaultsToOptionsObject`, `mergeNestedDefaults`, `stripVirtualHostFromDefaults`, `ensureNestedOptionValue`, `insertWevuDefaultsCall`).
  - `classStyle.ts`: class/style computed injection (`injectClassStyleComputed` and helpers).
  - `export.ts`: default export rewriting for app/component/skip branches with runtime imports.

## Data Flow

1. `index.ts` resolves the component expression and injects page feature flags.
2. `defaults.ts` merges wevu defaults into options with the same precedence and virtualHost handling.
3. `classStyle.ts` injects computed properties for class/style bindings when enabled.
4. `export.ts` rewrites the default export, injects runtime imports, and emits app/component creation calls.

## Error Handling

- Defaults serialization warnings remain unchanged.
- Class/style injection warnings remain unchanged.
- No changes to parsing or runtime import behavior.

## Testing

- No new tests required; existing transformScript coverage should remain green.
