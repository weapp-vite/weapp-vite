# Auto Import Service Split Design

## Context

`packages/weapp-vite/src/runtime/autoImport/service.ts` is >1000 lines and mixes resolver logic, metadata extraction, output scheduling, and registry mutation. This makes it hard to reason about responsibilities and to change any single area without touching unrelated code.

## Goals

- Reduce file size and clarify boundaries without changing runtime behavior.
- Keep `createAutoImportService` as the only public entry point.
- Preserve existing scheduling semantics, caches, and side effects.

## Non-goals

- No behavioral changes or new features.
- No changes to public APIs or configuration shape.

## Proposed Module Split

- `resolver.ts`
  - `resolveWithResolver`, `resolveWithResolvers`
  - `parsePackageSpecifier`, `getMiniprogramDir`, `getPackageRoot`, `resolveNavigationImport`
  - `collectResolverComponents`, `syncResolverComponentProps`
- `metadata.ts`
  - `getComponentMetadata`, `preloadResolverComponentMetadata`
- `outputs.ts`
  - `syncTypedComponentsDefinition`, `syncVueComponentsDefinition`, `syncHtmlCustomData`
  - `scheduleTypedComponentsWrite`, `scheduleVueComponentsWrite`, `scheduleHtmlCustomDataWrite`
  - `writeManifestFile`, `scheduleManifestWrite`
- `registry.ts`
  - `registerLocalComponent`, `removeRegisteredComponent`, `ensureMatcher`
- `service.ts`
  - Holds state and wires modules into the public `AutoImportService` interface.

## Data Flow

`service.ts` owns all mutable state (registries, caches, pending promises, last-written snapshots). It passes state and `ctx` into module functions. Output modules trigger write scheduling, while resolver/metadata modules are pure or only mutate passed-in maps/sets.

## Error Handling

Existing error logging behavior is preserved. Errors from file I/O remain logged via `logger` and do not throw to callers.

## Testing

No new tests required. Existing tests should remain green. If any failures appear, fix by adjusting imports or state wiring only.
