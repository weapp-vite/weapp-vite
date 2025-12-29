---
title: wevu 概览
---

# wevu 概览

我写 `wevu` 其实就是想把，我们中国开发者，最熟悉的 Vue 3 的开发体验，带进微信小程序：

你照常用 `ref`、`reactive`、`computed`、`watch` 写逻辑，模板/样式/配置可以使用 `vue` 单文件，也可以保持小程序原生写法，不引入 Virtual DOM，也不强迫你重构老项目。

为什么要 Vue 3 的开发体验?

因为 微信小程序 的语法设计的像 💩 ，然后各大小程序跟进，就像狗吃 💩 了之后继续拉 💩，然后就轮到我们开发者去吃 💩。

相信大家只要深度开发过小程序和 vue 应用的，就懂我在说什么了，开发者体验可是非常重要的啊！`wxs` 简直就是 💩 中的 💩

## 诞生的小故事

- 我最初的名字，想叫 `“wevue”`（weapp + vue），但 npm 已被占用，于是缩写成了 **wevu**。
- 当时最初为 `weapp-vite` 补齐 Vue SFC 支持时，我尝试嫁接社区的 `vue-mini`。在调研之后，发现我的 `weapp-vite` 编译器和他的 `vue-mini` 运行时都要大改，于是放弃 `vue-mini` 自己写了 `wevu` 来适配编译时。
- 借鉴 Vue 3.6 讨论的 `alien-signals` 思路，自研零依赖运行时，把多小程序平台适配也一并考虑，最终成型的就是现在的 `wevu`。

## 提供什么

- `wevu` 它是纯运行时，压缩后大约 30 KB，跑在基础库 ≥ 3.0.0 的环境即可。
- Composition API：`ref`、`reactive`、`computed`、`watch`、`watchEffect` 等。
- 页面/组件注册：`definePage`、`defineComponent`、`createApp`、`createWevuComponent`，支持生命周期钩子（`onShow`、`onHide`、`onReady`、分享/收藏、滚动等）。
- 双向绑定：`bindModel` 生成适配小程序事件的 v-model 绑定。
- Store 适配：`defineStore`、`storeToRefs`、可选的 `createStore` 插件体系，类 Pinia 写法但无需全局安装。
- 小程序友好：模板/样式/配置保持原生语法，组件通过 `<config> -> usingComponents` 声明。
- 导入路径：所有 API 均从 `wevu` 主入口获取，不支持 `wevu/store` 等子路径。

接下来可以按顺序阅读：

- 快速上手：`/wevu/quick-start`
- 运行时 API：`/wevu/runtime`
- Store：`/wevu/store`
- 兼容性与注意事项：`/wevu/compatibility`
