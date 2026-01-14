# NPM Plugin Split Design

## Context

`packages/weapp-vite/src/runtime/npmPlugin.ts` combines cache management, package build logic, relation list resolution, and the npm build orchestration in a single file. The module is long and difficult to navigate.

## Goals

- Split npm build helpers into focused modules.
- Keep the public entry path stable via a folder `index.ts`.
- Preserve current behavior and logging.

## Non-goals

- No changes to npm build behavior or output paths.
- No changes to cache semantics.
- No new tests.

## Proposed Structure

Create a new folder `packages/weapp-vite/src/runtime/npmPlugin/`:

- `index.ts`: public `createNpmServicePlugin` export.
- `service.ts`: `createNpmService` and `NpmService` definition.
- `cache.ts`: dependencies cache helpers.
- `builder.ts`: package build helpers (`bundleBuild`, `copyBuild`, `buildPackage`) and related utilities.
- `relations.ts`: pack npm relation list resolution.

The original `npmPlugin.ts` will be replaced by `npmPlugin/index.ts` to keep imports stable.

## Data Flow

`service.ts` orchestrates npm builds and delegates to cache helpers, the package builder, and relation list resolution. It keeps the public API unchanged.

## Error Handling

Unchanged. Errors and warnings remain intact.

## Testing

No new tests. Existing tests should continue to pass.
