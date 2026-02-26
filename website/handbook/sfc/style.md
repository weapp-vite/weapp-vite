---
title: 样式：wxss / scoped / 预处理器
description: 样式：wxss / scoped / 预处理器，聚焦 handbook / sfc 相关场景，覆盖 weapp-vite 与 wevu
  的能力、配置和实践要点。
keywords:
  - handbook
  - sfc
  - style
  - 样式：wxss
  - /
  - scoped
  - 预处理器
  - 聚焦
---

# 样式：wxss / scoped / 预处理器

## 本章你会学到什么

- 在 SFC 里写样式，最终如何落到 WXSS
- scoped、选择器限制、样式顺序等常见坑

## 你要记住的 3 件事

- 小程序选择器能力弱于 Web：写样式要更克制。
- `scoped` 不是浏览器的 shadow dom：它是编译期选择器改写。
- 样式顺序与注入策略会影响覆盖：团队最好统一主要预处理器（例如统一 scss）。

## 相关链接

- wxss 细节与坑位：`/guide/wxss`
