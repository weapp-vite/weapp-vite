# Rolldown-Require Performance Notes

## Scope

This note focuses on cold-start and rebuild performance for `rolldown-require`
while staying compatible with rolldown `1.0.0-rc.2`.

## Rolldown Core Behaviors That Matter

- Resolver caching: `rolldown_resolver::Resolver` owns multiple resolver variants
  (import/require/new-url/css) and keeps a `package_json_cache` keyed by real
  path. The cache is cleared only when the bundler is closed.
- Scan stage caching: `ScanStageCache` persists module graph data, resolved
  import records, barrel state, and AST indices across incremental builds. This
  cache also lives for the lifetime of the bundler instance.
- Resolver config: `ResolverConfig` builds condition lists, mainFields, and
  extensions per platform and import kind. Using its resolver avoids repeating
  JavaScript-side resolution work.

Implication: most performance wins come from reusing the resolver and avoiding
duplicated resolution logic in JavaScript, especially on cold starts.

## Changes Applied In This Refactor (Plan A)

1. **Use the rolldown resolver for externalization.**
   - The externalize plugin now calls `this.resolve(...)` with `kind` and
     `skipSelf: true` instead of running its own JS resolver.
   - This reuses the Rust resolver cache and removes duplicate resolve work.

2. **Avoid extra `createRequire(...).resolve` when a resolved path is already
   available.**
   - Externalization decisions now accept a resolved path and only fall back to
     `createRequire` if needed.

3. **Memoize externalization decisions and entry resolve checks.**
   - A small in-plugin cache reduces repeated filesystem scans and repeated
     decisions within a single build.

4. **Preserve `module-sync` condition at the resolver level.**
   - When `#module-sync-enabled` resolves to true, the condition is injected
     into rolldown's resolve options so Rust-side resolution sees it.

These changes target cold-start overhead first, and also reduce rebuild cost
by cutting repeat resolution work.

## Follow-Up Ideas (Not Implemented Here)

- **Skip bundling on valid cache hits** by storing dependency lists in cache
  metadata and validating them before running the bundler.
- **Bundler instance reuse** or **incremental build** (`experimental.incrementalBuild`)
  to retain `ScanStageCache` across calls for large rebuild wins.
- **Prune unused JS resolver code** if no longer referenced at runtime to shrink
  dependency surface and reduce install time.

## Files Touched By This Refactor

- `packages/rolldown-require/src/externalize.ts`
- `packages/rolldown-require/src/bundler.ts`
