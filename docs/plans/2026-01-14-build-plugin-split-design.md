# Build Plugin Split Design

## Context

`packages/weapp-vite/src/runtime/buildPlugin.ts` combines build service orchestration, independent subpackage builds, workers handling, output cleanup, and npm build scheduling. This makes the file long and harder to maintain.

## Goals

- Split build service helpers into focused modules.
- Keep the public entry path stable via a folder `index.ts`.
- Preserve current behavior and logging.

## Non-goals

- No changes to build flow or error handling.
- No changes to output paths.
- No new tests.

## Proposed Structure

Create a new folder `packages/weapp-vite/src/runtime/buildPlugin/`:

- `index.ts`: public `createBuildServicePlugin` export.
- `service.ts`: `createBuildService`, `BuildService`, `BuildOptions` definitions.
- `independent.ts`: independent subpackage build helpers.
- `workers.ts`: worker build helpers and worker watcher setup.
- `outputs.ts`: output cleanup helper.

The original `buildPlugin.ts` will be replaced by `buildPlugin/index.ts` to keep imports stable.

## Data Flow

`service.ts` orchestrates the build lifecycle and delegates to helper modules for independent bundle building, worker builds, and output cleanup. All shared state stays within the build service.

## Error Handling

Unchanged. Errors are still normalized and logged where they were before.

## Testing

No new tests. Existing tests should continue to pass.
