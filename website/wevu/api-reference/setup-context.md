---
title: Setup Context API（旧路径兼容）
description: 当前 Setup Context API 的规范入口是 /wevu/api/setup-context，本页仅用于兼容旧链接。
sidebar: false
keywords:
  - wevu
  - api-reference
  - setup-context
  - 兼容路径
---

# Setup Context API（旧路径兼容）

当前请改用新的规范入口：

- [Setup Context API](/wevu/api/setup-context)

## 1. 为什么优先使用新路径

`setup` 上下文相关 API 仍在持续演进，例如：

- `useNativeRouter()` / `useNativePageRouter()` 的语义边界
- `provideGlobal()` / `injectGlobal()` 的弃用说明
- `usePageLayout()` / `setPageLayout()` 等页面运行时辅助能力

这些更新会优先落在新的 `/wevu/api/setup-context` 页面。

## 2. 迁移建议

如果你在旧文档里使用了以下链接，请逐步替换：

- `/wevu/api-reference/setup-context`
- `/wevu/api-reference/setup-context#provideglobal`

替换为：

- [/wevu/api/setup-context](/wevu/api/setup-context)
- [/wevu/api/setup-context#provideglobal](/wevu/api/setup-context#provideglobal)

## 3. 参考资源

| 主题               | 推荐入口                                       |
| ------------------ | ---------------------------------------------- |
| Setup Context API  | [Setup Context API](/wevu/api/setup-context)   |
| Runtime Bridge API | [Runtime Bridge API](/wevu/api/runtime-bridge) |
| wevu/router        | [wevu/router](/wevu/router)                    |
