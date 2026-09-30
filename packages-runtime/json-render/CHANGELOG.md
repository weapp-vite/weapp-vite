# @wevu/json-render

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
