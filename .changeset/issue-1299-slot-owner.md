---
"@weapp-core/constants": patch
"@wevu/compiler": patch
"weapp-vite": patch
"create-weapp-vite": patch
---

fix(weapp-vite): 修复启用原生插槽上下文时，应用外壳和无脚本 Vue 布局的模板事件缺少对应组件处理方法的问题，并补齐 owner 所需运行时能力及构建重建支持。
