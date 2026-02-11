---
"@wevu/compiler": patch
"wevu": patch
"create-weapp-vite": patch
---

fix: 默认支持在小程序运行时通过 `useAttrs()` 收集未声明 props，并修复对象字面量组件绑定在 WXML 中的兼容性。
