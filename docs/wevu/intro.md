# wevu 概览

wevu 想把熟悉的 Vue 3 体验带进微信小程序：你照常用 `ref`、`reactive`、`computed`、`watch` 写业务逻辑，模板/样式/配置仍沿用小程序原生写法，不引入 Virtual DOM，也不强迫你重构老项目。它是纯运行时，压缩后大约 30 KB，在基础库 ≥ 3.0.0 的环境里就能跑。

## 诞生的小故事

本来想叫 “wevue”（weapp + vue），但 npm 已有人注册，只好缩成 **wevu**。当时要给 weapp-vite 补齐 Vue SFC 支持，编译链有了，却缺一个能落地到小程序的运行时。我试过嫁接社区的 `vue-mini`，但编译器和运行时都得大改，而且它依赖 `@vue/reactivity`，灵活度不够。索性借鉴 Vue 3.6 里讨论的 `alien-signals` 思路，做了个零依赖的纯运行时，把多小程序平台的适配也一起考虑，最终就成了现在的 wevu。

## 怎么读

- 先看 `quick-start.md` 起手。
- 核心 API：`app.md`、`page.md`、`component.md`、`page-component.md`。
- 依赖注入与状态管理：`provide-inject.md`、`store.md`。
- 兼容性/性能/对比：`compatibility.md`、`performance.md`、`comparisons.md`。
- 与 weapp-vite 的结合：`weapp-vite.md`。
