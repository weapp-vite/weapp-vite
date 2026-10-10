# @mpcore/weapp-vite

## 1.0.0

### Major Changes

- feat(engines)!: 将框架及编译依赖链的 Node.js 支持范围对齐为 `^22.18.0 || ^24.11.0 || >=26.0.0`，不再承诺 Node 20、23、25 或低于最低补丁版本的环境。CLI 在加载构建依赖前读取发布包声明并明确拒绝不支持的运行时；发布消费检查覆盖三系统最低版本和当前支持的 LTS 补丁版本。已有项目请先升级 Node.js；脚手架自身仍要求 Node 22.22.2、24.15.0 或 26 及以上版本，不降低其依赖所需版本。

### Patch Changes

- fix(acceptance): 修复 Doctor 会话清理、HMR profile 交接与测试产物缓存的归属和失效边界。

  - Doctor 分阶段保存宿主事实及脱敏清理证据，共享总预算；工具信息失败仍保留已连接事实，释放本次连接而不误删持久化会话。原生 CLI 登录查询仅显式启用，只采信布尔结果，超时或无效响应保持未知。
  - 拓扑替换独立移交原始计时与时钟，仅在完整产物发布后结算；保留重启失败、交接失效和关闭诊断。畸形枚举记录被跳过而不影响后续合法样本，异步写入使用已固定快照。
  - profile 监听只排除实际启用的输出文件，避免失败重建自触发；关闭 profile 时同名用户文件及相邻源码仍可触发更新。
  - 测试产物按进程、配置和 generation 隔离，基于源码、配置依赖和产物内容验证缓存，避免旧结果复用或覆盖在用产物；内容摘要去重重复通知，保留显式重建、构建中再编辑、合并更新、可等待关闭及过期缓存失败隔离。

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
  - weapp-vite@7.5.0

## 0.1.29

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
  - weapp-vite@7.4.0

## 0.1.28

### Patch Changes

- 基于 pnpm-workspace.yaml 中 catalog 版本变更，自动补充发布记录。
  默认 catalog 变更键：@icebreakers/eslint-config, @icebreakers/stylelint-config, magic-string, rolldown, sass, sass-embedded, tdesign-miniprogram。命名 catalog 变更键：tdesign-miniprogram-fixed(tdesign-miniprogram)。

- 自动补充依赖升级发布记录。
  涉及包：
  - @weapp-vite/ast-native：devDependencies.@napi-rs/cli

- Updated dependencies:
  - @mpcore/test@0.1.14
  - weapp-vite@7.3.0

## 0.1.27

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
  - weapp-vite@7.2.0

## 0.1.26

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
  - weapp-vite@7.1.4

## 0.1.25

### Patch Changes

- 基于 pnpm-workspace.yaml 中 catalog 版本变更，自动补充发布记录。
  默认 catalog 变更键：@icebreakers/eslint-config, @icebreakers/stylelint-config, @vue/compiler-core, @vue/compiler-dom, vue。命名 catalog 变更键：无。

- 基于 pnpm-workspace.yaml 中 catalog 版本变更，自动补充发布记录。
  默认 catalog 变更键：@icebreakers/eslint-config, @icebreakers/stylelint-config, @vue/compiler-core, @vue/compiler-dom, vue。命名 catalog 变更键：无。

- 自动补充依赖升级发布记录。
  `pnpm up:pkg` 改为按次追加 changeset，不再覆盖或删除既有自动生成文件。本文件为当前发布周期内全部可发布包补上 patch，覆盖仓库级依赖与 catalog 刷新。

- Updated dependencies:
  - @mpcore/test@0.1.11
  - weapp-vite@7.1.3

## 0.1.24

### Patch Changes

- Updated dependencies:
  - weapp-vite@7.1.2

## 0.1.23

### Patch Changes

- 统一可发布包的 npm SEO 元数据、公开发布配置与入口一致性检查，提升 npm 搜索与发布可靠性。

- Updated dependencies:
  - @mpcore/test@0.1.10
  - weapp-vite@7.1.1

## 0.1.22

### Patch Changes

- Updated dependencies:
  - @mpcore/test@0.1.9
  - weapp-vite@7.1.0

## 0.1.21

### Patch Changes

- Updated dependencies:
  - @mpcore/test@0.1.8
  - weapp-vite@7.0.4

## 0.1.20

### Patch Changes

- Updated dependencies:
  - @mpcore/test@0.1.7
  - weapp-vite@7.0.3

## 0.1.19

### Patch Changes

- Updated dependencies:
  - weapp-vite@7.0.2

## 0.1.18

### Patch Changes

- Updated dependencies:
  - @mpcore/test@0.1.6
  - weapp-vite@7.0.1

## 0.1.17

### Patch Changes

- Updated dependencies:
  - weapp-vite@7.0.0

## 0.1.16

### Patch Changes

- Updated dependencies:
  - weapp-vite@6.25.1

## 0.1.15

### Patch Changes

- Updated dependencies:
  - weapp-vite@6.25.0

## 0.1.14

### Patch Changes

- Updated dependencies:
  - weapp-vite@6.24.0

## 0.1.13

### Patch Changes

- Updated dependencies:
  - @mpcore/test@0.1.5
  - weapp-vite@6.23.0

## 0.1.12

### Patch Changes

- Updated dependencies:
  - @mpcore/test@0.1.4
  - weapp-vite@6.22.0

## 0.1.11

### Patch Changes

- Updated dependencies:
  - weapp-vite@6.21.0

## 0.1.10

### Patch Changes

- 升级工作区非 TypeScript 依赖并同步公共包的发布意图，覆盖 SWC、Vue tooling、Tailwind CSS、dayjs 等版本；同时兼容 SWC 1.16 函数体 AST 结构和 weapp-tailwindcss 5.3 的 Skyline 样式入口。

- Updated dependencies:
  - @mpcore/test@0.1.3
  - weapp-vite@6.20.5

## 0.1.9

### Patch Changes

- Updated dependencies:
  - weapp-vite@6.20.4

## 0.1.8

### Patch Changes

- 📦 **Dependencies** [`7fb40f9`](https://github.com/weapp-vite/weapp-vite/commit/7fb40f9500191125ea1a20d0354502141da92abe)
  → `weapp-vite@6.20.3`

## 0.1.7

### Patch Changes

- 📦 **Dependencies** [`dcee1d2`](https://github.com/weapp-vite/weapp-vite/commit/dcee1d2c7efe5dca0ff3751c4c9d4f5ea83a4e89)
  → `weapp-vite@6.20.2`

## 0.1.6

### Patch Changes

- 📦 **Dependencies** [`0558cf8`](https://github.com/weapp-vite/weapp-vite/commit/0558cf8c39bcbe05702bfe3834a585823f4f87ea)
  → `weapp-vite@6.20.1`

## 0.1.5

### Patch Changes

- 📦 **Dependencies** [`b04fe56`](https://github.com/weapp-vite/weapp-vite/commit/b04fe56dad711b9d643958a5b3b5e3a1fa438d29)
  → `weapp-vite@6.20.0`, `@mpcore/test@0.1.2`

## 0.1.4

### Patch Changes

- 📦 **Dependencies** [`080589c`](https://github.com/weapp-vite/weapp-vite/commit/080589cb0bd939fe8b421ee7c355ecdb21e03685)
  → `weapp-vite@6.19.4`

## 0.1.3

### Patch Changes

- 📦 **Dependencies** [`f635efc`](https://github.com/weapp-vite/weapp-vite/commit/f635efc847af98c13438495caf5dafc62ab61dda)
  → `weapp-vite@6.19.3`

## 0.1.2

### Patch Changes

- 📦 **Dependencies** [`b055929`](https://github.com/weapp-vite/weapp-vite/commit/b055929f8c18a2a9be800eff88f8f7806a9a4f46)
  → `weapp-vite@6.19.2`, `@mpcore/test@0.1.1`

## 0.1.1

### Patch Changes

- 📦 **Dependencies** [`c7d8514`](https://github.com/weapp-vite/weapp-vite/commit/c7d85143aeb5edaaf5d1902a8bd3d5fe09ef570e)
  → `weapp-vite@6.19.1`

## 0.1.0

### Minor Changes

- ✨ **新增面向真实小程序编译产物的页面与组件测试基础设施，提供共享运行时内核、逻辑 WXML 查询与交互、严格宿主 mock、Vitest 隔离适配和 weapp-vite 程序化测试构建入口。** [#761](https://github.com/weapp-vite/weapp-vite/pull/761) by @sonofmagic

### Patch Changes

- 📦 **Dependencies** [`878073f`](https://github.com/weapp-vite/weapp-vite/commit/878073f8819a21f7e6baa96d13cf3f7e552d2158)
  → `weapp-vite@6.19.0`, `@mpcore/test@0.1.0`
