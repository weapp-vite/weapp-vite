---
title: API & options
description: "rolldown-require exposes three APIs: bundleRequire, bundleFile,
  and loadFromBundledFile. Prefer the one-stop bundleRequ…"
keywords:
  - 配置
  - api
  - packages
  - rolldown
  - require
  - options
  - "&"
  - rolldown-require
---

# API & options

> Language: English | [中文](/packages/rolldown-require/options.zh)

`rolldown-require` exposes three APIs: `bundleRequire`, `bundleFile`, and `loadFromBundledFile`. Prefer the one-stop `bundleRequire`, which resolves the entry, bundles with rolldown, writes the temp output, loads it, and returns:

- `mod`: the executed module (automatically unwraps `default` if present)
- `dependencies`: the file paths touched during bundling

## Common options

### filepath / cwd

- `filepath` is required and accepts relative or absolute paths.
- `cwd` defaults to `process.cwd()` for resolving the relative entry and `tsconfig`.

### format

- If omitted, format is inferred from extension and `package.json.type` (`.mjs`/`.mts`/`type:module` -> `esm`, `.cjs`/`.cts` -> `cjs`).
- Pass `cjs`/`esm` to skip inference, e.g. force ESM for `.js`.

### require

Customize how the temp output is loaded: `(outfile, { format }) => any`.

- ESM: `import(outfile)` (temp file or data URL is written during bundling)
- CJS: compiles the source via a temporary `_require.extensions` hook

Use this to plug in your own loader, add custom `import` logic for ESM output, or inject mocks in tests.

### rolldownOptions

Pass through parts of rolldown options:

- `input`: add plugins, `resolve` rules, transforms, etc. Internally `platform: 'node'` and `treeshake: false` are fixed, and `define` injects `__dirname`/`__filename`/`import.meta.url`.
- `output`: merged with defaults; `format` is overridden by the `format` option, `inlineDynamicImports` is always `true`.

> Avoid overriding `platform`, `input`, or `inlineDynamicImports`, otherwise resolution/dependency collection may break.

### external

Forwarded to rolldown. The plugin already externalizes most `node_modules` deps while keeping JSON inlined; use this option to exclude or force-inline specific deps.

### tsconfig

- Auto-searches upward for `tsconfig.json` and reads `paths` for alias resolution during bundling.
- Pass a string to set the path explicitly; pass `false` to disable tsconfig handling.

### getOutputFile

Customize where the temp output is written (defaults to `node_modules/.rolldown-require` or the system temp dir with a random suffix). Handy for writing to a debuggable location.

### preserveTemporaryFile

Temp files are cleaned after CJS load or ESM import by default. Set to `true` (or `BUNDLE_REQUIRE_PRESERVE`) to keep them for inspection.

### cache

Disabled when `false`/unset. Pass `true` or an object to enable persistent + memory cache; see [Loading flow & cache](/packages/rolldown-require/cache) for details.

## Example configuration

```ts
import { bundleRequire } from 'rolldown-require'

const { mod } = await bundleRequire({
  cwd: process.cwd(),
  filepath: './tooling/config.ts',
  format: 'esm',
  tsconfig: './tsconfig.node.json',
  external: ['fsevents'],
  cache: {
    enabled: true,
    dir: './node_modules/.rolldown-require-cache',
    onEvent: e => console.log('[rolldown-require cache]', e),
  },
  rolldownOptions: {
    input: {
      plugins: [
        myCustomPlugin(),
      ],
    },
  },
})
```

This setup will:

1. Bundle `tooling/config.ts` as ESM using the specified `tsconfig`.
2. Mark `fsevents` as external while keeping the default externalization behaviour for others.
3. Cache the temp output in the given directory and emit cache events via `onEvent`.
