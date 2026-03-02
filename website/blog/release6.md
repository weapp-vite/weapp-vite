---
title: 重走 Vue 长征路 Weapp-vite：原生模式之外，多一种 Vue 选择
description: 还记得在 Weapp-vite 4.0 的发布文章里，我写过这样的话：
keywords:
  - Weapp-vite
  - Wevu
  - 微信小程序
  - 配置
  - 运行时
  - 编译
  - blog
  - release6
date: 2026-02-25
---

![Weapp-vite 6 顶部海报](/6/bg.jpg)

# 重走 Vue 长征路: Weapp-vite：原生模式之外，多一种 Vue SFC 选择

大家好呀，我是你们的老朋友，开源爱好者 [icebreaker](https://github.com/sonofmagic)！又到了新的一年了，祝大家财源滚滚，早日不用上班实现财务自由！

今天主要来分享一下我开源项目 [Weapp-vite](https://github.com/weapp-vite/weapp-vite) 的开发里程碑。核心就是来给大家秀一把。

## 前言

我还记得在过去 Weapp-vite@4.0 的发布文章里，写过这样的话：

> Weapp-vite **不适用场景**：需要使用 `Vue`/`React` 等前端框架的写法，来取代小程序原生写法。

但社区的声音让我重新思考这个定位。原因在于原生小程序的语法确实让人不想写，尤其是对于习惯了 Vue 3 的开发者来说，原生的 `this.setData`、事件绑定、生命周期等都显得非常笨重和不优雅，反衬出 Vue 的 SFC 设计的优秀。

而且即使到了这个 AI 时代，小程序的验收工具也比较笨重，因为小程序缺少 playwright-cli, agent-browser, chrome-devtools-mcp 这类的验收工具, 还原度远远不及 Web。

另外还有一点就是当时我正好在团队里面做[《Vue 编译本质论》](https://deep-in-vue.icebreaker.top/)的技术分享

所以我就在想**能不能把 Weapp-vite 改造成一个既保留原生模式优势，又提供 Vue 开发体验的工具？**

于是，Weapp-vite@6 来了——**在原生模式之外，多一种 Vue 选择**。

## 背景故事：从零运行时到 Vue SFC 支持

### 最初的定位

Weapp-vite 最初的设计理念是做一个**零运行时** 的原生小程序构建工具。用户用原生写法，Weapp-vite 提供现代化的开发体验，保证打出来的包足够小、性能足够好。

这个定位满足了很多只需要开发微信小程序、追求极致性能的用户，尤其是有 Skyline 需求的用户。

但我也在思考：能不能在不破坏原生模式的前提下，给用户一个 Vue 的选择？

### 市面上的选择

让我们看看现有的方案吧：

#### Taro

跨端能力很强，但代价是庞大的运行时代码。分包规划不好，主包容易爆。而且语法是 React/Vue 的"变种"，学习成本不低。

而且目前 Taro 维护的不是很好，issue 积压的比较多。

我也曾经在 2 年前，在他们的公众号上，看到了招聘启事，于是投了简历，结果人家完全没有鸟我(笑～)。

#### uni-app

上手简单，但专属的 DSL 和 `uni.xxx` API 是另一套新东西。uni-app x 那种 uts 和标准 Vue 生态还有社区有点貌合神离。

我很喜欢 uni-app, 当时也很早就让我另外一个项目 weapp-tailwindcss 中兼容了 uni-app x，但是我不喜欢 HBuilderX

#### mpx

滴滴出品，基于 Vue 2.7 + webpack。我不喜欢，因为技术栈较老，而且响应式系统和标准 Vue 不完全一样。

#### Weapp-vite

而我的 `Weapp-vite` 方案，可以看作是 mpx 的升级版：**基于 Vue 3 风格 + Rolldown Vite，专注小程序，保持对原生 API 的兼容**。

### Weapp-vite 的思路

Weapp-vite@6 的思路是：**同一个工具，给你两种模式**。

- **原生模式**：零运行时，极致性能，适合追求包体积和性能的项目
- **Vue 模式**：完整的 Vue 3 开发体验，适合熟悉 Vue 的团队

两者可以在同一个项目中并存，你 `.vue` 组件可以使用原生组件，原生组件也可以使用 `.vue` 组件，你可以根据具体页面/组件的需求来选择。

### 运行时 Wevu 的诞生

转折点是在开发 `wevu` 时——一个专为小程序设计的 Vue 运行时。

当时本来是叫 `wevue` 的，但是这个名字 `npm` 包已经被注册掉了，所以 `trimEnd` 了一个 `e`

`wevu` 保留了 Vue 3 的核心 API——`ref`、`computed`、`watch`、`onMounted` 等，但底层用小程序的 `setData` 做更新。

更重要的是，**Wevu 是设计给 Weapp-vite 中配合 SFC 编译时使用的**，所以可以在编译时尽可能的添加各种的 `糖` 来帮助大家进行快速开发。

### 编译时 + 运行时

既然 `wevu` 运行时已经就绪，Vue SFC 编译支持就是顺水推舟的事了。

## 认识 Wevu：Vue 3 风格的小程序运行时

**Wevu** 是一个专为小程序设计的 Vue 3 风格运行时。它的核心设计理念是：**响应式系统与 Vue 3 同源，渲染层深度适配小程序**。

### 核心特点

- **100% 兼容 Vue 3 响应式 API**：`ref`、`reactive`、`computed`、`watch`、`watchEffect` 等
- **Vue 3 生命周期支持**：`onMounted`、`onUpdated`、`onUnmounted` 等，自动映射到小程序生命周期
- **快照 diff 优化**：最小化 `setData` 调用，只传递变更的数据路径
- **内置状态管理**：`defineStore`/`storeToRefs`，API 类似 Pinia
- **编译协同**：配合 Weapp-vite 的 SFC 编译，提供一致的响应式与生命周期能力

### Vue 3 vs Wevu：实现上的异同

一句话版本：
- **相同点**：响应式 API 和使用方式与 Vue 3 基本一致；
- **差异点**：渲染目标不是 DOM，而是小程序实例，更新链路是“快照 diff + `setData`”。

### 没有使用 `createRenderer` 作为主实现

`@vue/runtime-core` 的 `createRenderer` 是技术上可行的方案，但 Wevu 主线没有采用它，核心是抽象边界不对齐：
- `createRenderer` 要求宿主提供较完整的节点操作语义；
- 小程序实际更新通道是 `setData(payload)`；
- Wevu 主链路是“编译到 WXML + 快照 diff + 最小 setData”，更贴合小程序性能约束。

### Weapp-vite + Wevu 的组合

- **Weapp-vite**：负责**编译时**工作，把 Vue SFC 拆解、转换、生成小程序四件套
- **Wevu**：负责**运行时**工作，提供响应式系统和生命周期

两者结合，你得到的是：
1. Vue 3 风格的开发体验（SFC + Composition API）
2. 几乎小程序原生的运行性能

**把 Vue SFC 支持直接内置到 `weapp-vite` 里**，而不是作为外部插件。

## 一处编写，四处生成

当你创建一个 `.vue` 文件时，Weapp-vite 会悄悄地施展编译魔法：

```
MyComponent.vue
    ├─> MyComponent.js    // 脚本逻辑
    ├─> MyComponent.wxml  // 模板结构
    ├─> MyComponent.wxss  // 样式文件
    └─> MyComponent.json  // 组件配置
```

Vue 的 `<script>`、`<template>`、`<style>`、`<json>`(可被 `defineXXXJson` 宏指令取代) 会被智能拆分并转换成小程序能理解的格式。整个过程就像是把 Vue 组件"翻译"成了小程序的方言。

## Vue 语法无缝转换

Weapp-vite 的 Vue 支持不是简单地把 Vue 代码塞进小程序，而是做了真正聪明的语法转换：

| Vue 写法 | 转换为 |
|:---|:---|
| `v-if` / `v-else-if` / `v-else` | `wx:if` / `wx:elif` / `wx:else` |
| `v-for="item in list"` | <code v-pre>wx:for="{{list}}"</code> + <code>wx:key</code> |
| `@click` / `@tap` | `bindtap` / `catchtap` |
| `:class` / `:style` | <code v-pre>class="{{...}}"</code> / <code v-pre>style="{{...}}"</code> |
| `v-model` | 双向绑定的完整实现（input/checkbox/radio/textarea 等） |
| `<script setup>` | 自动处理响应式和生命周期 |

你用 Vue 的方式思考，Weapp-vite 用小程序的方式执行。

## 工具链友好：智能提示 + AI 协作

### 智能提示友好：复用 Vue 官方插件

在 VS Code 里安装 Vue 官方插件（Vue - Official / Volar）后，Weapp-vite 的 `.vue` 文件可以直接复用成熟的模板智能提示与类型能力，不需要再适配一套全新的编辑器插件链路。

- `v-for` 场景下的 `:key` 等属性补全

![Vue 模板智能提示（v-for + :key）](/6/ic.png)

- `:class` / `:style` 等常用绑定提示
- 组件属性与事件相关补全

![Vue 模板智能提示（原生标签属性补全）](/6/in.png)
![Vue 模板智能提示（组件属性补全）](/6/inc.png)

### AI 友好

只看三件事：`skills`、`MCP`、`llms`。

**Skills**

```bash
npx skills add sonofmagic/skills
pnpm skills:link
```

- 常用：`weapp-vite-best-practices` / `weapp-vite-vue-sfc-best-practices` / `wevu-best-practices`

**MCP**

```bash
weapp-vite mcp
```

- 可选：不在仓库目录执行时，再加 `--workspace-root /path/to/weapp-vite`
- 说明：[/packages/mcp](/packages/mcp)
- 配置：[/config/shared#weapp-mcp](/config/shared#weapp-mcp)

**LLMs**

- 入口：[/llms](/llms)
- 语料：`/llms.txt`、`/llms-full.txt`、`/llms-index.json`
- 推荐读取顺序：`llms.txt -> llms-full.txt -> llms-index.json`

完整 AI 指南：[/guide/ai](/guide/ai)

## 使用用例：保留几个高频场景

### 用例 1：响应式状态 + 计算属性

```html
<script setup lang="ts">
import { computed, ref } from 'wevu'

const count = ref(0)
const doubled = computed(() => count.value * 2)
</script>

<template>
  <view>
    <text>{{ count }} / {{ doubled }}</text>
    <button @tap="count++">+1</button>
  </view>
</template>
```

### 用例 2：`definePageJson` 宏定义页面配置

```html
<script setup lang="ts">
definePageJson({
  navigationBarTitleText: '首页',
  navigationBarTextStyle: 'white',
})
</script>
```

### 用例 3：在 `.vue` 中直接用原生组件

```html
<script setup lang="ts">
import NativeMeter from '../../native/native-meter/index'
</script>

<template>
  <NativeMeter label="构建链能力" :value="80" />
</template>
```

### 用例 4：`v-model` 表单双向绑定

```html
<script setup lang="ts">
import { ref } from 'wevu'

const message = ref('')
</script>

<template>
  <input v-model="message" placeholder="输入点什么..." />
  <text>{{ message }}</text>
</template>
```

更多像 `slots`、`props/emits`、`app.vue` 配置以及编译行为说明，已放到原理文档统一说明：[`Weapp-vite@6 原理拆解`](/blog/release6-principles)。

## 适用场景

### Weapp-vite 的独特优势：双模式并存

与其他框架不同，Weapp-vite@6 支持在同一个项目中同时使用原生模式和 Vue 模式。你可以：

- 核心页面用原生模式，保证极致性能
- 业务页面用 Vue 模式，提升开发效率
- 逐步迁移，不需要一次性重写

### 适合 Vue 模式的场景：
- 你熟悉 Vue 3，想用 Vue 语法写小程序
- 团队有 Vue 技术栈，想复用到小程序
- 追求更优雅的响应式和组件化体验
- 想要热重载、TypeScript 支持等现代开发体验
- 希望 Vue 代码能尽量复用到 Web 项目

### 适合原生模式的场景：
- 需要极致性能，不想任何运行时开销
- 已有大量原生小程序代码，不想大改
- 团队熟悉小程序原生 API
- 对包体积有严格要求

### 什么时候选其他框架？

- **Taro**：如果你真的需要同时支持微信、支付宝、百度、字节等所有平台的小程序，甚至还要编译成 H5、RN，Taro 确实是唯一选择。但大部分项目真的需要跨这么多端吗？

- **uni-app**：如果你需要一个"开箱即用"的一站式解决方案，而且习惯了 DCloud 的生态（HBuilderX、uniCloud 等），uni-app 适合你。但它的专属 DSL 和标准 Vue 有差异。

- **mpx**：基于 Vue 2.7 + webpack，技术栈较老。如果你已经在用美团的小程序生态，可以考虑，否则不建议新项目使用。

**一句话总结**：Weapp-vite@6 的独特之处在于——原生 + Vue 双模式并存，同一个工具，给你两种选择。

## 快速体验

1. **创建项目**：

```sh
pnpm create weapp-vite@latest
# 选择 Wevu 模板或者 Wevu + TDesign 模板
```

2. **开发**：

```sh
pnpm dev
```

3. **享受 Vue 带来的快乐**：

```html
<script setup>
import { ref } from 'wevu'

const message = ref('Hello, weapp-vite@6!')
</script>

<template>
  <view>{{ message }}</view>
</template>
```

## 技术细节

原理和实现细节，如果大家有兴趣的话，我会另外写一篇专门的技术拆解文档。

## 未来计划

接下来我会把 Weapp-vite 的跨端能力继续往前推，重点是两条线：更多小程序平台支持，以及 Web 目标支持。

### Android / iOS 原生现状与后续方向

现在在原生 Android / iOS 侧，很多场景仍然需要借助微信开发者工具提供的多端框架能力来做转换。这个方向后续也会继续投入，目标是把这条链路做得更稳定、更易用，减少迁移和接入成本。

## 最后

Weapp-vite@6 的 Vue SFC 支持建立在：
- `vue/compiler-sfc` 的解析能力
- `wevu` 运行时的精心设计
- 社区对更好开发体验的需求反馈

感谢每一位提出建议、反馈 bug、贡献代码的同学。

Weapp-vite@6 把选择权交给你：
- 需要极致性能？用原生模式
- 需要 Vue 开发体验？用 Vue 模式
- Vue 模式由 Wevu 提供运行时支撑

---

如果 Weapp-vite 帮到了你，欢迎给项目点个 [Star](https://github.com/weapp-vite/weapp-vite)！

Happy Coding! 🚀
