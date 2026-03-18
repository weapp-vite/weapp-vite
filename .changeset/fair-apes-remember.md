---
"weapp-vite": minor
"wevu": minor
"@wevu/compiler": minor
"create-weapp-vite": patch
---

为 `weapp-vite` 新增了接近 Nuxt `app/layouts` 的页面布局能力：支持在 `src/layouts` 目录中约定 `default` 或命名布局，并通过 `definePageMeta({ layout })` 为页面声明使用的布局，同时支持 `layout: false` 显式关闭默认布局。布局组件既可以使用 Vue SFC，也可以使用原生小程序组件；编译阶段会自动包裹页面模板、注入布局组件的 `usingComponents` 配置，并让页面内容通过布局内的 `<slot></slot>` 渲染，同时提供对应的宏类型声明。

此外，`definePageMeta` 现已支持对象写法的布局配置，例如 `layout: { name: 'panel', props: { sidebar: true, title: 'Dashboard' } }`。当前会将静态字面量 `props` 编译为布局标签属性，并同时覆盖 Vue 布局与原生小程序布局场景。
