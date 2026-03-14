---
title: pages
description: 主包页面目录，是自动路由的默认扫描入口之一。
---

# `pages/`

这是主包页面目录，也是自动路由的默认扫描入口之一。

## 默认扫描规则

开启 `weapp.autoRoutes` 后，默认只扫描：

- `<srcRoot>/pages/**`
- 已声明分包 root 下的 `pages/**`

不会直接扫描全局 `**/pages/**`。

## 这样设计的原因

为了避免误伤，例如这些目录不应该被当成页面：

- `<srcRoot>/components/pages/**`
- `<srcRoot>/features/demo/pages/**`

## 页面目录的常见形态

```text
<srcRoot>/
  pages/
    profile/
      index.ts
      index.wxml
      index.json
      index.scss
```

或：

```text
<srcRoot>/
  pages/
    profile/
      index.vue
      index.json
```

## 识别规则

只要命中页面扫描规则，并且同一路径下存在脚本、模板、配置之一，就可以被识别成页面；但如果 `json.component === true`，则会被视为组件。
