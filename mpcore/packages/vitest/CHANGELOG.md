# @mpcore/vitest

## 1.0.0

### Major Changes

- feat(engines)!: 将框架及编译依赖链的 Node.js 支持范围对齐为 `^22.18.0 || ^24.11.0 || >=26.0.0`，不再承诺 Node 20、23、25 或低于最低补丁版本的环境。CLI 在加载构建依赖前读取发布包声明并明确拒绝不支持的运行时；发布消费检查覆盖三系统最低版本和当前支持的 LTS 补丁版本。已有项目请先升级 Node.js；脚手架自身仍要求 Node 22.22.2、24.15.0 或 26 及以上版本，不降低其依赖所需版本。

### Minor Changes

- feat(mpcore): 新增中立产物构建与监听接口，以及不会加载测试线程 runtime 的 Vitest 配置入口。

  - 新增中立构建/监听与不会加载测试线程 runtime 的 Vitest 配置入口，当前项目注入产物并在更新完成后重跑自身用例；无参 fixture 创建独立 runtime，不重复合并 setup，关闭等待异步启动、回调及所属 watcher。

### Patch Changes

- chore(deps): 合并本轮 catalog、生产依赖和构建工具链升级，联动所有受影响可发布包及脚手架，保持现有公开 peer 范围和各包声明的最低运行环境。

  - 同步 Vite、Rolldown、Babel、Oxc、Devframe、Sass、Tailwind 引擎、AI/MCP SDK、CLI 依赖及工作区锁文件；脚手架模板 catalog、React SWC 和生成 AI 指引随构建基线更新。
  - Rust Oxc/N-API 适配新版解析结果与箭头函数 AST，保留批量分析、嵌套函数边界及可选 native 回退。
  - 对齐 React 19.3 / reconciler 0.34 所需异步提交 hook，修复 `startTransition` 因缺失宿主方法而失败。
  - 适配新版 Vite 样式客户端，防止 DOM 客户端进入小程序 stateful HMR 产物；迁移 Vite/Rolldown 生命周期补丁并接入上游 macOS 原生 watch 修复，减少连续保存和拓扑更新丢失事件。
  - 适配上游 stateful ESM 图及内联 helper，在原生输出 hook 保留宿主 CommonJS 格式、sourcemap 和完整 runtime 契约。
  - 更新 uview-plus 与兼容矩阵，保留 `u-flex` / `up-flex` 自动导入、组件交互及 `u-video` 覆盖；条码 nextTick 补丁因上游已修复而移除。
  - 更新 repoctl 并移除上游已实现的发布补丁，保留 catalog 消费者、共享 constants 依赖和固定版本组的联动发布。

- Updated dependencies:
  - @mpcore/test@1.0.0

## 0.2.7

### Patch Changes

- 基于 pnpm-workspace.yaml 中 catalog 版本变更，自动补充发布记录。
  默认 catalog 变更键：weapp-tailwindcss。命名 catalog 变更键：weapp-tailwindcss-fixed(weapp-tailwindcss)。

- 自动补充依赖升级发布记录。
  涉及包：
  - @weapp-vite/glass-easel-web-adapter：dependencies.glass-easel-template-compiler
  - @weapp-vite/ast：dependencies.@oxc-project/types
  - @weapp-vite/eslint：devDependencies.@typescript-eslint/parser
  - @weapp-vite/mcp：dependencies.@modelcontextprotocol/server、devDependencies.@modelcontextprotocol/client
  - @weapp-vite/tailwindcss：dependencies.@weapp-tailwindcss/engine
  - weapp-ide-cli：dependencies.@modelcontextprotocol/server
  - weapp-vite：dependencies.@weapp-tailwindcss/engine
  - create-weapp-vite：基于 weapp-vite / wevu 的依赖升级联动更新脚手架模板

- Updated dependencies:
  - @mpcore/test@0.1.15

## 0.2.6

### Patch Changes

- 基于 pnpm-workspace.yaml 中 catalog 版本变更，自动补充发布记录。
  默认 catalog 变更键：@icebreakers/eslint-config, @icebreakers/stylelint-config, magic-string, rolldown, sass, sass-embedded, tdesign-miniprogram。命名 catalog 变更键：tdesign-miniprogram-fixed(tdesign-miniprogram)。

- 自动补充依赖升级发布记录。
  涉及包：
  - @weapp-vite/ast-native：devDependencies.@napi-rs/cli

- Updated dependencies:
  - @mpcore/test@0.1.14

## 0.2.5

### Patch Changes

- 基于 pnpm-workspace.yaml 中 catalog 版本变更，自动补充发布记录。
  默认 catalog 变更键：tsx, weapp-tailwindcss。命名 catalog 变更键：weapp-tailwindcss-fixed(weapp-tailwindcss)。

- 基于 pnpm-workspace.yaml 中 catalog 版本变更，自动补充发布记录。
  默认 catalog 变更键：oxc-parser。命名 catalog 变更键：无。

- 基于 pnpm-workspace.yaml 中 catalog 版本变更，自动补充发布记录。
  默认 catalog 变更键：weapp-tailwindcss。命名 catalog 变更键：weapp-tailwindcss-fixed(weapp-tailwindcss)。

- 自动补充依赖升级发布记录。
  涉及包：
  - @weapp-vite/glass-easel-web-adapter：devDependencies.tsx

- 自动补充依赖升级发布记录。
  涉及包：
  - @weapp-vite/ast：dependencies.@oxc-project/types

- 自动补充依赖升级发布记录。
  涉及包：
  - @weapp-vite/eslint：devDependencies.@typescript-eslint/parser

- Updated dependencies:
  - @mpcore/test@0.1.13

## 0.2.4

### Patch Changes

- 升级 weapp-tailwindcss 至 5.5.6，同步工作区默认依赖、固定版本回归环境及脚手架模板映射，使新建项目与仓库验证使用一致的 Tailwind 集成版本。

- 基于 pnpm-workspace.yaml 中 catalog 版本变更，自动补充发布记录。
  默认 catalog 变更键：@babel/core, @babel/generator, @babel/parser, @babel/traverse, @babel/types, @types/node, eslint, lru-cache。命名 catalog 变更键：无。

- 自动补充依赖升级发布记录。
  涉及包：
  - @weapp-vite/ast-native：devDependencies.@napi-rs/cli
  - weapp-vite：dependencies.@babel/preset-env
  - create-weapp-vite：基于 weapp-vite / wevu 的依赖升级联动更新脚手架模板

- Updated dependencies:
  - @mpcore/test@0.1.12

## 0.2.3

### Patch Changes

- 基于 pnpm-workspace.yaml 中 catalog 版本变更，自动补充发布记录。
  默认 catalog 变更键：@icebreakers/eslint-config, @icebreakers/stylelint-config, @vue/compiler-core, @vue/compiler-dom, vue。命名 catalog 变更键：无。

- 基于 pnpm-workspace.yaml 中 catalog 版本变更，自动补充发布记录。
  默认 catalog 变更键：@icebreakers/eslint-config, @icebreakers/stylelint-config, @vue/compiler-core, @vue/compiler-dom, vue。命名 catalog 变更键：无。

- 自动补充依赖升级发布记录。
  `pnpm up:pkg` 改为按次追加 changeset，不再覆盖或删除既有自动生成文件。本文件为当前发布周期内全部可发布包补上 patch，覆盖仓库级依赖与 catalog 刷新。

- Updated dependencies:
  - @mpcore/test@0.1.11

## 0.2.2

### Patch Changes

- 统一可发布包的 npm SEO 元数据、公开发布配置与入口一致性检查，提升 npm 搜索与发布可靠性。

- Updated dependencies:
  - @mpcore/test@0.1.10

## 0.2.1

### Patch Changes

- Updated dependencies:
  - @mpcore/test@0.1.9

## 0.2.0

### Minor Changes

- 适配 Vitest 5 的自定义 matcher 类型契约，并将最低支持版本提升至 Vitest 5，确保同步与异步断言返回类型正确传播。

### Patch Changes

- 自动补充依赖升级发布记录。
  涉及包：
  - @mpcore/vitest：devDependencies.vitest
  - @weapp-vite/ast-native：devDependencies.@napi-rs/cli、devDependencies.vitest
  - @weapp-vite/eslint：devDependencies.vitest

- Updated dependencies:
  - @mpcore/test@0.1.8

## 0.1.7

### Patch Changes

- Updated dependencies:
  - @mpcore/test@0.1.7

## 0.1.6

### Patch Changes

- Updated dependencies:
  - @mpcore/test@0.1.6

## 0.1.5

### Patch Changes

- Updated dependencies:
  - @mpcore/test@0.1.5

## 0.1.4

### Patch Changes

- Updated dependencies:
  - @mpcore/test@0.1.4

## 0.1.3

### Patch Changes

- 升级 Oxc 与 Vitest 依赖，并将脚手架模板使用的 weapp-tailwindcss 版本同步至 5.3.1，确保发布包和新建项目采用一致的依赖基线。

- Updated dependencies:
  - @mpcore/test@0.1.3

## 0.1.2

### Patch Changes

- 📦 **Dependencies**
  → `@mpcore/test@0.1.2`

## 0.1.1

### Patch Changes

- 📦 **Dependencies**
  → `@mpcore/test@0.1.1`

## 0.1.0

### Minor Changes

- ✨ **新增面向真实小程序编译产物的页面与组件测试基础设施，提供共享运行时内核、逻辑 WXML 查询与交互、严格宿主 mock、Vitest 隔离适配和 weapp-vite 程序化测试构建入口。** [#761](https://github.com/weapp-vite/weapp-vite/pull/761) by @sonofmagic

### Patch Changes

- 📦 **Dependencies** [`3d498d2`](https://github.com/weapp-vite/weapp-vite/commit/3d498d25ded2ea21a9c9c187afe743a64f17947d)
  → `@mpcore/test@0.1.0`
