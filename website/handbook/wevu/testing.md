---
title: 测试与 Mock
---

# 测试与 Mock

## 本章你会学到什么

- 在非小程序环境（Vitest/Node）里如何测试 wevu 逻辑
- 需要 stub 哪些全局（`Component`、`triggerEvent` 等）

## 最小原则

- 业务逻辑尽量下沉到纯函数/composable/service：脱离小程序也能测
- 依赖 `Component()` 的部分，在测试中 stub 全局并验证调用参数

## 相关链接

- wevu 运行时提示（Node 环境需要 stub）：`/wevu/runtime#defineComponent：注册页面组件`
