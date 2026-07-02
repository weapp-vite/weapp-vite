---
"weapp-vite": patch
"create-weapp-vite": patch
---

在自动导入没有待完成组件注册时跳过入口加载阶段的异步等待，减少 HMR 和构建中页面/组件入口加载的固定开销。
