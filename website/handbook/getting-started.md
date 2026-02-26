---
title: 快速开始（教程版）
description: 建议优先用仓库模板/脚手架创建项目，然后对照本教程逐步添加能力。
keywords:
  - Vue SFC
  - handbook
  - getting
  - started
  - 快速开始（教程版）
  - 建议优先用仓库模板/脚手架创建项目
  - 然后对照本教程逐步添加能力。
---

# 快速开始（教程版）

## 本章你会学到什么

- 如何把项目在 **Weapp-vite + Vue SFC + Wevu** 的组合下跑起来（能在开发者工具里看到页面）
- 常见“跑不起来”的排查路径

## 1. 先决条件

- Node.js（要求 `^20.19.0 || >=22.12.0`）
- pnpm（仓库为 pnpm workspace）
- 微信开发者工具（建议开启“服务端口”，方便 `weapp open/preview/upload`）

## 2. 最短路径：用模板创建

建议优先用仓库模板/脚手架创建项目，然后对照本教程逐步添加能力。

- 快速开始（模板/命令）：`/guide/`
- 手动集成：`/guide/manual-integration`

## 3. Vue SFC 最小页面（只演示形态）

> 关键点：运行时 API 从 `wevu` 导入；页面 JSON 推荐用 Script Setup JSON 宏注入。

```vue
<!-- pages/counter/index.vue -->
<script setup lang="ts">
import { computed, ref } from 'wevu'

definePageJson(() => ({
  navigationBarTitleText: '计数器',
}))

const count = ref(0)
const doubled = computed(() => count.value * 2)
const inc = () => (count.value += 1)
</script>

<template>
  <view class="page">
    <text>count: {{ count }} / doubled: {{ doubled }}</text>
    <button @tap="inc">
      +1
    </button>
  </view>
</template>
```

更多 SFC 与宏说明：`/wevu/vue-sfc`

## 4. 常见问题速查

- **页面不显示 / 白屏**：先看开发者工具控制台、网络面板；再检查 `app.json.pages` 是否包含目标页。
- **组件不渲染**：确认 `usingComponents` 已声明（详见 `/handbook/sfc/components`）。
- **数据不更新**：确认响应式来自 `wevu`（而不是 `vue`）；并检查是否在 `setup()` 同步阶段注册了 hooks。
