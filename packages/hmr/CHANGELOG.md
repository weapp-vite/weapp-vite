# @weapp-vite/hmr

## 0.2.1

### Patch Changes

- 升级 Vite、Oxc、Devframe、Sass、环境变量展开、脚手架 npm 配置与 AI SDK 等生产依赖及构建工具链，并同步工作区锁文件。

  - 迁移 Rust Oxc 至 0.152 与 N-API 依赖，适配新版解析结果和箭头函数 AST，保持批量分析、嵌套函数边界与可选 native 回退契约。
  - 对齐 React reconciler 0.34 的宿主接口，补齐异步提交所需的 hook，修复 `startTransition` 提交时因缺失宿主方法而失败的问题。
  - 升级 uview-plus 至 3.8.127，新增 `u-flex` / `up-flex` 自动导入及组件交互场景，将兼容矩阵扩展至 138 个具名组件，并保留条码组件读取 canvas 引用前等待实例 `$nextTick()` 的补丁。
  - 同步 `create-weapp-vite` 模板 catalog、React 模板的 SWC 依赖与生成的 AI 指引，使新建项目和 React 19.3 / reconciler 0.34 验证基线保持一致。

- 为 HMR 交付队列提供可等待的稳定边界，并将状态保持宿主的快照重建与产物发布纳入验收等待，避免页面已更新但后台发布尚未完成时提前采样。失败会明确拒绝等待，修复后仍可继续等待新的成功交付。

## 0.2.0

### Minor Changes

- 提供实验性的 HMR 批次协作内核与 Tailwind 编译控制器，供小程序构建宿主复用。保留宿主自身的监听、模块图、原生写出和运行时确认协议；weapp-vite 的现有 HMR、tailwindcss 配置与 prepareHmr 类型保持兼容。

  模拟器销毁运行时后取消延迟 Promise 回调新提交的计时任务，避免 React/Taro 卸载期间产生跨会话异步异常；外部页面和节点句柄仍严格失效。

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
