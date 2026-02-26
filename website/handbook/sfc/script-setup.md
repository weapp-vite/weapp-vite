---
title: Script Setup：推荐范式
description: Script Setup：推荐范式，聚焦 handbook / sfc 相关场景，覆盖 weapp-vite 与 wevu 的能力、配置和实践要点。
keywords:
  - Vue SFC
  - handbook
  - sfc
  - script
  - setup
  - Setup：推荐范式
  - 聚焦
  - /
---

# Script Setup：推荐范式

## 本章你会学到什么

- 用 `<script setup lang="ts">` 组织页面/组件逻辑的推荐写法
- 如何写出 IDE 友好的组件引入方式
- 如何统一 App 入口为 `app.vue`

## 基本原则

- 响应式与 hooks：从 `wevu` 导入
- 页面组件引入：优先 `import .vue`，避免手写 `usingComponents`
- 小程序 JSON 配置：优先使用 `defineAppJson / definePageJson / defineComponentJson`
- App 入口：优先 `app.vue`（而不是 `app.ts + app.json` 分离）

## 页面示例（推荐）

```vue
<script setup lang="ts">
import ComputedClassExample from '../../components/issue-289/ComputedClassExample/index.vue'
import MapClassExample from '../../components/issue-289/MapClassExample/index.vue'
import ObjectLiteralExample from '../../components/issue-289/ObjectLiteralExample/index.vue'
import RootClassExample from '../../components/issue-289/RootClassExample/index.vue'
</script>

<template>
  <view class="issue289-page">
    <ObjectLiteralExample />
    <MapClassExample />
    <RootClassExample />
    <ComputedClassExample />
  </view>
</template>
```

## App 示例（推荐 `app.vue`）

```vue
<script setup lang="ts">
import { onLaunch } from 'wevu'

defineAppJson({
  pages: [
    'pages/issue-289/index',
  ],
})

onLaunch(() => {})
</script>
```

## 常见坑

- hooks 不要写在异步回调里：必须在 `setup()` 同步阶段注册
- `ref/reactive` 误从 `vue` 导入：会导致状态更新与小程序 diff 链路脱节
- 组件仍靠手写 `usingComponents`：会损失一部分类型提示与重构体验
