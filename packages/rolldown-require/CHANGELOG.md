# rolldown-require

## 2.0.1

### Patch Changes

- 🐛 **新增 multiPlatform 多平台配置支持，允许按平台加载 `project.config` 并支持 `--project-config` 覆盖路径。** [`763e936`](https://github.com/weapp-vite/weapp-vite/commit/763e9366831f17042592230d7f0d09af9df53373) by @sonofmagic
  - 补充 `LoggerConfig`/`WeappWebConfig` 的 JSDoc 示例，提升 IDE 提示体验。 避免 rolldown-require 在配置 `codeSplitting` 时触发 `inlineDynamicImports` 的警告。

- 🐛 **对齐 `watch`/`watchEffect` 的 `flush`/`scheduler`/`once`/`deep:number` 行为与类型，并补充 `traverse` 分支覆盖；修复 rolldown-require 的类型构建错误。** [`28ea55d`](https://github.com/weapp-vite/weapp-vite/commit/28ea55d72429fd416502d80fa9819c099fe16dd3) by @sonofmagic

## 2.0.0

### Major Changes

- 🚀 **改为纯 ESM 产物，移除 CJS 导出，并将 Node 引擎版本提升至 ^20.19.0 || >=22.12.0。** [`eeca173`](https://github.com/weapp-vite/weapp-vite/commit/eeca1733e3074d878560abdb5b3378021dc02eda) by @sonofmagic
  - `vite.config.ts` 等配置请统一使用 ESM 写法，避免 `__dirname`/`require` 这类 CJS 语法。
  - `loadConfigFromFile` 在遇到 CJS 写法导致加载失败时，应提示：`XXX` 为 CJS 格式，需要改为 ESM 写法（可参考 `import.meta.dirname` 等用法）。

## 1.0.6

### Patch Changes

- [`1a71186`](https://github.com/weapp-vite/weapp-vite/commit/1a711865b415a0197e1b7017b98fb22a573bb8a6) Thanks [@sonofmagic](https://github.com/sonofmagic)! - Fix bundle loading cache flow by validating in-memory meta, guarding cache writes when require fails, and keeping memory entries in sync with on-disk metadata to avoid stale hits.

- [`adec557`](https://github.com/weapp-vite/weapp-vite/commit/adec557eaf08d9d0c05e55e5be20f05d4b3a8941) Thanks [@sonofmagic](https://github.com/sonofmagic)! - add benchmark harness vs unrun (in separate bench package), document results/conclusions, and improve bare import externalization (nested node_modules awareness)

- [`fa4bce0`](https://github.com/weapp-vite/weapp-vite/commit/fa4bce0dfd628a791f49f9249e0e05f54f76b6d7) Thanks [@sonofmagic](https://github.com/sonofmagic)! - add persistent cache option with temp fallback, update docs, and cover cache/temp output with tests; fix TS types for cache path

- [`fa4bce0`](https://github.com/weapp-vite/weapp-vite/commit/fa4bce0dfd628a791f49f9249e0e05f54f76b6d7) Thanks [@sonofmagic](https://github.com/sonofmagic)! - Refactor rolldown-require into smaller modules, tidy lint warnings, and keep bundle/load exports unchanged.

- [`a560261`](https://github.com/weapp-vite/weapp-vite/commit/a5602611084a55c09ada38c7b5eafd8e376a44b5) Thanks [@sonofmagic](https://github.com/sonofmagic)! - fix externalization helper call signature, add persistent cache (validated by mtime/size, default dir with fallbacks), harden temp output fallback (node_modules/.rolldown-require -> tmp -> data URL), and silence intended console warn patch block

## 1.0.5

### Patch Changes

- [`352554a`](https://github.com/weapp-vite/weapp-vite/commit/352554ad802d1e5a1f4802a55dd257a9b32d1d18) Thanks [@sonofmagic](https://github.com/sonofmagic)! - Re-route the injected globals through `transform.define` and filter rolldown's legacy warnings so esbuild 0.25 builds run cleanly.

## 1.0.4

### Patch Changes

- [`32949af`](https://github.com/weapp-vite/weapp-vite/commit/32949afff0c5cd4f410062209e504fef4cc56a4a) Thanks [@sonofmagic](https://github.com/sonofmagic)! - Refactor the bundler core, prune unused utilities, and add new dependency graph coverage to keep behaviour well-defined.

  重构打包核心，清理未使用的工具方法，并补充依赖图相关测试，确保行为更明确。

## 1.0.3

### Patch Changes

- [`2bda01c`](https://github.com/weapp-vite/weapp-vite/commit/2bda01c969c33c858e3dd30f617de232ba149857) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore(rolldown-require): upgrade deps

## 1.0.2

### Patch Changes

- [`1ad45c3`](https://github.com/weapp-vite/weapp-vite/commit/1ad45c3f36e8e23a54b15afc81a0b81a94c7acb7) Thanks [@sonofmagic](https://github.com/sonofmagic)! - - feat(rolldown-require): add `rolldownOptions` `input` and `output` options
  - chore: set `rolldown` `outputOptions.exports` default value as `named`

## 1.0.1

### Patch Changes

- [`e2cd39d`](https://github.com/weapp-vite/weapp-vite/commit/e2cd39def4b893c8f06be955fafe55744365b810) Thanks [@sonofmagic](https://github.com/sonofmagic)! - fix: set `#module-sync-enabled` as `external`

  chore: add home page url and npm keywords
