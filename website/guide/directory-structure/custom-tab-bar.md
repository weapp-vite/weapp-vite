---
title: custom-tab-bar
description: 微信自定义 tabBar 的固定保留目录，必须与 app.json 处于同一个 srcRoot 下。
---

# `custom-tab-bar/`

这是微信自定义 tabBar 的固定目录。

## 触发条件

当 `app.json` 中存在：

```json
{
  "tabBar": {
    "custom": true
  }
}
```

`weapp-vite` 会把 `custom-tab-bar/index` 当成固定入口分析。

## 位置要求

- 目录名必须是 `custom-tab-bar`
- 必须和 `app.json` 位于同一个 `srcRoot` 下

如果 `app.json` 在 `<srcRoot>/`，那它就应该是：

```text
<srcRoot>/
  app.json
  custom-tab-bar/
    index.vue
```

它不是普通页面目录，也不通过自动路由发现。
