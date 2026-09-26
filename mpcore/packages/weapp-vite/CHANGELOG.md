# @mpcore/weapp-vite

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
