---
name: wevu-best-practices
description: 面向小程序中 wevu 运行时的实践手册，覆盖生命周期注册、响应式更新、JSX/TSX、事件契约、`bindModel/useBindModel`、layout、原生 router helpers、`wevu/router`、store 约束，以及 `setData` 调度、渲染、页面切换、资源与内存性能治理。
---

# wevu-best-practices

## 用途

在小程序运行时里用 `wevu` 写出边界清晰、更新可控、契约明确的页面、组件和 store。

## 包与资料边界

- 本 skill 随 `wevu` 提供，运行时 API、响应式、生命周期、事件、store 与 router 由该包负责；只使用这些能力不要求安装 `weapp-vite`、克隆框架仓库或加载其他 skill。本文 `references/` 均相对本 skill，运行时入门也可查 [Wevu 文档](https://vite.weapp.dev/wevu/)。
- 构建沿用消费项目自己的工具链。使用 `weapp.*` 配置、`wv` CLI、SFC 宏/模板编译、编译期 layout 或自动类型生成时，才需显式安装 `weapp-vite`；编译器优化不等于仅安装 `wevu` 就会自动生效。
- React 互操作另需 `@weapp-vite/react` 及其 peer dependencies，TDesign/Vant 等 UI 示例另需对应组件库；相关 skill 仅在已安装时可选，不是运行时 API 的前提。
- 验证先读取消费项目 `package.json`，只运行其已有 typecheck、build 与相关测试 scripts，并在目标小程序 IDE/真机检查页面行为。没有 `weapp-vite` 时不运行 `wv prepare/analyze`；不要求框架仓库测试、包构建或发布命令。

## 何时使用

- 用户问 `wevu` 页面或组件应该怎么写。
- 用户问生命周期、hook 时序或 setup 约束。
- 用户问 props / emit / 双向绑定 / store。
- 用户问 `setPageLayout`、`useNativeRouter` 或 `wevu/router`。
- 用户问 AI 应如何保持 wevu 代码和模板约定一致。
- 用户使用纯 `.jsx/.tsx`、Vue 风格 TSX 或 SFC 内 JSX/TSX 编写 Wevu 页面和组件。
- 用户反馈卡顿、掉帧、页面切换慢、白屏、内存告警，且问题主轴在 `wevu` 运行时状态、渲染或副作用管理。

## 不适用场景

本 skill 聚焦运行时行为和状态/事件契约。

- 构建配置和分包：使用 `weapp-vite-best-practices`。
- `.vue` 模板和宏：使用 `weapp-vite-vue-sfc-best-practices`。
- 原生迁移：使用 `native-to-weapp-vite-wevu-migration`。
- 项目级 `weapp.react`、React hooks 或 `@weapp-vite/react` bridge：使用 `weapp-vite-react-best-practices`。

## 核心流程

先确定只读诊断或实施、允许写入与观察目标。读取页面/组件、模板、状态与事件入口、项目 scripts；记录已安装 `wevu`、实际构建工具、Node、包管理器、目标平台及实际 IDE/基础库/renderer 版本，不用声明范围代替安装版本，未取得项明确缺失。按问题选入口，不为独立 runtime 任务引入构建器：
- 状态/事件/hook：带上同步 setup、触发动作与预期文本/payload，进入 `references/component-patterns.md`；检查可序列化状态、注册时序及目标页面交互。缺目标宿主时只给静态诊断，不宣称运行通过。
- `setData`/卡顿：带上更新序列、采样条件与相同输入，进入 `references/runtime-perf-matrix.md`、`references/tuning-recipes.md`；按 observer/revision 关联、物理 dispatch 去重，并另查真实视图。样本容器保持非响应式，按实例/轮次限量收集与清理，避免清空丢掉迟到记录；明确回调、记录和导出本身有观测开销，比较时固定采样配置并保留关闭采样的对照。没有基线先测量，不同时改业务和 runtime；缺测量边界保留缺口。
- store/layout/router：带上状态所有者、调用者、导航或卸载路径，进入 `references/store-patterns.md`、`references/router-runtime-matrix.md`；按所需能力选根入口 helpers 或 router，检查响应性、导航结果和清理，不套 Web 挂载假设。
- JSX/平台能力：先确认现有编译 owner 与已安装依赖；只有接入对应编译链时才判断编译优化。检查目标模板与真实宿主 API；缺编译器或超出目标能力时停止对应结论，不为诊断安装新工具链。

1. 运行时 API 从 `wevu` 导入，页面和组件边界明确；选项式 `data` 若存在，保持函数形式。
2. 生命周期和 hook 必须在同步 `setup()` 中注册，不要在 `await` 之后注册。
   - Fetch SSE 与 EventSource 在同步 setup 注册 `onUnload`，回调执行 `controller.abort()` 或 `source.close()`；不要等请求返回后才注册，也不要把 `onHide` 当成卸载。Response 返回后的流错误仍需处理，reader 使用结束释放锁，异常路径中止请求；controller、reader 和 source 不进入模板状态。`wevu/fetch` 复用 `@wevu/web-apis`，项目级分块、GET/POST 分工及严格能力边界见 [Wevu Fetch SSE](https://vite.weapp.dev/wevu/fetch.html#sse-与响应流)。
3. 响应式更新优先 `ref/reactive/computed`，避免大对象和不透明状态写入；模板状态要可序列化。
   - 同一轮多个 ref/reactive 变更必须由调度器完整合并，不能因先到的刷新任务吞掉后续数组或对象 patch。
4. 事件和双向绑定遵循小程序语义：
   - 事件走 `emit`
   - 通用字段优先 `bindModel/useBindModel`
   - parser / formatter 语义明确
5. layout 与 router 要分清：
   - 运行时 layout 变化走 `setPageLayout` / `usePageLayout`
   - 区分原生 router helpers 与 `wevu/router`
6. 性能问题先分层：
   - `setData` 路径：是否高频整对象回写；使用 `weapp-vite` 编译时再检查 `autoSetDataPick`，独立运行时优化见 `references/tuning-recipes.md`。
   - 阶段测量：显式开启 `debugPhases`，按 observer/revision 关联，按物理 `dispatch.id` 去重；callback、Promise 和同步返回不代表可见视图，缺少边界保留未验证，但已观察到的失败仍是失败，参见 `references/runtime-perf-matrix.md` 的阶段观测。保持既有 `nextTick` 语义，独立执行真实视图断言。
   - render 路径：是否把重逻辑放进 `onPageScroll`
   - navigation 路径：`onHide/onUnload` 是否阻塞
   - resource / memory：图片尺寸、缓存、监听与定时器是否清理
7. store 以小 domain 为先，解构 state/getters 用 `storeToRefs`，避免巨大跨页 store。
   - 使用 `weapp-vite` 的项目可直接判断编译期常量 `import.meta.env.PLATFORM`（`weapp/alipay/tt/swan/jd/xhs/web`），由 `--platform` / `weapp.platform` 注入目标值；不要假定其他工具链具有这些配置或自动替换。
   - Wevu 发布包保留平台表达式供消费构建替换并删除非目标分支；独立工具链未提供目标时保留动态宿主探测。
   - 能力裁剪取决于实际使用与具名导入，不新增能力开关；接入对应 SFC/JSX 编译链后，由 Binding Manifest 安装所需能力，没有创建 router 时不引入首航 guard 状态机。
   - 区分编译器精简入口与公开动态工厂的保守兼容安装；未使用 API/fetch 时可整体移除，已使用的 API/fetch 保留动态跨平台 adapter。
8. 项目已有 `AGENTS.md` 时遵循它；独立运行时写法对照本 skill 的组件、store、router 和性能 references，不依赖其他包的 `dist/docs`。
9. JSX/TSX 中保持小程序事件、class 和组件 tag 语义；编译后的自定义组件标签应为 kebab-case，可选链/空值合并不得残留为目标模板不支持的表达式。
10. 若项目选择静态兼容检查，需显式安装 `@weapp-vite/eslint`，在项目自己的 ESLint 配置启用 `wevuCompatibilityRecommended` 与 `miniProgramRuntimeRecommended`；后者限制 DOM/Node 全局、现代内建和隐式 polyfill。不要假定微信 runtime 存在 `queueMicrotask`，新增宿主 API 前先在目标真实 IDE AppService 中探测。已安装 `weapp-vite` 的旧项目可继续从 `weapp-vite/eslint` 兼容入口导入，不为此默认添加构建器。
11. glass-easel 项目保持静态文本、属性和 Mustache 边界使用标准 WXML 实体转义；仅在项目已安装 `weapp-vite` 时使用 `wv analyze --glass-easel-check` 辅助检查，循环内 `<include>` 和旧式反斜杠引号转义需人工确认语义。

## Router 与平台边界

- 只需要宿主 `navigateTo/redirectTo` 时使用根入口 native router helpers；需要统一 route records、guards、`resolve` 和导航结果时使用 `wevu/router`。
- 小程序路由栈不提供标准前进语义；`router.forward()` 返回预期的 aborted failure，不应当按浏览器 bug 处理。
- `currentRoute` 不是 `Ref`，`isReady()` 立即完成；不要引入 `RouterView` / `RouterLink` 或 Web history。
- router、layout host、页面栈和 request globals 都以小程序生命周期为边界，不能套用浏览器 Vue 的挂载/卸载假设。
- React 项目需要复用 Wevu SFC 时，把 Wevu 组件作为小程序自定义组件注册并由 React bridge 引用；不要让 Wevu 和 React 同时拥有同一个 JSX/TSX 模块。
- 性能回归必须记录高频更新信号、页面切换链路和资源清理结果，再决定是否调整 runtime 或业务状态结构。

Router 选择和迁移见 `references/router-runtime-matrix.md`。

## 约束

- 不要在 `await` 后注册 hooks。
- 不要直接解构 store 丢失响应性。
- Store 以 Pinia 4.0.3 为参照：用 `use(createPinia())` / `app.use(pinia)` 安装，或显式 `useStore(pinia)`；外部 state 自动解包，Setup 自行提供 `$reset`，`$dispose` 保留 manager 状态。`createStore` 是 `createPinia` 的同函数别名，`StoreManager` 继续保留；本次 minor 仍需按 [PR 前后迁移指南](https://vite.weapp.dev/wevu/store-migration) 升级旧消费者。
- 不要返回不可序列化原生实例到模板状态。
- 不要把浏览器 Vue 行为当成 wevu 默认行为。
- 不要在没有基线时同时修改性能、运行时和业务逻辑三类变量。

## 输出

只输出本次运行时风险、实际版本/平台、文件级改动或只读建议、相关兼容边界与最小检查；不要求每次解释 Vue Web、store 或 router。命令必须来自项目已有 scripts/工具，无对应 script 就说明缺口，不编造 `wv` 或框架仓库测试命令。

每项结论用短记录关联：`对象/版本 → 实际命令或动作 → 观察/产物 → 方法、结果、限制`；同一结论可并列记录多种方法，各自结果互不覆盖，建议与已执行分开。缺前提仅阻塞依赖它的操作/验证，继续可达的只读诊断：
- 自动验证 `passed`：实际命令/断言通过，仅覆盖检查到的状态、事件、调度或视图。
- AI 评估 `passed`：列评估者、判据与材料；不等同自动验证，未实际隔离不得称独立。
- 人工确认 `passed`：引用该具体结果及版本的确认，不把计划批准当结果/示例批准。
- 未验证 `not-run`：未执行或前提不足，说明原因；已执行失败按实际方法记 `failed` 并保留证据。类型、构建、`setData` callback/Promise、commit 或 `nextTick` 均不单独证明可见更新；静态结构检查也不证明证据真实或任务执行。

## 完成标记

仅判断本次涉及的 API 来源、页面/组件边界、hook 时序与状态所有权；layout/router/store 未涉及则不适用。遵循已有 `AGENTS.md`，分别列已检查、失败与未验证项，不宣称全部 runtime 能力通过。
- 反馈记录期望/实际、复现与采样前提、证据和限定范围的提议；确定性调度/API 错误优先进入工具或检查，语义/风格先形成候选示例交人工审阅。一次偏好留本次记录；确有复发及具体人工规则决定后才提议长期规则，不自动改源码/全局规则或上传业务数据。
- Skill 永久修订只在获授权的作者检出目录进行，不修改包管理器受管的安装副本（如 `node_modules` 内 Skill 或 `.agents/skills` 指向它的链接）；维护用例留在作者仓库，不随消费包提供，也不是运行时使用前提。

## 参考资料

- `references/component-patterns.md`
- `references/store-patterns.md`
- `references/troubleshooting-checks.md`
- `references/runtime-perf-matrix.md`
- `references/tuning-recipes.md`
- `references/router-runtime-matrix.md`
