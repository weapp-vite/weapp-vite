---
title: FAQ 与排错
description: 收口 Wevu 新用户最常遇到的几个问题，帮助快速判断是导入错误、hooks 时机问题，还是组件协议问题。
keywords:
  - handbook
  - wevu
  - faq
  - 排错
---

# FAQ 与排错

## 为什么我更新了 `ref`，页面没变化？

先查这两件事：

1. `ref/reactive/computed` 是不是从 `wevu` 导入的
2. 模板里是不是真的消费了这份状态

## 为什么某些 hooks 不触发？

优先检查：

- hook 是否在 `setup()` 同步阶段注册
- 这个 hook 对应的宿主触发条件是否真的满足

例如分享、滚动这类能力，本来就不是“页面一进来必然触发”。

## 为什么自定义组件的 `v-model` 不生效？

重点看：

- `v-model` 后面是不是可赋值左值
- 子组件有没有按约定抛出值
- 事件和值字段是不是和你的组件协议一致

## 我什么时候该去怀疑不是 Wevu 问题？

如果你已经看到这些迹象，就优先回头查别层：

- 页面根本没生成
- `usingComponents` 映射不对
- 页面 JSON 配置有误
- 开发者工具导入目录不对

也就是说，不要一看到“页面不更新”就立刻认定是运行时问题。

## 更完整的排错入口

- [调试与排错（按层定位）](/handbook/debugging)
- [Wevu 运行时总览](/wevu/runtime)
- [/troubleshoot/index](/troubleshoot/index)
