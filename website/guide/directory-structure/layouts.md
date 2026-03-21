---
title: <srcRoot>/layouts
description: 说明 srcRoot/layouts 目录的职责、命名规则，以及它如何与 definePageMeta、routeRules、setPageLayout 协同工作。
keywords:
  - layouts
  - directory structure
  - definePageMeta
  - routeRules
  - setPageLayout
---

# `<srcRoot>/layouts/`

`<srcRoot>/layouts/` 是 `weapp-vite` 页面 layout 的约定目录。它的职责不是放普通业务组件，而是放“页面外壳”。

## 1. 这个目录解决什么问题

如果很多页面都要重复包一层：

- 统一头部
- 统一底部
- 统一侧边栏
- 统一内容容器

那这些结构更适合放在 `layouts/`，而不是在每个页面里手动重复引用。

| 放在这里的内容                             | 不建议放在这里的内容          |
| ------------------------------------------ | ----------------------------- |
| 页面级外壳组件                             | 普通业务组件                  |
| 后台壳、营销页壳、沉浸式壳                 | 单个页面独享的小组件          |
| 供 `definePageMeta({ layout })` 命中的布局 | 按钮、卡片、列表项一类通用 UI |

## 2. 一个典型目录长什么样

```txt
src/
├─ layouts/
│  ├─ default.vue
│  ├─ admin.vue
│  └─ native-shell/
│     ├─ index.json
│     ├─ index.wxml
│     ├─ index.wxss
│     └─ index.ts
└─ pages/
```

## 3. 名称是怎么推导的

layout 名称由相对 `layouts/` 的路径推导：

| 文件位置                       | layout 名      |
| ------------------------------ | -------------- |
| `layouts/default.vue`          | `default`      |
| `layouts/admin.vue`            | `admin`        |
| `layouts/native-shell/index.*` | `native-shell` |

> **注意**：`default` 是默认布局名。只要它存在，页面在没有显式声明 layout 时，就会优先尝试命中它。

## 4. 支持哪些实现形式

### 4.1 Vue layout

适合已经全面使用 Vue SFC 的项目：

```vue
<template>
  <view class="layout-default">
    <slot />
  </view>
</template>
```

### 4.2 原生 layout

适合原生小程序页面或渐进迁移项目：

```txt
layouts/native-shell/
├─ index.json
├─ index.wxml
├─ index.wxss
└─ index.ts
```

其中 `index.json` 需要声明为组件：

```json
{
  "component": true
}
```

## 5. 它会和哪些能力协同工作

| 能力                         | 作用                          |
| ---------------------------- | ----------------------------- |
| `definePageMeta({ layout })` | 页面显式指定 layout           |
| `weapp.routeRules`           | 批量声明默认 layout           |
| `setPageLayout()`            | 运行时显式切换当前页面 layout |
| `usePageLayout()`            | 读取当前页面 layout 状态      |

## 6. 使用时最容易踩的坑

### 6.1 把普通组件放进 `layouts/`

不推荐：

```txt
src/layouts/ProductCard.vue
```

更推荐：

```txt
src/components/ProductCard.vue
```

因为 `layouts/` 的语义是页面壳，不是普通 UI 组件目录。

### 6.2 以为 `layout` 可以写成动态表达式

不推荐：

```ts
definePageMeta({
  layout: currentLayout.value,
})
```

推荐：

```ts
setPageLayout('admin')
```

因为 `definePageMeta({ layout })` 是编译期静态分析，动态切换要交给运行时 API。

## 7. 总结

`<srcRoot>/layouts/` 的重点不在“多一个目录”，而在于把页面外壳从页面内容里抽出来，形成稳定的复用层。

如果你的项目准备启用 layout，建议最少先准备这两类：

1. `default`
2. 一个命名 layout，例如 `admin`

## 8. 参考资源

| 主题                  | 推荐入口                                                            |
| --------------------- | ------------------------------------------------------------------- |
| 页面 Layout 使用指南  | [guide/layouts](/guide/layouts)                                     |
| Route Rules 与 Layout | [config/route-rules](/config/route-rules)                           |
| `<srcRoot>/`          | [directory-structure/src-root](/guide/directory-structure/src-root) |
