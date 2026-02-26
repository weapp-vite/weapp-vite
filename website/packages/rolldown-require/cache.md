---
title: Loading flow & cache
description: This page outlines how bundleRequire bundles, writes, and loads
  under the hood, plus practical cache settings.
keywords:
  - 调试
  - packages
  - rolldown
  - require
  - cache
  - loading
  - flow
  - "&"
---

# Loading flow & cache

> Language: English | [中文](/packages/rolldown-require/cache.zh)

This page outlines how `bundleRequire` bundles, writes, and loads under the hood, plus practical cache settings.

## End-to-end flow

1. **Resolve entry**: turn `filepath` + `cwd` into an absolute path and infer `format` from the extension/`package.json.type` (overrideable).
2. **Bundle with rolldown**:
   - Fix `platform: 'node'`, `inlineDynamicImports: true`, `treeshake: false` to emit a single entry output and collect dependencies.
   - Inject `__dirname`/`__filename`/`import.meta.url` so runtime code sees the real source path.
   - Externalize most `node_modules` via the externalize-deps plugin, keep JSON inlined, and respect `module-sync` conditions.
3. **Execute the temp output**:
   - ESM: write a temp `.mjs`/`.cjs` or data URL, then `import()` it.
   - CJS: compile the source via a temporary `_require.extensions` hook.
4. **Return results**: provide `mod` plus `dependencies` (excluding the entry) for watching or debugging.

## Externalization & resolution

- Resolution aligns with Vite/rolldown: same main-field priority and `tsconfig` path support (when enabled).
- Node built-ins and `node:`/`npm:` namespace imports are marked external.
- Dependencies inside nested `node_modules` under the entry directory are inlined to keep the temp output runnable.
- JSON resources are always handled by rolldown (never externalized).

## Temp output control

- Defaults to the nearest `node_modules/.rolldown-require`; falls back to the system temp dir. Filenames include a random hash to avoid contention.
- Customize the path via `getOutputFile`; set `preserveTemporaryFile: true` to skip cleanup for direct inspection.
- If all disk attempts fail for ESM, it falls back to a `data:` URL.

## Cache strategy

Caching is off by default. Set `cache: true` or pass an object to enable persistent + in-memory cache:

- **Location**: nearest `node_modules/.rolldown-require-cache`, else `os.tmpdir()/rolldown-require-cache`; override with `cache.dir`.
- **Cache key**: entry path, `mtime`/`size`, `format`, `tsconfig` path, Node version, and a hash of `rolldownOptions`.
- **Validation**: after a hit, each entry/dependency `mtime`/`size` is compared; any change invalidates the cache.
- **Memory cache**: on by default (`cache.memory !== false`); returns the loaded module directly to avoid extra fs I/O.
- **Reset & events**:
  - `cache.reset: true` removes prior code/meta before writing.
  - `cache.onEvent` receives `hit`/`miss`/`store`/`skip-invalid`; `skip-invalid.reason` may be `missing-entry`, `format-mismatch`, `stale-deps`, etc.

Example: log cache events and set a custom directory

```ts
await bundleRequire({
  filepath: './config/vite.config.ts',
  cache: {
    enabled: true,
    dir: './.cache/rolldown-require',
    onEvent: (e) => {
      console.log(`[cache] ${e.type}`, e)
    },
  },
})
```

## Debugging tips

- Watch `dependencies` to decide when to call `bundleRequire` again.
- Pair with `preserveTemporaryFile: true` to inspect temp code, or compare `*.code.mjs/cjs` directly inside the cache dir.
- To debug suspicious hits, temporarily set `cache.reset: true` or disable cache entirely.
- When the entry extension and `package.json.type` disagree, pass `format` explicitly to avoid Node/rolldown differences.
