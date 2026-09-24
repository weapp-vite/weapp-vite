# @weapp-vite/eslint

## 0.2.8

### Patch Changes

- 基于 pnpm-workspace.yaml 中 catalog 版本变更，自动补充发布记录。
  默认 catalog 变更键：@icebreakers/eslint-config, @icebreakers/stylelint-config, magic-string, rolldown, sass, sass-embedded, tdesign-miniprogram。命名 catalog 变更键：tdesign-miniprogram-fixed(tdesign-miniprogram)。

- 自动补充依赖升级发布记录。
  涉及包：
  - @weapp-vite/ast-native：devDependencies.@napi-rs/cli

## 0.2.7

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

- 以 Pinia 4.0.3 为公开用法和主要行为参照，完善 Store 初始化、Setup 自动解包、深层 patch、重置、插件和生命周期。本次按 minor 发布，但包含需要旧 Store 消费者迁移的不兼容变化，推荐使用 `createPinia()` 创建管理器，`createStore()` 保留为同一个函数的兼容别名，继续保留 `StoreManager` 及已有公开 API 名称，升级前须按 [Store 迁移指南](https://vite.weapp.dev/wevu/store-migration) 检查消费者：显式安装 Store 管理器、将外部 `store.field.value` 改为 `store.field`、直接从 Store 解构 actions，并为 Setup Store 自行实现 `$reset`。默认订阅改为异步且随注册作用域解绑；`$dispose` 保留状态，在途 action 结果回调继续执行。同步自动导入、兼容诊断、示例与迁移文档。

  修正嵌套 `$patch` 在下一轮调度中重复发布直接修改通知的问题，保留普通同步 watcher 的逐次更新；Store 解包保留 `shallowRef` 与 `shallowReactive` 的引用和浅层响应式边界；插件初始化期间的同步订阅、默认异步订阅及显式 patch 通知对齐 Pinia。

  Store 继续使用面向小程序的 wevu 响应式核心和 setData 调度。减少 patch 中被抑制的订阅重复遍历，默认订阅跨同一轮多个 patch 合并收集；修复显式 batch 与 patch 组合时重复发布 direct 的问题，保留普通同步 watcher 语义，并增加真实小程序中的通知、渲染与依赖收集次数回归。

## 0.2.6

### Patch Changes

- 升级 weapp-tailwindcss 至 5.5.6，同步工作区默认依赖、固定版本回归环境及脚手架模板映射，使新建项目与仓库验证使用一致的 Tailwind 集成版本。

- 基于 pnpm-workspace.yaml 中 catalog 版本变更，自动补充发布记录。
  默认 catalog 变更键：@babel/core, @babel/generator, @babel/parser, @babel/traverse, @babel/types, @types/node, eslint, lru-cache。命名 catalog 变更键：无。

- 自动补充依赖升级发布记录。
  涉及包：
  - @weapp-vite/ast-native：devDependencies.@napi-rs/cli
  - weapp-vite：dependencies.@babel/preset-env
  - create-weapp-vite：基于 weapp-vite / wevu 的依赖升级联动更新脚手架模板

## 0.2.5

### Patch Changes

- 基于 pnpm-workspace.yaml 中 catalog 版本变更，自动补充发布记录。
  默认 catalog 变更键：@icebreakers/eslint-config, @icebreakers/stylelint-config, @vue/compiler-core, @vue/compiler-dom, vue。命名 catalog 变更键：无。

- 基于 pnpm-workspace.yaml 中 catalog 版本变更，自动补充发布记录。
  默认 catalog 变更键：@icebreakers/eslint-config, @icebreakers/stylelint-config, @vue/compiler-core, @vue/compiler-dom, vue。命名 catalog 变更键：无。

- 自动补充依赖升级发布记录。
  `pnpm up:pkg` 改为按次追加 changeset，不再覆盖或删除既有自动生成文件。本文件为当前发布周期内全部可发布包补上 patch，覆盖仓库级依赖与 catalog 刷新。

## 0.2.4

### Patch Changes

- 统一可发布包的 npm SEO 元数据、公开发布配置与入口一致性检查，提升 npm 搜索与发布可靠性。

## 0.2.3

### Patch Changes

- 修复 Wevu 首屏异步导航对宿主 `queueMicrotask` 和现代内建的隐式依赖，收紧 headless simulator 的 AppService 全局边界，并新增仅作用于小程序运行时代码的 ESLint API 门禁、模板配置与真实 DevTools 验证规范。

## 0.2.2

### Patch Changes

- 将包主页、随包文档、脚手架默认链接与小程序 JSON Schema 地址统一迁移到 `vite.weapp.dev`，确保新生成项目和公开元数据使用新的文档主域名。

## 0.2.1

### Patch Changes

- 自动补充依赖升级发布记录。
  涉及包：
  - @weapp-vite/ast：dependencies.@oxc-project/types
  - @weapp-vite/eslint：devDependencies.@typescript-eslint/parser

## 0.2.0

### Minor Changes

- 新增 Wevu 兼容性清单与静态 API 防护，补齐 SFC scoped、CSS Modules 和 CSS `v-bind()` 的编译及运行时桥接，并同步模板、网站和迁移文档。
