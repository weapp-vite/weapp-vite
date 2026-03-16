# @weapp-core/shared

## 3.0.2

### Patch Changes

- 🐛 **将仓库内原先使用 `tsup` 的发布包统一迁移到 `tsdown` 构建链路，并按现有产物约定保留对应的 ESM/CJS 输出后缀、声明文件生成与多入口导出结构。其中 `@weapp-vite/web` 额外改为由 `tsdown` 负责 JavaScript 产物、`tsc --emitDeclarationOnly` 负责类型声明，以规避当前 `rolldown-plugin-dts` 在该包上的类型生成异常，确保迁移后各包的发布结果与现有消费方式保持兼容。** [`d49d790`](https://github.com/weapp-vite/weapp-vite/commit/d49d79011253552daf088695bb52d158816dfec8) by @sonofmagic

## 3.0.1

### Patch Changes

- 🐛 **完善中文 JSDoc 与类型提示，提升 dts 智能提示体验。** [`f2d613f`](https://github.com/weapp-vite/weapp-vite/commit/f2d613fcdafd5de6bd145619f03d12b0b465688f) by @sonofmagic

## 3.0.0

### Major Changes

- 🚀 **改为纯 ESM 产物，移除 CJS 导出，并将 Node 引擎版本提升至 ^20.19.0 || >=22.12.0。** [`eeca173`](https://github.com/weapp-vite/weapp-vite/commit/eeca1733e3074d878560abdb5b3378021dc02eda) by @sonofmagic
  - `vite.config.ts` 等配置请统一使用 ESM 写法，避免 `__dirname`/`require` 这类 CJS 语法。
  - `loadConfigFromFile` 在遇到 CJS 写法导致加载失败时，应提示：`XXX` 为 CJS 格式，需要改为 ESM 写法（可参考 `import.meta.dirname` 等用法）。

## 2.0.1

### Patch Changes

- [`7a8a130`](https://github.com/weapp-vite/weapp-vite/commit/7a8a130aff74304bb59ca9d2783783c81850c3f0) Thanks [@sonofmagic](https://github.com/sonofmagic)! - fix: [#129](https://github.com/weapp-vite/weapp-vite/issues/129)

  修复 `autoImportComponents` 功能并未按预期自动导入并编译问题

## 2.0.0

### Major Changes

- [`32738e9`](https://github.com/weapp-vite/weapp-vite/commit/32738e92712d650cdc7651c63114464170d159a4) Thanks [@sonofmagic](https://github.com/sonofmagic)! - 更多详情见:

  https://vite.icebreaker.top/migration/v5.htm

## 1.0.8

### Patch Changes

- [`e8d9e03`](https://github.com/weapp-vite/weapp-vite/commit/e8d9e03b9508eabde1a43245eecd3408a757413b) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore(deps): upgrade

## 1.0.7

### Patch Changes

- [`bbd3334`](https://github.com/weapp-vite/weapp-vite/commit/bbd3334758fa3b6fb8fc0571957d2a4a51ab1a1c) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat: add isEmptyObject method

## 1.0.6

### Patch Changes

- [`c70141a`](https://github.com/weapp-vite/weapp-vite/commit/c70141ab30b16b74e34055f2d6aff9f61332da81) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore(deps): upgrade

## 1.0.5

### Patch Changes

- [`8682d07`](https://github.com/weapp-vite/weapp-vite/commit/8682d07cb9e9fb34acf1ce8c38756d38c005cd35) Thanks [@sonofmagic](https://github.com/sonofmagic)! - fix: build error and add semver/functions/parse as dep

## 1.0.5-alpha.0

### Patch Changes

- [`8682d07`](https://github.com/weapp-vite/weapp-vite/commit/8682d07cb9e9fb34acf1ce8c38756d38c005cd35) Thanks [@sonofmagic](https://github.com/sonofmagic)! - fix: build error and add semver/functions/parse as dep

## 1.0.4

### Patch Changes

- [`c11d076`](https://github.com/weapp-vite/weapp-vite/commit/c11d07684c4592700a1141f2dc83dc3ce08c6676) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat: add removeExtensionDeep

## 1.0.3

### Patch Changes

- [`1596334`](https://github.com/weapp-vite/weapp-vite/commit/159633422903bf3b5a5a3015bc0c495ec672c308) Thanks [@sonofmagic](https://github.com/sonofmagic)! - fix: object-hash import error

## 1.0.2

### Patch Changes

- [`e15adce`](https://github.com/weapp-vite/weapp-vite/commit/e15adce483e9b47ef836680df49321db5431ac31) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat: add objectHash function

## 1.0.1

### Patch Changes

- f7a2d5d: fix: watcher do not close error

## 1.0.0

### Major Changes

- 36f5a7c: release major version

### Patch Changes

- 80ce9ca: `@weapp-ide-cli` cjs -> esm ( `type: module` ) (BREAKING CHANGE!)

  `weapp-vite` use `@weapp-ide-cli`

  `vite.config.ts` support

  enhance `@weapp-core/init`

- 0fc5083: release alpha
- f22c535: chore: compact for `weapp-vite`
- 2b7be6d: feat: add serve watch files

## 1.0.0-alpha.4

### Major Changes

- 36f5a7c: release major version

## 0.0.2-alpha.3

### Patch Changes

- 792f50c: chore: compact for `weapp-vite`

## 0.0.2-alpha.2

### Patch Changes

- ffa21da: `@weapp-ide-cli` cjs -> esm ( `type: module` ) (BREAKING CHANGE!)

  `weapp-vite` use `@weapp-ide-cli`

  `vite.config.ts` support

  enhance `@weapp-core/init`

## 0.0.2-alpha.1

### Patch Changes

- a4adb3f: feat: add serve watch files

## 0.0.2-alpha.0

### Patch Changes

- f28a193: release alpha

## 0.0.1

### Patch Changes

- f01681a: release version
