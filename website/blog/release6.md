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

大家好呀，我是你们的老朋友，开源爱好者 [icebreaker](https://github.com/sonofmagic)！又到了新的一年，我想死你们了。

今天主要来分享一下我开源项目 [Weapp-vite](https://github.com/weapp-vite/weapp-vite) 的开发里程碑。核心就是来给大家秀一把。

## 前言

我还记得在过去 Weapp-vite 4.0 的发布文章里，写过这样的话：

> Weapp-vite **不适用场景**：需要使用 `Vue`/`React` 等前端框架的写法，来取代小程序原生写法。

当时的想法很单纯：Weapp-vite 的定位是「原生小程序的现代化构建工具」，保持零运行时，专注于 TypeScript、SCSS、HMR 极致分包，这些开发体验的提升。

但社区的声音让我重新思考这个定位。原因在于原生小程序的语法确实烂到让人不想写，尤其是对于习惯了 Vue 3 的开发者来说，原生的 `this.setData`、事件绑定、生命周期等都显得非常笨重和不优雅。

而且即使到了这个 AI 时代， 小程序的验收工具也很烂，导致还原度远远不及 Web, 因为小程序缺少 playwright-cli, agent-browser, chrome-devtools-mcp 这类的验证工具。

而现在，市面上已经有不少支持 Vue 写小程序的方案：
- **Taro**：React/Vue 语法，跨端能力强大
- **uni-app**：Vue 语法，开箱即用
- **mpx**：美团出品，增强型小程序框架

但它们都有各自的"槽点"：运行时庞大、DSL 不标准、技术栈老旧、或者深度绑定特定生态。这里我又要Q一下这个可恶的 HbuilderX 了。

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

跨端能力很强，但代价是庞大的运行时代码。分包规划不好，主包容易爆表。而且语法是 React/Vue 的"变种"，学习成本不低。

目前 Taro 维护的不是很好，issue 积压的比较多。

我过去很喜欢 Taro，直到 2 年前在公众号上，看到他们的招聘启事，于是投了简历，结果人家完全没有鸟我，于是我现在不喜欢 Taro 了(笑～)。

#### uni-app

上手简单，但专属的 DSL 和 `uni.xxx` API 是另一套新东西。uni-app x 那种 uts 和标准 Vue 生态还有社区有点貌合神离。

同样我过去很喜欢 uni-app, 但是我不喜欢 HBuilderX, uni-app x 还有 uts, 虽然当时我在 weapp-tailwindcss 中兼容了 uni-app x, 但是我还是不喜欢

#### mpx

滴滴出品，基于 Vue 2.7 + webpack。我不喜欢，因为技术栈较老，而且响应式系统和标准 Vue 不完全一样。

而我的 `Weapp-vite` 方案，我感觉本质上就是 mpx 的升级版：**基于 Vue 3 风格 + Rolldown Vite，专注小程序，保持对原生 API 的兼容**。

### Weapp-vite 的思路

Weapp-vite@6 的思路是：**同一个工具，给你两种模式**。

- **原生模式**：零运行时，极致性能，适合追求包体积和性能的项目
- **Vue 模式**：完整的 Vue 3 开发体验，适合熟悉 Vue 的团队

两者可以在同一个项目中并存，你 `.vue` 组件可以使用原生组件，原生组件也可以使用 `.vue` 组件，你可以根据具体页面/组件的需求来选择。

### 运行时 Wevu 的诞生

转折点是在开发 `wevu` 时——一个专为小程序设计的 Vue 运行时。

当时本来是叫 `wevue` 的，但是这个名字 `npm` 包已经被注册掉了，所以 `trimEnd` 了一个 `e`

`wevu` 保留了 Vue 3 的核心 API——`ref`、`computed`、`watch`、`onMounted` 等，但底层用小程序的 `setData` 做更新。给小程序装上了 Vue 的"大脑"，但骨子里还是小程序的"身体"。

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

虽然 Wevu 的 API 设计与 Vue 3 高度一致，但由于运行环境不同，底层实现有本质区别。

| 对比维度 | Vue 3 | Wevu |
|:---|:---|:---|
| **运行环境** | Web 浏览器 | 微信小程序 |
| **响应式系统** | Proxy + effect | Proxy + effect（**相同实现**） |
| **渲染目标** | DOM 节点 | 小程序页面/组件实例 |
| **渲染方式** | Virtual DOM Diff → DOM API | Snapshot Diff → `setData` |
| **数据模型** | VNode 树 | 纯 JS 对象快照 |
| **更新机制** | 异步调度 + DOM 操作 | 异步调度 + `setData` |
| **生命周期** | onMounted/onUpdated 等 | 映射到小程序生命周期 |
| **事件系统** | DOM 事件 | 小程序 bind/catch 事件 |
| **SFC 编译** | @vitejs/plugin-vue | Weapp-vite 内置 |

**相同点：响应式系统**

Vue 3 和 Wevu 的响应式系统**完全相同**，都基于 `Proxy` + `effect` 实现：

```ts
// 这段代码在 Vue 3 和 wevu 中写法完全一致
import { computed, ref, watch } from 'wevu'  // Vue 3 同名 API

const count = ref(0)
const doubled = computed(() => count.value * 2)

watch(count, val => console.log(val))
```

**不同点：渲染机制**

Vue 3 使用 Virtual DOM Diff，然后调用 DOM API 更新视图：

```
状态变化 → effect 触发 → 组件更新 → VNode Diff → DOM 操作
```

Wevu 使用快照 Diff，然后调用小程序的 `setData`：

```
状态变化 → effect 触发 → 快照 Diff → setData → 小程序渲染
```

Wevu 的快照 Diff 直接对响应式数据对象做深度比较，计算出最小变更路径（如 `data.a.b[2]`），然后只传递这部分数据给 `setData`，避免全量更新。

### Weapp-vite + Wevu 的组合

- **Weapp-vite**：负责**编译时**工作，把 Vue SFC 拆解、转换、生成小程序四件套
- **Wevu**：负责**运行时**工作，提供响应式系统和生命周期

两者结合，你得到的是：
1. Vue 3 风格的开发体验（SFC + Composition API）
2. 几乎小程序原生的运行性能

最关键的设计决策是：**把 Vue SFC 支持直接内置到 `weapp-vite` 里**，而不是作为外部插件。

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

**编译原理小剧场**：

1. **解析阶段**：使用 `vue/compiler-sfc` 把 SFC 拆成四块
2. **转换阶段**：Vue 指令 → 小程序指令（`v-if` → `wx:if`，`@click` → `bindtap`）
3. **生成阶段**：输出小程序四件套
4. **运行时**：配合 `wevu` 提供响应式能力

整个过程中，编译缓存机制确保只有修改过的文件才会重新编译——这就是 HMR 的基础。

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
- `:class` / `:style` 等常用绑定提示
- 组件属性与事件相关补全

![Vue 模板智能提示（v-for + :key）](/6/ic.png)
![Vue 模板智能提示（原生标签属性补全）](/6/in.png)
![Vue 模板智能提示（组件属性补全）](/6/inc.png)

### AI 友好

Weapp-vite@6 的 Vue 模式对 AI 协作也比较友好，核心原因是「语法接近标准 Vue SFC」和「编译边界清晰」：

- 模板、脚本、样式、JSON 配置职责清楚，便于 AI 定位与修改
- 大量 API 与 Vue 3 同名，AI 可以复用 Vue 官方文档和社区知识
- `definePageJson` / `defineComponentJson` 这类宏语义明确，生成代码更稳定

如果你在 Codex / Claude Code 中协作开发，可以直接安装和同步项目技能：

```bash
# 推荐：安装公开 skills 集合
npx skills add sonofmagic/skills
```

常用的 Weapp-vite 相关 skills：

- `weapp-vite-best-practices`
- `weapp-vite-vue-sfc-best-practices`
- `wevu-best-practices`

## 使用用例：从简单到复杂

### 用例 1：计数器——Vue 响应式的魔力

先来个最经典的例子，对比一下原生写法和 Vue 写法：

**原生小程序写法**：
```js
Page({
  data: {
    count: 0,
  },
  increment() {
    this.setData({
      count: this.data.count + 1, // 每次都要写 this.data 和 this.setData
    })
  },
})
```

**Weapp-vite + Vue 写法**：
```html
<script setup>
import { ref } from 'wevu'

const count = ref(0)

function increment() {
  count.value++ // 就这？
}
</script>

<template>
  <view class="counter">
    <text>Count: {{ count }}</text>
    <button @tap="increment">+1</button>
  </view>
</template>
```

这区别，就像是骑自行车和开电动车——都能到目的地，但体验完全不同。

### 用例 2：computed 和 watch——复杂状态管理

```html
<script setup lang="ts">
import { computed, ref, watch } from 'wevu'

const count = ref(0)
const doubled = computed(() => count.value * 2)

// 监听变化
watch(count, (newValue, oldValue) => {
  console.log(`count changed: ${oldValue} -> ${newValue}`)
})

function increment() {
  count.value++
}
</script>

<template>
  <view class="counter">
    <text>Count: {{ count }}</text>
    <text>Doubled: {{ doubled }}</text>
    <button @tap="increment">+1</button>

    <view v-if="count > 5">
      <text>Count is greater than 5!</text>
    </view>
    <view v-else>
      <text>Count is 5 or less</text>
    </view>
  </view>
</template>
```

`computed` 自动计算，`watch` 自动监听，`v-if` 自动渲染。不用手动管理任何依赖关系。

### 用例 3：definePageJson——宏的魔法

Weapp-vite 提供了三个独特的宏，让你在 `<script setup>` 里定义小程序配置：

```html
<script setup lang="ts">
import { ref } from 'wevu'

// 页面配置宏——直接生成页面 JSON
definePageJson({
  navigationBarTitleText: '首页',
  navigationBarBackgroundColor: '#4c6ef5',
  navigationBarTextStyle: 'white',
})

const count = ref(0)
</script>

<template>
  <view>{{ count }}</view>
</template>
```

**宏的原理**：编译时，`definePageJson` 的参数会被提取出来，合并到最终生成的 `.json` 文件中。这个过程发生在构建阶段，运行时零开销。

宏家族有三个成员：
- `defineAppJson`：在 `app.vue` 中定义全局配置
- `definePageJson`：在页面中定义页面配置
- `defineComponentJson`：在组件中定义组件配置

**为什么推荐使用宏而不是 `<json>` 块？**

1. **完整的 TypeScript 类型支持**：宏指令有完整的类型提示和校验
2. **共享 setup 作用域**：可以在宏的参数中引用 `<script setup>` 里定义的变量
3. **更好的开发体验**：IDE 自动补全、类型检查、重构支持

```html
<script setup lang="ts">
import { ref } from 'wevu'

// 可以引用 setup 作用域的变量！
const pageTitle = ref('动态标题')

definePageJson({
  navigationBarTitleText: pageTitle.value, // ✅ 类型安全
  // ...
})
</script>
```

相比之下，自定义 `<json>` 块虽然支持 JSONC 和 JS/TS 格式，但与 `<script setup>` 作用域隔离，无法共享变量，也缺乏类型支持。

### 用例 4：`.vue` 文件直接引入原生组件

除了 `.vue` 子组件，原生小程序组件也可以在 `<script setup>` 中直接引入并在模板里使用。

```html
<script setup lang="ts">
import NativeMeter from '../../native/native-meter/index'
</script>

<template>
  <view class="native-demo">
    <NativeMeter label="构建链能力" :value="80" tone="success" />
  </view>
</template>
```

构建阶段会根据 `import` + 模板实际使用，自动补齐产物里的 `usingComponents`，你不需要再手写同样的映射。

```json
{
  "usingComponents": {
    "native-meter": "../../native/native-meter/index"
  }
}
```

这让 Vue SFC 的组件编排体验和原生组件生态可以自然衔接：写法更统一，重构和类型提示也更稳定。

### 用例 5：v-model——双向绑定

表单处理一直是小程序的痛点。原生写法需要手动监听 `input` 事件，然后 `setData`。Vue 的 `v-model` 让这一切变得简单：

```html
<script setup>
import { ref } from 'wevu'

const message = ref('Hello WeVU!')
const checked = ref(false)
const selected = ref('option1')
</script>

<template>
  <view class="form">
    <!-- 文本输入 -->
    <input v-model="message" placeholder="输入点什么...">

    <!-- 复选框 -->
    <checkbox v-model="checked">同意协议</checkbox>

    <!-- 单选框 -->
    <radio-group v-model="selected">
      <radio value="option1">选项 1</radio>
      <radio value="option2">选项 2</radio>
    </radio-group>

    <view>
      <text>message: {{ message }}</text>
      <text>checked: {{ checked }}</text>
      <text>selected: {{ selected }}</text>
    </view>
  </view>
</template>
```

`v-model` 会自动处理不同表单元素的双向绑定逻辑，无需手动写事件监听。

### 用例 6：组件通信——props 和 emits

```html
<!-- Parent.vue -->
<script setup>
import { ref } from 'wevu'
import Child from './Child.vue'

const parentMessage = ref('来自父组件的消息')

function handleChildEvent(data) {
  console.log('收到子组件事件:', data)
}
</script>

<template>
  <view>
    <Child
      :title="parentMessage"
      @child-event="handleChildEvent"
    />
  </view>
</template>

<!-- Child.vue -->
<script setup>
import { defineEmits, defineProps } from 'weapp-vite/runtime'

const props = defineProps<{
  title: string
}>()

const emit = defineEmits<{
  childEvent: [data: string]
}>()

function handleClick() {
  emit('childEvent', '来自子组件的数据')
}
</script>

<template>
  <view @tap="handleClick">
    <text>{{ title }}</text>
  </view>
</template>
```

完整的 TypeScript 支持，类型安全的组件通信。

### 用例 7：app.vue——应用级配置

`app.vue` 是 Weapp-vite Vue 模式的入口文件，你可以在这里定义全局配置和应用生命周期：

```html
<script setup lang="ts">
import { onHide, onLaunch, onShow } from 'wevu'

defineAppJson({
  pages: [
    'pages/index/index',
    'pages/detail/detail',
  ],
  window: {
    navigationBarTitleText: 'Weapp-Vite + WeVU',
    navigationBarBackgroundColor: '#4c6ef5',
    navigationBarTextStyle: 'white',
  },
  style: 'v2',
  sitemapLocation: 'sitemap.json',
})

onLaunch(() => {
  console.log('App Launch')
})

onShow(() => {
  console.log('App Show')
})

onHide(() => {
  console.log('App Hide')
})
</script>

<style lang="scss">
@use 'tailwindcss/base';
@use 'tailwindcss/components';
@use 'tailwindcss/utilities';

page {
  color: #1c1c3c;
  background: #f6f7fb;
}
</style>
```

注意这里还支持 SCSS 和 TailwindCSS——现代化的开发体验，一个都不能少。

### 用例 8：自定义 `<json>` 块

除了用宏定义配置，Weapp-vite 还支持 Vue SFC 的自定义块语法：

```html
<script setup>
const count = ref(0)
</script>

<template>
  <view>{{ count }}</view>
</template>

<style>
.view {
  padding: 20rpx;
}
</style>

<!-- 小程序专属配置块 -->
<json>
{
  "navigationBarTitleText": "Vue 小程序",
  "navigationBarBackgroundColor": "#667eea",
  "navigationBarTextStyle": "white"
}
</json>
```

`<json>` 块的内容会直接合并到生成的 `.json` 文件中。这是 Weapp-vite 支持的语法，但**不推荐使用**——推荐使用前面介绍的 `definePageJson` 等宏指令，因为它们有完整的 TypeScript 类型支持，并且可以共享 `<script setup>` 作用域的变量。

### 用例 9：插槽 Slots

插槽是组件复用的重要机制，Weapp-vite 支持常用的插槽语法（默认插槽、具名插槽、作用域插槽）：

```html
<!-- Card.vue -->
<script setup>
defineProps<{
  title: string
}>()
</script>

<template>
  <view class="card">
    <view class="card-header">{{ title }}</view>

    <!-- 默认插槽 -->
    <view class="card-body">
      <slot />
    </view>

    <!-- 具名插槽 -->
    <view class="card-footer">
      <slot name="footer">
        <text>默认底部内容</text>
      </slot>
    </view>
  </view>
</template>
```

```html
<!-- 使用 Card 组件 -->
<script setup>
import Card from './Card.vue'
</script>

<template>
  <Card title="卡片标题">
    <!-- 默认插槽内容 -->
    <view>这是卡片主体内容</view>

    <!-- 具名插槽内容 -->
    <template #footer>
      <view>自定义底部</view>
    </template>
  </Card>
</template>
```

编译阶段会按小程序 slot 语义做转换：
- 默认插槽 `<slot></slot>` → `<slot></slot>`
- 具名插槽 `<slot name="footer"></slot>` → `<slot name="footer"></slot>`
- 插槽内容 `<template #footer>`（无作用域参数）→ 转为带 `slot="footer"` 的原生节点
- 若使用 `<template #footer="{ item }">` 这类作用域插槽 → 编译为 scoped slot 组件（不是简单的 `template slot` 文本替换）

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

## 技术细节（给好奇的同学）

Weapp-vite 的 Vue 支持不是简单的黑盒，而是精心设计的编译管道：

### 编译流程

```
.vue 文件
  ↓
vue/compiler-sfc 解析
  ↓
┌─────────┬─────────┬─────────┐
│ <script>│<template>│<style>  │
└────┬────┴────┬────┴────┬────┘
     │         │         │
     ↓         ↓         ↓
  处理宏    指令转换   样式转换
     │         │         │
     └─────────┴─────────┘
               ↓
         生成四件套
         .js .wxml .wxss .json
```

### 构建内核升级：切换到 Rolldown 带来的效率提升

在 v6 这轮演进里，Weapp-vite 的构建链路逐步切换到 **Rolldown** 内核（并保持对现有插件生态的兼容能力）。

这件事最直接的收益是“工程体感”上的提速，主要体现在：

- **冷启动更快**：大型项目首次启动时，依赖图建立与模块处理耗时更短；
- **增量构建更灵敏**：改动后重新编译和回写产物的等待时间明显下降；
- **大仓库更稳定**：在依赖规模较大、分包较多的场景下，构建波动更小。

对于日常开发来说，这种提升会直接转化为更顺滑的 HMR 反馈和更短的“改完代码到看到结果”的链路时间。

### 为什么主线没有使用 `@vue/runtime-core` 的 `createRenderer`

`createRenderer` 在技术上是可行路线，但 Wevu 当前没有把它作为主实现，核心原因是“抽象不对齐”：

- `createRenderer` 需要宿主提供完整的节点操作语义（`insert/remove/patchProp` 等）；
- 小程序运行时真正的更新通道是 `setData(payload)`，优化重点是“何时触发 + payload 多小”；
- Wevu 主链路已经是“编译到 WXML + 快照 diff + 最小 setData”，直接命中小程序性能约束。

这也是为什么类似 “大 `base.wxml` + 运行时节点树” 的方案虽然可做，但在多数业务场景里，通常会带来额外映射和协调成本，整体性能往往不如当前链路。

完整分析可见：[`为什么没有使用 @vue/runtime-core 的 createRenderer 来实现`](/wevu/why-not-runtime-core-create-renderer)

### 支持的功能清单

- **核心指令**：v-if、v-else、v-for、v-show、v-model
- **事件绑定**：@click、@tap、自定义事件
- **属性绑定**：:class、:style、动态属性
- **样式处理**：CSS Modules、预处理器（SCSS/Less）
- **组件通信**：props、emits、provide/inject、slots
- **生命周期**：onMounted、onUpdated、onUnmounted 等
- **响应式 API**：ref、computed、watch、watchEffect
- **TypeScript**：完整支持，包括泛型组件

## 未来计划

接下来我会把 Weapp-vite 的跨端能力继续往前推，重点是两条线：更多小程序平台支持，以及 Web 目标支持。

### 更多小程序平台

目前社区里对多平台小程序（不只是微信）的需求越来越明显，后续会继续补齐和验证更多平台的适配能力，让同一套工程配置能覆盖更广的端。

### Web 目标支持

除了小程序端，后续也会继续探索和增强 Vue 代码到 Web 的复用路径，尽量让业务组件在小程序与 Web 之间共享更多逻辑，减少重复开发成本。

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
