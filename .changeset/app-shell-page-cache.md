---
"weapp-vite": patch
"create-weapp-vite": patch
---

fix: 修复开发模式增删 app.vue 应用壳模板时，未修改的页面复用旧编译缓存，导致页面包装和组件引用未同步更新的问题。
