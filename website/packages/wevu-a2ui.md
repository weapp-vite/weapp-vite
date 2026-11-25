---
title: '@wevu/a2ui'
description: 在 Wevu 微信小程序中渲染 A2UI 1.0 surface 状态消息，支持数据绑定、模板列表和动作外发，不引入 lit。
keywords:
  - Wevu
  - A2UI
  - 小程序
  - Generative UI
---

# @wevu/a2ui（实验）

`@wevu/a2ui` 是 A2UI 1.0 协议 Wevu 渲染适配层的运行时部分，直接复用 `@a2ui/web_core@0.16.1` 的消息处理、节点解析与信号。当前为仓库内的实验性 workspace 包，尚未发布到 npm。

包只负责会话与视图投影：接收服务端下发的 surface 状态消息，维护组件树与数据模型，把解析后的绑定求值成一份组件无关的 JSON 节点树。渲染宿主由消费项目提供预编译 SFC，本包不生成模板，也不在 AppService 中执行模型返回的代码。

## 与 json-render 的差异

`@wevu/json-render` 使用自有的 JSON 描述与 JSONL Patch 协议，业务状态由渲染器持有；`@wevu/a2ui` 直接消费上游 A2UI 消息流，界面与数据由 `createSurface`、`updateComponents`、`updateDataModel`、`deleteSurface` 四类状态消息驱动，动作以 `action.event` 外发给 agent，回包再改写数据模型。两者共用同一套小程序渲染约束：不使用 `<component :is>`，递归宿主 SFC，不引入 lit 或 Web 自定义元素。

## 接入入口

- `@wevu/a2ui`：`createA2uiSession`、`createA2uiCatalog`、`readA2uiEnvelope`、`A2UI_PROTOCOL_VERSION` 及 `A2uiNode`、`A2uiSurfaceView`、`A2uiInteraction`、`A2uiActionMessage` 等类型。
- 宿主渲染：由应用提供递归组件，按 `A2uiNode.type` 静态分支，使用 `node.componentId` 作为稳定标识。

```ts
import type { A2uiSurfaceView } from '@wevu/a2ui'
import { createA2uiSession } from '@wevu/a2ui'
import { shallowRef } from 'wevu'

const views = shallowRef<A2uiSurfaceView[]>([])
const session = createA2uiSession({
  catalog: demoCatalog,
  onSurfaces: (next) => {
    views.value = next
  },
  onAction: async (message) => {
    await agent.send(message)
  },
})
session.receive({ version: '1.0', createSurface: { surfaceId: 'after-sales', catalogId: DEMO_CATALOG_ID, components: [], dataModel: {} } })
```

页面在同步 setup 中创建会话并在卸载时 `dispose()`，模板里递归渲染 `views`，把宿主组件的输入与点击事件原样交给 `session.interact(surfaceId, event)`。目录（catalog）由调用方注入，业务组件与基础组件写在同一份 JSON Schema 目录里。

## 支持范围

- 四类 surface 状态消息，严格校验；`createSurface` 失败会回滚该 surface，便于用同一 id 重下。
- `DynamicString` 的 `@path` 绑定、`ChildList` 模板列表、按钮 `action.event` 与上下文求值。
- 输入绑定写回数据模型，动作消息按调用顺序交给 `onAction`，`dispose()` 后不再通知。
- 每次组件或对象级数据替换会提升 generation，节点 id 形如 `组件ID-vN`，用于宿主重建与选择器稳定。

不支持 `callRendererFunction`、函数调用与校验规则等完整 Basic Catalog 能力，也不接管 transport、agent 或 RPC。Core 的依赖图会带入 `zod@3` 与 `zod-to-json-schema`（约 77 kB gzip），`lit` 等声明依赖在小程序入口不可达。当前验证目标是微信 DevTools 与 mpcore headless。

完整会话语义与投影规则见 [包 README](https://github.com/weapp-vite/weapp-vite/tree/main/packages-runtime/a2ui)。可运行的售后示例见 [wevu-a2ui-demo](https://github.com/weapp-vite/weapp-vite/tree/main/apps/wevu-a2ui-demo)。
