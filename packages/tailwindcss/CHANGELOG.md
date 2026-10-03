# @weapp-vite/tailwindcss

## 1.0.0

### Major Changes

- 将框架及编译依赖链的 Node.js 支持范围对齐为 `^22.18.0 || ^24.11.0 || >=26.0.0`，不再承诺 Node 20、23、25 或低于最低补丁版本的环境。CLI 在加载构建依赖前读取发布包声明并明确拒绝不支持的运行时；发布消费检查覆盖三系统最低版本和当前支持的 LTS 补丁版本。已有项目请先升级 Node.js；脚手架自身仍要求 Node 22.22.2、24.15.0 或 26 及以上版本，不降低其依赖所需版本。

### Patch Changes

- 升级 Vite、Oxc、Devframe、Sass、环境变量展开、脚手架 npm 配置与 AI SDK 等生产依赖及构建工具链，并同步工作区锁文件。

  - 迁移 Rust Oxc 至 0.152 与 N-API 依赖，适配新版解析结果和箭头函数 AST，保持批量分析、嵌套函数边界与可选 native 回退契约。
  - 对齐 React reconciler 0.34 的宿主接口，补齐异步提交所需的 hook，修复 `startTransition` 提交时因缺失宿主方法而失败的问题。
  - 升级 uview-plus 至 3.8.127，新增 `u-flex` / `up-flex` 自动导入及组件交互场景，将兼容矩阵扩展至 138 个具名组件，并保留条码组件读取 canvas 引用前等待实例 `$nextTick()` 的补丁。
  - 同步 `create-weapp-vite` 模板 catalog、React 模板的 SWC 依赖与生成的 AI 指引，使新建项目和 React 19.3 / reconciler 0.34 验证基线保持一致。

- 按实际能力启用情况延迟加载 Web 插件、Tailwind 引擎和高级 TypeScript 路径解析适配，减少普通小程序命令的无关模块加载；保持现有配置与 HMR 行为，并补充独立发布包的完整入口、负向校验及安装和启动成本证据。

- Updated dependencies:
  - @weapp-vite/hmr@0.2.1

## 0.2.0

### Minor Changes

- 提供实验性的 HMR 批次协作内核与 Tailwind 编译控制器，供小程序构建宿主复用。保留宿主自身的监听、模块图、原生写出和运行时确认协议；weapp-vite 的现有 HMR、tailwindcss 配置与 prepareHmr 类型保持兼容。

  模拟器销毁运行时后取消延迟 Promise 回调新提交的计时任务，避免 React/Taro 卸载期间产生跨会话异步异常；外部页面和节点句柄仍严格失效。

### Patch Changes

- 基于 pnpm-workspace.yaml 中 catalog 版本变更，自动补充发布记录。
  默认 catalog 变更键：weapp-tailwindcss。命名 catalog 变更键：weapp-tailwindcss-fixed(weapp-tailwindcss)。

- 升级 Vite、Rolldown、Tailwind 构建链及 Dashboard、MCP、自动化工具的相关依赖，保持共享依赖版本一致，并同步脚手架模板使用的依赖 catalog。迁移 uview-plus 3.8.125 兼容补丁，仅保留条码实例 $nextTick 等待。保留 TypeScript 6 与现有环境变量展开语义。

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
  - @weapp-vite/hmr@0.2.0
