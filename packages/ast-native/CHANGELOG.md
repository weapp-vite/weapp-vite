# @weapp-vite/ast-native

## 0.1.2

### Patch Changes

- 自动补充依赖升级发布记录。
  涉及包：
  - @mpcore/vitest：devDependencies.vitest
  - @weapp-vite/ast-native：devDependencies.@napi-rs/cli、devDependencies.vitest
  - @weapp-vite/eslint：devDependencies.vitest

## 0.1.1

### Patch Changes

- 将模板与 JSX 的 `warnings` 升级为带 code、severity 和 loc 的结构化 `diagnostics`，并支持完整 SFC 源码定位。同步补充 Vue 语义对齐与 fuzz 回归，移除无稳定收益的 native SFC 接入，优化诊断热路径和编译器分发体积。

## 0.1.0

### Minor Changes

- 将 SFC HMR 语义下沉到 `@wevu/compiler`，新增 script、template、style、config block 级签名与变更分类，并扩展可选 native 载荷保持同构回退。`weapp-vite` 仅保存编译器快照并继续通过 `ModuleGraphService` 传播失效；脚本文本候选分析统一由 `@weapp-vite/ast` 提供。

## 0.0.8

### Patch Changes

- 将包主页、随包文档、脚手架默认链接与小程序 JSON Schema 地址统一迁移到 `vite.weapp.dev`，确保新生成项目和公开元数据使用新的文档主域名。

## 0.0.7

### Patch Changes

- 基于 pnpm-workspace.yaml 中 catalog 版本变更，自动补充发布记录。
  默认 catalog 变更键：@vue/language-core, eslint, vue-tsc。命名 catalog 变更键：无。

## 0.0.6

### Patch Changes

- 升级 Oxc 与 Vitest 依赖，并将脚手架模板使用的 weapp-tailwindcss 版本同步至 5.3.1，确保发布包和新建项目采用一致的依赖基线。

## 0.0.5

### Patch Changes

- 🐛 **自动补充依赖升级发布记录。** [`4197538`](https://github.com/weapp-vite/weapp-vite/commit/4197538abacf278136db75cdb1e84c4cfb88c5a8) by @sonofmagic
  涉及包：
  - @weapp-vite/ast：dependencies.@oxc-project/types
  - @weapp-vite/ast-native：devDependencies.@napi-rs/cli

## 0.0.4

### Patch Changes

- 🐛 **升级除 TypeScript 外的依赖与 pnpm，并适配 Vite 8 的 OXC JSX 转换：已有 `esbuild.jsx: 'preserve'` 配置会同步到 OXC，避免 Wevu JSX 被误转换为 React runtime。** [#772](https://github.com/weapp-vite/weapp-vite/pull/772) by @sonofmagic
  升级至 `weapp-tailwindcss@5.2.11`，采用上游对 Tailwind v4 生成器 module ID 查询的统一清理，避免 `weapp-vite` 样式 sidecar 虚拟模块 ID 被当作磁盘路径读取，确保原生模板、脚本和样式增量更新正常输出。

  涉及包：
  - @wevu/api：dependencies.@douyin-microapp/typings
  - @weapp-vite/web：dependencies.rolldown
  - @weapp-vite/ast：dependencies.@oxc-project/types
  - @weapp-vite/ast-native：devDependencies.@napi-rs/cli
  - @weapp-vite/dashboard：devDependencies.@iconify/tailwind4
  - @weapp-vite/miniprogram-automator：dependencies.ws
  - rolldown-require：dependencies.get-tsconfig
  - weapp-ide-cli：dependencies.execa
  - weapp-vite：dependencies.@vercel/detect-agent、dependencies.rolldown-plugin-dts
  - create-weapp-vite：基于 weapp-vite / wevu 的依赖升级联动更新脚手架模板

## 0.0.3

### Patch Changes

- 🐛 **基于 pnpm-workspace.yaml 中 catalog 版本变更，自动补充发布记录。** [`98aa0bc`](https://github.com/weapp-vite/weapp-vite/commit/98aa0bcce2aa02df4ef6760f382143240dd76c17) by @sonofmagic
  - 默认 catalog 变更键：@types/node, miniprogram-api-typings, oxc-parser, postcss, tailwind-variants, weapp-tailwindcss。命名 catalog 变更键：latest(miniprogram-api-typings)；weapp-tailwindcss-fixed(weapp-tailwindcss)。

## 0.0.2

### Patch Changes

- 🐛 **基于 pnpm-workspace.yaml 中 catalog 版本变更，自动补充发布记录。** [`71e0e70`](https://github.com/weapp-vite/weapp-vite/commit/71e0e70cc7a466d67236a406d47f261ac57c815b) by @sonofmagic
  - 默认 catalog 变更键：@vue/language-core, oxc-parser, postcss, rolldown, sass, stylelint, vue-tsc, weapp-tailwindcss。命名 catalog 变更键：weapp-tailwindcss-fixed(weapp-tailwindcss)。
  - 同时适配 Monaco Editor 0.56 的 worker 公开入口，恢复 Dashboard 构建。

## 0.0.1

### Patch Changes

- 🐛 **新增可选的 native AST 批量分析与性能评估能力，将同一份脚本上的多项静态检查合并为一次 JS 与 Rust 通信和一次解析，并在 bundle rewrite 热路径复用分析缓存。native binding 未配置、加载失败或执行失败时继续回退 Babel、Oxc 与 Vue compiler 路径，保持现有构建兼容性。** [`1f62703`](https://github.com/weapp-vite/weapp-vite/commit/1f62703e60b9db5223ef349ad4dff7ac4f16bdfc) by @sonofmagic
