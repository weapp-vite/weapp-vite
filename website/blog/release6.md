---
title: weapp-vite@6：原生模式之外，多一种 Vue 选择
description: 还记得在 weapp-vite 4.0 的发布文章里，我写过这样的话：
keywords:
  - weapp-vite
  - wevu
  - 微信小程序
  - 配置
  - 运行时
  - 编译
  - blog
  - release6
date: 2026-02-25
---

# weapp-vite@6：原生模式之外，多一种 Vue 选择

## 前言

还记得在 weapp-vite 4.0 的发布文章里，我写过这样的话：

> **不适用场景**：需要使用 `Vue`/`React` 等前端框架的写法，来取代小程序原生写法。

当时的想法很单纯：weapp-vite 的定位是「原生小程序的现代化构建工具」，保持零运行时，专注于 TypeScript、SCSS、HMR 这些开发体验的提升。

但社区的声音让我重新思考这个定位。

确实，市面上已经有不少支持 Vue 写小程序的方案：
- **Taro**：React/Vue 语法，跨端能力强大
- **uni-app**：Vue 语法，开箱即用
- **mpx**：美团出品，增强型小程序框架

但它们都有各自的"槽点"：运行时庞大、DSL 不标准、技术栈老旧、或者深度绑定特定生态。

**能不能做一个既保留原生模式优势，又提供 Vue 开发体验的工具？**

于是，weapp-vite@6 来了——**在原生模式之外，多一种 Vue 选择**。

## 背景故事：从零运行时到 Vue 支持

### 最初的定位

weapp-vite 最初的设计理念是做一个**零运行时**的原生小程序构建工具。用户用原生写法，weapp-vite 提供现代化的开发体验，保证打出来的包足够小、性能足够好。

这个定位满足了很多只需要开发微信小程序、追求极致性能的用户。

但我也在思考：能不能在不破坏原生模式的前提下，给用户一个 Vue 的选择？

### 市面上的选择

看看现有的方案，各有取舍：

- **Taro**：跨端能力很强，但代价是庞大的运行时代码。分包规划不好，主包容易爆表。而且语法是 React/Vue 的"变种"，学习成本不低。

- **uni-app**：上手简单，但专属的 DSL 和 `uni.xxx` API 是另一套新东西。和标准 Vue 生态貌合神离。

- **mpx**：美团出品，基于 Vue 2.7 + webpack。技术栈较老，而且响应式系统和标准 Vue 不完全一样。


### weapp-vite 的思路

weapp-vite@6 的思路是：**同一个工具，给你两种模式**。

- **原生模式**：零运行时，极致性能，适合追求包体积和性能的项目
- **Vue 模式**：完整的 Vue 3 开发体验，适合熟悉 Vue 的团队

两者可以在同一个项目中并存，你可以根据具体页面/组件的需求来选择。

### wevu 的诞生

转折点是在开发 `wevu` 时——一个专为小程序设计的 Vue 运行时。

`wevu` 保留了 Vue 3 的核心 API——`ref`、`computed`、`watch`、`onMounted` 等，但底层用小程序的 `setData` 做更新。给小程序装上了 Vue 的"大脑"，但骨子里还是小程序的"身体"。

更重要的是，**wevu 既可以在 weapp-vite 中配合 SFC 编译时使用，也可以单独作为纯运行时库使用**。

### 编译时 + 运行时

既然 `wevu` 运行时已经就绪，Vue SFC 编译支持就是顺水推舟的事了。

## 认识 wevu：Vue 3 风格的小程序运行时

**wevu** 是一个专为小程序设计的 Vue 3 风格运行时。它的核心设计理念是：**响应式系统与 Vue 3 同源，渲染层深度适配小程序**。

### 核心特点

- **100% 兼容 Vue 3 响应式 API**：`ref`、`reactive`、`computed`、`watch`、`watchEffect` 等
- **Vue 3 生命周期支持**：`onMounted`、`onUpdated`、`onUnmounted` 等，自动映射到小程序生命周期
- **快照 diff 优化**：最小化 `setData` 调用，只传递变更的数据路径
- **内置状态管理**：`defineStore`/`storeToRefs`，API 类似 Pinia
- **可独立使用**：既可以配合 weapp-vite 的 SFC 编译，也可以单独作为运行时库使用

### Vue 3 vs wevu：实现上的异同

虽然 wevu 的 API 设计与 Vue 3 高度一致，但由于运行环境不同，底层实现有本质区别。

| 对比维度 | Vue 3 | wevu |
|:---|:---|:---|
| **运行环境** | Web 浏览器 | 微信小程序 |
| **响应式系统** | Proxy + effect | Proxy + effect（**相同实现**） |
| **渲染目标** | DOM 节点 | 小程序页面/组件实例 |
| **渲染方式** | Virtual DOM Diff → DOM API | Snapshot Diff → `setData` |
| **数据模型** | VNode 树 | 纯 JS 对象快照 |
| **更新机制** | 异步调度 + DOM 操作 | 异步调度 + `setData` |
| **生命周期** | onMounted/onUpdated 等 | 映射到小程序生命周期 |
| **事件系统** | DOM 事件 | 小程序 bind/catch 事件 |
| **SFC 编译** | @vitejs/plugin-vue | weapp-vite 内置 |

**相同点：响应式系统**

Vue 3 和 wevu 的响应式系统**完全相同**，都基于 `Proxy` + `effect` 实现：

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

wevu 使用快照 Diff，然后调用小程序的 `setData`：

```
状态变化 → effect 触发 → 快照 Diff → setData → 小程序渲染
```

wevu 的快照 Diff 直接对响应式数据对象做深度比较，计算出最小变更路径（如 `data.a.b[2]`），然后只传递这部分数据给 `setData`，避免全量更新。

### weapp-vite + wevu 的组合

- **weapp-vite**：负责**编译时**工作，把 Vue SFC 拆解、转换、生成小程序四件套
- **wevu**：负责**运行时**工作，提供响应式系统和生命周期

两者结合，你得到的是：
1. Vue 3 风格的开发体验（SFC + Composition API）
2. 小程序原生的运行性能
3. 可选的独立运行时使用（wevu 可单独安装）

最关键的设计决策是：**把 Vue SFC 支持直接内置到 `weapp-vite` 里**，而不是作为外部插件。

这意味着：
- 不需要安装 `@vitejs/plugin-vue`
- 不需要复杂的配置
- 只需要在 `vite.config.ts` 里加一个开关

```ts
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  plugins: [
    weappVite({
      vue: {
        enable: true, // 就这么简单！
      },
    }),
  ],
})
```

从现在起，weapp-vite 不再只是"原生小程序的现代化工具"，而是"**原生 + Vue**的双料选择"。

## 一处编写，四处生成

当你创建一个 `.vue` 文件时，weapp-vite 会悄悄地施展编译魔法：

```
MyComponent.vue
    ├─> MyComponent.js    // 脚本逻辑
    ├─> MyComponent.wxml  // 模板结构
    ├─> MyComponent.wxss  // 样式文件
    └─> MyComponent.json  // 组件配置
```

Vue 的 `<script>`、`<template>`、`<style>` 会被智能拆分并转换成小程序能理解的格式。整个过程就像是把 Vue 组件"翻译"成了小程序的方言。

**编译原理小剧场**：

1. **解析阶段**：使用 `vue/compiler-sfc` 把 SFC 拆成三块
2. **转换阶段**：Vue 指令 → 小程序指令（`v-if` → `wx:if`，`@click` → `bindtap`）
3. **生成阶段**：输出小程序四件套
4. **运行时**：配合 `wevu` 提供响应式能力

整个过程中，编译缓存机制确保只有修改过的文件才会重新编译——这就是 HMR 的基础。

## Vue 语法无缝转换

weapp-vite 的 Vue 支持不是简单地把 Vue 代码塞进小程序，而是做了真正聪明的语法转换：

| Vue 写法 | 转换为 |
|:---|:---|
| `v-if` / `v-else-if` / `v-else` | `wx:if` / `wx:elif` / `wx:else` |
| `v-for="item in list"` | <code v-pre>wx:for="{{list}}"</code> + <code>wx:key</code> |
| `@click` / `@tap` | `bindtap` / `catchtap` |
| `:class` / `:style` | <code v-pre>class="{{...}}"</code> / <code v-pre>style="{{...}}"</code> |
| `v-model` | 双向绑定的完整实现（input/checkbox/radio/textarea 等） |
| `<script setup>` | 自动处理响应式和生命周期 |

你用 Vue 的方式思考，weapp-vite 用小程序的方式执行。

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

**weapp-vite + Vue 写法**：
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

weapp-vite 提供了三个独特的宏，让你在 `<script setup>` 里定义小程序配置：

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

### 用例 4：v-model——双向绑定

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

### 用例 5：组件通信——props 和 emits

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

### 用例 6：app.vue——应用级配置

`app.vue` 是 weapp-vite Vue 模式的入口文件，你可以在这里定义全局配置和应用生命周期：

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

### 用例 7：自定义 `<json>` 块

除了用宏定义配置，weapp-vite 还支持 Vue SFC 的自定义块语法：

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

`<json>` 块的内容会直接合并到生成的 `.json` 文件中。这是 weapp-vite 支持的语法，但**不推荐使用**——推荐使用前面介绍的 `definePageJson` 等宏指令，因为它们有完整的 TypeScript 类型支持，并且可以共享 `<script setup>` 作用域的变量。

### 用例 8：插槽 Slots

插槽是组件复用的重要机制，weapp-vite 支持完整的插槽语法：

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

编译后会转换为小程序的 `<slot>` 语法：
- 默认插槽 `<slot></slot>` → `<slot></slot>`
- 具名插槽 `<slot name="footer"></slot>` → `<slot name="footer"></slot>`
- 插槽内容 `<template #footer>` → `<template slot="footer">`

## 适用场景

### weapp-vite 的独特优势：双模式并存

与其他框架不同，weapp-vite@6 支持在同一个项目中同时使用原生模式和 Vue 模式。你可以：

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

**一句话总结**：weapp-vite@6 的独特之处在于——原生 + Vue 双模式并存，同一个工具，给你两种选择。

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

weapp-vite 的 Vue 支持不是简单的黑盒，而是精心设计的编译管道：

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

### 支持的功能清单

- **核心指令**：v-if、v-else、v-for、v-show、v-model
- **事件绑定**：@click、@tap、自定义事件
- **属性绑定**：:class、:style、动态属性
- **样式处理**：CSS Modules、预处理器（SCSS/Less）
- **组件通信**：props、emits、provide/inject、slots
- **生命周期**：onMounted、onUpdated、onUnmounted 等
- **响应式 API**：ref、computed、watch、watchEffect
- **TypeScript**：完整支持，包括泛型组件

### 测试覆盖

- **73+ 测试用例** 全部通过
- **85%+ 代码覆盖率**
- 测试分类：基础模板编译、样式处理、高级特性、E2E 集成测试

## 最后

weapp-vite@6 的 Vue SFC 支持建立在：
- `vue/compiler-sfc` 的解析能力
- `wevu` 运行时的精心设计
- 社区对更好开发体验的需求反馈

感谢每一位提出建议、反馈 bug、贡献代码的同学。

weapp-vite@6 把选择权交给你：
- 需要极致性能？用原生模式
- 需要 Vue 开发体验？用 Vue 模式
- wevu 也可以单独作为纯运行时库使用

---

如果 weapp-vite 帮到了你，欢迎给项目点个 [Star](https://github.com/weapp-vite/weapp-vite)！

Happy Coding! 🚀
