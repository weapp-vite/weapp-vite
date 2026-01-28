# wevu-compiler Migration Design

## Overview

Move the pure Vue SFC compilation pipeline and wevu page-features analysis from `packages/weapp-vite` into `packages/wevu-compiler`. Keep Vite plugins and IO glue in `weapp-vite`. Expose compiler APIs via `wevu/compiler`, backed by `@wevu/compiler`, so `weapp-vite` depends only on `wevu` and no longer aligns versions with `weapp-vite`.

## Goals

- Centralize SFC compilation and wevu feature analysis in `@wevu/compiler`.
- `wevu` depends on `@wevu/compiler` and re-exports it from `wevu/compiler`.
- `weapp-vite` consumes `wevu/compiler` APIs for existing behavior with minimal change.
- Preserve output equivalence (template/script/style/config) and page feature injection.

## Non-Goals

- Moving Vite plugin wiring, caching, or FS emission from `weapp-vite`.
- Changing the external behavior of `weapp-vite` or `wevu` runtime APIs.

## Architecture

- `packages/wevu-compiler`
  - `src/sfc/*`: SFC parsing, compile pipeline (template/script/style/config), JSON macro eval, JSON merge.
  - `src/script/*`: AST transforms for SFC output and runtime injection.
  - `src/template/*`: WXML compiler and platform helpers.
  - `src/page-features/*`: hooks analysis and feature injection.
  - `src/utils/*`: babel, path, sfc-src resolving, builtin component list.
  - `src/index.ts`: public compiler exports.
- `packages/wevu`
  - `src/compiler/index.ts`: re-export from `@wevu/compiler`.
- `packages/weapp-vite`
  - Vite plugin layer calls `wevu/compiler` instead of internal modules.

## API Surface (compiler)

- SFC compile: `compileSfc`, `parseSfc`, `compileTemplate`, `compileStyle`, `compileConfig`, `transformScript`, `finalizeSfc`.
- Types: `SfcCompileOptions`, `SfcCompileResult`, `TemplateCompileOptions`.
- Page features: `collectPageFeatureFlags`, `injectPageFeatures`, `injectPageFeaturesWithResolver`, `createPageEntryMatcher`, `WevuPageFeatureFlag`, `ModuleResolver`.
- Constants: `WE_VU_MODULE_ID`, `WE_VU_RUNTIME_APIS`, `WE_VU_PAGE_HOOK_TO_FEATURE`.

## Data Flow

1. `weapp-vite` Vite plugin reads `.vue` source.
2. Calls `compileSfc` from `wevu/compiler` with options.
3. Uses `script/template/style/config` outputs as before.
4. Page feature injection done via `injectPageFeaturesWithResolver`.

## Logging / Warnings

- Replace `weapp-vite` logger dependency with optional `warn` callbacks in compiler options.
- Default to `console.warn` if no callback is provided.

## Testing Strategy

- Move unit tests for SFC compile and page features to `packages/wevu-compiler/test`.
- Keep `weapp-vite` Vite-plugin integration tests to validate wiring.

## Migration Steps

1. Create `@wevu/compiler` code structure and move compiler modules.
2. Replace weapp-vite internal imports with `wevu/compiler` calls.
3. Add `@wevu/compiler` dependency to `wevu` and re-export.
4. Update types and warnings to avoid `weapp-vite` logger coupling.
5. Move/update tests and ensure outputs match.
