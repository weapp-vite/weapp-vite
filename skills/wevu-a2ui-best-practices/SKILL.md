---
name: wevu-a2ui-best-practices
description: 面向使用 `@wevu/a2ui` 开发微信小程序的实践手册，覆盖 A2UI 1.0 surface 消息、catalog、数据模型、视图投影、输入写回、动作外发、函数实现、递归宿主、兼容层与真实运行时验收。
---

# wevu-a2ui-best-practices

## 用途

把服务端 A2UI 1.0 surface 状态消息投影为组件无关的 JSON 节点树，并在微信小程序中提供可验证的渲染、输入和动作宿主。

## 包与资料边界

- 本 skill 随 `@wevu/a2ui` 提供，负责 envelope、catalog、会话、数据模型、视图投影与交互选择；不提供 UI 组件、transport、agent RPC 或模型调用。
- 渲染层由消费项目提供预编译递归组件，按 `A2uiNode.type` 静态分支；不要使用 `<component :is>`、lit、Web 自定义元素或运行时模板生成。
- 数据模型由 surface 消息权威维护，输入通过 `session.interact` 写回，动作通过 `onAction` 外发；不要把本地状态当成第二份权威数据源。
- `createA2uiCatalog` 显式安装 `Object.hasOwn`、`AbortController`、`AbortSignal` 兼容实现；宿主已有同名内建时保留原实现，不要求修改系统或全局配置。
- 当前只承诺 A2UI 1.0 四类 surface 状态消息与微信目标；其他平台、真机、RPC 和完整 Basic Catalog 能力未验证时不作承诺。

## 何时使用

- 用户要接入 `@wevu/a2ui`、`createA2uiSession` 或 `createA2uiCatalog`。
- 用户要处理 `createSurface`、`updateComponents`、`updateDataModel`、`deleteSurface` 或批量消息。
- 用户要渲染嵌套节点、`Tabs.tabs[].child`、模板列表、多个可写绑定或多个动作。
- 用户要实现 `input` / `action` 交互、`eventId` 去重、异步动作队列或 transport metadata。
- 用户要注入 `functionImplementations`、排查标准函数、校验反馈或小程序兼容层。
- 用户要诊断 generation、节点 ID、数据回滚、异常保留或 `dispose()` 清理。

## 不适用场景

- json-render 自有 spec、`$state` / `$bindState` 或 JSONL SpecStream：使用 `wevu-json-render-best-practices`。
- 通用 Wevu hook、store、router、`setData` 性能：使用 `wevu-best-practices`。
- `.vue` 宏、模板兼容或构建器配置：使用 `weapp-vite-vue-sfc-best-practices` 或 `weapp-vite-best-practices`。
- 原生小程序迁移路线：使用 `native-to-weapp-vite-wevu-migration`。

## 核心流程

先确定只读诊断或实施范围，读取项目 `package.json`、catalog、消息样例、会话入口、递归宿主、页面模板、scripts 与 transport 边界。记录实际 `@wevu/a2ui`、`@a2ui/web_core`、Wevu、`@wevu/web-apis`、Node、包管理器及目标微信 IDE/基础库版本；没有宿主时只给静态诊断。

1. **确认协议与依赖**
   - catalog 与消息只接受 `protocolVersion: '1.0'` / `version: '1.0'`。
   - 仅处理四类 surface 状态消息；RPC、内部操作、空 `surfaceId` 和非 1.0 数据直接拒绝。
   - 保留 `@a2ui/web_core` 作为宿主打包的外部依赖，检查实际安装版本，不照搬旧文档版本。

2. **创建 catalog 与会话**
   - 用标准 catalog 文档建立 `createA2uiCatalog`，业务组件与基础组件都在同一目录声明。
   - 在同步 setup 或应用入口创建 `createA2uiSession`，提供 `onSurfaces`、`onAction`、可选 `onError` 和 `functionImplementations`。
   - 页面卸载显式 `dispose()`；`receive` 不接管 transport、重连或消息排队。

3. **投递与提交消息**
   - `receive` 支持单条消息、只读数组和 `{ messages }` wrapper；先校验整批形状，再逐条应用。
   - 一批消息只提交一次最终视图；处理失败回滚当前失败消息，前序成功消息保留。
   - `updateComponents` 按 id upsert 并保持整树可达；不通过删除单组件实现隐藏。

4. **投影与交互**
   - `onSurfaces` 推送 `{ id, root }` 视图；宿主按 `node.type` 静态渲染 `children`，并递归读取 props 中的嵌套节点。
   - 输入使用 `{ type: 'input', nodeId, bindingName, value }`；动作使用 `{ type: 'action', nodeId, actionName?, eventId? }`。
   - 多个候选未显式选择时抛 `TypeError`；深层绑定只投影值，不登记为可交互输入/动作。
   - `eventId` 仅在单个 surface 内去重；进行中共享执行，成功记录 30 秒内忽略重复，失败允许同 ID 重试。

5. **处理函数、兼容与动作队列**
   - 宿主函数只接收已校验参数，不接收 `DataContext` / `AbortSignal`；未声明实现或 schema-only 函数通过 `onError` 报告。
   - `functionCall` 本地执行且不外发；`callRendererFunction` / agent 函数响应不在当前范围。
   - 动作回调可异步等待，Core 本地动作按序串行；每个动作捕获的消息按序投递，但不同动作的 `onAction` 回调可能交错。不要在动作 handler 内 `await session.interact(...)` 等待同一队列。
   - `dispose()` 不强制取消已经启动的异步函数实现，宿主用自身清理机制结束等待。

6. **验证真实产物与 runtime**
   - 先跑包级单测、类型与 consumer 类型检查，再构建宿主应用并检查递归组件、页面和 catalog 产物。
   - 在目标微信 DevTools 观察首屏、嵌套渲染、输入写回、动作外发/回包、增量替换、异常保留和卸载清理。

## 关键契约

| 对象 | 规则 |
| --- | --- |
| `receive` | 四类状态消息；整批形状预校验，失败消息回滚，整批一次 `onSurfaces` |
| `interact(input)` | 只写顶层已登记 `WritableBinding`；多候选必须显式 `bindingName` |
| `interact(action)` | 执行 Core 动作并逐条外发其捕获消息；`eventId` 去重，失败不写成功缓存 |
| `A2uiNode.id` | `${Core 解析节点 id}-v${generation}`，不等于协议 `componentId` 加后缀；generation 内稳定，替换时用于重建宿主引用 |
| `A2uiNode.props` | 可包含嵌套节点与混合数组；宿主需递归读取，不能只遍历 `children` |
| `A2uiNode.actions` | 动作属性名清单；深层函数属性不自动成为动作 |
| `sendDataModel` | surface 启用时通过 `onAction` metadata 深拷贝上报，不混入 `ActionPayload` |
| `dispose` | 幂等，停止投影并释放 resolver/processor；不取消已开始的宿主异步函数 |

## 协议与安全边界

- 只接受 JSON 数据；投影丢弃未登记函数与 `undefined`，把 `NaN` / `Infinity` 转为 `null`。
- 不引入 lit、动态求值或模型代码执行；所有模板分支保持静态。
- `updateDataModel` 失败恢复目标 surface 数据快照，但调用仍收到异常；大模型快照是 O(N) 深拷贝。
- 不提供 Markdown、图片/勾选等目录扩展的自动渲染；catalog 能声明不等于宿主已实现。
- 当前验证目标是微信 DevTools 与 mpcore headless；真机、其他平台、真实网络与 agent RPC 单独验收。

## 输出

只输出本次相关的协议/会话/宿主改动、实际版本与微信边界、最小检查及未验证项。每项结论记录 `对象/版本 → 命令或动作 → 产物/观察 → 方法与限制`；构建、类型和 headless 通过不冒充真实 IDE 可见行为。

## 完成标记

- 已检查：1.0 catalog/消息、surface 数据所有权、投影与交互选择、异步动作/清理、递归宿主、目标产物。
- 已执行：列出实际命令及结果；真实 DevTools 未运行时明确写 `未验证`，不宣称 runtime 完成。
- 不适用：未涉及的 RPC、扩展组件和平台能力不展开；已观察到的失败保留。

## 参考资料

- 会话、批量消息与 transport：`references/session-and-transport.md`
- 视图投影与交互：`references/projection-and-interactions.md`
- catalog 函数、校验与兼容层：`references/catalog-functions-and-compat.md`
- 递归宿主与静态组件：`references/host-rendering.md`
- 分层验证与产物检查：`references/validation-matrix.md`
