---
title: 创建项目，跑起来
description: 从零开始创建一个 Weapp-vite + Wevu 小程序项目，写出第一个页面，确认它能在开发者工具里正常运行。
keywords:
  - Weapp-vite
  - Wevu
  - handbook
  - 快速开始
---

# 创建项目，跑起来

这篇教程不讲理论，目标就一个：你跟着做完，能在微信开发者工具里看到自己写的页面。

## 你需要准备什么

- Node.js 22 LTS（`>=22.12.0`）
- pnpm
- 微信开发者工具

如果你后面想用命令行控制开发者工具（打开、预览、上传），记得在开发者工具的设置里开启"服务端口"。

## 创建项目

```bash
pnpm create weapp-vite
```

跟着提示走就行。创建完之后，你会看到大概这样的目录：

```txt
my-app/
├─ src/
│  ├─ app.vue
│  ├─ app.json
│  └─ pages/
│     └─ home/
│        └─ index.vue
├─ vite.config.ts
├─ project.config.json
├─ package.json
└─ AGENTS.md
```

脚手架还会问你要不要装推荐的 AI skills，如果跳过了，后面可以手动装：

```bash
npx skills add sonofmagic/skills
```

## 写第一个页面

打开 `src/pages/home/index.vue`，写一个最简单的计数器：

```vue
<script setup lang="ts">
import { computed, ref } from 'wevu'

definePageJson(() => ({
  navigationBarTitleText: '首页',
}))

const count = ref(0)
const doubled = computed(() => count.value * 2)
</script>

<template>
  <view class="page">
    <text class="title">Hello Weapp-vite</text>
    <text>count: {{ count }}</text>
    <text>doubled: {{ doubled }}</text>
    <button @tap="count++">
      +1
    </button>
  </view>
</template>

<style scoped>
.page {
  padding: 32rpx;
}

.title {
  display: block;
  margin-bottom: 24rpx;
  font-size: 36rpx;
  font-weight: 600;
}
</style>
```

这里面有几个关键点，先记住就行，后面会展开讲：

- `definePageJson()` 是页面配置的宏，用来设置标题、下拉刷新这些
- 响应式 API（`ref`、`computed`）从 `wevu` 导入，不是从 `vue`
- 模板里用的是小程序标签（`view`、`text`、`button`），事件用 `@tap` 不是 `@click`

## 确认页面被路由系统识别

页面写好了，还得确认它被纳入了应用。看一下 `src/app.json`：

```json
{
  "pages": ["pages/home/index"],
  "window": {
    "navigationBarTitleText": "Demo"
  }
}
```

如果你开了自动路由（`weapp.autoRoutes`），这一步可以省掉，`pages/` 下的 `.vue` 文件会被自动扫描。

## 启动开发

```bash
pnpm dev
```

然后用微信开发者工具打开项目的 `dist` 目录（不是 `src`）。你应该能看到页面正常显示，点按钮数字会变。

如果你在用 AI 终端，这几个命令会很常用：

```bash
wv prepare          # 生成类型支持文件
wv ide logs --open  # 把开发者工具的 console 桥接到终端
```

## 跑不起来？先查这几个地方

| 症状             | 先查什么                                                          |
| ---------------- | ----------------------------------------------------------------- |
| 页面白屏         | `app.json` 里有没有这个页面路径                                   |
| 点按钮没反应     | `ref` 是不是从 `wevu` 导入的                                      |
| 数据改了页面没变 | 同上，从 `vue` 导入的 `ref` 在小程序里不会触发更新                |
| 标题没生效       | 看 `dist/pages/home/index.json` 里有没有 `navigationBarTitleText` |
| 开发者工具打不开 | 确认导入的是 `dist` 目录，不是 `src`                              |

## 这套技术栈是怎么分工的

你现在不需要完全理解，但知道这个分工会帮你后面排查问题：

```txt
weapp-vite  → 负责开发、构建、把 .vue 编译成小程序文件
wevu        → 负责运行时：响应式、生命周期、状态管理
你的代码     → 页面、组件、请求、业务逻辑
```

一个 `.vue` 文件最终会变成小程序的四件套：

```txt
dist/pages/home/
├─ index.js      ← 页面逻辑
├─ index.json    ← 页面配置
├─ index.wxml    ← 模板
└─ index.wxss    ← 样式
```

遇到问题的时候，去 `dist` 里看这些文件，比盯着源码猜要快得多。

## 下一步

项目跑起来了，接下来看看[目录怎么放](/handbook/project-structure)比较合理。
