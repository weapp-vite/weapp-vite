---
title: app.json(.js|.ts)?
description: 应用配置入口，既支持原生 JSON，也支持 app.json.js 和 app.json.ts 这类脚本化形式。
---

# `app.json(.js|.ts)?`

`app.json(.js|.ts)?` 是小程序应用配置入口。

## 支持哪些形式

- `app.json`
- `app.json.js`
- `app.json.ts`

## 它通常负责

- `pages`
- `subPackages`
- `tabBar`
- `appBar`
- 全局窗口配置

## 和目录结构的关键关系

- `tabBar.custom === true` 时，会启用 [`custom-tab-bar/`](/guide/directory-structure/custom-tab-bar)
- 配置了 `appBar` 时，会启用 [`app-bar/`](/guide/directory-structure/app-bar)
- 如果你开启了自动路由，可以通过脚本方式把扫描结果写回这里

## 什么时候用脚本化形式

如果你的配置需要消费变量、函数结果或自动路由数据，`app.json.ts` / `app.json.js` 会比纯 JSON 更合适。

```ts
import autoRoutes from 'weapp-vite/auto-routes'
import { defineAppJson } from 'weapp-vite/json'

export default defineAppJson({
  pages: autoRoutes.pages,
  subPackages: autoRoutes.subPackages,
})
```
