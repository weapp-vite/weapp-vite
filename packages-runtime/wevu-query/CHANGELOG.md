# @wevu/query

## 0.0.8

### Patch Changes

- 升级 Vite、Oxc、Devframe、Sass、环境变量展开、脚手架 npm 配置与 AI SDK 等生产依赖及构建工具链，并同步工作区锁文件。

  - 迁移 Rust Oxc 至 0.152 与 N-API 依赖，适配新版解析结果和箭头函数 AST，保持批量分析、嵌套函数边界与可选 native 回退契约。
  - 对齐 React reconciler 0.34 的宿主接口，补齐异步提交所需的 hook，修复 `startTransition` 提交时因缺失宿主方法而失败的问题。
  - 升级 uview-plus 至 3.8.127，新增 `u-flex` / `up-flex` 自动导入及组件交互场景，将兼容矩阵扩展至 138 个具名组件，并保留条码组件读取 canvas 引用前等待实例 `$nextTick()` 的补丁。
  - 同步 `create-weapp-vite` 模板 catalog、React 模板的 SWC 依赖与生成的 AI 指引，使新建项目和 React 19.3 / reconciler 0.34 验证基线保持一致。

- Updated dependencies:
  - @wevu/web-apis@1.3.5
  - wevu@7.5.0

## 0.0.7

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
  - @wevu/web-apis@1.3.4
  - wevu@7.4.0

## 0.0.6

### Patch Changes

- 基于 pnpm-workspace.yaml 中 catalog 版本变更，自动补充发布记录。
  默认 catalog 变更键：@icebreakers/eslint-config, @icebreakers/stylelint-config, magic-string, rolldown, sass, sass-embedded, tdesign-miniprogram。命名 catalog 变更键：tdesign-miniprogram-fixed(tdesign-miniprogram)。

- 自动补充依赖升级发布记录。
  涉及包：
  - @weapp-vite/ast-native：devDependencies.@napi-rs/cli

- Updated dependencies:
  - @wevu/web-apis@1.3.3
  - wevu@7.3.0

## 0.0.5

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
  - @wevu/web-apis@1.3.2
  - wevu@7.2.0

## 0.0.4

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
  - @wevu/web-apis@1.3.1
  - wevu@7.1.4

## 0.0.3

### Patch Changes

- 基于 pnpm-workspace.yaml 中 catalog 版本变更，自动补充发布记录。
  默认 catalog 变更键：@icebreakers/eslint-config, @icebreakers/stylelint-config, @vue/compiler-core, @vue/compiler-dom, vue。命名 catalog 变更键：无。

- 基于 pnpm-workspace.yaml 中 catalog 版本变更，自动补充发布记录。
  默认 catalog 变更键：@icebreakers/eslint-config, @icebreakers/stylelint-config, @vue/compiler-core, @vue/compiler-dom, vue。命名 catalog 变更键：无。

- 自动补充依赖升级发布记录。
  `pnpm up:pkg` 改为按次追加 changeset，不再覆盖或删除既有自动生成文件。本文件为当前发布周期内全部可发布包补上 patch，覆盖仓库级依赖与 catalog 刷新。

- Updated dependencies:
  - @wevu/web-apis@1.3.0
  - wevu@7.1.3

## 0.0.2

### Patch Changes

- Updated dependencies:
  - wevu@7.1.2

## 0.0.1

### Patch Changes

- 统一可发布包的 npm SEO 元数据、公开发布配置与入口一致性检查，提升 npm 搜索与发布可靠性。

- Updated dependencies:
  - @wevu/web-apis@1.2.42
  - wevu@7.1.1

## 0.0.0

### Minor Changes

- 新增独立的 `@wevu/query` 服务端状态管理包，提供类型关联查询键、共享请求与缓存、失效刷新、作用域隔离、mutation、分页查询，以及 Wevu 响应式和页面生命周期接入。应用前后台与网络状态通过显式微信宿主适配器驱动，不内置持久化或自动重试策略。

  为 simulator 增加应用显示/隐藏监听和显式测试控制，并支持在执行小程序入口前等待 `configureSession` 配置完成。查询回归通过仅限指定回环源与查询路径的测试传输访问真实 HTTP 服务，默认 request mock 和 strict mock 策略保持不变。

  应用事件分发对齐真实微信开发者工具：保留同一监听器的重复注册，按事件快照处理派发期间的增删，取消监听时移除全部同引用注册；冷启动保持 App 显示钩子先执行，后续恢复与隐藏则先执行 wx 监听器。

  自定义 `HeadlessWxDriver` 实现需要补齐 `onAppShow`、`offAppShow`、`onAppHide`、`offAppHide` 四个方法；内置 Node 与 browser driver 已同步迁移。

  Web runtime 同步支持 `wx.onAppShow`、`wx.offAppShow`、`wx.onAppHide`、`wx.offAppHide`，保持相同的监听快照、重复注册与回调顺序。浏览器隐藏事件向 wx 监听器与 App 钩子传递同一份 `{ reason: 3 }`，表示无法区分微信退出来源的“其他”原因；同时修正公开类型入口，使其指向实际生成的 `.d.mts` 声明文件。

### Patch Changes

- Updated dependencies:
  - @wevu/web-apis@1.2.41
  - wevu@7.1.0
