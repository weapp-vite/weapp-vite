# wevu 概览

wevu 是一个基于 Vue 3 响应式与组合式 API 的小程序运行时库：

- 轻量纯运行时：仅增强小程序 JS 逻辑层，不依赖编译步骤，也不引入 Virtual DOM。
- 与原生协同：模板/样式/配置维持小程序原生写法，可与原生选项式语法混用，便于渐进式接入与旧项目改造。
- 组合式 API：把 Vue 3 的 Composition API 能力（ref/reactive/computed/watch 等）带入小程序，改善代码组织、逻辑复用与 TypeScript 体验。
- 平台与要求：当前专注微信小程序，运行环境需原生 ES6 支持；建议基础库版本 ≥ 3.0.0。

建议阅读顺序

- 快速上手：quick-start.md
- 核心 API：app.md、page.md、component.md、page-component.md
- 依赖注入与状态管理：provide-inject.md、pinia.md
- 兼容性/性能/对比：compatibility.md、performance.md、comparisons.md
