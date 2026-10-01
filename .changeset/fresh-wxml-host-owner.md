---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复开发模式下 WXML 转换外部依赖没有模块图节点时变更被忽略的问题，统一由 Vite 宿主驱动重建，并保持依赖删除报错、恢复及独立分包失效行为。
