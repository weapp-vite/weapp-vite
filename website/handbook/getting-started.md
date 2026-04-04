---
title: 30 分钟快速开始
description: 用一个最小可运行的小程序页面，带你按顺序完成项目创建、页面编写、开发预览和常见问题排查。
keywords:
  - Weapp-vite
  - handbook
  - getting started
  - 快速开始
  - Vue SFC
  - Wevu
---

# 30 分钟快速开始

这一章的目标很简单：不追求功能完整，只追求你能在 30 分钟内把一个 `Weapp-vite + Vue SFC + Wevu` 的小程序页面跑起来。

跑完这一章，你应该至少能做到：

- 知道项目要怎么创建
- 知道页面文件放在哪
- 知道为什么响应式 API 要从 `wevu` 导入
- 知道页面打不开时该先查什么

## 1. 第 0 步：准备环境

你至少需要这些前置条件：

- Node.js：最低要求 `>=22.12.0`，并且应使用原生稳定支持 ESM 的版本；推荐直接使用当前维护中的 `Node.js 22 LTS`
- `pnpm`
- 微信开发者工具

如果你希望后面能用命令行自动打开/预览/上传，还建议提前在开发者工具里开启“服务端口”。

## 2. 第 1 步：创建项目

最省心的做法是使用模板或脚手架创建项目，然后在这个基础上继续学。

如果你想要的是“立即开始写页面”的体验，优先参考：

- [/guide/](/guide/)
- [/guide/manual-integration](/guide/manual-integration)

一个典型的新项目目录，看起来大概会像这样：

```txt
my-app/
├─ package.json
├─ project.config.json
├─ src/
│  ├─ app.json
│  ├─ app.vue
│  └─ pages/
│     └─ home/
│        └─ index.vue
└─ vite.config.ts
```

如果你使用的是 `create-weapp-vite`，当前初始化流程通常还会额外做两件事：

1. 询问是否安装推荐的 AI skills
2. 在项目根目录生成 `AGENTS.md`

推荐的 skills 安装命令是：

```bash
npx skills add sonofmagic/skills
```

如果你创建项目时先跳过了，也可以后面手动执行。

## 3. 第 2 步：先写一个最小页面

先不要急着做请求、登录、路由守卫。先让页面真的显示出来。

下面是一个足够小、但已经包含核心要素的页面：

```vue
<!-- src/pages/home/index.vue -->
<script setup lang="ts">
import { computed, ref } from 'wevu'

definePageJson(() => ({
  navigationBarTitleText: '首页',
}))

const count = ref(1)
const doubled = computed(() => count.value * 2)

function increase() {
  count.value += 1
}
</script>

<template>
  <view class="page">
    <text class="title">
      Hello Weapp-vite
    </text>
    <text class="value">
      count: {{ count }}
    </text>
    <text class="value">
      doubled: {{ doubled }}
    </text>

    <button @tap="increase">
      点击加一
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

.value {
  display: block;
  margin-bottom: 16rpx;
}
</style>
```

这个例子里有 4 个最重要的点：

- `definePageJson()` 用来声明页面配置
- 响应式 API 从 `wevu` 导入
- 模板仍然写小程序语义，例如 `<view>`、`<text>`、`@tap`
- 样式依然要以小程序宿主约束为准

## 4. 第 3 步：确认页面已经被路由系统看到

页面写好了，不代表开发者工具里就一定能看到。你还需要确认页面入口已经纳入应用。

一个最小 `app.json` 可能长这样：

```json
{
  "pages": ["pages/home/index"],
  "window": {
    "navigationBarTitleText": "Demo"
  }
}
```

如果你使用的是自动路由方案，则要确认：

- 路由规则已经开启
- 页面路径符合项目约定
- 最终输出里确实生成了该页面对应的 `.json/.js/.wxml/.wxss`

## 5. 第 4 步：启动开发

通常直接运行：

```bash
pnpm dev
```

跑起来后，你需要观察的是这 3 个点：

1. 控制台里没有明显的编译错误。
2. 开发者工具导入的根目录正确。
3. 页面能正常展示并响应按钮点击。

如果你当前是在 AI 终端里工作，还可以顺手记住这三个高频命令：

```bash
wv prepare
wv ide logs --open
wv screenshot --project ./dist/build/mp-weixin --page pages/home/index --output .tmp/home.png --json
```

它们分别对应：

- 生成 `.weapp-vite` 支持文件
- 把 DevTools console 桥接回终端
- 做一次真实小程序运行时截图

## 6. 第 5 步：学会看“最终产物”

很多新用户只看源码，不看构建产物。这个习惯在小程序里很容易误判问题。

你至少要知道，一个页面最终会变成什么：

```txt
dist/pages/home/
├─ index.js
├─ index.json
├─ index.wxml
└─ index.wxss
```

如果你怀疑“明明源码是对的，为什么开发者工具里不对”，就要回到产物里看：

- `index.json` 页面标题对不对
- `index.wxml` 模板有没有被正确编译
- `index.js` 有没有输出

## 7. 第 6 步：最常见的 6 个问题

### 7.1 页面白屏

先查：

- `app.json.pages` 有没有包含该页面
- 页面路径和目录名是不是写错了
- 控制台有没有组件路径或 JSON 配置错误

### 7.2 点击按钮没有反应

先查：

- 模板里是不是用的 `@tap`
- 方法名是否拼错
- 响应式值是不是从 `wevu` 导入

### 7.3 数据改了但页面没更新

优先检查：

```ts
import { ref } from 'wevu'
```

而不是：

```ts
import { ref } from 'vue'
```

### 7.4 页面标题没生效

检查 `definePageJson()` 是否输出了：

```ts
definePageJson(() => ({
  navigationBarTitleText: '首页',
}))
```

### 7.5 样式不对

先看：

- 是否用了小程序不支持的 CSS 能力
- `scoped` 后选择器是否符合预期
- 最终输出到 `wxss` 后有没有异常

### 7.6 构建正常，开发者工具里还是打不开

通常是工程根目录没对齐。你需要确认开发者工具看的到底是不是 `dist`。

## 8. 速查表

| 你要确认的事情      | 对应检查点                                   |
| ------------------- | -------------------------------------------- |
| 页面能否被识别      | `app.json.pages` 或自动路由输出是否正确      |
| 页面能否被编译      | `dist/pages/**` 是否生成 `json/js/wxml/wxss` |
| 页面能否响应更新    | 响应式 API 是否从 `wevu` 导入                |
| 页面能否在 IDE 打开 | 开发者工具根目录是否指向正确产物             |
| 类型提示是否稳定    | 是否执行过 `wv prepare`                      |
| AI 是否读对项目说明 | 是否先读取根目录 `AGENTS.md`                 |

## 9. 接下来该学什么

项目跑起来以后，最容易乱的是目录和分层。所以建议下一章直接看：

- [目录结构怎么放最顺手](/handbook/project-structure)
- [环境变量与配置怎么分层](/handbook/env-and-config)
- [先建立 SFC 心智模型](/handbook/sfc/)
- [AI 协作指南](/guide/ai)

## 10. 参考资源

| 主题           | 推荐入口                                               |
| -------------- | ------------------------------------------------------ |
| Guide 快速开始 | [/guide/](/guide/)                                     |
| 手动接入       | [/guide/manual-integration](/guide/manual-integration) |
| 配置总览       | [/config/](/config/)                                   |
| 调试排错       | [/handbook/debugging](/handbook/debugging)             |
