---
title: 从旧项目迁移过来
description: 从原生小程序或旧工程结构迁移到 Weapp-vite + 原生，或继续迁移到 Weapp-vite + Wevu + Vue SFC 时，推荐采用分阶段、可回滚的迁移路线。
keywords:
  - handbook
  - migration
  - 迁移
  - 原生小程序
---

# 从旧项目迁移过来

迁移最怕两种做法：

- 一次性全改，最后很难回滚
- 只改一半链路，结果新旧写法互相打架

更稳的思路是：**按阶段迁移，每一阶段都能独立验证。**

## 先决定迁移终点

迁移不一定等于“全量改成 Vue SFC”。常见有两种终点：

- `weapp-vite + 原生`：继续保留 `Page/Component + WXML/WXSS/JSON`，先获得 Vite 构建、TS、别名、资源处理、DevTools、截图日志和 AI 协作能力。
- `weapp-vite + Wevu + Vue SFC`：在前一条路线稳定后，继续把新页面或目标页面族迁到 `.vue`，使用响应式状态和更明确的组件契约。

如果当前项目里有很多复杂插件、`wxs/sjs`、云开发、地图、直播、支付或老旧 Behavior，优先把 `weapp-vite + 原生` 做稳，再挑低风险页面试点 SFC。

## 一条推荐的迁移路线

### 第 1 阶段：先接入 Weapp-vite

这一阶段尽量少碰业务逻辑，目标只是：

- 替换开发与构建体验
- 让项目能通过 Weapp-vite 正常产出 `dist`

这一步完成后，你就已经有了更好的工程化基础。
如果团队只想保留原生开发方式，这一步可以继续收口成明确的阶段性交付，不必强行进入 SFC 迁移。

### 第 2 阶段：整理目录和配置

把这些基础问题先梳理掉：

- 目录结构
- 依赖策略
- 环境变量
- 构建输出

### 第 3 阶段：选择是否试点 SFC

不要一开始就全站改 Vue SFC。
先挑一个低风险、结构清晰的页面。

例如：

- 个人中心首页
- 列表页
- 纯展示详情页

把它改成：

```txt
index.js + index.wxml + index.wxss + index.json
```

变成：

```txt
index.vue
```

并接入 `wevu` 响应式写法。

### 第 4 阶段：抽公共组件、service、store

当试点页稳定后，再开始把公共逻辑抽出来：

- 通用组件
- 请求层
- 状态层

### 第 5 阶段：逐模块推进

例如按业务域推进：

- 商品域
- 订单域
- 用户域

这样每一波迁移的边界都更清楚。

## 一个很实用的迁移判断标准

每次迁移只做一件更大的事：

- 只换构建
- 只换目录
- 只试点一个 SFC 页面
- 只迁移一个业务模块

不要在同一波里同时做：

- 页面改写
- 接口重构
- UI 改版
- 埋点体系调整

## 一个试点页面的迁移示例

原来的原生页面可能是：

```txt
pages/profile/
├─ index.js
├─ index.json
├─ index.wxml
└─ index.wxss
```

迁移后的第一版可以先做到：

```vue
<script setup lang="ts">
import { ref } from 'wevu'

definePageJson(() => ({
  navigationBarTitleText: '个人中心',
}))

const nickname = ref('游客')
</script>

<template>
  <view class="page">
    <text>{{ nickname }}</text>
  </view>
</template>
```

第一版不要追求完美，只要：

- 页面跑通
- 结构稳定
- 可回滚

## 什么叫“可回滚迁移”

就是你每次迁移完一个模块，都能明确回答：

- 如果线上有问题，我能不能只回退这一波改动？
- 新旧页面是否能并存一段时间？
- 配置、路由、资源是否仍然兼容？

## 一份迁移清单

```txt
[ ] 先完成工具链接入
[ ] 目录和配置先整理，再迁移页面
[ ] 从一个低风险页面试点
[ ] 每次只迁移一个业务域
[ ] 每一波迁移都可独立验证和回滚
```

如果你当前正处在迁移期，建议配合这些页面一起看：

- [30 分钟快速开始](/handbook/)
- [先建立 SFC 心智模型](/handbook/sfc/)
- [为什么要用 Wevu](/handbook/wevu/)
