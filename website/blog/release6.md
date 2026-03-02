---
title: Weapp-vite：原生模式之外，多一种 Vue 选择
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

# Weapp-vite：原生模式之外，多一种 Vue SFC 选择

大家好呀，我是你们的老朋友，开源爱好者 [icebreaker](https://github.com/sonofmagic)！又到了新的一年了，祝大家财源滚滚，早日不用上班实现财务自由！

今天主要来分享一下我开源项目 [Weapp-vite](https://github.com/weapp-vite/weapp-vite) 的开发里程碑，核心就是来给大家秀一把。

## 前言

我还记得在过去 Weapp-vite@4.0 的发布文章里，写过这样的话：

> Weapp-vite **不适用场景**：需要使用 `Vue`/`React` 等前端框架的写法，来取代小程序原生写法。

但社区的声音让我重新想了想这个定位。说实话，原生小程序的语法写多了确实烦，尤其是你要是平时写 Vue 3 写习惯了，回头再 `this.setData`、手动绑事件、管生命周期，就会觉得特别笨重。Vue 的 SFC 设计确实好用，这个没什么好争的。

而且即使到了这个 AI 时代，小程序的验收工具也比较笨重，因为小程序缺少 playwright-cli, agent-browser, chrome-devtools-mcp 这类的验收工具, 还原度远远不及 Web。

另外还有一点就是当时我正好在团队里面做[《Vue 编译本质论》](https://deep-in-vue.icebreaker.top/)的技术分享

所以我就在想**能不能把 Weapp-vite 改造成一个既保留原生模式优势，又提供 Vue 开发体验的工具？**

于是，Weapp-vite@6 来了——**在原生模式之外，多一种 Vue 选择**。

## 背景故事：从零运行时到 Vue SFC 支持

### 最初的定位

Weapp-vite 一开始就是奔着**零运行时**去的——一个纯粹的原生小程序构建工具。你用原生写法写代码，它给你提供现代化的开发体验，打出来的包尽量小、跑起来尽量快。

这个定位确实满足了不少用户，特别是只做微信小程序、对性能有洁癖的那批人，还有用 Skyline 的。

但我后来一直在琢磨：能不能在不动原生模式的前提下，再给一个 Vue 的选项？

### 市面上的选择

让我们看看现有的方案吧：

#### Taro

跨端能力确实强，但运行时代码量不小。分包没规划好的话，主包很容易超。语法上虽然说支持 React/Vue，但写起来总有种"变种"的感觉，踩坑成本不低。

而且说实话 Taro 现在维护节奏慢了不少，issue 堆得挺多的。

我也曾经在 2 年前，在他们的公众号上，看到了招聘启事，于是投了简历，结果人家完全没有鸟我(笑～)。

#### uni-app

上手是挺快的，但 `uni.xxx` 那套 API 和专属 DSL 毕竟是另一套东西。uni-app x 搞的 uts，跟标准 Vue 生态和社区总感觉有点貌合神离。

我很喜欢 uni-app, 当时也很早就让我另外一个项目 weapp-tailwindcss 中兼容了 uni-app x，但是我不喜欢 HBuilderX

#### mpx

滴滴出品，基于 Vue 2.7 + webpack。我不喜欢，技术栈老了，响应式系统跟标准 Vue 也不完全一样。

我的 `Weapp-vite` 方案，你可以理解成 mpx 的下一代：**Vue 3 风格 + Rolldown Vite，只做小程序，但跟原生 API 完全兼容**。

### Weapp-vite 的思路

Weapp-vite@6 想做的事情很简单：**同一个工具，两种模式**。

- **原生模式**：零运行时，包体积和性能都拉满，适合对这些有要求的项目
- **Vue 模式**：完整的 Vue 3 写法，适合 Vue 技术栈的团队

两者可以在同一个项目里混着用。`.vue` 组件能引原生组件，原生组件也能引 `.vue` 组件，按页面按组件自己选就行。

### 运行时 Wevu 的诞生

转折点是 `wevu` 的出现——一个专门给小程序写的 Vue 运行时。

当时本来是叫 `wevue` 的，但是这个名字 `npm` 包已经被注册掉了，所以 `trimEnd` 了一个 `e`

`wevu` 保留了 Vue 3 那些核心 API——`ref`、`computed`、`watch`、`onMounted` 之类的，但底层更新走的是小程序的 `setData`。

更重要的是，**Wevu 从一开始就是配合 Weapp-vite 的 SFC 编译来设计的**，所以编译时能加的糖都尽量加上了，写起来会比较顺手。

### 编译时 + 运行时

`wevu` 运行时搞定之后，Vue SFC 编译支持就是顺水推舟的事了。

## 认识 Wevu：给小程序写的 Vue 3 风格运行时

**Wevu** 专门给小程序设计，核心思路就是：**响应式那套跟 Vue 3 同源，渲染层按小程序的规矩来**。

### 它能干什么

- `ref`、`reactive`、`computed`、`watch`、`watchEffect` 这些响应式 API 都有，用法跟 Vue 3 一样
- `onMounted`、`onUpdated`、`onUnmounted` 等生命周期钩子，自动映射到小程序对应的生命周期
- 快照 diff 优化，`setData` 只传变了的数据路径，不会整坨丢过去
- 内置了 `defineStore`/`storeToRefs`，用法跟 Pinia 差不多
- 跟 Weapp-vite 的 SFC 编译配合使用，响应式和生命周期都是打通的

### Vue 3 和 Wevu 到底哪不一样

响应式 API 和写法基本一致，区别在渲染那层：Wevu 不操作 DOM，而是操作小程序实例，更新走的是"快照 diff + `setData`"。

### 为什么没用 `createRenderer`

`@vue/runtime-core` 的 `createRenderer` 技术上能做，但拿来对小程序有个根本问题：它假设宿主能提供一套比较完整的节点操作接口，而小程序这边核心就一个 `setData(payload)`，两边的抽象对不上。

Wevu 走的是"编译到 WXML + 快照 diff + 最小 setData"，把优化做在更贴近小程序实际情况的地方。

### Weapp-vite + Wevu 怎么配合

- **Weapp-vite** 管编译：把 Vue SFC 拆开、转换、生成小程序四件套
- **Wevu** 管运行时：提供响应式系统和生命周期

两个加一起，你得到的就是：
1. Vue 3 的开发体验（SFC + Composition API）
2. 接近小程序原生的运行性能

Vue SFC 支持是**直接内置在 `weapp-vite` 里的**，不是外挂插件。

## 一处编写，四处生成

你写一个 `.vue` 文件，Weapp-vite 编译完会变成小程序四件套：

```text
MyComponent.vue
    ├─> MyComponent.js    // 脚本逻辑
    ├─> MyComponent.wxml  // 模板结构
    ├─> MyComponent.wxss  // 样式文件
    └─> MyComponent.json  // 组件配置
```

Vue 的 `<script>`、`<template>`、`<style>`、`<json>`(可被 `defineXXXJson` 宏指令取代) 会被拆开，各自转换成小程序能认的格式。整个过程就像是把 Vue 组件"翻译"成了小程序的方言。

## Vue 语法怎么转的

这不是简单地把 Vue 代码塞进小程序，而是做了一层语法映射：

| Vue 写法 | 转换为 |
|:---|:---|
| `v-if` / `v-else-if` / `v-else` | `wx:if` / `wx:elif` / `wx:else` |
| `v-for="item in list"` | <code v-pre>wx:for="{{list}}"</code> + <code>wx:key</code> |
| `@click` / `@tap` | `bindtap` / `catchtap` |
| `:class` / `:style` | <code v-pre>class="{{...}}"</code> / <code v-pre>style="{{...}}"</code> |
| `v-model` | 双向绑定的完整实现（input/checkbox/radio/textarea 等） |
| `<script setup>` | 自动处理响应式和生命周期 |

你按 Vue 的方式写，Weapp-vite 按小程序的方式跑。

## 工具链友好：智能提示 + AI 协作

### 智能提示：直接复用 Vue 官方插件

VS Code 里装了 Vue 官方插件（Vue - Official / Volar）的话，Weapp-vite 的 `.vue` 文件直接就能用上模板智能提示和类型检查，不用再折腾一套新的编辑器插件。

- `v-for` 场景下的 `:key` 等属性补全

![Vue 模板智能提示（v-for + :key）](/6/ic.png)

- `:class` / `:style` 等常用绑定提示
- 组件属性与事件相关补全

![Vue 模板智能提示（原生标签属性补全）](/6/in.png)
![Vue 模板智能提示（组件属性补全）](/6/inc.png)

### AI 协作

如果你准备用 AI 来协作开发，我自己的顺序一直很固定：先把 `skills` 装好，再起 `MCP`，最后按需喂 `llms` 语料。

先装 skills：

```bash
npx skills add sonofmagic/skills
```

常用的几个：`weapp-vite-best-practices`、`weapp-vite-vue-sfc-best-practices`、`wevu-best-practices`。

然后启动 MCP：

```bash
weapp-vite mcp
```

如果你不在仓库目录下执行，再补 `--workspace-root /path/to/weapp-vite`。

最后是 llms 语料入口：

- 页面：[/llms](/llms)
- 文件：`/llms.txt`、`/llms-full.txt`、`/llms-index.json`
- 顺序：`llms.txt -> llms-full.txt -> llms-index.json`

更多细节放在这里：[/guide/ai](/guide/ai)、[/packages/mcp](/packages/mcp)、[/config/shared#weapp-mcp](/config/shared#weapp-mcp)。

## 几个常见用法

### 响应式状态 + 计算属性

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

### `definePageJson` 宏定义页面配置

```html
<script setup lang="ts">
definePageJson({
  navigationBarTitleText: '首页',
  navigationBarTextStyle: 'white',
})
</script>
```

### 在 `.vue` 里直接用原生组件

```html
<script setup lang="ts">
import NativeMeter from '../../native/native-meter/index'
</script>

<template>
  <NativeMeter label="构建链能力" :value="80" />
</template>
```

### `v-model` 表单双向绑定

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

### 双模式并存才是 Weapp-vite 的杀手锏

Weapp-vite@6 最实用的一点就是"同仓双模式"。性能敏感的页面继续走原生，迭代快、业务重的页面丢到 Vue 模式里。迁移可以一个页面一个页面来，不用一口气重写整个项目。

### 什么时候用 Vue 模式：
- 你平时写 Vue 3，想用同样的写法搞小程序
- 团队本来就是 Vue 技术栈，想复用过来
- 想要热重载、TypeScript 这些现代开发体验
- 希望 Vue 代码后面还能往 Web 项目上搬

### 什么时候用原生模式：
- 对性能有洁癖，一点运行时开销都不想要
- 已经有一大堆原生代码，不想大动
- 团队对小程序原生 API 很熟
- 包体积卡得很死

### 什么时候该选别的框架？

- **Taro**：如果你真的要同时出微信、支付宝、百度、字节好几个平台的小程序，甚至还要编 H5 和 RN，那 Taro 确实是绕不开的。不过说真的，大部分项目真需要跨这么多端吗？

- **uni-app**：如果你想要一个开箱即用的全家桶，而且已经习惯了 DCloud 那套生态（HBuilderX、uniCloud 之类的），uni-app 挺合适。就是它的 DSL 跟标准 Vue 还是有些差异。

- **mpx**：Vue 2.7 + webpack，技术栈偏老了。

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

## 后面打算做什么

接下来主要推两条线：支持更多小程序平台，以及支持 Web 目标。

### Android / iOS 原生方向

现在原生 Android / iOS 这边，很多场景还是得靠微信开发者工具的多端框架来转。这块后面会继续投入，目标是把链路做得更稳、接入成本更低。

## 最后

Weapp-vite@6 这次就是想把选择权留给你：要性能就走原生，要开发体验就走 Vue 模式，混着来也行。背后靠的是 `vue/compiler-sfc` 的解析能力、`wevu` 的运行时设计，以及社区一路给的真实反馈。

感谢每一位提建议、报 bug、提 PR 的同学。

---

如果 Weapp-vite 帮到了你，欢迎给项目点个 [Star](https://github.com/weapp-vite/weapp-vite)！

Happy Coding! 🚀
