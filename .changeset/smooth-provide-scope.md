---
"wevu": patch
"@weapp-core/constants": patch
"create-weapp-vite": patch
---

修复 wevu provide/inject 在小程序运行时只能依赖 app 级 provide 的问题，对齐 Vue 3 的 app、layout、page、组件祖先链注入语义，并补充深层组件注入覆盖。
