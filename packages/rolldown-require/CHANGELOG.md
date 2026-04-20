# rolldown-require

## 2.0.14

### Patch Changes

- 🐛 **基于 pnpm-workspace.yaml 中 catalog 版本变更，自动补充发布记录。** [`624f9ee`](https://github.com/weapp-vite/weapp-vite/commit/624f9ee0bf09d9cf5a5d0815cbff1aa094cdd702) by @sonofmagic
  - 默认 catalog 变更键：@icebreakers/eslint-config, @vue/language-core, rolldown, vite, vue-tsc。命名 catalog 变更键：无。

## 2.0.13

### Patch Changes

- 🐛 **同步 `create-weapp-vite` 内置模板的依赖版本，升级 ESLint/Stylelint 配置与部分示例请求依赖；同时更新 `rolldown-require` 的 `rolldown` 兼容版本声明，跟进最新 `rolldown` 版本。** [`0cc4a6e`](https://github.com/weapp-vite/weapp-vite/commit/0cc4a6e8a604f160a14ce1a7868b079cad166522) by @sonofmagic

## 2.0.12

### Patch Changes

- 🐛 **修复 Windows 环境下的路径与包元数据兼容问题。`weapp-vite` 现在会将 watch file 路径统一规范化为 POSIX 形式，避免布局与依赖监听在 Windows 上产出反斜杠路径；`rolldown-require` 现在会在读取 `package.json` 时自动去除 UTF-8 BOM，避免部分环境下解析版本信息时报 JSON 语法错误。** [#367](https://github.com/weapp-vite/weapp-vite/pull/367) by @sonofmagic

## 2.0.11

### Patch Changes

- 🐛 **补发 `rolldown-require` patch 版本，确保其发布版本的 `rolldown` peer 约束与仓库当前使用的 `rolldown@1.0.0-rc.11` 保持一致，避免下游安装时出现误导性的版本告警。** [`0066308`](https://github.com/weapp-vite/weapp-vite/commit/0066308e1af282e9bc204143e685c54edd490f41) by @sonofmagic

- 🐛 **修复新建项目在使用 Yarn 安装依赖时的 `rolldown` peer dependency 警告。`weapp-vite` 现将 `rolldown-plugin-dts` 回退到与 `rolldown@1.0.0-rc.11` 兼容的 `0.22.5`，并同步重新发布 `rolldown-require` 与 `create-weapp-vite`，确保脚手架默认生成项目的依赖版本保持一致，减少安装期的误导性告警。** [`60487a4`](https://github.com/weapp-vite/weapp-vite/commit/60487a4e9ea8057c4b3b6952870ab94355a20cc8) by @sonofmagic

## 2.0.10

### Patch Changes

- 🐛 **同步升级 `weapp-vite` 与 `rolldown-require` 对 `rolldown@1.0.0-rc.11` 的依赖约束，并更新部分 Vue 3.5.31、`tsdown` 等构建链路依赖版本，减少脚手架与实际构建环境之间的版本漂移。** [`3094be8`](https://github.com/weapp-vite/weapp-vite/commit/3094be81a5c569237425602388b7a7a579cdbce0) by @sonofmagic

## 2.0.9

### Patch Changes

- 🐛 **升级 `rolldown-require` 对 `get-tsconfig` 的依赖版本，并完成构建与测试验证。该升级用于保持 tsconfig 解析链路与上游兼容性，包含 `tsconfig paths` 在内的现有解析行为未出现回归。** [`aae675c`](https://github.com/weapp-vite/weapp-vite/commit/aae675c4084864f16d74cce1d0f19592d6abf0c6) by @sonofmagic

## 2.0.8

### Patch Changes

- 🐛 **将仓库内原先使用 `tsup` 的发布包统一迁移到 `tsdown` 构建链路，并按现有产物约定保留对应的 ESM/CJS 输出后缀、声明文件生成与多入口导出结构。其中 `@weapp-vite/web` 额外改为由 `tsdown` 负责 JavaScript 产物、`tsc --emitDeclarationOnly` 负责类型声明，以规避当前 `rolldown-plugin-dts` 在该包上的类型生成异常，确保迁移后各包的发布结果与现有消费方式保持兼容。** [`d49d790`](https://github.com/weapp-vite/weapp-vite/commit/d49d79011253552daf088695bb52d158816dfec8) by @sonofmagic

## 2.0.7

### Patch Changes

- 🐛 **将 `rolldown-require` 的 `rolldown` peer 依赖最低版本提升到 `1.0.0-rc.9`，并为 `weapp-vite` 增加安装时的真实 rolldown 版本检查与运行时版本判断修复，避免工作区继续解析旧的 `1.0.0-rc.3`，同时同步 `create-weapp-vite` 的模板依赖目录版本。** [`88b2d31`](https://github.com/weapp-vite/weapp-vite/commit/88b2d316fe1238ea928abf7d63d0cb63ae29e1e8) by @sonofmagic

## 2.0.6

### Patch Changes

- 🐛 **chore: upgrade get-tsconfig to 4.13.5** [`7f1a2b5`](https://github.com/weapp-vite/weapp-vite/commit/7f1a2b5de1f22d5340affc57444f7f01289fa7b4) by @sonofmagic

## 2.0.5

### Patch Changes

- 🐛 **chore: "rolldown": ">=1.0.0-rc.3"** [`b15f16f`](https://github.com/weapp-vite/weapp-vite/commit/b15f16f9cc1c3f68b8ec85f54dcd00ccfe389603) by @sonofmagic

## 2.0.4

### Patch Changes

- 🐛 **完善中文 JSDoc 与类型提示，提升 dts 智能提示体验。** [`f2d613f`](https://github.com/weapp-vite/weapp-vite/commit/f2d613fcdafd5de6bd145619f03d12b0b465688f) by @sonofmagic

## 2.0.3

### Patch Changes

- 🐛 **升级多处依赖版本（Babel 7.29、oxc-parser 0.112、@vitejs/plugin-vue 6.0.4 等）。** [`8143b97`](https://github.com/weapp-vite/weapp-vite/commit/8143b978cc1bbc41457411ffab007ef20a01f628) by @sonofmagic
  - 同步模板与示例的 tdesign-miniprogram、weapp-tailwindcss、autoprefixer 等版本，确保脚手架默认依赖一致。

## 2.0.2

### Patch Changes

- 🐛 **Add sourcemap support for debugging with automatic inline mode and tests.** [`0f4dcbf`](https://github.com/weapp-vite/weapp-vite/commit/0f4dcbf91630b3c0222ac5602b148ee5d500dd17) by @sonofmagic

- 🐛 **Optimize externalization resolution and cache checks; remove unused resolver dependencies.** [`f4ae9e2`](https://github.com/weapp-vite/weapp-vite/commit/f4ae9e20b9822df6febd9ef4cea76292d095eb2e) by @sonofmagic

- 🐛 **Add cache precheck to skip bundling on valid hits and extend test coverage.** [`bbadce5`](https://github.com/weapp-vite/weapp-vite/commit/bbadce58b77a11fdfa37680f57a18495b87e0deb) by @sonofmagic

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
