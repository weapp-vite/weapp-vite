---
"@wevu/compiler": patch
"weapp-vite": patch
"create-weapp-vite": patch
---

修复隐式默认插槽直接投影 Vue 组件时的 `provide()` / `inject()` 作用域兼容问题。该场景会生成增强 scoped slot 组件，让 slot 内容实例挂载到 slot 宿主组件的运行时父链下；具名插槽、显式默认插槽、原生元素包裹的默认内容，以及 TDesign 这类 kebab-case 小程序组件的默认插槽仍保持原生 slot 输出。微信产物会为内部 scoped slot generic 补默认空组件，避免真实 IDE 报出 `wx-scoped-slots-*` 未实例化 warning。
