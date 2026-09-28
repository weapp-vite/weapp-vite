---
title: '@wevu/json-render'
description: 在 Wevu 微信小程序中通过预编译组件渲染 json-render 描述，支持状态绑定、动作和流式更新。
keywords:
  - Wevu
  - json-render
  - 小程序
  - Generative UI
---

# @wevu/json-render（实验）

`@wevu/json-render` 提供 json-render 的 Wevu renderer 适配层，复用 `@json-render/core@0.21.0`。当前为仓库内的实验性 workspace 包，尚未发布到 npm。

主包以 ESM 提供响应式 API，配套组件包只提供预编译原生组件，避免两份运行时分裂状态依赖。消费项目显式安装主包和配套组件依赖，业务代码通过主包和 resolver 接入。

它接收组件目录、JSON 描述、初始状态和动作处理器，将描述投影为可序列化节点树，再通过包内预编译 SFC 渲染。业务组件通过小程序泛型组件静态注册；整个过程不依赖 React、Vue Web renderer 或动态代码执行。

## 接入入口

- `@wevu/json-render`：`defineRendererCatalog`、`standardComponents`、`createJsonRenderer`、`useJsonRenderer`、`createSpecStream`、`validateRendererSpec` 及类型。
- `@wevu/json-render/resolver`：`JsonRendererResolver()`，放入 `weapp.autoImportComponents.resolvers`。
- `@wevu/json-render-components/renderer/index`：主包自动依赖的预编译递归组件，使用 `<json-renderer :node="tree" />`。

```ts
import { JsonRendererResolver } from '@wevu/json-render/resolver'
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: { autoImportComponents: { resolvers: [JsonRendererResolver()] } },
})
```

业务页面在同步 setup 中调用 `useJsonRenderer({ catalog, spec, initialState, actions })`，把 `renderer.tree` 交给组件，将 `node-event` 转交 `renderer.dispatch`。自定义业务节点通过 `generic:custom-node="business-node"` 传入，使用 `RenderNode` / `RendererEvent` 契约；组件及路由仍需随小程序预编译发布。

## 支持范围

- 内置 Stack、Card、Text、Input、Button；目录可扩展业务组件和动作 schema。
- `$state`、受目录约束的 `$bindState`、布尔或状态比较可见性、单动作事件绑定。
- JSONL 的 add/replace/remove，只更新界面描述；业务状态由输入和已注册动作维护。
- 默认 200 个节点、8 层深度；校验失败保留上一版界面。
- 动作去重和资源清理；旧动作完成后不能经上下文更新已经重置/卸载的会话。

不支持 repeat、watch、任意表达式或完整上游 slots/action chains 协议。Core 初始化前启用 Zod jitless，调用方不要重新开启 JIT。当前验证目标是微信 DevTools 与 mpcore headless，不把浏览器或其他平台视为同等支持。

完整接入例子、类型和取消语义见 [包 README](https://github.com/weapp-vite/weapp-vite/tree/main/packages-runtime/json-render)。可运行的售后示例见 [wevu-json-render-demo](https://github.com/weapp-vite/weapp-vite/tree/main/apps/wevu-json-render-demo)。
