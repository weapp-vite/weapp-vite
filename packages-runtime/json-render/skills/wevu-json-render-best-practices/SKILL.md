---
name: wevu-json-render-best-practices
description: 面向使用 `@wevu/json-render` 与 `@wevu/json-render-components` 开发微信小程序的实践手册，覆盖 catalog/spec、状态绑定、动作、SpecStream、预编译 renderer、自定义节点、resolver 接入、协议边界与真实运行时验收。
---

# wevu-json-render-best-practices

## 用途

在微信小程序中把 json-render 描述渲染为可交互界面，保持 spec、业务状态、组件资源和宿主生命周期边界清晰。

## 包与资料边界

- 本 skill 随 `@wevu/json-render` 提供，同时覆盖配套资源包 `@wevu/json-render-components`。消费项目应在 `dependencies` 中同时声明两个包；业务代码只导入主包 API，不复制或改写包内组件源码。
- `@wevu/json-render` 负责 catalog、spec 校验、响应式会话、状态/动作和 SpecStream；`@wevu/json-render-components` 只提供预编译原生组件与共享类型。原生 npm 构建需要应用显式依赖后者，`JsonRendererResolver()` 负责注册组件。
- 使用 `weapp.autoImportComponents.resolvers` 时需要项目已经安装 `weapp-vite`；仅有 json-render 包时先诊断现有产物，不默认引入构建器。
- 包内兼容入口已在 Core 初始化前执行 `z.config({ jitless: true })`；消费项目创建自有 Zod schema 前也应执行，后续不要重新开启 JIT。
- 包不提供模型调用、网络分块解码或完整上游 renderer；当前承诺范围是微信目标。其他平台、真机和完整上游能力未验证时不作兼容承诺。

## 何时使用

- 用户要接入 `@wevu/json-render`、注册 `JsonRendererResolver()` 或排查 renderer 组件未注册。
- 用户要定义 `RendererCatalog`、`CatalogSpec`、组件 props/events/actions 或 `bindings`。
- 用户要处理 `$state`、`$bindState`、可见性、JSON Pointer 状态写入或动作参数校验。
- 用户要使用 `useJsonRenderer` / `createJsonRenderer`、取消过期动作或管理会话清理。
- 用户要接入 JSONL SpecStream、增量 Patch、错误恢复或流与状态并行更新。
- 用户要扩展 `custom-node`、业务容器、递归渲染或 `RendererEvent`。

## 不适用场景

- 服务端 A2UI 1.0 surface 消息、`createSurface` / `updateDataModel`：使用 `wevu-a2ui-best-practices`。
- 通用 Wevu hook、store、router、`setData` 性能：使用 `wevu-best-practices`。
- `.vue` 宏、模板兼容、分包或构建器配置：使用 `weapp-vite-vue-sfc-best-practices` 或 `weapp-vite-best-practices`。
- 原生小程序迁移路线：使用 `native-to-weapp-vite-wevu-migration`。

## 核心流程

先确定只读诊断或实施范围，读取项目 `package.json`、构建配置、页面/组件、catalog/spec、状态入口和已有 scripts。记录实际安装的两个包、Wevu、weapp-vite、Zod、Node、包管理器及目标微信 IDE/基础库版本；缺少宿主或脚本时只完成可达的静态诊断。

1. **确认依赖与构建 owner**
   - 同时安装 `@wevu/json-render` 和 `@wevu/json-render-components`。
   - 先构建配套组件，再构建主包和宿主应用；仓库内顺序可参考 `references/components-and-resolver.md`。
   - 业务代码不从 `@wevu/json-render-components` 的私有路径创建会话或实现状态管理。

2. **注册预编译组件**
   - 在 `weapp.autoImportComponents.resolvers` 中加入 `JsonRendererResolver()`。
   - 页面使用 `<json-renderer :node="tree" @node-event="onNodeEvent" />`。
   - 自定义类型通过静态注册的 `generic:custom-node` 传入；不要使用 `<component :is>` 或运行时生成模板。

3. **建立 catalog 与 spec**
   - 从 `standardComponents` 扩展组件，props schema 使用 `.strict()`，动作 schema 与 `on` 绑定保持一致。
   - 输入组件通过 `bindings` 声明可写属性；spec 只使用 `$state`、受约束的 `$bindState` 和布尔/比较可见性。
   - 网络、模型或存储中的未知 spec 必须经 `validateRendererSpec` / `load` 校验，不把 TypeScript 类型当运行时边界。

4. **创建会话并绑定视图**
   - 页面/组件同步 `setup()` 中优先 `useJsonRenderer`；非组件场景使用 `createJsonRenderer` 并负责 `dispose()`。
   - `state` 是唯一业务状态，`tree` 是求值后的节点树；输入与动作统一交给 `dispatch`，不要直接改内部结构。
   - 业务节点发出 `RendererEvent`，容器通过默认 `<slot />` 接收子节点；事件与节点 ID 保持稳定。

5. **处理流、动作与恢复**
   - 使用 `createStream` / `stream.push` 应用 JSONL Patch；会话包装返回 boolean，完整新树提交时为 `true`，暂未提交、已停止或失效时为 `false`。独立 `createSpecStream(initialSpec, catalog, state).push` 返回新 spec 或 `null`，不要把“尚未提交”直接当网络失败。
   - `load` 失败保留上一版界面；新流使旧流失效，但可以保留业务状态。
   - 异步动作通过 `context.setState` 提交，使用 `context.isActive()` 和 `context.onCleanup()` 阻止重置/卸载后的迟到写入。

6. **验证真实产物与 runtime**
   - 先跑包级相关单测和类型检查，再构建宿主应用并检查 renderer、业务组件与页面产物。
   - 在目标微信 DevTools 观察首屏、输入写回、自定义节点事件、流更新、异常恢复和卸载清理；headless 结果不能替代真实 IDE。

## 关键契约

| 对象 | 规则 |
| --- | --- |
| `catalog` | 组件名、props/events/actions/bindings/container 是静态契约；schema 在边界校验 |
| `spec` | JSON 描述，`root` 指向 `elements`；节点 ID 是组件身份与事件路由依据 |
| `state` | JSON 数据，通过 `setState` 写现有 JSON Pointer 路径；拒绝原型链键和不存在的路径 |
| `dispatch` | 返回 `Promise<boolean>`；忽略不可见/已移除节点，同节点同名进行中动作去重 |
| `load` | 事务化替换 spec；失败保留旧树，不传 `nextState` 时保留业务状态 |
| `stream` | 仅 `add` / `replace` / `remove`，只允许 `/root` 与 `/elements` |
| `custom-node` | 静态分支、`RenderNode` 输入、`node-event` 输出；泛型逐层传递 |
| `dispose` | 幂等；停止流、执行动作清理并阻止旧上下文写入 |

## 协议与安全边界

- 默认限制 200 个节点、8 层深度、待解析缓冲 65536 个字符；调整 `limits` 只接受正整数。
- 不支持 repeat、上游 slots 字段、watch、computed/cond、action chains 或远程 state patch；未知能力明确拒绝。业务容器的本地默认插槽不等于上游 slots。
- 不接受任意函数、动态代码或 `$bindState` 未声明路径；不要把模型输出直接拼进模板或交给 `eval` / `new Function`。
- 包不假设宿主存在 `AbortController`，也不接管请求、transport、重连或排队。
- 当前只验证微信 DevTools 与 mpcore headless；真机、其他平台和真实网络分块需要单独证据。

## 输出

只输出本次相关的依赖/owner、catalog/spec 或会话改动、实际版本与微信边界、最小检查及未验证项。每项结论记录 `对象/版本 → 命令或动作 → 产物/观察 → 方法与限制`；构建、类型和 headless 通过不冒充真实 IDE 可见行为。

## 完成标记

- 已检查：两个显式依赖、resolver、静态组件注册、schema/状态/动作边界、流与清理、目标产物。
- 已执行：列出实际命令及结果；真实 DevTools 未运行时明确写 `未验证`，不宣称 runtime 完成。
- 不适用：未涉及的协议能力不展开；已观察到的失败保留，不用后续成功覆盖。

## 参考资料

- 目录、表达式与协议：`references/catalog-and-protocol.md`
- 会话、动作与 SpecStream：`references/session-and-streaming.md`
- 组件包、resolver 与自定义节点：`references/components-and-resolver.md`
- 分层验证与产物检查：`references/validation-matrix.md`
