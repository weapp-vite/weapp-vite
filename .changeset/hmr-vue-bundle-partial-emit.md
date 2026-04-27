---
"weapp-vite": patch
"create-weapp-vite": patch
---

优化 Vue SFC 开发态 HMR 的 bundle 产物生成：局部入口更新时只重新发射本轮实际 emit 的 Vue 页面/组件资产，避免历史编译缓存中的其它页面在 `generateBundle` 阶段被重复处理，从而降低 Vue 模板热更新时间。
