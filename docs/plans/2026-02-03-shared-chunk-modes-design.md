# Shared Chunk Modes Design

## Summary

Add configurable shared-chunk output modes to weapp-vite so users can:

- Disable shared chunk extraction globally (no `common.js`).
- Disable shared chunk extraction for specific modules/paths.
- Emit shared modules as per-source relative paths (e.g. `src/utils/foo.ts` → `utils/foo.js`).

Default behavior remains unchanged.

## Goals

- Preserve current default behavior (`common.js` / shared chunk logic).
- Provide three modes: `common`, `inline`, `path`.
- Support per-module overrides using glob/RegExp rules.
- Allow dynamic-import handling to be configured.
- Apply to miniprogram, plugin/worker, and web builds.

## Non-goals

- Changing existing shared chunk strategy semantics (`duplicate` vs `hoist`).
- Rewriting module graph semantics beyond chunk naming/output.

## Config Surface

Extend `weapp.chunks`:

```ts
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    chunks: {
      sharedStrategy: 'duplicate',
      sharedMode: 'common', // 'common' | 'path' | 'inline'
      sharedOverrides: [
        { test: 'utils/**', mode: 'path' },
        { test: /legacy\//, mode: 'inline' },
      ],
      sharedPathRoot: 'src', // default: srcRoot
      dynamicImports: 'preserve', // 'preserve' | 'inline'
    },
  },
})
```

Defaults:

- `sharedMode`: `common`
- `sharedOverrides`: `[]`
- `sharedPathRoot`: `srcRoot`
- `dynamicImports`: `preserve`

## Behavior

- `sharedMode: 'common'`: keep current behavior; repeated imports consolidate into `common.js` (or shared chunk per subpackage strategy).
- `sharedMode: 'path'`: output shared modules as individual chunks using source-relative paths (no `common.js`).
- `sharedMode: 'inline'`: disable shared chunks; shared code is duplicated into importers.
- `sharedOverrides`: matching module path uses its own mode; unmatched modules follow `sharedMode`.
- `dynamicImports: 'preserve'`: keep existing dynamic chunks.
- `dynamicImports: 'inline'`: inline dynamic imports when possible.

## Architecture & Data Flow

1. **Config types & defaults**
   - Extend `ChunksConfig` in `packages/weapp-vite/src/types/config.ts`.
   - Add defaults in `packages/weapp-vite/src/defaults.ts`.

2. **Chunk naming / shared resolution**
   - In `packages/weapp-vite/src/runtime/chunkStrategy/naming.ts`:
     - Resolve per-module mode via `sharedOverrides` (glob/RegExp).
     - `inline`: return `undefined` (no shared chunk).
     - `path`: return chunk name based on `sharedPathRoot` relative path (sans ext).
     - `common`: fall back to current logic.

3. **Shared-chunk post-processing**
   - `applySharedChunkStrategy` remains unchanged and only applies to virtual shared chunks.
   - When mode is `path` or `inline`, no virtual shared chunk should be produced, so post-processing is a no-op.

4. **Dynamic import handling**
   - If `dynamicImports: 'inline'`, set rolldown `output.inlineDynamicImports = true` when safe.
   - If the bundler rejects the combination, warn and fall back to `preserve`.

## Edge Cases & Errors

- `sharedPathRoot` must be within `srcRoot`. If invalid, warn and fall back to `srcRoot`.
- Keep existing subpackage boundary checks (modules in a subpackage referenced by other subpackages should still error).
- If module ID is virtual or cannot be mapped to a file path, fall back to `common` and log a debug note.

## Tests

- `sharedMode=common`: existing tests remain passing.
- `sharedMode=inline`: shared module is duplicated; no `common.js`.
- `sharedMode=path`: shared module output matches source-relative path; no `common.js`.
- `sharedOverrides`: mixed output (e.g., `utils/**` → `path`, others → `common`).
- `dynamicImports`: preserve vs inline behavior.
- Subpackage boundary error remains intact under all modes.

## Open Questions

- Should `sharedMode='inline'` implicitly set `dynamicImports='inline'` or remain independent?
- Should `sharedPathRoot` support multiple roots (e.g., monorepo src roots)?
