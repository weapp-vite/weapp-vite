---
title: Setup Context API
description: 本页严格对应 wevu 源码中的 setup 上下文相关导出（runtime/hooks.ts、runtime/provide.ts、runtime/register.ts、runtime/vueCompat.ts）。
outline:
  level: [3, 3]
keywords:
  - Wevu
  - api
  - setup
  - context
---

# Setup Context API（setup 上下文）

`setup(props, ctx)` 的字段语义来自 `SetupContext` 类型；本页重点列出可直接导入调用的公开 API。

`ctx` 常见字段（类型定义语义）：

- `ctx.runtime`：当前 `RuntimeInstance`
- `ctx.instance`：原生小程序实例
- `ctx.emit`：事件派发函数

<!--@include: ../../.partials/wevu-api/setup-context/01-实例与上下文访问-api.md-->

<!--@include: ../../.partials/wevu-api/setup-context/02-依赖注入-api.md-->

<!--@include: ../../.partials/wevu-api/setup-context/03-setup-兼容工具-api.md-->

<!--@include: ../../.partials/wevu-api/setup-context/04-示例.md-->
