---
title: wevu 概览
---

# wevu 概览

wevu 想把熟悉的 Vue 3 体验带进微信小程序：你照常用 `ref`、`reactive`、`computed`、`watch` 写逻辑，模板/样式/配置仍保持小程序原生写法，不引入 Virtual DOM，也不强迫你重构老项目。它是纯运行时，压缩后大约 30 KB，跑在基础库 ≥ 3.0.0 的环境即可。

## 诞生的小故事

- 最初的名字想叫 “wevue”（weapp + vue），但 npm 已被占用，于是缩成 **wevu**。
- 为 weapp-vite 补齐 Vue SFC 支持时，编译链准备好了，却缺一个能落地到小程序的运行时。尝试嫁接社区的 `vue-mini`，发现编译器和运行时都要大改，而且它依赖 `@vue/reactivity`，灵活度不够。
- 于是借鉴 Vue 3.6 讨论的 `alien-signals` 思路，自研零依赖运行时，把多小程序平台适配也一并考虑，最终成型的就是现在的 wevu。

## 提供什么

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
