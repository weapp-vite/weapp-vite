---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复微信状态保持 HMR 更新静态资源时，普通构建脚本覆盖 DevEngine 组件入口，导致 app.vue 更新后页面布局消失的问题。静态快照仅更新资源，保留脚本入口的 HMR 注册上下文。
