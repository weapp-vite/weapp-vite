---
title: app.vue
description: Vue SFC 形式的应用入口，可在一个文件中组织脚本、defineAppJson 宏与样式。
keywords:
  - app.vue
  - Vue SFC
  - defineAppJson
  - 目录结构
---

# `app.vue`

`app.vue` 是 Weapp-vite + Vue SFC 场景下非常常见的应用入口。

## 它适合解决什么

- 希望把应用脚本、应用配置和样式放在一个 SFC 中维护
- 想直接在顶层使用 `defineAppJson`
- 想在应用入口里直接创建 router、store 或其他全局运行时能力

## 典型写法

```vue
<script setup lang="ts">
import { defineAppJson } from 'weapp-vite/json'

defineAppJson({
  pages: ['pages/index/index'],
})
</script>

<style src="./app.css"></style>
```

## 它和 `app.(js|ts)` / `app.json(.js|.ts)?` / `app.(css|scss|wxss|...)` 的关系

可以把 `app.vue` 理解为一种“组合式入口”：

- 脚本逻辑在 `<script setup>` 或普通 `<script>` 中表达
- JSON 配置通过 `defineAppJson` 或 `<json>` 块表达
- 全局样式通过 `<style>` 或 `src="./app.css"` 这类方式表达

如果你已经使用 `app.vue`，很多场景下就不需要再单独维护 `app.ts`。
