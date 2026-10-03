# @wevu/json-render

## 0.1.1

### Patch Changes

- 升级 Vite、Oxc、Devframe、Sass、环境变量展开、脚手架 npm 配置与 AI SDK 等生产依赖及构建工具链，并同步工作区锁文件。

  - 迁移 Rust Oxc 至 0.152 与 N-API 依赖，适配新版解析结果和箭头函数 AST，保持批量分析、嵌套函数边界与可选 native 回退契约。
  - 对齐 React reconciler 0.34 的宿主接口，补齐异步提交所需的 hook，修复 `startTransition` 提交时因缺失宿主方法而失败的问题。
  - 升级 uview-plus 至 3.8.127，新增 `u-flex` / `up-flex` 自动导入及组件交互场景，将兼容矩阵扩展至 138 个具名组件，并保留条码组件读取 canvas 引用前等待实例 `$nextTick()` 的补丁。
  - 同步 `create-weapp-vite` 模板 catalog、React 模板的 SWC 依赖与生成的 AI 指引，使新建项目和 React 19.3 / reconciler 0.34 验证基线保持一致。

- Updated dependencies:
  - @wevu/json-render-components@0.1.1
  - wevu@7.5.0

## 0.1.0

### Minor Changes

- 新增 json-render 的 Wevu 小程序适配包，提供组件目录、状态绑定、动作调度、事务化流式更新和可通过泛型组件扩展的递归 SFC。修复 lib 模式递归引用 SFC 时的重复组件注册，以及 simulator 未继承父级泛型映射的问题，使自定义业务节点及事件转发与真实微信运行时一致。

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
  - @wevu/json-render-components@0.1.0
  - wevu@7.4.0
