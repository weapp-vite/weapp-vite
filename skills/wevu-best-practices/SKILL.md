---
name: wevu-best-practices
description: 面向小程序中 wevu 运行时的实践手册，覆盖生命周期注册、响应式更新、事件契约、`bindModel/useBindModel`、`setPageLayout/usePageLayout`、根入口 `useNativeRouter/useNativePageRouter`、`wevu/router`、store 约束，以及和脚手架 `AGENTS.md`、本地 `dist/docs/wevu-authoring.md` 对齐的当前 wevu 写法。
---

# wevu-best-practices

## 目的

在小程序运行时里用 `wevu` 写出边界清晰、更新可控、契约明确的页面、组件和 store。

## 触发信号

- 用户问 `wevu` 页面或组件应该怎么写。
- 用户问生命周期、hook 时序或 setup 约束。
- 用户问 props / emit / 双向绑定 / store。
- 用户问 `setPageLayout`、`useNativeRouter` 或 `wevu/router`。
- 用户问 AI 应如何保持 wevu 代码和模板约定一致。

## 适用边界

本 skill 聚焦运行时行为和状态/事件契约。

以下情况不应作为主 skill：

- 主要是构建配置和分包。使用 `weapp-vite-best-practices`。
- 主要是 `.vue` 模板和宏。使用 `weapp-vite-vue-sfc-best-practices`。
- 主要是原生迁移。使用 `native-to-weapp-vite-wevu-migration`。

## 快速开始

1. 确认 API 从 `wevu` 导入。
2. 确认 hook 在同步 `setup()` 中注册。
3. 明确状态、事件和 store 边界。
4. 对照项目根 `AGENTS.md` 和本地 `dist/docs/wevu-authoring.md`。

## 执行流程

1. 建立运行时约定

- 业务代码里的运行时 API 从 `wevu` 导入
- 页面和组件的上下文边界要明确
- 选项式 `data` 若存在，保持函数形式

2. 校验时序

- 生命周期注册放在同步 `setup()` 中
- 不要在 `await` 之后注册 hooks

3. 规范响应式更新

- 优先 `ref/reactive/computed`
- 避免大对象、不透明状态写入
- 记住模板状态要可序列化、可同步到小程序快照

4. 规范事件与双向绑定

- 事件使用小程序语义的 `emit`
- 通用字段契约优先 `bindModel/useBindModel`
- 值转换要明确 parser / formatter

5. 处理 layout 与 router

- 运行时 layout 变化用 `setPageLayout` / `usePageLayout`
- 区分：
  - 原生 router helpers
  - `wevu/router`

6. store discipline

- 小 domain 优先 Setup Store
- 解构 state/getters 用 `storeToRefs`
- 不要轻易做巨大跨页 store

## 约束

- 不要在 `await` 后注册 hooks。
- 不要直接解构 store 丢失响应性。
- 不要返回不可序列化原生实例到模板状态。
- 不要把浏览器 Vue 行为当成 wevu 默认行为。

## 输出要求

应用本 skill 时，输出必须包含：

- 运行时风险摘要。
- 文件级改动建议。
- 相对 Vue Web runtime 的兼容说明。
- 最小验证命令。

## 完成检查

- API 导入来自 `wevu`。
- 页面 / 组件边界清晰。
- hook 注册时序正确。
- layout、router、store 选择有明确理由。
- 与项目 `AGENTS.md` 约定一致。

## 参考资料

- `references/component-patterns.md`
- `references/store-patterns.md`
- `references/troubleshooting-checks.md`
