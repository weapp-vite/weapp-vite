# @weapp-core/schematics

## 6.0.2

### Patch Changes

- 🐛 **完善中文 JSDoc 与类型提示，提升 dts 智能提示体验。** [`f2d613f`](https://github.com/weapp-vite/weapp-vite/commit/f2d613fcdafd5de6bd145619f03d12b0b465688f) by @sonofmagic

## 6.0.1

### Patch Changes

- 🐛 **修复 vue-tsc 加载 weapp-vite/volar 的 CJS 兼容问题，并补充 schematics 的 CJS 产物。** [`d6bd490`](https://github.com/weapp-vite/weapp-vite/commit/d6bd490eb22cbc97614e7f0343c520b288ddc27c) by @sonofmagic

## 6.0.0

### Major Changes

- 🚀 **改为纯 ESM 产物，移除 CJS 导出，并将 Node 引擎版本提升至 ^20.19.0 || >=22.12.0。** [`eeca173`](https://github.com/weapp-vite/weapp-vite/commit/eeca1733e3074d878560abdb5b3378021dc02eda) by @sonofmagic
  - `vite.config.ts` 等配置请统一使用 ESM 写法，避免 `__dirname`/`require` 这类 CJS 语法。
  - `loadConfigFromFile` 在遇到 CJS 写法导致加载失败时，应提示：`XXX` 为 CJS 格式，需要改为 ESM 写法（可参考 `import.meta.dirname` 等用法）。

## 5.0.0

### Major Changes

- 🚀 **## unify-json-schema-source** [`488f8c4`](https://github.com/weapp-vite/weapp-vite/commit/488f8c4e62dcbd58a5b6823d97992680d077e4f7) by @sonofmagic
  统一 JSON Schema 定义来源，消除重复维护；移除编译产物中的 `$schema` 字段；修复 Vue SFC TypeScript 转换和运行时模块问题

  ### @weapp-core/schematics
  - 导出 `JSON_SCHEMA_DEFINITIONS`，供其他包使用
  - JSON Schema 现在只通过 Zod 在 `scripts/json.ts` 中维护单一数据源

## 4.0.1-alpha.0

### Patch Changes

- [`01d0ded`](https://github.com/weapp-vite/weapp-vite/commit/01d0dedec1ab85c0b7e5db0e87e82884f035ca15) Thanks [@sonofmagic](https://github.com/sonofmagic)! - 统一 JSON Schema 定义来源，消除重复维护；移除编译产物中的 `$schema` 字段；修复 Vue SFC TypeScript 转换和运行时模块问题

  ### @weapp-core/schematics
  - 导出 `JSON_SCHEMA_DEFINITIONS`，供其他包使用
  - JSON Schema 现在只通过 Zod 在 `scripts/json.ts` 中维护单一数据源

  ### @weapp-vite/volar
  - 删除手写的 JSON Schema 定义（约 230 行）
  - 改为从 `@weapp-core/schematics` 导入 `JSON_SCHEMA_DEFINITIONS`
  - 确保与 schematics 包的 schema 定义始终同步

  ### weapp-vite
  - Vue SFC `<json>` 块编译时自动移除 `$schema` 字段
  - `$schema` 字段仅用于编辑器智能提示，不应出现在编译产物中
  - 修复 TypeScript `as` 类型断言移除逻辑
  - 修复正则表达式错误删除属性值的问题
  - 修复运行时模块解析问题：将 `createWevuComponent` 代码内联到每个页面文件

## 4.0.0

### Major Changes

- [`284e0a2`](https://github.com/weapp-vite/weapp-vite/commit/284e0a29ea3fa3e66b8c2659eba40aea6ee893e0) Thanks [@sonofmagic](https://github.com/sonofmagic)! - - 重构生成器实现：拆分 App/Page/Component 等 JSON、WXML、JS 模板逻辑到独立模块，公开 API 保持不变
  - Schema 构建脚本改为内存生成，统一输出网站 JSON Schema 与 type.auto.ts，减少重复 I/O 并便于扩展

## 4.0.0-alpha.0

### Major Changes

- [`284e0a2`](https://github.com/weapp-vite/weapp-vite/commit/284e0a29ea3fa3e66b8c2659eba40aea6ee893e0) Thanks [@sonofmagic](https://github.com/sonofmagic)! - - 重构生成器实现：拆分 App/Page/Component 等 JSON、WXML、JS 模板逻辑到独立模块，公开 API 保持不变
  - Schema 构建脚本改为内存生成，统一输出网站 JSON Schema 与 type.auto.ts，减少重复 I/O 并便于扩展

## 3.0.0

### Major Changes

- [`b8e58c3`](https://github.com/weapp-vite/weapp-vite/commit/b8e58c38b0c95a2440601879e98511e08d90d821) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat!: 使用 zod@4 来生成 json schema 去除zod-to-json-schema 支持

## 2.0.1

### Patch Changes

- [`0ae2a53`](https://github.com/weapp-vite/weapp-vite/commit/0ae2a53198b8d3ab3e8a9ac18ee125e2017a8f51) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: change website url

## 2.0.0

### Major Changes

- [`32738e9`](https://github.com/weapp-vite/weapp-vite/commit/32738e92712d650cdc7651c63114464170d159a4) Thanks [@sonofmagic](https://github.com/sonofmagic)! - 更多详情见:

  https://vite.icebreaker.top/migration/v5.htm

## 1.1.0

### Minor Changes

- [`953b105`](https://github.com/weapp-vite/weapp-vite/commit/953b105562fc559ddd811f8dfffcd71c19eedfde) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat: 添加 `plugin.json` `schema` 为了插件开发

## 1.0.13

### Patch Changes

- [`e8d9e03`](https://github.com/weapp-vite/weapp-vite/commit/e8d9e03b9508eabde1a43245eecd3408a757413b) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore(deps): upgrade

## 1.0.12

### Patch Changes

- [`ce411f5`](https://github.com/weapp-vite/weapp-vite/commit/ce411f5ca65be7a2457223dc493e7d3f30b771f0) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: 更换 json $schema 引用地址以应对 dns 劫持污染

## 1.0.11

### Patch Changes

- [`e583052`](https://github.com/weapp-vite/weapp-vite/commit/e5830522ba086959ca5632a58e1d077a99ee0c56) Thanks [@sonofmagic](https://github.com/sonofmagic)! - fix: usingComponents -> Record<string,string>

## 1.0.10

### Patch Changes

- [`c70141a`](https://github.com/weapp-vite/weapp-vite/commit/c70141ab30b16b74e34055f2d6aff9f61332da81) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore(deps): upgrade

## 1.0.9

### Patch Changes

- [`f307755`](https://github.com/weapp-vite/weapp-vite/commit/f307755039eea6b316fe6918e9acf654f7e5c6b3) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: make sitemapLocation optional

## 1.0.8

### Patch Changes

- [`fc3afe3`](https://github.com/weapp-vite/weapp-vite/commit/fc3afe361e404e6eabfe587edf073cfad1024e10) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: update worker schema

## 1.0.7

### Patch Changes

- [`145e036`](https://github.com/weapp-vite/weapp-vite/commit/145e03624e6e205f8bd314ec4220e289d9a526f4) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat: add entry type

## 1.0.6

### Patch Changes

- [`cc9d70f`](https://github.com/weapp-vite/weapp-vite/commit/cc9d70fa8b359fe0202cac32eb36d20cf6b065bc) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat: 生成脚手架支持 dirs 和 filenames 配置

## 1.0.5

### Patch Changes

- [`0e2c9cb`](https://github.com/weapp-vite/weapp-vite/commit/0e2c9cb24c5a7dd803aaded340820ed4a1522f52) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat: 支持 Skyline 全局工具栏 appBar

## 1.0.4

### Patch Changes

- [`33933ad`](https://github.com/weapp-vite/weapp-vite/commit/33933ad2059a142a28df488bffbf6939d2f6ad1b) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat: 优化 schematics dts 的结构

## 1.0.3

### Patch Changes

- [`5488a42`](https://github.com/weapp-vite/weapp-vite/commit/5488a42dcd9b6848f29c9f0ac5797d3330165901) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: 额外导出 Sitemap 和 Theme 对象

## 1.0.2

### Patch Changes

- [`f0523bc`](https://github.com/weapp-vite/weapp-vite/commit/f0523bc120655282fa411380c8fc227632f1460e) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: 组件默认 styleIsolation 为 apply-shared

## 1.0.1

### Patch Changes

- [`e0f4c38`](https://github.com/weapp-vite/weapp-vite/commit/e0f4c386823ec99c653ad2b5e1cbf4344ac632b4) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat: 添加 sitemap.json 和 theme.json 的 $schema 支持

## 1.0.0

### Major Changes

- [`1d84143`](https://github.com/weapp-vite/weapp-vite/commit/1d8414388e2fb18d4ccec0d743de787d934e772e) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat: 正式 release `@weapp-core/schematics`
