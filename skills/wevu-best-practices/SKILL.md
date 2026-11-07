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
   - 阶段测量：显式开启 `debugPhases`，按 observer/revision 关联，按物理 `dispatch.id` 去重；callback、Promise 和同步返回不代表可见视图，缺少边界保持未知，参见 `references/runtime-perf-matrix.md` 的阶段观测。保持既有 `nextTick` 语义，独立执行真实视图断言。
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

应用本 skill 时，输出必须包含：

- 运行时风险摘要。
- 文件级改动建议。
- 相对 Vue Web runtime 的兼容说明。
- 最小验证命令。

## 完成标记

- API 导入来自 `wevu`。
- 页面 / 组件边界清晰。
- hook 注册时序正确。
- layout、router、store 选择有明确理由。
- 与项目 `AGENTS.md` 约定一致。

## 参考资料

- `references/component-patterns.md`
- `references/store-patterns.md`
- `references/troubleshooting-checks.md`
- `references/runtime-perf-matrix.md`
- `references/tuning-recipes.md`
- `references/router-runtime-matrix.md`
