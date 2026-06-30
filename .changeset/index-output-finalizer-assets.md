---
"weapp-vite": patch
"create-weapp-vite": patch
---

优化 output finalizer 的 asset 后处理流程，在插件入口一次性分类样式与模板资源，减少 HMR 和构建尾段对完整 bundle 的重复遍历。
