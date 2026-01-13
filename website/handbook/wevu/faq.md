---
title: FAQ 与排错
---

# FAQ 与排错

## Q1：为什么我更新了 ref，但页面没变？

- 确认 `ref/reactive` 来自 `wevu` 而不是 `vue`
- 确认该状态确实被模板使用（不在模板中使用不会触发渲染变化）

## Q2：为什么 onPageScroll/onShareAppMessage 不触发？

- 分享/滚动等事件属于“按需派发”，必须满足微信官方触发条件
- 另外 hooks 需要在 `setup()` 同步阶段注册

## Q3：为什么自定义组件 v-model 不生效？

- 确认 v-model 表达式是可赋值左值
- 确认组件触发了 `input` 事件，并在 `detail.value` 回传新值

## 更多排错入口

- wevu：`/wevu/runtime`
- SFC：`/wevu/vue-sfc`
- 常见问题：`/troubleshoot/index`
