---
title: 兼容性与注意事项
---

# 兼容性与注意事项

- **运行环境**：wevu 依赖 `Proxy` / `WeakMap` / `Symbol` 等能力，建议微信小程序基础库 ≥ 3.0.0；模板/样式/配置通常配合 weapp-vite 构建产物使用。
- **无 DOM/浏览器 API**：不要使用 `window`/`document`，请使用小程序原生能力（如 `wx.request`）。
- **defineComponent 的前提**：`defineComponent()` 会直接调用全局 `Component()`，请确保代码在小程序运行时执行（或测试环境自行 stub）。
- **createApp 的行为**：`createApp()` 只会在检测到全局 `App()` 时自动注册；否则仅返回运行时对象，适用于测试或自定义适配。
- **生命周期钩子约束**：所有钩子必须在 `setup()` 同步阶段调用；分享/收藏/退出状态等“返回值型钩子”为单实例（后注册覆盖先注册）。
- **页面事件按需派发**：如 `onPageScroll`/分享/朋友圈/收藏等，只有定义了对应页面方法才会触发；wevu 也仅在你定义了这些页面方法时桥接 `setup()` 中注册的同名 hooks。
- **Vue 别名的差异**：`onBeforeMount/onBeforeUnmount` 在 `setup()` 同步阶段立即执行；`onBeforeUpdate/onUpdated` 当前版本尚未在 `setData` 前后自动派发（仅提供注册 API）。
- **Provide/Inject 的限制**：当前版本没有组件树父子指针，`inject()` 不会向上查找祖先组件；组件内只会命中“当前实例提供的值”，否则回落到全局存储。
- **watch 深度策略**：`deep` 默认采用“版本信号”策略（不做深层遍历），可通过 `setDeepWatchStrategy('traverse')` 切换为遍历策略。
- **setData diff 规则**：缺失字段与 `undefined` 会被归一化为 `null`；运行时只下发 state + computed 的差量路径；`setData()` 返回 Promise 时会吞掉 reject 以避免阻塞更新链路。
- **组件与模板规则**：小程序组件必须在 `<json>` 的 `usingComponents` 声明；`@tap`、`v-if`、`v-for` 等语法由编译侧（如 weapp-vite）转换为 WXML。
- **样式**：输出为 `wxss`；即使使用 SFC 的 `scoped`，仍需遵守小程序样式能力与选择器限制。
