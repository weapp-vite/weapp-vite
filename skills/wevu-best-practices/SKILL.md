---
name: wevu-best-practices
description: 面向小程序中 wevu 运行时的实践手册，覆盖生命周期注册、响应式更新、事件契约、`bindModel/useBindModel`、`setPageLayout/usePageLayout`、根入口 `useNativeRouter/useNativePageRouter`、`wevu/router`、store 约束，以及 `setData`、渲染、页面切换、资源与内存性能治理。
---

# wevu-best-practices

## 用途

在小程序运行时里用 `wevu` 写出边界清晰、更新可控、契约明确的页面、组件和 store。

## 何时使用

- 用户问 `wevu` 页面或组件应该怎么写。
- 用户问生命周期、hook 时序或 setup 约束。
- 用户问 props / emit / 双向绑定 / store。
- 用户问 `setPageLayout`、`useNativeRouter` 或 `wevu/router`。
- 用户问 AI 应如何保持 wevu 代码和模板约定一致。
- 用户反馈卡顿、掉帧、页面切换慢、白屏、内存告警，且问题主轴在 `wevu` 运行时状态、渲染或副作用管理。

## 不适用场景

本 skill 聚焦运行时行为和状态/事件契约。

- 构建配置和分包：使用 `weapp-vite-best-practices`。
- `.vue` 模板和宏：使用 `weapp-vite-vue-sfc-best-practices`。
- 原生迁移：使用 `native-to-weapp-vite-wevu-migration`。

## 核心流程

1. 运行时 API 从 `wevu` 导入，页面和组件边界明确；选项式 `data` 若存在，保持函数形式。
2. 生命周期和 hook 必须在同步 `setup()` 中注册，不要在 `await` 之后注册。
3. 响应式更新优先 `ref/reactive/computed`，避免大对象和不透明状态写入；模板状态要可序列化。
4. 事件和双向绑定遵循小程序语义：
   - 事件走 `emit`
   - 通用字段优先 `bindModel/useBindModel`
   - parser / formatter 语义明确
5. layout 与 router 要分清：
   - 运行时 layout 变化走 `setPageLayout` / `usePageLayout`
   - 区分原生 router helpers 与 `wevu/router`
6. 性能问题先分层：
   - `setData` 路径：是否高频整对象回写、是否启用 `autoSetDataPick`
   - render 路径：是否把重逻辑放进 `onPageScroll`
   - navigation 路径：`onHide/onUnload` 是否阻塞
   - resource / memory：图片尺寸、缓存、监听与定时器是否清理
7. store 以小 domain 为先，解构 state/getters 用 `storeToRefs`，避免巨大跨页 store。
8. 写法同时对照项目根 `AGENTS.md` 和本地 `dist/docs/wevu-authoring.md`。

## 约束

- 不要在 `await` 后注册 hooks。
- 不要直接解构 store 丢失响应性。
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
