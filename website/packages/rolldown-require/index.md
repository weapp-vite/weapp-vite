---
title: rolldown-require Guide
description: rolldown-require bundles and then loads config files of any flavor
  (TS / MJS / CJS / JSX, etc.) using rolldown, so CLI …
keywords:
  - packages
  - rolldown
  - require
  - rolldown-require
  - guide
  - bundles
  - then
  - loads
---

# rolldown-require Guide

> Language: English | [中文](/packages/rolldown-require/index.zh)

`rolldown-require` bundles and then loads config files of any flavor (TS / MJS / CJS / JSX, etc.) using `rolldown`, so CLI tools or Node scripts can execute them safely. Its API mirrors `bundle-require` while reusing `rolldown` resolution and plugins to stay close to `rolldown-vite` runtime behaviour.

## What problems it solves

- **Cross-format loading**: infers entry module type automatically and works with ESM/CJS/TypeScript and more.
- **Consistent resolution**: follows Vite/rolldown resolution and externalization (including `module-sync`), avoiding require/import mismatches.
- **Source context preserved**: restores `__dirname`, `__filename`, and `import.meta.url` after bundling so temp output matches the source path.
- **Observable dependencies**: returns the dependency list from bundling, ready for watchers or cache validation.
- **Optional caching**: built-in persistent + in-memory cache to speed up repeated config loads.

## Install

```sh
pnpm add rolldown-require rolldown -D
# or npm / yarn / bun
```

> `rolldown` is a peer dependency and must be installed alongside.

## Quick start

```ts
import { bundleRequire } from 'rolldown-require'

const { mod, dependencies } = await bundleRequire({
  filepath: './vite.config.ts',
  cache: true, // optional: enable cache for faster reruns
})

// mod is the executed module (default export is unwrapped automatically)
// dependencies can drive a watcher to decide when to re-bundle
```

`bundleRequire` will:

1. Infer ESM/CJS from the entry path (override with `format` if needed).
2. Bundle the entry with `rolldown`, externalizing most `node_modules` to match `rolldown-vite` behaviour.
3. Execute the temp output (ESM via `import()`, CJS via `require`) and return the module plus dependency list.

## How it differs from bundle-require

- Uses `rolldown` as the bundler, matching the ecosystem and respecting conditional exports and module-sync flags.
- Injects file-scope variables so changing the temp output path does not break `__dirname`/`__filename`.
- Supports optional persistent and memory cache to reuse the same bundle across cold and warm starts.

## Next steps

- See [API & options](/packages/rolldown-require/options) for defaults and scenarios.
- Read [Loading flow & cache](/packages/rolldown-require/cache) for externalization details, temp files, and debugging tips.
