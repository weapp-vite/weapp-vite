# Rolldown-only build options

## Context

weapp-vite should rely solely on rolldown for build output control. Any Rollup-specific configuration (especially `build.rollupOptions`) must be ignored, even if users provide it. Shared chunk behavior should only activate when users explicitly configure `weapp.chunks`, keeping default output identical to the pre-change behavior.

## Goals

- Remove all internal reads/writes/injections of `build.rollupOptions`.
- Ensure `build.rolldownOptions` is the only build output path used by weapp-vite.
- Preserve default output behavior unless `weapp.chunks` is explicitly configured.

## Non-goals

- No compatibility mapping from Rollup options to rolldown options.
- No warnings or logs for ignored Rollup options.

## Decisions

1. Strip `build.rollupOptions` during config load so it never reaches downstream build flows.
2. Remove any internal rollup output generation and injection (e.g. for shared chunk output).
3. Keep shared chunk logic behind the `chunksConfigured` flag only.
4. For npm packaging defaults, use `build.rolldownOptions` instead of `build.rollupOptions`.

## Implementation notes

- `packages/weapp-vite/src/runtime/config/internal/loadConfig.ts`: delete/ignore `build.rollupOptions`.
- `packages/weapp-vite/src/runtime/config/internal/merge/index.ts`: remove rollup output injection and imports.
- `packages/weapp-vite/src/runtime/sharedBuildConfig.ts`: return empty config when `chunksConfigured` is false.
- `packages/weapp-vite/src/runtime/npmPlugin/builder.ts`: replace default rollup options with rolldown options.

## Testing

Run targeted tests to confirm unchanged defaults and correct chunk output when configured:

- `pnpm vitest run packages/weapp-vite/test/shared-chunks.test.ts`
- `pnpm vitest run packages/weapp-vite/test/shared-chunk-modes.matrix.test.ts`
- `pnpm vitest run packages/weapp-vite/test/subPackages.test.ts`
- `pnpm vitest run packages/weapp-vite/test/subPackages-dependencies.test.ts`
- `pnpm vitest run packages/weapp-vite/test/subpackage-dayjs.test.ts`
- `pnpm vitest run packages/weapp-vite/test/asset.test.ts`
