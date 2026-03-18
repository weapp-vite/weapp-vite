---
"weapp-vite": minor
"wevu": minor
"@wevu/compiler": minor
"create-weapp-vite": patch
---

为 `weapp-vite` 新增了接近 Nuxt `app/layouts` 的页面布局能力：支持在 `src/layouts` 目录中约定 `default` 或命名布局，并通过 `definePageMeta({ layout })` 为页面声明使用的布局，同时支持 `layout: false` 显式关闭默认布局。编译阶段会自动包裹页面模板、注入布局组件的 `usingComponents` 配置，并提供对应的宏类型声明。
