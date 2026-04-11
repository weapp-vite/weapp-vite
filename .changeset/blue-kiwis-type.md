---
'create-weapp-vite': patch
'weapp-vite': patch
---

修复自动生成的 `components.d.ts` 在为带源码跳转的原生组件补充类型时，没有把小程序通用基础属性稳定合并进最终组件 props 的问题。现在这类组件在 Vue 模板中也能正确接受 `class`、`style`、`id` 等基础属性，避免像 `<Tabbar class="text-red" />` 这样的写法被误报类型错误。
